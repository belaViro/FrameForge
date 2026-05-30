"use client";

import { useState } from "react";
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
    const eventSource = new EventSource(`/api/production/${taskId}/events`);
    eventSource.addEventListener("progress", (e) => {
      const info = JSON.parse(e.data);
      setBuildStatus(`[${info.stage}] ${Math.round(info.progress * 100)}%`);
    });
    eventSource.addEventListener("done", (e) => {
      const info = JSON.parse(e.data);
      setBuildStatus(info.status === "completed" ? "构建完成!" : `失败: ${info.error}`);
      setBuilding(false);
      eventSource.close();
    });
    eventSource.onerror = () => {
      setBuildStatus("连接中断");
      setBuilding(false);
      eventSource.close();
    };
  }

  function updateScene(index: number, field: keyof Scene, value: string) {
    const updated = [...scenes];
    updated[index] = { ...updated[index], [field]: value };
    setScenes(updated);
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/episodes" className="text-gray-400 hover:text-gray-600">
          &larr;
        </Link>
        <h2 className="text-2xl font-bold text-gray-900">
          EP{String(episode.number).padStart(2, "0")} {episode.title}
        </h2>
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
          {episode.status}
        </span>
      </div>

      {/* 元数据 */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">基本信息</h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">钩子</label>
              <input
                type="text"
                value={hook}
                onChange={(e) => setHook(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">核心类比</label>
              <input
                type="text"
                value={analogy}
                onChange={(e) => setAnalogy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </section>

      {/* 场景列表 */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">场景列表 ({scenes.length} 个)</h3>
        <div className="space-y-4">
          {scenes.map((scene, idx) => (
            <div key={scene.id} className="border border-gray-200 rounded-md p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                  #{scene.order}
                </span>
                <input
                  type="text"
                  value={scene.subtitle}
                  onChange={(e) => updateScene(idx, "subtitle", e.target.value)}
                  onBlur={() => handleSaveScene(scenes[idx])}
                  placeholder="字幕标签"
                  className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm"
                />
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">图片: {scene.image || "未设置"}</p>
                  {scene.image && (
                    <img
                      src={`/api/files/${episode.imageDir}/${scene.image}`}
                      alt={scene.subtitle}
                      className="w-full rounded border border-gray-200"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">旁白文本</label>
                  <textarea
                    value={scene.narration}
                    onChange={(e) => updateScene(idx, "narration", e.target.value)}
                    onBlur={() => handleSaveScene(scenes[idx])}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-y"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 构建操作 */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">视频构建</h3>
        <div className="flex items-center gap-4">
          <button
            onClick={handleBuild}
            disabled={building}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {building ? "构建中..." : "开始构建"}
          </button>
          {buildStatus && (
            <span className="text-sm text-gray-600">{buildStatus}</span>
          )}
        </div>
        {episode.outputName && (
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-2">最新成片:</p>
            <video
              controls
              className="w-full max-w-2xl rounded border border-gray-200"
              src={`/api/files/out/${episode.outputName}`}
            />
          </div>
        )}
      </section>
    </div>
  );
}
