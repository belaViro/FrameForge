import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const SETTINGS_DIR = path.resolve(process.cwd(), "..", "data");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "settings.json");

async function loadSettings(): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveSettings(data: Record<string, unknown>): Promise<void> {
  await mkdir(SETTINGS_DIR, { recursive: true });
  await writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  const settings = await loadSettings();
  // Mask the API key for display (return last 4 chars only)
  if (settings.openai_api_key && typeof settings.openai_api_key === "string") {
    const key = settings.openai_api_key;
    settings.openai_api_key = key.length > 8
      ? "sk-..." + key.slice(-4)
      : key;
  }
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const existing = await loadSettings();

  // If the API key looks masked (starts with "sk-..."), keep the old one
  if (
    typeof body.openai_api_key === "string" &&
    body.openai_api_key.startsWith("sk-...") &&
    existing.openai_api_key
  ) {
    body.openai_api_key = existing.openai_api_key;
  }

  await saveSettings(body);
  return NextResponse.json({ ok: true });
}
