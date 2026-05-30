"use client";

import { useEffect, useState } from "react";

interface Settings {
  openai_base_url: string;
  openai_api_key: string;
  llm_model: string;
  image_model: string;
  tts_voice: string;
  tts_rate: string;
  tts_pitch: string;
  tts_volume: string;
  video_width: number;
  video_height: number;
  video_fps: number;
  worker_url: string;
  project_root: string;
}

const defaults: Settings = {
  openai_base_url: "",
  openai_api_key: "",
  llm_model: "gpt-4o",
  image_model: "gpt-image-1",
  tts_voice: "zh-CN-YunxiNeural",
  tts_rate: "-8%",
  tts_pitch: "-3Hz",
  tts_volume: "+0%",
  video_width: 1920,
  video_height: 1080,
  video_fps: 30,
  worker_url: "http://localhost:8787",
  project_root: "",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings({ ...defaults, ...data }))
      .catch(() => {});
  }, []);

  function update(key: keyof Settings, value: string | number) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setMessage(res.ok ? "已保存" : "保存失败");
    setTimeout(() => setMessage(""), 3000);
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">设置</h2>
        <div className="flex items-center gap-3">
          {message && (
            <span className="text-sm text-green-600">{message}</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* OpenAI API 配置 */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-1">OpenAI API 配置</h3>
          <p className="text-xs text-gray-500 mb-4">用于封面图片生成，支持兼容 OpenAI 接口的第三方服务</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
              <input
                type="text"
                value={settings.openai_base_url}
                onChange={(e) => update("openai_base_url", e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm placeholder:text-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">留空则使用默认 OpenAI 地址，也可填写代理或第三方兼容接口</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                type="password"
                value={settings.openai_api_key}
                onChange={(e) => update("openai_api_key", e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono placeholder:text-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">密钥仅保存在本地，不会上传到任何远程服务</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LLM 模型（脚本生成）</label>
                <input
                  type="text"
                  value={settings.llm_model}
                  onChange={(e) => update("llm_model", e.target.value)}
                  placeholder="gpt-4o"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">图像模型（配图生成）</label>
                <input
                  type="text"
                  value={settings.image_model}
                  onChange={(e) => update("image_model", e.target.value)}
                  placeholder="gpt-image-1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>
        </section>

        {/* TTS 配置 */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">TTS 默认配置</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">语音</label>
              <select
                value={settings.tts_voice}
                onChange={(e) => update("tts_voice", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="zh-CN-YunxiNeural">云希 (男声)</option>
                <option value="zh-CN-YunyangNeural">云扬 (男声)</option>
                <option value="zh-CN-XiaoxiaoNeural">晓晓 (女声)</option>
                <option value="zh-CN-XiaoyiNeural">晓伊 (女声)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">语速</label>
              <input
                type="text"
                value={settings.tts_rate}
                onChange={(e) => update("tts_rate", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">音调</label>
              <input
                type="text"
                value={settings.tts_pitch}
                onChange={(e) => update("tts_pitch", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">音量</label>
              <input
                type="text"
                value={settings.tts_volume}
                onChange={(e) => update("tts_volume", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        </section>

        {/* 视频配置 */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">视频默认配置</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">宽度</label>
              <input
                type="number"
                value={settings.video_width}
                onChange={(e) => update("video_width", parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">高度</label>
              <input
                type="number"
                value={settings.video_height}
                onChange={(e) => update("video_height", parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">帧率</label>
              <input
                type="number"
                value={settings.video_fps}
                onChange={(e) => update("video_fps", parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        </section>

        {/* 服务配置 */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">服务配置</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Python Worker 地址</label>
              <input
                type="text"
                value={settings.worker_url}
                onChange={(e) => update("worker_url", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">项目根目录</label>
              <input
                type="text"
                value={settings.project_root}
                onChange={(e) => update("project_root", e.target.value)}
                placeholder="D:/your/project/path"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm placeholder:text-gray-400"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
