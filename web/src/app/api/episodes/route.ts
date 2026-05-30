import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const season = req.nextUrl.searchParams.get("season");
  const episodes = await prisma.episode.findMany({
    where: season ? { season: parseInt(season) } : undefined,
    orderBy: { number: "asc" },
    include: { _count: { select: { scenes: true } } },
  });
  return NextResponse.json(episodes);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const episode = await prisma.episode.create({
    data: {
      number: body.number,
      title: body.title,
      hook: body.hook || "",
      analogy: body.analogy || "",
      season: body.season || 1,
      status: "draft",
    },
  });
  return NextResponse.json(episode, { status: 201 });
}
