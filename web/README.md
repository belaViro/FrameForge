# FrameForge

AI 驱动的科普短视频自动化生产工具。从脚本生成、配图绘制、语音合成到视频渲染，一站式完成。

## 功能

- **AI 脚本生成** — 输入主题，LLM 自动拆分为多场景旁白脚本
- **AI 配图生成** — 根据每个场景内容自动生成风格统一的科普插画
- **TTS 语音合成** — 使用 Edge TTS 生成自然语音旁白，支持语速/音调调节
- **视频自动渲染** — Ken Burns 缩放动效 + ASS 字幕烧录 + FFmpeg 合成
- **构建队列** — 支持异步构建、实时进度推送（SSE）、取消任务
- **素材管理** — 图片浏览、文件上传、分集管理

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Next.js 16 + React 19 + Tailwind CSS 4 |
| 数据库 | Prisma + SQLite |
| Worker | FastAPI + edge-tts + Pillow + FFmpeg |
| AI | OpenAI 兼容 API（LLM + 图像生成） |

## 快速开始

### 环境要求

- Node.js 20+
- Python 3.11+
- FFmpeg（通过 `imageio-ffmpeg` 自动管理）

### 安装

```bash
# 前端依赖
npm install
npx prisma generate

# Worker 依赖
cd worker
pip install -r requirements.txt
```

### 配置

复制 `.env.example` 为 `.env`，填入数据库路径：

```env
DATABASE_URL="file:../data/app.db"
```

API Key 在启动后通过 Settings 页面配置。

### 启动

```bash
npm run dev
```

同时启动 Next.js (端口 3000) 和 Worker (端口 8787)。

浏览器打开 http://localhost:3000

## 项目结构

```
src/
├── app/              # Next.js App Router 页面和 API
├── components/       # React 组件
└── lib/              # 工具函数、Prisma 客户端

worker/
├── main.py           # FastAPI 应用（构建、生成、TTS）
└── pipeline.py       # 视频生产流水线（FFmpeg 渲染）

prisma/
└── schema.prisma     # 数据模型

data/                 # 运行时数据（SQLite、配置、任务状态）
storage/              # 上传文件和生成的图片/视频
```

## 工作流程

1. 创建分集 → 填写标题和钩子
2. 点击「AI 生成脚本」→ LLM 输出分场景旁白
3. 点击「AI 生成图片」→ 逐场景生成配图
4. 点击「开始构建」→ TTS + 视频渲染 + 字幕合成
5. 预览成片，导出发布

## License

MIT
