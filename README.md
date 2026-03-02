# X Reply Drafter v2.0

AI-powered reply drafting Chrome extension for X/Twitter with engagement tracking, prompt ranking, and notes.

## Architecture

### Chrome Extension (`extension/`)
- **React popup** with 5 tabs: Dashboard, Prompts, Post Library, Analytics, Settings
- **Content script** injects "Draft Reply" button on every X post
- **Background script** routes messages between content script and LLM APIs
- **Works standalone** (direct LLM calls) or with optional backend

### Backend API (`backend/`)
- **Hono on Vercel** with Vercel KV (Redis) storage
- Optional — extension works without it via direct API calls
- Provides server-side encryption for API keys

## Features

### Core
- Draft Reply button on every X post (content script injection)
- Support for OpenAI, Anthropic, and any OpenAI-compatible API
- Auto-fetch available models from entered API key
- 4 tone/style modes: Professional, Casual, Provocative, Contrarian
- Auto-fill X compose box with drafted reply
- Auto-submit toggle (posts without manual click)

### Prompts
- Save and manage multiple draft prompts with tags
- Prompts ranked by average engagement
- Active prompt selector

### Engagement Tracking
- Captures likes, RTs, replies on drafted posts
- Post library with full history
- Periodic engagement scraping from X

### Notes
- Each reply has an attached notes field
- Add/edit notes after posting
- Search and filter posts by notes content
- Notes visible alongside engagement metrics

### Analytics
- Engagement by tone (bar chart)
- Best posting times (hour heatmap)
- Top performing prompts ranked by engagement
- Summary statistics

## Setup

### Extension (standalone mode)
```bash
cd extension
npm install
npm run build
# Load extension/dist as unpacked extension in Chrome
```

1. Go to `chrome://extensions`
2. Enable Developer Mode
3. Click "Load unpacked"
4. Select the `extension/dist` folder
5. Open extension popup → Settings → Enter API key

### Backend (optional)
```bash
cd backend
npm install
# Set environment variables:
# ENCRYPTION_SECRET=your-32-char-secret
# KV_REST_API_URL=your-vercel-kv-url
# KV_REST_API_TOKEN=your-vercel-kv-token
vercel deploy
```

Then enter your backend URL in extension Settings.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/draft` | Generate reply draft via LLM |
| POST | `/api/draft/models` | Fetch available models |
| GET | `/api/prompts` | List prompts (ranked by engagement) |
| POST | `/api/prompts` | Create/update prompt |
| DELETE | `/api/prompts/:id` | Delete prompt |
| GET | `/api/posts` | List posts with engagement + notes |
| GET | `/api/posts/:postId` | Get single post detail |
| POST | `/api/posts` | Save new reply record |
| POST | `/api/posts/track-engagement` | Update engagement metrics |
| POST | `/api/posts/notes/:postId` | Add/update notes |
| GET | `/api/posts/analytics/summary` | Engagement analytics |
| GET/POST | `/api/settings` | User settings |

## Tech Stack
- Frontend: React 19 + Vite + TypeScript
- Backend: Hono + Vercel KV
- Extension: Chrome Manifest V3
- No Supabase — lightweight, self-contained
