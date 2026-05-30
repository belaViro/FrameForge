import { WORKER_URL } from "@/lib/utils";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  const workerUrl = `${WORKER_URL}/build/${taskId}/events`;

  const workerRes = await fetch(workerUrl, {
    headers: { Accept: "text/event-stream" },
  });

  if (!workerRes.ok || !workerRes.body) {
    return new Response("Worker unavailable", { status: 502 });
  }

  return new Response(workerRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
