import { WORKER_URL } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function getApiConfig() {
  const settingsPath = path.resolve(process.cwd(), "data", "settings.json");
  try {
    const raw = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(raw);
    const llmBaseUrl = settings.llm_base_url || settings.openai_base_url || null;
    const llmApiKey = settings.llm_api_key || settings.openai_api_key || "";
    const llmModel = settings.llm_model || "gpt-4o";
    return {
      llm_base_url: llmBaseUrl,
      llm_api_key: llmApiKey,
      llm_model: llmModel,
      image_base_url: settings.image_base_url || llmBaseUrl,
      image_api_key: settings.image_api_key || llmApiKey,
      image_model: settings.image_model || "gpt-image-1",
      project_root: settings.project_root || "",
    };
  } catch {
    return {
      llm_base_url: null, llm_api_key: "", llm_model: "gpt-4o",
      image_base_url: null, image_api_key: "", image_model: "gpt-image-1",
      project_root: "",
    };
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action;
  const config = await getApiConfig();

  if (action === "script") {
    if (!config.llm_api_key) {
      return NextResponse.json(
        { error: "请先在设置页面配置 LLM API Key" },
        { status: 400 }
      );
    }

    const res = await fetch(`${WORKER_URL}/generate/script`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: body.title,
        hook: body.hook || "",
        analogy: body.analogy || "",
        scene_count: body.scene_count || 8,
        base_url: config.llm_base_url,
        api_key: config.llm_api_key,
        model: config.llm_model,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  }

  if (action === "image") {
    if (!config.image_api_key) {
      return NextResponse.json(
        { error: "请先在设置页面配置图像生成 API Key" },
        { status: 400 }
      );
    }

    if (!body.output_dir) {
      return NextResponse.json(
        { error: "缺少 output_dir 参数" },
        { status: 400 }
      );
    }

    const CWD = process.cwd();
    const outputDir = body.output_dir.startsWith("/") || body.output_dir.includes(":")
      ? body.output_dir
      : path.resolve(CWD, "storage", "images", body.output_dir);

    const res = await fetch(`${WORKER_URL}/generate/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: body.prompt,
        output_dir: outputDir,
        filename: body.filename,
        base_url: config.image_base_url,
        api_key: config.image_api_key,
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

  if (action === "test_llm") {
    const baseUrl = body.llm_base_url || config.llm_base_url;
    const apiKey = body.llm_api_key?.includes("...") ? config.llm_api_key : (body.llm_api_key || config.llm_api_key);
    const model = body.llm_model || config.llm_model;

    if (!apiKey) {
      return NextResponse.json(
        { error: "未配置 LLM API Key" },
        { status: 400 }
      );
    }

    const res = await fetch(`${WORKER_URL}/test/llm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_url: baseUrl,
        api_key: apiKey,
        model: model,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  }

  if (action === "test_image") {
    const baseUrl = body.image_base_url || config.image_base_url;
    const apiKey = body.image_api_key?.includes("...") ? config.image_api_key : (body.image_api_key || config.image_api_key);
    const model = body.image_model || config.image_model;

    if (!apiKey) {
      return NextResponse.json(
        { error: "未配置图像生成 API Key" },
        { status: 400 }
      );
    }

    const res = await fetch(`${WORKER_URL}/test/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_url: baseUrl,
        api_key: apiKey,
        model: model,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  }

  if (action === "style_prompt") {
    const baseUrl = body.llm_base_url || config.llm_base_url;
    const apiKey = body.llm_api_key?.includes("...") ? config.llm_api_key : (body.llm_api_key || config.llm_api_key);
    const model = body.llm_model || config.llm_model;

    if (!apiKey) {
      return NextResponse.json({ error: "未配置 LLM API Key" }, { status: 400 });
    }

    const res = await fetch(`${WORKER_URL}/generate/style-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: body.keyword,
        base_url: baseUrl,
        api_key: apiKey,
        model: model,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  }

  if (action === "meta") {
    if (!config.llm_api_key) {
      return NextResponse.json(
        { error: "请先在设置页面配置 LLM API Key" },
        { status: 400 }
      );
    }

    const res = await fetch(`${WORKER_URL}/generate/meta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: body.title,
        base_url: config.llm_base_url,
        api_key: config.llm_api_key,
        model: config.llm_model,
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
