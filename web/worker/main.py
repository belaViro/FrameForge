from __future__ import annotations

import asyncio
import json
import os
import tempfile
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from pipeline import Workflow, load_workflow, validate, build
from pipeline import synth_all, concat_audio, render_video, write_subtitles, mux

app = FastAPI(title="Video Production Worker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TASKS_FILE = PROJECT_ROOT / "data" / "worker_tasks.json"
MAX_CONCURRENT_BUILDS = 2

tasks: dict[str, dict[str, Any]] = {}
_running_tasks: dict[str, asyncio.Task] = {}
_build_semaphore = asyncio.Semaphore(MAX_CONCURRENT_BUILDS)


def _load_tasks() -> None:
    """Load persisted tasks and mark stale running tasks as failed."""
    global tasks
    if TASKS_FILE.exists():
        try:
            tasks = json.loads(TASKS_FILE.read_text(encoding="utf-8"))
            for tid, t in tasks.items():
                if t["status"] in ("queued", "running"):
                    t["status"] = "failed"
                    t["error"] = "Worker 重启，任务中断"
        except (json.JSONDecodeError, KeyError):
            tasks = {}


def _save_tasks() -> None:
    """Persist task state to disk."""
    TASKS_FILE.parent.mkdir(parents=True, exist_ok=True)
    TASKS_FILE.write_text(
        json.dumps(tasks, ensure_ascii=False, default=str),
        encoding="utf-8",
    )


_load_tasks()


class BuildRequest(BaseModel):
    config: dict[str, Any]
    task_id: str | None = None


class TtsPreviewRequest(BaseModel):
    text: str
    voice: str = "zh-CN-YunxiNeural"
    rate: str = "-8%"
    pitch: str = "-3Hz"
    volume: str = "+0%"


class GenerateScriptRequest(BaseModel):
    title: str
    hook: str = ""
    analogy: str = ""
    scene_count: int = 8
    base_url: str | None = None
    api_key: str = ""
    model: str = "gpt-4o"


class GenerateStylePromptRequest(BaseModel):
    keyword: str
    base_url: str | None = None
    api_key: str = ""
    model: str = "gpt-4o"


class GenerateImageRequest(BaseModel):
    prompt: str
    output_dir: str
    filename: str
    base_url: str | None = None
    api_key: str = ""
    model: str = "gpt-image-1"
    size: str = "1536x1024"


class TestLlmRequest(BaseModel):
    base_url: str | None = None
    api_key: str = ""
    model: str = "gpt-4o"


class TestImageRequest(BaseModel):
    base_url: str | None = None
    api_key: str = ""
    model: str = "gpt-image-1"


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/build")
async def start_build(req: BuildRequest):
    active_builds = sum(1 for t in tasks.values() if t["status"] in ("queued", "running"))
    if active_builds >= MAX_CONCURRENT_BUILDS:
        raise HTTPException(429, "已达到最大并发构建数，请稍后重试")
    task_id = req.task_id or str(uuid.uuid4())
    tasks[task_id] = {
        "status": "queued",
        "progress": 0.0,
        "stage": "",
        "log": "",
        "error": "",
        "output_path": "",
    }
    _running_tasks[task_id] = asyncio.create_task(_run_build(task_id, req.config))
    _save_tasks()
    return {"task_id": task_id}


@app.get("/build/{task_id}/status")
async def build_status(task_id: str):
    if task_id not in tasks:
        raise HTTPException(404, "Task not found")
    return tasks[task_id]


@app.get("/build/{task_id}/events")
async def build_events(task_id: str):
    if task_id not in tasks:
        raise HTTPException(404, "Task not found")

    async def event_generator():
        last_stage = ""
        last_progress = -1.0
        while True:
            task = tasks.get(task_id)
            if not task:
                break
            if task["stage"] != last_stage or task["progress"] != last_progress:
                last_stage = task["stage"]
                last_progress = task["progress"]
                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "status": task["status"],
                        "stage": task["stage"],
                        "progress": task["progress"],
                        "log": task["log"][-500:] if task["log"] else "",
                    }),
                }
            if task["status"] in ("completed", "failed"):
                yield {
                    "event": "done",
                    "data": json.dumps({
                        "status": task["status"],
                        "output_path": task["output_path"],
                        "error": task["error"],
                    }),
                }
                break
            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())


@app.post("/build/{task_id}/cancel")
async def cancel_build(task_id: str):
    if task_id not in tasks:
        raise HTTPException(404, "Task not found")
    task = tasks[task_id]
    if task["status"] not in ("queued", "running"):
        return {"message": "Task already finished"}
    running = _running_tasks.get(task_id)
    if running and not running.done():
        running.cancel()
    task["status"] = "failed"
    task["error"] = "用户取消"
    _running_tasks.pop(task_id, None)
    _save_tasks()
    return {"message": "Task cancelled"}


