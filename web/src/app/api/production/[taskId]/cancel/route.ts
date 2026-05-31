import { prisma } from "@/lib/prisma";
import { WORKER_URL } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    const res = await fetch(`${WORKER_URL}/build/${taskId}/cancel`, {
      method: "POST",
    });

    if (!res.ok && res.status !== 404) {
      return NextResponse.json({ error: "Worker cancel failed" }, { status: 500 });
    }

    await prisma.buildTask.update({
      where: { id: taskId },
      data: {
        status: "failed",
        error: "用户取消",
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
