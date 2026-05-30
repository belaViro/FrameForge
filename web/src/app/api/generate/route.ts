import { WORKER_URL } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function getApiConfig() {
  const settingsPath = path.resolve(process.cwd(), "..", "data", "settings.json");
  try {
    const raw = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(raw);
    return {
      base_url: settings.openai_base_url || null,
      api_key: settings.openai_api_key || "",
      model: settings.llm_model || "gpt-4o",
      image_model: settings.image_model || "gpt-image-1",
      project_root: settings.project_root || "",
    };
  } catch {
    return { base_url: null, api_key: "", model: "gpt-4o", image_model: "gpt-image-1", project_root: "" };
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action;
  const config = await getApiConfig();

  if (!config.api_key) {
    return NextResponse.json(
      { error: "请先在设置页面配置 OpenAI API Key" },
      { status: 400 }
    );
  }

  if (action === "script") {
    const res = await fetch(`${WORKER_URL}/generate/script`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: body.title,
        hook: body.hook || "",
        analogy: body.analogy || "",
        scene_count: body.scene_count || 8,
        base_url: config.base_url,
        api_key: config.api_key,
        model: config.model,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  }

  if (action === "image") {
    const PROJECT_ROOT = process.env.PROJECT_ROOT || config.project_root || "";
    const outputDir = body.output_dir.startsWith("/") || body.output_dir.includes(":")
      ? body.output_dir
      : `${PROJECT_ROOT}/${body.output_dir}`;

    const res = await fetch(`${WORKER_URL}/generate/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: body.prompt,
        output_dir: outputDir,
        filename: body.filename,
        base_url: config.base_url,
        api_key: config.api_key,
        model: config.image_model,
        size: body.size || "1536x1024",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
