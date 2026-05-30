import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const episode = await prisma.episode.findUnique({
    where: { id: parseInt(id) },
    include: {
      scenes: { orderBy: { order: "asc" } },
      ttsConfig: true,
      videoConfig: true,
    },
  });
  if (!episode) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(episode);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const episode = await prisma.episode.update({
    where: { id: parseInt(id) },
    data: {
      title: body.title,
      hook: body.hook,
      analogy: body.analogy,
      status: body.status,
      imageDir: body.imageDir,
      outputName: body.outputName,
    },
  });
  return NextResponse.json(episode);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.episode.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
