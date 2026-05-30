import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const scene = await prisma.scene.update({
    where: { id: parseInt(id) },
    data: {
      narration: body.narration,
      subtitle: body.subtitle,
      image: body.image,
      order: body.order,
    },
  });
  return NextResponse.json(scene);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.scene.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
