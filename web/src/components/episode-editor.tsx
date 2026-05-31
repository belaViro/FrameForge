"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Scene {
  id: number;
  order: number;
  image: string;
  narration: string;
  subtitle: string;
}

interface BuildTask {
  id: string;
  status: string;
  progress: number;
  stage: string;
  createdAt: string | Date;
}

interface Episode {
  id: number;
  number: number;
  title: string;
  hook: string;
  analogy: string;
  season: number;
  status: string;
  imageDir: string;
  outputName: string;
  scenes: Scene[];
  ttsConfig: { voice: string; rate: string; pitch: string; volume: string } | null;
  videoConfig: { width: number; height: number; fps: number; burnSubtitles: boolean } | null;
  builds: BuildTask[];
}

export function EpisodeEditor({ episode }: { episode: Episode }) {
  const [title, setTitle] = useState(episode.title);
  const [hook, setHook] = useState(episode.hook);
  const [analogy, setAnalogy] = useState(episode.analogy);
  const [scenes, setScenes] = useState(episode.scenes);
  const [saving, setSaving] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildStatus, setBuildStatus] = useState("");
  const [generating, setGenerating] = useState("");
  const [outputName, setOutputName] = useState(episode.outputName);
  const [status, setStatus] = useState(episode.status);
  const [buildTaskId, setBuildTaskId] = useState<string | null>(null);

  const [stylePrompt, setStylePrompt] = useState("手绘白板科普信息图，完整白色背景，横向宽屏课件感，大号手写中文标题，蓝色绿色橙色关键词，高信息密度排版，圆角卡片分区，虚线箭头流程，编号标签，手绘图标，可爱拟人化设备，Q版人物角色，轻松课堂讲义风，马克笔线条，粗黑描边，浅色填充，少量星星和放射线装饰，清晰易懂的科普插画。");
  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(data => {
      if (data.image_style_prompt) setStylePrompt(data.image_style_prompt);
    }).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/episodes/${episode.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, hook, analogy }),
    });
    setSaving(false);
  }

  async function handleSaveScene(scene: Scene) {
    await fetch(`/api/scenes/${scene.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        narration: scene.narration,
        subtitle: scene.subtitle,
        image: scene.image,
      }),
    });
  }

  async function handleGenerateScript() {
    setGenerating("script");
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "script",
        title,
        hook,
        analogy,
        scene_count: 8,
      }),
    });
    const data = await res.json();
    setGenerating("");

    if (!res.ok) {
      alert(data.error || "生成失败");
      return;
    }

    // 删除旧场景
    await fetch(`/api/episodes/${episode.id}/scenes`, { method: "DELETE" });

    // 将生成的场景写入数据库并更新本地状态
    const generatedScenes: Scene[] = [];
    for (let i = 0; i < data.scenes.length; i++) {
      const s = data.scenes[i];
      const sceneRes = await fetch(`/api/episodes/${episode.id}/scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: i + 1,
          subtitle: s.subtitle,
          narration: s.narration,
          image: "",
        }),
      });
      const saved = await sceneRes.json();
      generatedScenes.push(saved);
    }
    setScenes(generatedScenes);

    // 更新状态为 scripted
    await fetch(`/api/episodes/${episode.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "scripted" }),
    });
    setStatus("scripted");
  }

  async function handleGenerateImages() {
    if (scenes.length === 0) {
      alert("请先生成脚本");
      return;
    }
    setGenerating("images");

    const imageDir = `ep${episode.number}`;
    await fetch(`/api/episodes/${episode.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDir }),
    });

    const tasks = scenes
      .map((scene, i) => {
        if (scene.image) return null;
        const filename = `${String(i + 1).padStart(2, "0")}_${scene.subtitle.replace(/[\\/:*?"<>|]/g, "").slice(0, 20)}.png`;
        const prompt = `${stylePrompt}\n\n画面主题：${scene.subtitle}\n内容要点：${scene.narration.slice(0, 100)}`;
        return { index: i, filename, prompt, sceneId: scene.id };
      })
      .filter(Boolean) as { index: number; filename: string; prompt: string; sceneId: number }[];

    if (tasks.length === 0) {
      setGenerating("");
      return;
    }

    const CONCURRENCY = 3;
    const MAX_RETRIES = 2;
    const updatedScenes = [...scenes];
    let failCount = 0;

    for (let start = 0; start < tasks.length; start += CONCURRENCY) {
      const batch = tasks.slice(start, start + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (t) => {
          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 90000);
              const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "image",
                  prompt: t.prompt,
                  output_dir: imageDir,
                  filename: t.filename,
                  size: "1536x1024",
                }),
                signal: controller.signal,
              });
              clearTimeout(timeout);
              if (res.ok) return t;
              if (attempt < MAX_RETRIES) {
                await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
                continue;
              }
              return null;
            } catch {
              if (attempt < MAX_RETRIES) {
                await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
                continue;
              }
              return null;
            }
          }
          return null;
        })
      );

      for (const result of results) {
        const t = result.status === "fulfilled" ? result.value : null;
        if (t) {
          updatedScenes[t.index] = { ...updatedScenes[t.index], image: t.filename };
          try {
            await fetch(`/api/scenes/${t.sceneId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image: t.filename }),
            });
          } catch {
            // DB save failed but image exists on disk
          }
        } else {
          failCount++;
        }
      }
      setScenes([...updatedScenes]);
    }

    setGenerating("");
    if (failCount > 0) {
      alert(`${failCount} 张图片生成失败，可点击单张图片的 ↻ 按钮重试`);
      return;
    }

    // 更新状态为 images_ready
    await fetch(`/api/episodes/${episode.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "images_ready" }),
    });
    setStatus("images_ready");
  }

  async function handleBuild() {
    setBuilding(true);
    setBuildStatus("正在启动构建...");
    const res = await fetch("/api/production", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodeId: episode.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBuildStatus(`构建失败: ${data.error}`);
      setBuilding(false);
      return;
    }

    const taskId = data.taskId;
    setBuildTaskId(taskId);
    const eventSource = new EventSource(`/api/production/${taskId}/events`);
    eventSource.addEventListener("progress", (e) => {
      const info = JSON.parse(e.data);
      setBuildStatus(`[${info.stage}] ${Math.round(info.progress * 100)}%`);
    });
    eventSource.addEventListener("done", (e) => {
      const info = JSON.parse(e.data);
      if (info.status === "completed") {
        setBuildStatus("构建完成!");
        const filename = info.output_path?.split(/[/\\]/).pop() || "";
        if (filename) setOutputName(filename);
        setStatus("produced");
      } else {
        setBuildStatus(`失败: ${info.error}`);
      }
      setBuilding(false);
      eventSource.close();
    });
    eventSource.onerror = () => {
      setBuildStatus("连接中断");
      setBuilding(false);
      eventSource.close();
    };
  }

  async function handleCancelBuild() {
    if (!buildTaskId) return;
    await fetch(`/api/production/${buildTaskId}/cancel`, { method: "POST" });
    setBuildStatus("已取消");
    setBuilding(false);
    setBuildTaskId(null);
  }

  async function handleRegenNarration(idx: number) {
    const scene = scenes[idx];
    setGenerating(`narration-${idx}`);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "script",
          title,
          hook: `请只为以下场景重新生成旁白，场景标题：${scene.subtitle}`,
          analogy,
          scene_count: 1,
        }),
      });
      const data = await res.json();
      if (res.ok && data.scenes?.[0]) {
        const newNarration = data.scenes[0].narration;
        const updated = [...scenes];
        updated[idx] = { ...updated[idx], narration: newNarration };
        setScenes(updated);
        await fetch(`/api/scenes/${scene.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ narration: newNarration }),
        });
      } else {
        alert(data.error || "重新生成失败");
      }
    } finally {
      setGenerating("");
    }
  }

  async function handleRegenImage(idx: number) {
    const scene = scenes[idx];
    if (!scene.subtitle && !scene.narration) {
      alert("请先填写场景标题或旁白");
      return;
    }
    setGenerating(`image-${idx}`);
    try {
      const imageDir = episode.imageDir || `ep${episode.number}`;
      if (!episode.imageDir) {
        await fetch(`/api/episodes/${episode.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDir }),
        });
      }
      const filename = `${String(idx + 1).padStart(2, "0")}_${scene.subtitle.replace(/[\\/:*?"<>|]/g, "").slice(0, 20)}.png`;
      const prompt = `${stylePrompt}\n\n画面主题：${scene.subtitle}\n内容要点：${scene.narration.slice(0, 100)}`;

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "image",
          prompt,
          output_dir: imageDir,
          filename,
          size: "1536x1024",
        }),
      });
      if (res.ok) {
        const updated = [...scenes];
        updated[idx] = { ...updated[idx], image: filename };
        setScenes(updated);
        await fetch(`/api/scenes/${scene.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: filename }),
        });
      } else {
        const data = await res.json();
        alert(data.error || "图片生成失败");
      }
    } finally {
      setGenerating("");
    }
  }

  function updateScene(index: number, field: keyof Scene, value: string) {
    const updated = [...scenes];
    updated[index] = { ...updated[index], [field]: value };
    setScenes(updated);
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/episodes" className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900">
            EP{String(episode.number).padStart(2, "0")} {episode.title}
          </h2>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          status === "produced" ? "bg-emerald-50 text-emerald-700" :
          status === "images_ready" ? "bg-cyan-50 text-cyan-700" :
          status === "scripted" ? "bg-violet-50 text-violet-700" :
          "bg-slate-100 text-slate-600"
        }`}>
          {status === "produced" ? "已制作" : status === "images_ready" ? "待构建" : status === "scripted" ? "已编剧" : "草稿"}
        </span>
      </div>

      {/* 元数据 */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 mb-5">
        <h3 className="font-semibold text-slate-900 mb-4">基本信息</h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">钩子</label>
              <input
                type="text"
                value={hook}
                onChange={(e) => setHook(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">核心类比</label>
              <input
                type="text"
                value={analogy}
                onChange={(e) => setAnalogy(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
              />
            </div>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </section>

      {/* AI 生成 */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 mb-5">
        <h3 className="font-semibold text-slate-900 mb-1">AI 生成</h3>
        <p className="text-xs text-slate-400 mb-4">根据标题和钩子自动生成脚本，再为每个场景生成配图</p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerateScript}
            disabled={!!generating}
            className="px-4 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {generating === "script" ? "生成脚本中..." : "AI 生成脚本"}
          </button>
          <button
            onClick={handleGenerateImages}
            disabled={!!generating || scenes.length === 0}
            className="px-4 py-2.5 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors"
          >
            {generating === "images" ? "生成图片中..." : "AI 生成图片"}
          </button>
          {generating && (
            <span className="text-xs text-slate-500 animate-pulse">
              {generating === "script" ? "正在调用 LLM 生成分场景脚本..." : "正在逐张生成场景图片..."}
            </span>
          )}
        </div>
      </section>

      {/* 场景列表 */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 mb-5">
        <h3 className="font-semibold text-slate-900 mb-4">场景列表 ({scenes.length} 个)</h3>
        {scenes.length === 0 ? (
          <p className="text-sm text-slate-400">暂无场景，点击上方"AI 生成脚本"自动创建</p>
        ) : (
          <div className="space-y-3">
            {scenes.map((scene, idx) => (
              <div key={scene.id} className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-1 rounded">
                    #{scene.order}
                  </span>
                  <input
                    type="text"
                    value={scene.subtitle}
                    onChange={(e) => updateScene(idx, "subtitle", e.target.value)}
                    onBlur={() => handleSaveScene(scenes[idx])}
                    placeholder="字幕标签"
                    className="flex-1 px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>
                <div className="grid grid-cols-[180px_1fr] gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs text-slate-400">{scene.image || "未生成"}</p>
                      <button
                        onClick={() => handleRegenImage(idx)}
                        disabled={!!generating}
                        title="重新生成图片"
                        className="text-xs text-cyan-600 hover:text-cyan-700 disabled:opacity-40"
                      >
                        {generating === `image-${idx}` ? "..." : "↻"}
                      </button>
                    </div>
                    {scene.image && episode.imageDir && (
                      <img
                        src={`/api/files/storage/images/${episode.imageDir}/${scene.image}`}
                        alt={scene.subtitle}
                        className="w-full rounded-lg border border-slate-200"
                      />
                    )}
                    {!scene.image && (
                      <button
                        onClick={() => handleRegenImage(idx)}
                        disabled={!!generating}
                        className="w-full h-24 border border-dashed border-slate-300 rounded-lg text-xs text-slate-400 hover:border-cyan-400 hover:text-cyan-600 disabled:opacity-40 transition-colors"
                      >
                        {generating === `image-${idx}` ? "生成中..." : "点击生成图片"}
                      </button>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-slate-400">旁白文本</label>
                      <button
                        onClick={() => handleRegenNarration(idx)}
                        disabled={!!generating}
                        title="重新生成旁白"
                        className="text-xs text-violet-600 hover:text-violet-700 disabled:opacity-40"
                      >
                        {generating === `narration-${idx}` ? "生成中..." : "↻ 重写"}
                      </button>
                    </div>
                    <textarea
                      value={scene.narration}
                      onChange={(e) => updateScene(idx, "narration", e.target.value)}
                      onBlur={() => handleSaveScene(scenes[idx])}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 构建操作 */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">视频构建</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBuild}
            disabled={building || scenes.length === 0}
            className="px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {building ? "构建中..." : "开始构建"}
          </button>
          {building && (
            <button
              onClick={handleCancelBuild}
              className="px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              取消构建
            </button>
          )}
          {buildStatus && (
            <span className="text-sm text-slate-600">{buildStatus}</span>
          )}
        </div>
        {outputName && (
          <div className="mt-5">
            <p className="text-xs text-slate-400 mb-2">最新成片</p>
            <video
              controls
              className="w-full max-w-2xl rounded-lg border border-slate-200"
              src={`/api/files/storage/output/${outputName}`}
            />
          </div>
        )}
      </section>
    </div>
  );
}
