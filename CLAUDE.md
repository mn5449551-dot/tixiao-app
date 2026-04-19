# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

洋葱学园图文提效工作流 (tixiao-app) — AI-powered image-text production workflow for operations teams. Users create projects, write requirements, generate copy directions, configure image generation, review candidates, and export finalized images to ad platform specs.

**Stack**: Next.js 16 App Router, React 19, TypeScript, SQLite (better-sqlite3 + Drizzle ORM), React Flow (@xyflow/react), Tailwind v4, Zustand 5.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check (tsc --noEmit)
npm run test         # Run all tests
npm run test -- lib/__tests__/schema.test.ts  # Single test file
```

Tests use Node's built-in test runner with `tsx`. No Jest/Vitest.

## Architecture

### Data Flow

Requirement → Directions → Copy Cards → Image Configs → Candidate Pool → Finalized Pool → Export

Each stage is a React Flow node type: `requirementCard`, `directionCard`, `copyCard`, `imageConfigCard`, `candidatePool`, `finalizedPool`.

### Data Layer

- Schema: `lib/schema.ts` (15 tables, SQLite)
- Facade: `lib/project-data.ts` re-exports from `lib/project-data-modules/` — always import from the facade
- Internal helpers: `lib/project-data-modules-internal.ts`
- Bootstrap: `lib/db.ts` `bootstrap()` auto-creates tables/columns on startup. When changing `lib/schema.ts`, **always** update `bootstrap()` too.

### AI Pipeline

- Text client: `lib/ai/client.ts` — default model `deepseek-v3-2-251201`
- Image transport: `lib/ai/image-chat.ts` — multi-transport (images_generations, chat_completions, images/edits)
- Default image model: `doubao-seedream-4-0` (7 models defined in `lib/constants.ts` IMAGE_MODELS)
- Agents in `lib/ai/agents/`: assistant, direction, copy, image-description, image, requirement
- All agent prompts output strict JSON, all in Chinese

### API Routes

Next.js 16 App Router — `context.params` is a Promise:
```typescript
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
}
```
Shared helpers: `lib/api-route.ts` (`jsonNoStore`, `jsonError`, `readIdParam`). Client-side: `lib/api-fetch.ts` (`apiFetch`).

### Card Action Pattern

Each card type has a `-actions.ts` file (e.g. `components/cards/copy-card/copy-card-actions.ts`) that wraps `apiFetch()` calls. These are client-side modules, not React Server Actions.

### Generation Polling

`lib/hooks/use-generation-polling.ts` polls `/api/projects/[id]/generation-status` every 3s. `lib/workspace-graph-sync.ts` merges status into the graph; triggers full reload when all images complete.

### Storage & Export

- Images: `.local-data/storage/images/{projectId}/` (sharp for processing)
- Exports: `.local-data/storage/exports/{projectId}/` (ZIP via `/usr/bin/zip`)
- Logo overlay applied during **export only**, not during generation

### IDs

`createId(prefix)` from `lib/id.ts` → `prefix_<8-char-nanoid>` (e.g. `proj_a1b2c3d4`).

## Conventions

- **Chinese UI**: All user-facing text, error messages, and AI prompts are in Chinese
- **CSS tokens**: Warm earth-tone theme via CSS custom properties in `app/globals.css` (`--brand-500: #e8835a`)
- **Next.js 16**: Has breaking changes from standard Next.js — read `node_modules/next/dist/docs/` before writing route or page code
- **IP mode**: Switching from IP to normal style auto-clears `ipRole` and `referenceImageUrl`

## Environment Variables

Required in `.env.local`:
- `NEW_API_BASE_URL` — AI gateway URL (default: https://ops-ai-gateway.yc345.tv)
- `NEW_API_KEY` — API key for text/image model calls

Optional:
- `TIXIAO_DATA_ROOT` — Custom data storage path (default: `.local-data/`)

## Deployment

Server: `/root/tixiao-app` on Tencent Cloud. Update: `bash scripts/deploy.sh` (git pull → npm install → build → pm2 restart `tixiao`).
