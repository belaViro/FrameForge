# FrameForge

A full-stack video production dashboard for creating explainer videos from static images. Upload hand-drawn infographics, write narration scripts, and generate polished videos with TTS voiceover, Ken Burns zoom effects, and burned-in subtitles — all from a web UI.

## Architecture

```
┌────────────────────────────────────────────┐
│  Next.js App (port 3000)                   │
│  React frontend + REST API + SQLite        │
└─────────────────────┬──────────────────────┘
                      │ HTTP / SSE
┌─────────────────────▼──────────────────────┐
│  Python Worker (port 8787)                 │
│  FastAPI + Edge TTS + FFmpeg pipeline      │
└────────────────────────────────────────────┘
```

## Features

- **Episode Management** — Create, edit, and organize video episodes by season
- **Scene Editor** — Drag-and-drop scene ordering, inline narration editing, image upload
- **One-Click Build** — Trigger TTS + video rendering from the browser
- **Real-Time Progress** — SSE-powered live build status with stage indicators
- **Video Preview** — Watch generated videos directly in the dashboard
- **Asset Browser** — Browse all images, audio segments, and output files
- **Cover Generation** — Generate vertical covers via OpenAI image API

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| Database | SQLite via Prisma ORM |
| Backend API | Next.js API Routes |
| Video Worker | Python, FastAPI, Edge TTS, FFmpeg |
| Progress | Server-Sent Events (SSE) |

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- FFmpeg (auto-provided via `imageio-ffmpeg`)

### 1. Install dependencies

```bash
# Frontend
cd web
npm install
npx prisma generate
npx prisma db push

# Worker
cd ../worker
pip install fastapi uvicorn[standard] sse-starlette edge-tts imageio-ffmpeg Pillow openai
```

### 2. Configure environment

```bash
# web/.env
DATABASE_URL="file:../data/dashboard.db"
WORKER_URL="http://localhost:8787"
PROJECT_ROOT="/path/to/your/project"
```

### 3. Seed the database (optional)

```bash
cd web
npx tsx prisma/seed.ts
```

### 4. Start both services

```bash
# Terminal 1
cd web && npm run dev

# Terminal 2
cd worker && python -m uvicorn worker.main:app --port 8787
```

Or on Windows, just double-click `start.bat`.

Open **http://localhost:3000** in your browser.

## Project Structure

```
├── web/                          # Next.js application
│   ├── prisma/
│   │   ├── schema.prisma        # Database schema
│   │   └── seed.ts              # Data seeder
│   ├── src/
│   │   ├── app/                 # Pages and API routes
│   │   ├── components/          # React components
│   │   └── lib/                 # Utilities
│   └── .env                     # Environment config
│
├── worker/                       # Python FastAPI service
│   ├── pyproject.toml
│   └── worker/
│       └── main.py              # API + task queue + pipeline
│
├── make_explainer_video.py       # Core video pipeline (standalone)
├── generate_cover.py             # Cover image generator
├── workflow_config_ai_agent.json  # Example workflow config
└── start.bat                     # Windows launcher
```

## How It Works

1. **Create an episode** in the dashboard with title, hook, and scenes
2. **Upload images** for each scene (hand-drawn infographics work great)
3. **Write narration** text for each scene
4. **Click Build** — the system generates TTS audio, applies zoom effects to each image, burns subtitles, and muxes everything into a final MP4
5. **Preview** the result right in the browser

## Video Pipeline

The build process runs these steps sequentially:

```
Narration text → Edge TTS → Audio segments
                                    ↓
Images → Resize/fit → Zoompan → Video segments
                                    ↓
Audio + Video + ASS subtitles → Final MP4
```

- **TTS**: Microsoft Edge TTS with configurable voice, rate, pitch
- **Video**: Ken Burns slow-zoom effect on each static image
- **Subtitles**: Auto-split narration into timed ASS subtitle units (max 24 chars)
- **Caching**: TTS audio is cached — rebuilds skip unchanged scenes

## API Reference

### Next.js Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/episodes` | List or create episodes |
| GET/PUT/DELETE | `/api/episodes/[id]` | Episode CRUD |
| POST | `/api/episodes/[id]/scenes` | Add scene |
| PUT/DELETE | `/api/scenes/[id]` | Update or delete scene |
| POST | `/api/production` | Trigger video build |
| GET | `/api/production/[taskId]/events` | SSE progress stream |
| POST | `/api/upload` | Upload image file |
| GET | `/api/files/[...path]` | Serve local assets |
| POST | `/api/tts` | Preview TTS audio |

### Worker Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/build` | Start video build |
| GET | `/build/{id}/events` | SSE progress |
| POST | `/tts/preview` | Generate TTS preview |
| GET | `/health` | Health check |

## License

MIT
