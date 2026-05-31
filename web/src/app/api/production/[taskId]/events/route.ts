import { prisma } from "@/lib/prisma";
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

  const reader = workerRes.body.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let buffer = "";
      const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
      const timeout = setTimeout(() => {
        reader.cancel();
      }, TIMEOUT_MS);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            controller.enqueue(encoder.encode(line + "\n"));

            if (line.startsWith("data:")) {
              const dataStr = line.slice(5).trim();
              try {
                const data = JSON.parse(dataStr);
                if (data.status === "completed" || data.status === "failed") {
                  await prisma.buildTask.update({
                    where: { id: taskId },
                    data: {
                      status: data.status,
                      outputPath: data.output_path || "",
                      error: data.error || "",
                      finishedAt: new Date(),
                    },
                  });
                  if (data.status === "completed" && data.output_path) {
                    const task = await prisma.buildTask.findUnique({
                      where: { id: taskId },
                    });
                    if (task) {
                      const filename = data.output_path.split(/[/\\]/).pop() || "";
                      if (filename) {
                        await prisma.episode.update({
                          where: { id: task.episodeId },
                          data: { outputName: filename, status: "produced" },
                        });
                      }
                    }
                  }
                }
              } catch {
                // not JSON or parse error, skip
              }
            }
          }
        }
      } catch {
        // stream ended or cancelled by timeout
      } finally {
        clearTimeout(timeout);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
