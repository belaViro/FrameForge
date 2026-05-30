import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const PROJECT_ROOT = process.env.PROJECT_ROOT || "D:/财富密码/视频号/静态图片科普视频";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const dir = formData.get("dir") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const targetDir = dir ? path.join(PROJECT_ROOT, dir) : path.join(PROJECT_ROOT, "uploads");
  await mkdir(targetDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(targetDir, file.name);

  // Prevent directory traversal
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(PROJECT_ROOT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await writeFile(resolved, buffer);

  return NextResponse.json({
    name: file.name,
    path: path.relative(PROJECT_ROOT, resolved).replace(/\\/g, "/"),
    size: buffer.length,
  });
}
