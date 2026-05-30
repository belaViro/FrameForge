from __future__ import annotations

import argparse
import base64
import os
import re
from pathlib import Path
from typing import Any

from openai import OpenAI


ROOT = Path(__file__).resolve().parent
COVER_DIR = ROOT / "封面"

DEFAULT_TITLE = "什么是 AI 智能体？"
DEFAULT_SUBTITLE = "从回答问题到推进任务"
DEFAULT_OUTPUT = "AI智能体科普_什么是AI智能体_竖版封面.png"


def slugify(value: str) -> str:
    value = re.sub(r"[\\/:*?\"<>|]+", "", value).strip()
    return value or "cover"


def build_prompt(title: str, subtitle: str) -> str:
    return f"""生成一张竖向 9:16 视频封面，主题是“{title}”。

画面风格：简明扼要的手绘白板科普信息图，完整白色背景，马克笔线条，粗黑/深蓝描边，少量蓝色、绿色、橙色强调色。

构图要求：
- 顶部大号清晰中文标题“{title}”。
- 中间只放一个可爱但简洁的 AI 机器人/小助手。
- 左侧小气泡写“会聊天”。
- 右侧工具箱和任务清单写“会干活”。
- 中间用一条箭头表达“从聊天到执行”。
- 底部放一句副标题“{subtitle}”。

视觉要求：
- 适合视频号/抖音竖向封面，一眼能看懂。
- 中文文字必须大、清晰、可读。
- 信息少，留白充足，重点突出。
- 不要黑边，不要字幕条，不要复杂小字，不要水印，不要 logo。
- 不要写实 3D，不要商务 PPT 风，不要摄影感。"""


def find_image_base64(response: Any) -> str:
    for item in getattr(response, "output", []) or []:
        for content in getattr(item, "content", []) or []:
            image_base64 = getattr(content, "image_base64", None)
            if image_base64:
                return image_base64
    data = response.model_dump() if hasattr(response, "model_dump") else response
    stack = [data]
    while stack:
        current = stack.pop()
        if isinstance(current, dict):
            for key, value in current.items():
                if key in {"image_base64", "b64_json"} and isinstance(value, str):
                    return value
                stack.append(value)
        elif isinstance(current, list):
            stack.extend(current)
    raise RuntimeError("No base64 image found in API response.")


def generate_cover(
    prompt: str,
    output_path: Path,
    model: str,
    size: str,
    base_url: str | None,
) -> None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set.")

    client = OpenAI(api_key=api_key, base_url=base_url or os.environ.get("OPENAI_BASE_URL"))
    response = client.responses.create(
        model=model,
        input=prompt,
        tools=[
            {
                "type": "image_generation",
                "size": size,
            }
        ],
    )
    image_base64 = find_image_base64(response)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(base64.b64decode(image_base64))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a reusable vertical cover image for explainer videos.")
    parser.add_argument("--title", default=DEFAULT_TITLE)
    parser.add_argument("--subtitle", default=DEFAULT_SUBTITLE)
    parser.add_argument("--out", default=str(COVER_DIR / DEFAULT_OUTPUT))
    parser.add_argument("--model", default=os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2"))
    parser.add_argument("--size", default="1024x1536")
    parser.add_argument("--base-url", default=os.environ.get("OPENAI_BASE_URL"))
    parser.add_argument("--prompt-only", action="store_true", help="Only write the prompt file, do not call the API.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_path = Path(args.out)
    if not output_path.is_absolute():
        output_path = ROOT / output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)

    prompt = build_prompt(args.title, args.subtitle)
    prompt_path = output_path.with_suffix(".prompt.txt")
    prompt_path.write_text(prompt, encoding="utf-8")

    if args.prompt_only:
        print(f"prompt: {prompt_path}")
        return

    generate_cover(
        prompt=prompt,
        output_path=output_path,
        model=args.model,
        size=args.size,
        base_url=args.base_url,
    )
    print(f"cover: {output_path}")
    print(f"prompt: {prompt_path}")


if __name__ == "__main__":
    main()