@app.post("/tts/preview")
async def tts_preview(req: TtsPreviewRequest):
    import edge_tts
    from fastapi.responses import FileResponse
    from starlette.background import BackgroundTask

    communicate = edge_tts.Communicate(
        text=req.text,
        voice=req.voice,
        rate=req.rate,
        pitch=req.pitch,
        volume=req.volume,
    )
    tmp = Path(tempfile.NamedTemporaryFile(suffix=".mp3", delete=False).name)
    try:
        await communicate.save(str(tmp))
    except Exception as e:
        tmp.unlink(missing_ok=True)
        raise HTTPException(500, f"TTS 合成失败: {str(e)[:200]}")
    return FileResponse(
        str(tmp),
        media_type="audio/mpeg",
        filename="preview.mp3",
        background=BackgroundTask(lambda: tmp.unlink(missing_ok=True)),
    )


async def _run_build(task_id: str, config: dict[str, Any]) -> None:
    task = tasks[task_id]
    task["status"] = "running"

    async with _build_semaphore:
        try:
            fd, tmp_path = tempfile.mkstemp(suffix=".json")
            os.close(fd)
            tmp_config = Path(tmp_path)
            tmp_config.write_text(json.dumps(config, ensure_ascii=False), encoding="utf-8")

            workflow = load_workflow(tmp_config)
            validate(workflow)

            task["stage"] = "tts"
            task["progress"] = 0.1
            await synth_all(workflow)
            task["progress"] = 0.3

            task["stage"] = "concat_audio"
            audio, durations = await concat_audio(workflow)
            task["progress"] = 0.4

            task["stage"] = "subtitles"
            subtitles = write_subtitles(workflow, durations) if workflow.burn_subtitles else None
            task["progress"] = 0.5

            task["stage"] = "render_video"
            silent = await render_video(workflow, durations)
            task["progress"] = 0.8

            task["stage"] = "mux"
            out = await mux(workflow, silent, audio, subtitles)
            task["progress"] = 1.0

            task["status"] = "completed"
            task["stage"] = "done"
            task["output_path"] = str(out)

            tmp_config.unlink(missing_ok=True)

        except asyncio.CancelledError:
            task["status"] = "failed"
            task["error"] = "用户取消"
        except Exception as e:
            task["status"] = "failed"
            task["error"] = str(e)
        finally:
            _running_tasks.pop(task_id, None)
            _save_tasks()


@app.post("/generate/script")
async def generate_script(req: GenerateScriptRequest):
    from openai import OpenAI

    if not req.api_key:
        raise HTTPException(400, "API key is required")

    base_url = req.base_url or None
    if base_url and not base_url.rstrip("/").endswith("/v1"):
        base_url = base_url.rstrip("/") + "/v1"

    client = OpenAI(api_key=req.api_key, base_url=base_url)

    system_prompt = """你是一个短视频科普脚本编剧。用户会给你一个视频主题，你需要生成适合 60 秒科普短视频的分场景脚本。

要求：
1. 输出 JSON 数组，每个元素包含 subtitle（简短场景标题，10字以内）和 narration（该场景的旁白文本，50-100字）
2. 第一个场景是钩子/开场，最后一个场景是总结
3. 语言口语化、通俗易懂，适合普通观众
4. 每个场景的旁白要能独立成段，朗读时长约 5-8 秒
5. 只输出 JSON 数组，不要其他内容"""

    user_prompt = f"主题：{req.title}"
    if req.hook:
        user_prompt += f"\n钩子：{req.hook}"
    if req.analogy:
        user_prompt += f"\n核心类比：{req.analogy}"
    user_prompt += f"\n场景数量：{req.scene_count} 个"

    try:
        response = await asyncio.to_thread(
            client.chat.completions.create,
            model=req.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=4096,
        )
    except Exception as e:
        raise HTTPException(500, f"LLM 调用失败: {str(e)[:300]}")

    content = (response.choices[0].message.content or "").strip()
    if not content:
        raise HTTPException(500, "LLM 返回了空内容，请重试")

    # Check if response was truncated
    finish_reason = response.choices[0].finish_reason
    if finish_reason == "length":
        raise HTTPException(500, "LLM 输出被截断（内容过长），请减少场景数量后重试")

    # Strip markdown code fences if present
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

    try:
        scenes = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(500, f"LLM 返回的内容不是有效 JSON，请重试。原始内容: {content[:200]}")

    if not isinstance(scenes, list) or len(scenes) == 0:
        raise HTTPException(500, f"LLM 返回格式不正确，期望 JSON 数组: {content[:200]}")

    return {"scenes": scenes}


@app.post("/generate/image")
async def generate_image(req: GenerateImageRequest):
    import base64
    from openai import OpenAI

    if not req.api_key:
        raise HTTPException(400, "API key is required")

    base_url = req.base_url or None
    if base_url and not base_url.rstrip("/").endswith("/v1"):
        base_url = base_url.rstrip("/") + "/v1"

    client = OpenAI(api_key=req.api_key, base_url=base_url)

    # Restrict output_dir to project storage
    storage_root = PROJECT_ROOT / "storage" / "images"
    output_dir = (storage_root / req.output_dir).resolve()
    if not str(output_dir).startswith(str(storage_root.resolve())):
        raise HTTPException(403, "output_dir 路径不合法")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / req.filename

    try:
        response = await asyncio.to_thread(
            client.images.generate,
            model=req.model,
            prompt=req.prompt,
            size=req.size,
            n=1,
            response_format="b64_json",
        )
    except Exception as e:
        raise HTTPException(500, f"图像生成 API 调用失败: {str(e)[:300]}")

    if not response.data or not response.data[0].b64_json:
        raise HTTPException(500, "图像 API 返回了空数据，请重试")

    image_data = response.data[0].b64_json
    output_path.write_bytes(base64.b64decode(image_data))

    return {"path": str(output_path), "filename": req.filename}


