from __future__ import annotations

import argparse
import asyncio
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import edge_tts
import imageio_ffmpeg
from PIL import Image


@dataclass(frozen=True)
class Scene:
    image: str
    narration: str
    subtitle: str = ""


@dataclass(frozen=True)
class Workflow:
    root: Path
    title: str
    image_dir: Path
    build_dir: Path
    out_dir: Path
    output_name: str
    width: int
    height: int
    fps: int
    voice: str
    rate: str
    pitch: str
    volume: str
    silence_duration: float
    zoom_end: float
    burn_subtitles: bool
    subtitle_font: str
    subtitle_font_size: int
    scenes: list[Scene]


def resolve_path(root: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else root / path


def load_workflow(config_path: Path) -> Workflow:
    config_path = config_path.resolve()
    data = json.loads(config_path.read_text(encoding="utf-8"))
    root = config_path.parent
    video = data.get("video", {})
    tts = data.get("tts", {})
    subtitles = data.get("subtitles", {})

    scenes = [
        Scene(
            image=item["image"],
            narration=item["narration"],
            subtitle=item.get("subtitle", ""),
        )
        for item in data["scenes"]
    ]

    return Workflow(
        root=root,
        title=data.get("title", config_path.stem),
        image_dir=resolve_path(root, data["image_dir"]),
        build_dir=resolve_path(root, data.get("build_dir", f"build_{config_path.stem}")),
        out_dir=resolve_path(root, data.get("out_dir", "out")),
        output_name=data.get("output_name", f"{config_path.stem}.mp4"),
        width=int(video.get("width", 1920)),
        height=int(video.get("height", 1080)),
        fps=int(video.get("fps", 30)),
        voice=tts.get("voice", "zh-CN-YunxiNeural"),
        rate=tts.get("rate", "-8%"),
        pitch=tts.get("pitch", "-3Hz"),
        volume=tts.get("volume", "+0%"),
        silence_duration=float(video.get("silence_duration", 0.28)),
        zoom_end=float(video.get("zoom_end", 1.035)),
        burn_subtitles=bool(subtitles.get("burn", True)),
        subtitle_font=subtitles.get("font", "Microsoft YaHei"),
        subtitle_font_size=int(subtitles.get("font_size", 46)),
        scenes=scenes,
    )


def run(cmd: list[str]) -> None:
    print(" ".join(str(x) for x in cmd))
    subprocess.run(cmd, check=True)


async def run_async(cmd: list[str], cwd: Path | None = None, timeout: float = 300) -> None:
    print(" ".join(str(x) for x in cmd))
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(cwd) if cwd else None,
    )
    try:
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise RuntimeError(f"FFmpeg 超时 ({timeout}s): {' '.join(str(x) for x in cmd[:6])}")
    if proc.returncode != 0:
        err_text = stderr.decode("utf-8", errors="ignore")[-500:]
        raise subprocess.CalledProcessError(
            proc.returncode, cmd, output=b"", stderr=f"FFmpeg error: {err_text}".encode()
        )


def ffmpeg() -> str:
    return imageio_ffmpeg.get_ffmpeg_exe()


def naturalize_text(text: str) -> str:
    text = text.strip()
    text = re.sub(r"([。！？])", r"\1\n", text)
    return re.sub(r"\n+", "\n", text)


async def synth_scene(workflow: Workflow, scene: Scene, out_path: Path) -> None:
    communicate = edge_tts.Communicate(
        text=naturalize_text(scene.narration),
        voice=workflow.voice,
        rate=workflow.rate,
        pitch=workflow.pitch,
        volume=workflow.volume,
    )
    try:
        await communicate.save(str(out_path))
    except Exception as e:
        raise RuntimeError(
            f"TTS 合成失败 (场景: {scene.subtitle or scene.image}): {e}"
        ) from e


async def synth_all(workflow: Workflow, rebuild_tts: bool = False) -> None:
    audio_dir = workflow.build_dir / "audio_segments"
    audio_dir.mkdir(parents=True, exist_ok=True)
    for index, scene in enumerate(workflow.scenes, start=1):
        out = audio_dir / f"{index:02d}.mp3"
        if not rebuild_tts and out.exists() and out.stat().st_size > 1000:
            print(f"skip tts {out.name}")
            continue
        print(f"tts {index:02d}: {scene.subtitle or scene.image}")
        await synth_scene(workflow, scene, out)


