# FrameForge

全栈视频生产管理后台 — 从静态图片一键生成科普讲解视频。上传手绘信息图、编写旁白脚本，自动合成带 TTS 配音、Ken Burns 缩放动效和烧录字幕的成品视频，可以全程在浏览器中完成。

## 系统架构

```
┌────────────────────────────────────────────┐
│  Next.js 前端 + API (port 3000)            │
│  React 界面 / REST API / SQLite 数据库      │
└─────────────────────┬──────────────────────┘
                      │ HTTP / SSE
┌─────────────────────▼──────────────────────┐
│  Python Worker (port 8787)                 │
│  FastAPI / Edge TTS / FFmpeg 视频流水线     │
└────────────────────────────────────────────┘
```

## 核心功能

- **选题管理** — 创建、编辑、按季分组管理视频选题
- **场景编辑器** — 拖拽排序场景、行内编辑旁白、上传图片
- **一键构建** — 在浏览器中触发 TTS 生成 + 视频渲染
- **实时进度** — 基于 SSE 的构建进度推送，阶段可视化
- **视频预览** — 构建完成后直接在后台播放成片
- **素材浏览** — 浏览所有图片、音频片段和输出文件
- **封面生成** — 通过 OpenAI 兼容接口生成竖版封面
- **API 密钥管理** — 在设置页面配置 Base URL 和 Key，本地持久化

## 技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端 | Next.js 16、React 19、Tailwind CSS |
| 数据库 | SQLite + Prisma ORM |
| 后端 API | Next.js API Routes |
| 视频 Worker | Python、FastAPI、Edge TTS、FFmpeg |
| 进度推送 | Server-Sent Events (SSE) |

## 快速开始

### 环境要求

- Node.js 20+
- Python 3.11+
- FFmpeg（通过 `imageio-ffmpeg` 自动提供，无需手动安装）

### 1. 安装依赖

```bash
# 前端
cd web
npm install
npx prisma generate
npx prisma db push

# Worker
cd ../worker
pip install fastapi "uvicorn[standard]" sse-starlette edge-tts imageio-ffmpeg Pillow openai
```

### 2. 配置环境变量

编辑 `web/.env`：

```bash
DATABASE_URL="file:../data/dashboard.db"
WORKER_URL="http://localhost:8787"
PROJECT_ROOT="D:/你的项目路径"
```

### 3. 初始化数据（可选）

```bash
cd web
npx tsx prisma/seed.ts
```

### 4. 启动服务

```bash
# 终端 1：前端
cd web && npm run dev

# 终端 2：Worker
cd worker && python -m uvicorn worker.main:app --port 8787
```

Windows 用户也可以直接双击 `start.bat` 一键启动。

打开浏览器访问 **http://localhost:3000**。

### 5. 配置 API 密钥

进入 **设置** 页面，填写 OpenAI Base URL 和 API Key（支持任何兼容 OpenAI 接口的服务），点击保存即可。密钥仅存储在本地 `data/settings.json`，不会上传。

## 项目结构

```
├── web/                          # Next.js 应用
│   ├── prisma/
│   │   ├── schema.prisma        # 数据库模型定义
│   │   └── seed.ts              # 数据初始化脚本
│   ├── src/
│   │   ├── app/                 # 页面和 API 路由
│   │   ├── components/          # React 组件
│   │   └── lib/                 # 工具函数
│   └── .env                     # 环境变量配置
│
├── worker/                       # Python FastAPI 服务
│   ├── pyproject.toml
│   └── worker/
│       └── main.py              # API + 任务队列 + 流水线
│
├── make_explainer_video.py       # 核心视频生成流水线（可独立运行）
├── generate_cover.py             # 封面图片生成器
├── workflow_config_ai_agent.json  # 工作流配置示例
└── start.bat                     # Windows 一键启动脚本
```

## 使用流程

1. 在后台**创建选题**，填写标题、钩子和核心类比
2. 为每个场景**上传图片**（手绘白板信息图效果最佳）
3. 为每个场景**编写旁白**文本
4. 点击**开始构建** — 系统自动生成 TTS 配音、对图片施加缩放动效、烧录字幕、合成最终 MP4
5. 在编辑器内**预览**成片

## 视频生成流水线

构建过程按以下步骤顺序执行：

```
旁白文本 → Edge TTS → 音频片段
                              ↓
图片 → 缩放适配 → 慢推动效 → 视频片段
                              ↓
音频 + 视频 + ASS 字幕 → 最终 MP4
```

- **TTS**：Microsoft Edge TTS，可配置语音、语速、音调
- **视频**：Ken Burns 慢推缩放效果，让静态图片产生动感
- **字幕**：自动将旁白按标点拆分为定时字幕单元（每行最多 24 字）
- **缓存**：TTS 音频自动缓存，重新构建时跳过未修改的场景

## API 参考

### Next.js 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/episodes` | 获取列表 / 创建选题 |
| GET/PUT/DELETE | `/api/episodes/[id]` | 单集 CRUD |
| POST | `/api/episodes/[id]/scenes` | 添加场景 |
| PUT/DELETE | `/api/scenes/[id]` | 更新 / 删除场景 |
| POST | `/api/production` | 触发视频构建 |
| GET | `/api/production/[taskId]/events` | SSE 进度流 |
| GET/PUT | `/api/settings` | 读取 / 保存全局设置 |
| POST | `/api/upload` | 上传图片文件 |
| GET | `/api/files/[...path]` | 本地文件服务 |
| POST | `/api/tts` | TTS 语音预览 |

### Worker 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/build` | 启动视频构建 |
| GET | `/build/{id}/events` | SSE 进度推送 |
| POST | `/tts/preview` | 生成 TTS 预览音频 |
| GET | `/health` | 健康检查 |

## 许可证

MIT
