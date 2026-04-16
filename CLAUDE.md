# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

洋葱学园图文提效工作流 (tixiao-app) — AI-powered image-text production workflow for operations teams. Next.js 16 App Router + SQLite + Drizzle ORM + React Flow.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check (tsc --noEmit)
npm run test         # Run all tests (NODE_ENV=test node --import tsx --test)
npm run db:generate  # Generate Drizzle migrations
npm run db:push      # Push schema changes to database
```

Run a single test file:
```bash
npm run test lib/__tests__/schema.test.ts
```

Tests use Node's built-in test runner with `tsx` for TypeScript. No Jest/Vitest. Test files in `lib/__tests__/` follow `*.test.ts` pattern.

## Environment Variables

Required in `.env.local`:
- `NEW_API_BASE_URL` — AI gateway URL (default: https://ops-ai-gateway.yc345.tv)
- `NEW_API_KEY` — API key for text/image model calls

Optional:
- `TIXIAO_DATA_ROOT` — Custom data storage path (default: `.local-data/`)

## Architecture

### Directory Structure
- `app/` — Next.js App Router pages and API routes
- `components/` — React components: `ui/`, `cards/`, `workspace/`, `canvas/`, `dashboard/`, `inpaint/`
- `lib/` — Core business logic, AI agents, data access, storage
- `db/` — SQLite database file and Drizzle migrations

### Data Layer
- SQLite via `better-sqlite3` with Drizzle ORM
- Schema in `lib/schema.ts` — 13 tables: projectFolders, projects, requirementCards, directions, copyCards, copies, imageConfigs, imageGroups, generatedImages, exportRecords, assistantStates, canvasStates, projectGenerationRuns, settings
- Public API facade: `lib/project-data.ts` re-exports from `lib/project-data-modules/`
- Database file: `.local-data/db/onion.db` (auto-migration on startup via `lib/db.ts` bootstrap)

### Database Migrations
`lib/db.ts` `bootstrap()` auto-creates missing tables and columns on startup using `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE`. When adding new tables/columns to `lib/schema.ts`, **always** add corresponding bootstrap checks in `lib/db.ts`. No manual migration needed on server — restart auto-applies.

### AI Agents & Models
- Client: `lib/ai/client.ts` — chat completions and multimodal calls via AI gateway
- Image transport: `lib/ai/image-chat.ts` — multi-transport image generation (images_generations, chat_completions, images/edits)
- 5 agents in `lib/ai/agents/`: assistant (requirement), direction, copy, image-description, image
- Knowledge in `lib/ai/knowledge/` and `lib/ai/agents/*-knowledge.ts`
- All agents output strict JSON. All prompts are in Chinese.
- Default text model: `deepseek-v3-2-251201`, default image model: `gpt-image-1` (configurable via Settings page)

### Supported Image Models
7 models with different transports and capabilities (defined in `lib/constants.ts` IMAGE_MODELS):
- **doubao** (seedream 4-0/4-5/5-0-lite): `images_generations` + `images/edits`, all aspect ratios, returns URL
- **qwen-image-2.0**: `images_generations` + `images/edits`, all ratios, returns b64_json
- **gemini-3.1-flash / gemini-3-pro**: `chat_completions`, returns inlineData (base64)
- **gpt-image-1.5**: `images_generations`, only 1:1, returns b64_json

### Workflow Canvas
- React Flow graph built in `lib/workflow-graph.ts` from workspace data
- Node types: requirementCard, directionCard, copyCard, imageConfigCard, candidatePool, finalizedPool
- Layout: `lib/canvas-layout.ts`, interaction: `lib/canvas-interaction.ts`

### Storage & Export
- `lib/storage.ts` — image file management using sharp (save, thumbnail generation, logo overlay)
- Images: `.local-data/storage/images/{projectId}/`
- Exports: `.local-data/storage/exports/{projectId}/` (ZIP via `/usr/bin/zip`)
- Logo overlay applied during **export** only, not during image generation

### Workspace UI
- Three-panel layout: ProjectTree (left, 240px) | ReactFlow Canvas (center) | AgentPanel (right, 360px)
- Panels collapse below 1280px viewport width
- Dynamic imports with `next/dynamic` for SSR-safe loading

## Key Patterns

### API Routes
All routes in `app/api/` follow Next.js 16 App Router conventions. Use `context.params` as Promise:
```typescript
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  // ...
}
```
Routes use shared helpers from `lib/api-route.ts`: `jsonNoStore()`, `jsonError()`, `readIdParam()`. Client-side uses `apiFetch()` from `lib/api-fetch.ts`.

### Project Data Modules
Operations are modularized in `lib/project-data-modules/`:
- `project-queries.ts` — read operations and project CRUD
- `direction-operations.ts` — direction generation and updates
- `copy-operations.ts` — copy card generation
- `image-config-operations.ts` — image config and variant generation
- `export-context.ts` — export data aggregation
- `settings-operations.ts` — system settings CRUD

Internal implementation: `lib/project-data-modules-internal.ts`. Import from the facade `lib/project-data.ts`, not directly from modules.

### ID Generation
All IDs use `createId(prefix)` from `lib/id.ts` generating `prefix_<8-char-nanoid>` (e.g., `proj_a1b2c3d4`).

### IP Mode
Switching from IP to normal style clears `ipRole` and `referenceImageUrl` automatically.

## Important Notes

- **Chinese UI**: All user-facing text, AI prompts, error messages, and comments are in Chinese. Maintain this in any changes.
- **AI Gateway**: Text model defaults to `deepseek-v3-2-251201`, image model to `gpt-image-1`. Both require `NEW_API_KEY`.
- **CSS**: Tailwind v4 with CSS-based config in `globals.css`. Uses CSS custom properties for theming (warm earth tones, `--brand-500: #e8835a`).
- **Fonts**: Noto Sans SC (sans), Noto Serif SC (serif), IBM Plex Mono (mono) via `next/font/google`.

### Deployment
- Server: `/root/tixiao-app` on Tencent Cloud (101.42.53.212)
- One-command update: `bash scripts/deploy.sh` (git pull → npm install → build → pm2 restart)
- PM2 process name: `tixiao`
