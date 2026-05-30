import { prisma } from "@/lib/prisma";
import { WORKER_URL, PROJECT_ROOT } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

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

  const task = await prisma.buildTask.create({
    data: { episodeId, status: "queued" },
  });

  const tts = episode.ttsConfig || { voice: "zh-CN-YunxiNeural", rate: "-8%", pitch: "-3Hz", volume: "+0%" };
  const video = episode.videoConfig || { width: 1920, height: 1080, fps: 30, silenceDuration: 0.28, zoomEnd: 1.035, burnSubtitles: true, subtitleFont: "Microsoft YaHei", subtitleFontSize: 46 };

  const config = {
    title: episode.title,
    image_dir: `${PROJECT_ROOT}/${episode.imageDir}`,
    build_dir: `${PROJECT_ROOT}/build_ep${episode.number}`,
    out_dir: `${PROJECT_ROOT}/out`,
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
