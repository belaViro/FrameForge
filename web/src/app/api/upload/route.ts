import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const FILE_ROOT = process.cwd();
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".mp3", ".wav", ".mp4", ".json", ".txt",
]);

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const dir = formData.get("dir") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ error: `File too large (max ${MAX_UPLOAD_SIZE / 1024 / 1024}MB)` }, { status: 413 });
  }

  // Sanitize filename
  const safeName = file.name.replace(/[/\\:*?"<>|]/g, "_").replace(/\.\./g, "_");
  if (!safeName || safeName.startsWith(".")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  // File type check
  const ext = path.extname(safeName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: `File type ${ext || "(none)"} not allowed` }, { status: 415 });
  }

  const targetDir = dir ? path.join(FILE_ROOT, dir) : path.join(FILE_ROOT, "storage", "uploads");
  const filePath = path.join(targetDir, safeName);

  // Path traversal check BEFORE any filesystem operations
  const resolvedDir = path.resolve(targetDir);
  const resolvedFile = path.resolve(filePath);
  if (!resolvedDir.startsWith(path.resolve(FILE_ROOT)) || !resolvedFile.startsWith(path.resolve(FILE_ROOT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await mkdir(resolvedDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(resolvedFile, buffer);

  return NextResponse.json({
    name: safeName,
    path: path.relative(FILE_ROOT, resolvedFile).replace(/\\/g, "/"),
    size: buffer.length,
  });
}
