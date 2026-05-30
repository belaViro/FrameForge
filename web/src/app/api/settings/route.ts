import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const SETTINGS_DIR = path.resolve(process.cwd(), "..", "data");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "settings.json");

const KEY_FIELDS = ["llm_api_key", "image_api_key"];

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

function maskKey(key: string): string {
  if (key.length > 8) return key.slice(0, 3) + "..." + key.slice(-4);
  return key;
}

export async function GET() {
  const settings = await loadSettings();
  for (const field of KEY_FIELDS) {
    if (settings[field] && typeof settings[field] === "string") {
      settings[field] = maskKey(settings[field] as string);
    }
  }
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const existing = await loadSettings();

  for (const field of KEY_FIELDS) {
    if (
      typeof body[field] === "string" &&
      body[field].includes("...") &&
      existing[field]
    ) {
      body[field] = existing[field];
    }
  }

  await saveSettings(body);
  return NextResponse.json({ ok: true });
}
