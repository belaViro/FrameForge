"use client";

import { useEffect, useState } from "react";

interface Settings {
  llm_base_url: string;
  llm_api_key: string;
  llm_model: string;
  image_base_url: string;
  image_api_key: string;
  image_model: string;
  image_style_prompt: string;
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
  llm_base_url: "",
  llm_api_key: "",
  llm_model: "gpt-4o",
  image_base_url: "",
  image_api_key: "",
  image_model: "gpt-image-2",
  image_style_prompt: "手绘白板科普信息图，完整白色背景，横向宽屏课件感，大号手写中文标题，蓝色绿色橙色关键词，高信息密度排版，圆角卡片分区，虚线箭头流程，编号标签，手绘图标，可爱拟人化设备，Q版人物角色，轻松课堂讲义风，马克笔线条，粗黑描边，浅色填充，少量星星和放射线装饰，清晰易懂的科普插画。",
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

const inputClass = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors bg-white";
const labelClass = "block text-xs font-medium text-slate-500 mb-1.5";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [llmTesting, setLlmTesting] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState("");
  const [imageTesting, setImageTesting] = useState(false);
  const [imageTestResult, setImageTestResult] = useState("");

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

  async function handleTestLlm() {
    setLlmTesting(true);
    setLlmTestResult("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_llm",
          llm_base_url: settings.llm_base_url,
          llm_api_key: settings.llm_api_key,
          llm_model: settings.llm_model,
        }),
      });
      const data = await res.json();
      setLlmTestResult(res.ok ? `连接成功: ${data.message}` : `失败: ${data.error}`);
    } catch (e) {
      setLlmTestResult(`请求异常: ${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setLlmTesting(false);
    }
  }

  async function handleTestImage() {
    setImageTesting(true);
    setImageTestResult("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_image",
          image_base_url: settings.image_base_url,
          image_api_key: settings.image_api_key,
          image_model: settings.image_model,
        }),
      });
      const data = await res.json();
      setImageTestResult(res.ok ? `连接成功: ${data.message}` : `失败: ${data.error}`);
    } catch (e) {
      setImageTestResult(`请求异常: ${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setImageTesting(false);
    }
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">设置</h2>
          <p className="text-sm text-slate-500 mt-1">配置 API 服务、语音合成和视频参数</p>
        </div>
        <div className="flex items-center gap-3">
          {message && (
            <span className={`text-sm font-medium ${message === "已保存" ? "text-emerald-600" : "text-red-500"}`}>
              {message}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </div>

      {/* Two-column layout for API configs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* LLM 配置 */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3 className="font-semibold text-slate-900 text-sm">LLM 脚本生成</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4 ml-8">OpenAI Chat API 兼容服务</p>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Base URL</label>
              <input type="text" value={settings.llm_base_url} onChange={(e) => update("llm_base_url", e.target.value)} placeholder="https://api.openai.com/v1" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>API Key</label>
              <input type="password" value={settings.llm_api_key} onChange={(e) => update("llm_api_key", e.target.value)} placeholder="sk-..." className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label className={labelClass}>模型</label>
              <input type="text" value={settings.llm_model} onChange={(e) => update("llm_model", e.target.value)} placeholder="gpt-4o" className={inputClass} />
            </div>
          </div>
          <TestButton loading={llmTesting} result={llmTestResult} onClick={handleTestLlm} />
        </section>

        {/* 图像生成配置 */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-cyan-100 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
            <h3 className="font-semibold text-slate-900 text-sm">图像生成</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4 ml-8">OpenAI Images API 兼容服务</p>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Base URL</label>
              <input type="text" value={settings.image_base_url} onChange={(e) => update("image_base_url", e.target.value)} placeholder="https://api.openai.com/v1" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>API Key</label>
              <input type="password" value={settings.image_api_key} onChange={(e) => update("image_api_key", e.target.value)} placeholder="sk-..." className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label className={labelClass}>模型</label>
              <input type="text" value={settings.image_model} onChange={(e) => update("image_model", e.target.value)} placeholder="gpt-image-1" className={inputClass} />
            </div>
          </div>
          <TestButton loading={imageTesting} result={imageTestResult} onClick={handleTestImage} />
        </section>
      </div>

      {/* 图片风格 */}
      <ImageStyleSection
        value={settings.image_style_prompt}
        onChange={(v) => update("image_style_prompt", v)}
        llmBaseUrl={settings.llm_base_url}
        llmApiKey={settings.llm_api_key}
        llmModel={settings.llm_model}
      />

      {/* TTS 配置 */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          </div>
          <h3 className="font-semibold text-slate-900 text-sm">语音合成 (TTS)</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="col-span-2 lg:col-span-1">
            <label className={labelClass}>语音</label>
            <select value={settings.tts_voice} onChange={(e) => update("tts_voice", e.target.value)} className={inputClass}>
              <optgroup label="中文男声">
                <option value="zh-CN-YunxiNeural">云希 (年轻男声)</option>
                <option value="zh-CN-YunyangNeural">云扬 (新闻播报)</option>
                <option value="zh-CN-YunjianNeural">云健 (运动解说)</option>
                <option value="zh-CN-YunzeNeural">云泽 (纪录片)</option>
                <option value="zh-CN-YunhaoNeural">云皓 (广告配音)</option>
                <option value="zh-CN-YunfengNeural">云枫 (沉稳男声)</option>
              </optgroup>
              <optgroup label="中文女声">
                <option value="zh-CN-XiaoxiaoNeural">晓晓 (活泼女声)</option>
                <option value="zh-CN-XiaoyiNeural">晓伊 (温柔女声)</option>
                <option value="zh-CN-XiaochenNeural">晓辰 (知性女声)</option>
                <option value="zh-CN-XiaohanNeural">晓涵 (温暖女声)</option>
                <option value="zh-CN-XiaomengNeural">晓梦 (可爱女声)</option>
                <option value="zh-CN-XiaomoNeural">晓墨 (情感女声)</option>
                <option value="zh-CN-XiaoruiNeural">晓睿 (沉稳女声)</option>
                <option value="zh-CN-XiaoshuangNeural">晓双 (儿童声)</option>
                <option value="zh-CN-XiaoxuanNeural">晓萱 (甜美女声)</option>
                <option value="zh-CN-XiaoyanNeural">晓颜 (清新女声)</option>
                <option value="zh-CN-XiaozhenNeural">晓甄 (成熟女声)</option>
              </optgroup>
              <optgroup label="粤语">
                <option value="zh-HK-HiuMaanNeural">晓曼 (粤语女声)</option>
                <option value="zh-HK-WanLungNeural">云龙 (粤语男声)</option>
              </optgroup>
              <optgroup label="English">
                <option value="en-US-GuyNeural">Guy (American Male)</option>
                <option value="en-US-JennyNeural">Jenny (American Female)</option>
                <option value="en-GB-RyanNeural">Ryan (British Male)</option>
              </optgroup>
            </select>
          </div>
          <div>
            <label className={labelClass}>语速</label>
            <input type="text" value={settings.tts_rate} onChange={(e) => update("tts_rate", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>音调</label>
            <input type="text" value={settings.tts_pitch} onChange={(e) => update("tts_pitch", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>音量</label>
            <input type="text" value={settings.tts_volume} onChange={(e) => update("tts_volume", e.target.value)} className={inputClass} />
          </div>
        </div>
        <TtsPreview voice={settings.tts_voice} rate={settings.tts_rate} pitch={settings.tts_pitch} volume={settings.tts_volume} />
      </section>

      {/* Video + Service in two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
            </div>
            <h3 className="font-semibold text-slate-900 text-sm">视频参数</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>宽度</label>
              <input type="number" value={settings.video_width} onChange={(e) => update("video_width", parseInt(e.target.value) || 0)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>高度</label>
              <input type="number" value={settings.video_height} onChange={(e) => update("video_height", parseInt(e.target.value) || 0)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>帧率</label>
              <input type="number" value={settings.video_fps} onChange={(e) => update("video_fps", parseInt(e.target.value) || 0)} className={inputClass} />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
            </div>
            <h3 className="font-semibold text-slate-900 text-sm">服务配置</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Worker 地址</label>
              <input type="text" value={settings.worker_url} onChange={(e) => update("worker_url", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>项目根目录</label>
              <input type="text" value={settings.project_root} onChange={(e) => update("project_root", e.target.value)} placeholder="D:/your/project/path" className={inputClass} />
            </div>
          </div>
        </section>
      </div>

      <p className="text-xs text-slate-400 mt-4 text-center">所有密钥仅保存在本地 data/settings.json，不会上传到任何远程服务</p>
    </div>
  );
}

function TestButton({ loading, result, onClick }: { loading: boolean; result: string; onClick: () => void }) {
  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <div className="flex items-center gap-3">
        <button
          onClick={onClick}
          disabled={loading}
          className="px-3.5 py-2 bg-slate-800 text-white text-xs font-medium rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors"
        >
          {loading ? "测试中..." : "测试连接"}
        </button>
        {result && (
          <span className={`text-xs leading-tight ${result.startsWith("连接成功") ? "text-emerald-600" : "text-red-500"}`}>
            {result.length > 80 ? result.slice(0, 80) + "..." : result}
          </span>
        )}
      </div>
    </div>
  );
}

function ImageStyleSection({
  value,
  onChange,
  llmBaseUrl,
  llmApiKey,
  llmModel,
}: {
  value: string;
  onChange: (v: string) => void;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
}) {
  const [generating, setGenerating] = useState(false);
  const [keyword, setKeyword] = useState("");

  async function handleGenerate() {
    if (!keyword.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "style_prompt",
          keyword: keyword.trim(),
          llm_base_url: llmBaseUrl,
          llm_api_key: llmApiKey,
          llm_model: llmModel,
        }),
      });
      const data = await res.json();
      if (res.ok && data.prompt) {
        onChange(data.prompt);
      } else {
        alert(data.error || "生成失败");
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6 mb-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-md bg-pink-100 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#db2777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
        </div>
        <h3 className="font-semibold text-slate-900 text-sm">图片风格提示词</h3>
      </div>
      <p className="text-xs text-slate-400 mb-4 ml-8">生成场景配图时使用的风格描述，可手动编辑或输入关键词让 AI 生成详细 prompt</p>

      <div className="mb-3">
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="输入风格关键词，如：赛博朋克、水彩插画、像素风..."
            className={`flex-1 ${inputClass}`}
          />
          <button
            onClick={handleGenerate}
            disabled={generating || !keyword.trim()}
            className="px-4 py-2 bg-pink-600 text-white text-xs font-medium rounded-lg hover:bg-pink-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {generating ? "生成中..." : "AI 生成 Prompt"}
          </button>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder="图片风格提示词..."
          className={`${inputClass} resize-y`}
        />
        <p className="text-xs text-slate-400 mt-1.5">此提示词会作为前缀拼接到每张场景图片的生成请求中</p>
      </div>
    </section>
  );
}

function TtsPreview({ voice, rate, pitch, volume }: { voice: string; rate: string; pitch: string; volume: string }) {
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [text, setText] = useState("你好，这是一段语音试听示例。AI 智能体可以帮你完成很多任务。");

  async function handlePreview() {
    setLoading(true);
    setAudioUrl(null);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, rate, pitch, volume }),
      });
      if (!res.ok) {
        alert("试听失败，请确认 Worker 已启动");
        return;
      }
      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <label className={labelClass}>试听预览</label>
      <div className="flex gap-2">
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="输入试听文本..." className={`flex-1 ${inputClass}`} />
        <button onClick={handlePreview} disabled={loading || !text.trim()} className="px-4 py-2 bg-slate-800 text-white text-xs font-medium rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors whitespace-nowrap">
          {loading ? "生成中..." : "试听"}
        </button>
      </div>
      {audioUrl && <audio controls src={audioUrl} className="w-full mt-3" autoPlay />}
    </div>
  );
}
