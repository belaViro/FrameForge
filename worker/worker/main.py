from __future__ import annotations

import asyncio
import json
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from make_explainer_video import Workflow, load_workflow, validate, build  # noqa: E402

app = FastAPI(title="Video Production Worker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

tasks: dict[str, dict[str, Any]] = {}


class BuildRequest(BaseModel):
    config: dict[str, Any]
    task_id: str | None = None


class TtsPreviewRequest(BaseModel):
    text: str
    voice: str = "zh-CN-YunxiNeural"
    rate: str = "-8%"
    pitch: str = "-3Hz"
    volume: str = "+0%"


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/build")
async def start_build(req: BuildRequest):
    task_id = req.task_id or str(uuid.uuid4())
    tasks[task_id] = {
        "status": "queued",
        "progress": 0.0,
        "stage": "",
        "log": "",
        "error": "",
        "output_path": "",
    }
    asyncio.create_task(_run_build(task_id, req.config))
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


@app.post("/tts/preview")
async def tts_preview(req: TtsPreviewRequest):
    import edge_tts

    communicate = edge_tts.Communicate(
        text=req.text,
        voice=req.voice,
        rate=req.rate,
        pitch=req.pitch,
        volume=req.volume,
    )
    tmp = Path(tempfile.mktemp(suffix=".mp3"))
    await communicate.save(str(tmp))
    from fastapi.responses import FileResponse
    return FileResponse(str(tmp), media_type="audio/mpeg", filename="preview.mp3")


async def _run_build(task_id: str, config: dict[str, Any]) -> None:
    task = tasks[task_id]
    task["status"] = "running"

    try:
        tmp_config = Path(tempfile.mktemp(suffix=".json"))
        tmp_config.write_text(json.dumps(config, ensure_ascii=False), encoding="utf-8")

        workflow = load_workflow(tmp_config)
        validate(workflow)

        task["stage"] = "tts"
        task["progress"] = 0.1
        from make_explainer_video import synth_all, concat_audio, render_video, write_subtitles, mux
        await synth_all(workflow)
        task["progress"] = 0.3

        task["stage"] = "concat_audio"
        audio, durations = concat_audio(workflow)
        task["progress"] = 0.4

        task["stage"] = "subtitles"
        subtitles = write_subtitles(workflow, durations) if workflow.burn_subtitles else None
        task["progress"] = 0.5

        task["stage"] = "render_video"
        silent = render_video(workflow, durations)
        task["progress"] = 0.8

        task["stage"] = "mux"
        out = mux(workflow, silent, audio, subtitles)
        task["progress"] = 1.0

        task["status"] = "completed"
        task["stage"] = "done"
        task["output_path"] = str(out)

        tmp_config.unlink(missing_ok=True)

    except Exception as e:
        task["status"] = "failed"
        task["error"] = str(e)
