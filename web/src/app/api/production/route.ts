import { prisma } from "@/lib/prisma";
import { WORKER_URL } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const tasks = await prisma.buildTask.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { episode: true },
  });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const episodeId = body.episodeId;

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      scenes: { orderBy: { order: "asc" } },
      ttsConfig: true,
      videoConfig: true,
    },
  });

  if (!episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  if (episode.scenes.length === 0) {
    return NextResponse.json({ error: "No scenes configured" }, { status: 400 });
  }

  // Prevent concurrent builds for the same episode
  const activeBuild = await prisma.buildTask.findFirst({
    where: {
      episodeId,
      status: { in: ["queued", "running"] },
    },
  });
  if (activeBuild) {
    return NextResponse.json(
      { error: "该集已有构建任务正在进行中，请等待完成后再试" },
      { status: 409 }
    );
  }

  if (!episode.imageDir) {
    return NextResponse.json(
      { error: "该集尚未设置图片目录，请先生成图片" },
      { status: 400 }
    );
  }

  // Check all scenes have images
  const missingImages = episode.scenes.filter((s) => !s.image);
  if (missingImages.length > 0) {
    return NextResponse.json(
      { error: `有 ${missingImages.length} 个场景缺少图片，请先生成图片` },
      { status: 400 }
    );
  }

  const task = await prisma.buildTask.create({
    data: { episodeId, status: "queued" },
  });

  // Read global settings as fallback for TTS/video config
  let globalSettings: Record<string, unknown> = {};
  try {
    const raw = await readFile(path.resolve(process.cwd(), "data", "settings.json"), "utf-8");
    globalSettings = JSON.parse(raw);
  } catch { /* no settings file, use defaults */ }

  const tts = episode.ttsConfig || {
    voice: (globalSettings.tts_voice as string) || "zh-CN-YunxiNeural",
    rate: (globalSettings.tts_rate as string) || "-8%",
    pitch: (globalSettings.tts_pitch as string) || "-3Hz",
    volume: (globalSettings.tts_volume as string) || "+0%",
  };
  const video = episode.videoConfig || { width: 1920, height: 1080, fps: 30, silenceDuration: 0.28, zoomEnd: 1.035, burnSubtitles: true, subtitleFont: "Microsoft YaHei", subtitleFontSize: 46 };

  const config = {
    title: episode.title,
    image_dir: path.resolve(process.cwd(), "storage", "images", episode.imageDir),
    build_dir: path.resolve(process.cwd(), "storage", "builds", `ep${episode.number}`),
    out_dir: path.resolve(process.cwd(), "storage", "output"),
    output_name: episode.outputName || `EP${String(episode.number).padStart(2, "0")}_${episode.title}.mp4`,
    video: {
      width: video.width,
      height: video.height,
      fps: video.fps,
      silence_duration: (video as Record<string, unknown>).silenceDuration ?? 0.28,
      zoom_end: (video as Record<string, unknown>).zoomEnd ?? 1.035,
    },
    tts: {
      voice: tts.voice,
      rate: tts.rate,
      pitch: tts.pitch,
      volume: tts.volume,
    },
    subtitles: {
      burn: (video as Record<string, unknown>).burnSubtitles ?? true,
      font: (video as Record<string, unknown>).subtitleFont ?? "Microsoft YaHei",
      font_size: (video as Record<string, unknown>).subtitleFontSize ?? 46,
    },
    scenes: episode.scenes.map((s) => ({
      image: s.image,
      narration: s.narration,
      subtitle: s.subtitle,
    })),
  };

  try {
    const workerRes = await fetch(`${WORKER_URL}/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config, task_id: task.id }),
    });

    if (!workerRes.ok) {
      const err = await workerRes.text();
      await prisma.buildTask.update({
        where: { id: task.id },
        data: { status: "failed", error: err },
      });
      return NextResponse.json({ error: err }, { status: 500 });
    }

    await prisma.buildTask.update({
      where: { id: task.id },
      data: { status: "running", startedAt: new Date() },
    });

    return NextResponse.json({ taskId: task.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Worker unreachable";
    await prisma.buildTask.update({
      where: { id: task.id },
      data: { status: "failed", error: msg },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