@app.post("/generate/style-prompt")
async def generate_style_prompt(req: GenerateStylePromptRequest):
    from openai import OpenAI

    if not req.api_key:
        raise HTTPException(400, "API key is required")

    base_url = req.base_url or None
    if base_url and not base_url.rstrip("/").endswith("/v1"):
        base_url = base_url.rstrip("/") + "/v1"

    client = OpenAI(api_key=req.api_key, base_url=base_url)

    system_prompt = """你是一个图片风格提示词专家。用户会给你一个风格关键词或简短描述，你需要生成一段详细的图片生成提示词（prompt），用于指导 AI 图像生成模型生成该风格的科普配图。

要求：
1. 输出一段连贯的中文描述，约 100-200 字
2. 包含：整体风格、背景、配色、线条特征、排版方式、装饰元素、人物/图标风格
3. 适合作为科普短视频配图的风格描述
4. 只输出提示词文本，不要其他内容"""

    try:
        response = await asyncio.to_thread(
            client.chat.completions.create,
            model=req.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"风格关键词：{req.keyword}"},
            ],
            temperature=0.7,
            max_tokens=500,
        )
    except Exception as e:
        raise HTTPException(500, f"LLM 调用失败: {str(e)[:200]}")

    content = (response.choices[0].message.content or "").strip()
    if not content:
        raise HTTPException(500, "LLM 返回了空内容")

    return {"prompt": content}

@app.post("/test/llm")
async def test_llm(req: TestLlmRequest):
    import httpx

    if not req.api_key:
        raise HTTPException(400, "API key is required")

    # Append /v1 if not present, matching generate_script behavior
    base_url = (req.base_url or "https://api.openai.com/v1").rstrip("/")
    if not base_url.endswith("/v1"):
        base_url = base_url + "/v1"
    url = f"{base_url}/chat/completions"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {req.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": req.model,
                    "messages": [{"role": "user", "content": "Hi"}],
                    "max_tokens": 5,
                    "stream": False,
                },
            )
        if resp.status_code == 200:
            data = resp.json()
            content = ""
            try:
                content = data["choices"][0]["message"]["content"]
            except (KeyError, IndexError, TypeError):
                content = str(data)[:60]
            return {"message": f"模型 {req.model} 响应正常 — \"{content.strip()[:50]}\""}
        elif resp.status_code == 401:
            raise HTTPException(500, f"认证失败 (401)，请检查 API Key")
        elif resp.status_code == 404:
            raise HTTPException(500, f"接口不存在 (404)，请检查 Base URL 是否正确（当前: {base_url}）")
        elif resp.status_code == 400:
            body = resp.text[:300]
            if "model" in body.lower() or "not supported" in body.lower():
                raise HTTPException(500, f"连接正常但模型 {req.model} 不可用，请更换模型。API 返回: {body[:150]}")
            raise HTTPException(500, f"API 返回 400: {body[:150]}")
        else:
            body = resp.text[:200]
            raise HTTPException(500, f"API 返回 {resp.status_code}: {body}")
    except httpx.ConnectError:
        raise HTTPException(500, f"无法连接到 {base_url}")
    except httpx.TimeoutException:
        raise HTTPException(500, f"连接超时 ({base_url})")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"连接失败: {str(e)[:200]}")


@app.post("/test/image")
async def test_image(req: TestImageRequest):
    import httpx

    if not req.api_key:
        raise HTTPException(400, "API key is required")

    base_url = (req.base_url or "https://api.openai.com/v1").rstrip("/")
    if not base_url.endswith("/v1"):
        base_url = base_url + "/v1"
    url = f"{base_url}/images/generations"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {req.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": req.model,
                    "prompt": "a white dot on white background",
                    "size": "1024x1024",
                    "n": 1,
                },
            )
        if resp.status_code == 200:
            return {"message": f"图像生成 API 正常，模型 {req.model} 可用"}
        elif resp.status_code == 401:
            raise HTTPException(500, "认证失败 (401)，请检查 API Key")
        elif resp.status_code == 404:
            raise HTTPException(500, f"Images API 不可用 (404)，该服务可能不支持图像生成")
        else:
            body = resp.text[:200]
            if "not supported" in body.lower() or "not available" in body.lower():
                raise HTTPException(500, f"该 API Key/服务不支持图像生成: {body[:150]}")
            raise HTTPException(500, f"API 返回 {resp.status_code}: {body[:150]}")
    except httpx.ConnectError:
        raise HTTPException(500, f"无法连接到 {base_url}")
    except httpx.TimeoutException:
        raise HTTPException(500, f"连接超时 ({base_url})")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"连接失败: {str(e)[:200]}")
