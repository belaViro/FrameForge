import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const SETTINGS_DIR = path.resolve(process.cwd(), "data");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "settings.json");

const KEY_FIELDS = ["llm_api_key", "image_api_key", "openai_api_key"];

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

  // Migrate old field names to new split fields for display
  if (!settings.llm_base_url && settings.openai_base_url) {
    settings.llm_base_url = settings.openai_base_url;
  }
  if (!settings.llm_api_key && settings.openai_api_key) {
    settings.llm_api_key = settings.openai_api_key;
  }
  if (!settings.image_base_url) {
    settings.image_base_url = settings.llm_base_url || settings.openai_base_url || "";
  }
  if (!settings.image_api_key) {
    settings.image_api_key = settings.llm_api_key || settings.openai_api_key || "";
  }

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

  // Merge: start with existing, overlay with new values
  const merged = { ...existing, ...body };

  // Preserve masked API keys (don't overwrite real keys with masked values)
  for (const field of KEY_FIELDS) {
    if (
      typeof merged[field] === "string" &&
      (merged[field] as string).includes("...") &&
      existing[field]
    ) {
      merged[field] = existing[field];
    }
  }

  // Remove legacy fields if new fields are explicitly set
  if (body.llm_base_url !== undefined && merged.openai_base_url) {
    delete merged.openai_base_url;
  }
  if (body.llm_api_key !== undefined && !(body.llm_api_key as string).includes("...") && merged.openai_api_key) {
    delete merged.openai_api_key;
  }

  await saveSettings(merged);
  return NextResponse.json({ ok: true });
}
