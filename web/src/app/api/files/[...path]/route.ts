import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const PROJECT_ROOT = process.env.PROJECT_ROOT || "D:/财富密码/视频号/静态图片科普视频";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".json": "application/json",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const filePath = path.join(PROJECT_ROOT, ...segments);

  // Prevent directory traversal
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(PROJECT_ROOT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 404 });
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    // For video files, support range requests
    if (ext === ".mp4") {
      const range = req.headers.get("range");
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileStat.size - 1;
        const chunkSize = end - start + 1;

        const { createReadStream } = await import("node:fs");
        const stream = createReadStream(resolved, { start, end });
        const readable = new ReadableStream({
          start(controller) {
            stream.on("data", (chunk) => controller.enqueue(chunk));
            stream.on("end", () => controller.close());
            stream.on("error", (err) => controller.error(err));
          },
        });

        return new Response(readable, {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunkSize),
            "Content-Type": contentType,
          },
        });
      }
    }

    const buffer = await readFile(resolved);
    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileStat.size),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
