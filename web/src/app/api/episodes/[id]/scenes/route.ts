import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const episodeId = parseInt(id);
  const body = await req.json();

  const maxOrder = await prisma.scene.findFirst({
    where: { episodeId },
    orderBy: { order: "desc" },
  });

  const scene = await prisma.scene.create({
    data: {
      episodeId,
      order: (maxOrder?.order || 0) + 1,
      image: body.image || "",
      narration: body.narration || "",
      subtitle: body.subtitle || "",
    },
  });
  return NextResponse.json(scene, { status: 201 });
}