async def media_duration(path: Path) -> float:
    proc = await asyncio.create_subprocess_exec(
        ffmpeg(), "-hide_banner", "-i", str(path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    text = stderr.decode("utf-8", errors="ignore")
    match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", text)
    if not match:
        raise RuntimeError(f"Cannot read duration for {path}:\n{text}")
    h, m, s = match.groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


async def make_silence(path: Path, duration: float) -> None:
    await run_async(
        [
            ffmpeg(),
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=24000:cl=mono",
            "-t",
            f"{duration:.3f}",
            "-q:a",
            "9",
            "-acodec",
            "libmp3lame",
            str(path),
        ]
    )


async def concat_audio(workflow: Workflow) -> tuple[Path, list[float]]:
    audio_dir = workflow.build_dir / "audio_segments"
    final_audio = workflow.build_dir / "narration.mp3"
    silence = workflow.build_dir / "pause.mp3"
    await make_silence(silence, workflow.silence_duration)

    durations: list[float] = []
    concat_items: list[Path] = []
    for index in range(1, len(workflow.scenes) + 1):
        item = audio_dir / f"{index:02d}.mp3"
        if not item.exists() or item.stat().st_size < 100:
            raise FileNotFoundError(f"音频片段缺失或损坏: {item.name} (场景 {index})")
        durations.append(await media_duration(item) + workflow.silence_duration)
        concat_items.extend([item, silence])

    list_file = workflow.build_dir / "audio_concat.txt"
    with list_file.open("w", encoding="utf-8") as f:
        for item in concat_items:
            rel = item.relative_to(workflow.build_dir)
            f.write(f"file '{rel.as_posix()}'\n")

    await run_async(
        [
            ffmpeg(),
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_file),
            "-c:a",
            "libmp3lame",
            "-b:a",
            "128k",
            str(final_audio),
        ],
        cwd=workflow.build_dir,
    )
    return final_audio, durations


def contain_image(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    iw, ih = img.size
    scale = min(target_w / iw, target_h / ih)
    nw, nh = int(iw * scale), int(ih * scale)
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (target_w, target_h), (255, 255, 255))
    canvas.paste(resized, ((target_w - nw) // 2, (target_h - nh) // 2))
    return canvas


async def render_video(workflow: Workflow, scene_durations: list[float]) -> Path:
    silent_video = workflow.build_dir / "video_silent.mp4"
    still_dir = workflow.build_dir / "scene_stills"
    segment_dir = workflow.build_dir / "video_segments"
    still_dir.mkdir(parents=True, exist_ok=True)
    segment_dir.mkdir(parents=True, exist_ok=True)

    segment_paths: list[Path] = []
    for index, (scene, duration) in enumerate(zip(workflow.scenes, scene_durations), start=1):
        still = still_dir / f"{index:02d}.png"
        segment = segment_dir / f"{index:02d}.mp4"
        frame_count = max(1, int(round(duration * workflow.fps)))

        with Image.open(workflow.image_dir / scene.image).convert("RGB") as src:
            contain_image(src, workflow.width, workflow.height).save(still)

        zoom_delta = max(workflow.zoom_end - 1.0, 0.0)
        zoom = f"1+{zoom_delta:.6f}*on/{max(frame_count - 1, 1)}"
        await run_async(
            [
                ffmpeg(),
                "-y",
                "-loop",
                "1",
                "-i",
                str(still),
                "-vf",
                (
                    f"zoompan=z='{zoom}':x='iw/2-(iw/zoom/2)':"
                    f"y='ih/2-(ih/zoom/2)':d={frame_count}:"
                    f"s={workflow.width}x{workflow.height}:fps={workflow.fps},format=yuv420p"
                ),
                "-frames:v",
                str(frame_count),
                "-an",
                "-vcodec",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-preset",
                "veryfast",
                "-crf",
                "20",
                str(segment),
            ]
        )
        segment_paths.append(segment)

    list_file = workflow.build_dir / "video_concat.txt"
    with list_file.open("w", encoding="utf-8") as f:
        for segment in segment_paths:
            rel = segment.relative_to(workflow.build_dir)
            f.write(f"file '{rel.as_posix()}'\n")

    await run_async([ffmpeg(), "-y", "-f", "concat", "-safe", "0", "-i", str(list_file), "-c", "copy", str(silent_video)], cwd=workflow.build_dir)
    return silent_video


def split_subtitle_units(text: str, max_chars: int = 24) -> list[str]:
    parts = [p.strip() for p in re.split(r"(?<=[。！？])", text.strip()) if p.strip()]
    units: list[str] = []
    for part in parts:
        if len(part) <= max_chars:
            units.append(part)
            continue
        line = ""
        for chunk in [c for c in re.split(r"(?<=[，；、])", part) if c]:
            if len(line + chunk) <= max_chars:
                line += chunk
                continue
            if line:
                units.append(line.strip())
            line = chunk
            while len(line) > max_chars:
                units.append(line[:max_chars].strip())
                line = line[max_chars:]
        if line:
            units.append(line.strip())
    return units


def ass_time(seconds: float) -> str:
    seconds = max(seconds, 0.0)
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int(round((seconds - int(seconds)) * 100))
    if cs == 100:
        s += 1
        cs = 0
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def ass_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", r"\{").replace("}", r"\}")


def write_subtitles(workflow: Workflow, scene_durations: list[float]) -> Path:
    subtitle_file = workflow.build_dir / "subtitles.ass"
    events: list[tuple[float, float, str]] = []
    cursor = 0.0
    for scene, duration in zip(workflow.scenes, scene_durations):
        units = split_subtitle_units(scene.narration)
        weights = [max(len(unit), 8) for unit in units]
        total_weight = sum(weights) or 1
        scene_cursor = cursor
        for unit, weight in zip(units, weights):
            unit_duration = duration * weight / total_weight
            start = scene_cursor + 0.05
            end = min(scene_cursor + unit_duration - 0.05, cursor + duration - 0.05)
            if end > start:
                events.append((start, end, unit))
            scene_cursor += unit_duration
        cursor += duration

    with subtitle_file.open("w", encoding="utf-8-sig") as f:
        f.write("[Script Info]\n")
        f.write("ScriptType: v4.00+\n")
        f.write(f"PlayResX: {workflow.width}\n")
        f.write(f"PlayResY: {workflow.height}\n")
        f.write("WrapStyle: 0\n")
        f.write("ScaledBorderAndShadow: yes\n\n")
        f.write("[V4+ Styles]\n")
        f.write(
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
            "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
            "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
            "Alignment, MarginL, MarginR, MarginV, Encoding\n"
        )
        f.write(
            f"Style: Default,{workflow.subtitle_font},{workflow.subtitle_font_size},"
            "&H00FFFFFF,&H00FFFFFF,&H9A000000,&H00000000,-1,0,0,0,"
            "100,100,0,0,1,3,1,2,120,120,46,1\n\n"
        )
        f.write("[Events]\n")
        f.write("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
        for start, end, text in events:
            f.write(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Default,,0,0,0,,{ass_escape(text)}\n")
    return subtitle_file


async def mux(workflow: Workflow, video: Path, audio: Path, subtitles: Path | None) -> Path:
    workflow.out_dir.mkdir(parents=True, exist_ok=True)
    out = workflow.out_dir / workflow.output_name
    if subtitles is not None:
        # Two-pass: first mux video+audio, then burn subtitles separately
        # This avoids all path escaping issues with the ass/subtitles filter
        tmp_muxed = workflow.build_dir / "muxed_no_sub.mp4"
        await run_async([
            ffmpeg(), "-y", "-i", str(video), "-i", str(audio),
            "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", str(tmp_muxed),
        ])
        # Burn subtitles using the subtitles filter with cwd set to subtitle directory
        await run_async([
            ffmpeg(), "-y", "-i", str(tmp_muxed),
            "-vf", f"ass={subtitles.name}",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20",
            "-c:a", "copy", str(out),
        ], cwd=subtitles.parent)
    else:
        await run_async([
            ffmpeg(), "-y", "-i", str(video), "-i", str(audio),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20",
            "-c:a", "aac", "-b:a", "160k", "-shortest", str(out),
        ])
    return out


def validate(workflow: Workflow) -> None:
    missing = [scene.image for scene in workflow.scenes if not (workflow.image_dir / scene.image).exists()]
    if missing:
        raise FileNotFoundError(f"Missing images: {missing}")
    if workflow.width < workflow.height:
        print("warning: output is vertical; use this only when source images are designed for vertical video")


def build(workflow: Workflow, rebuild_tts: bool = False, no_subtitles: bool = False, dry_run: bool = False) -> None:
    validate(workflow)
    workflow.build_dir.mkdir(parents=True, exist_ok=True)
    workflow.out_dir.mkdir(parents=True, exist_ok=True)
    print(f"title: {workflow.title}")
    print(f"scenes: {len(workflow.scenes)}")
    print(f"output: {workflow.out_dir / workflow.output_name}")
    if dry_run:
        return

    asyncio.run(_build_async(workflow, rebuild_tts, no_subtitles))


async def _build_async(workflow: Workflow, rebuild_tts: bool = False, no_subtitles: bool = False) -> None:
    await synth_all(workflow, rebuild_tts=rebuild_tts)
    audio, durations = await concat_audio(workflow)
    print(f"audio duration: {await media_duration(audio):.2f}s")
    subtitles = None if no_subtitles or not workflow.burn_subtitles else write_subtitles(workflow, durations)
    silent = await render_video(workflow, durations)
    out = await mux(workflow, silent, audio, subtitles)
    print(f"done: {out}")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a hand-drawn infographic explainer video workflow.")
    parser.add_argument("--config", default="workflow_config_ai_agent.json", help="JSON workflow config path.")
    parser.add_argument("--rebuild-tts", action="store_true", help="Regenerate all TTS audio segments.")
    parser.add_argument("--no-subtitles", action="store_true", help="Do not burn subtitles into the final video.")
    parser.add_argument("--dry-run", action="store_true", help="Validate config and assets without generating video.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    workflow = load_workflow(Path(args.config))
    build(workflow, rebuild_tts=args.rebuild_tts, no_subtitles=args.no_subtitles, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
