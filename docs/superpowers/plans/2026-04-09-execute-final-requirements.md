# Execute Final Requirements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the current `main` baseline in line with `06-final-requirements.md` and `07-final-requirements-executable.md`, including button copy, direction-card layout rules, delete guards, candidate-pool visibility, and layout-safe card sizing.

**Architecture:** Keep the existing workflow shape and data model, but tighten UI behavior and route/data rules at the card boundaries. Most changes live in the requirement/direction/copy cards and their related routes, with graph/layout updates to preserve auto-placement and "一键整理" behavior.

**Tech Stack:** Next.js App Router, React 19, TypeScript, node:test, React Flow, SQLite/Drizzle

---

### Task 1: Requirement And Copy Entry Labels

**Files:**
- Modify: `components/cards/requirement-card.tsx`
- Modify: `components/cards/copy-card.tsx`
- Test: `lib/__tests__/requirement-card-source.test.ts`
- Test: `lib/__tests__/copy-card-source.test.ts`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run `NODE_ENV=test node --import tsx --test lib/__tests__/requirement-card-source.test.ts lib/__tests__/copy-card-source.test.ts`**
- [ ] **Step 3: Change requirement button copy to `保存并生成方向` and copy-card primary CTA to `生成图片配置`**
- [ ] **Step 4: Re-run the same tests until green**

### Task 2: Direction Card Behavior And Layout

**Files:**
- Modify: `components/cards/direction-card.tsx`
- Modify: `components/cards/direction-card/direction-item-row.tsx`
- Modify: `components/cards/direction-card/direction-card-actions.ts`
- Test: `lib/__tests__/direction-card-source.test.ts`

- [ ] **Step 1: Write/adjust failing tests for no regenerate button, no collapse/expand, and loading feedback**
- [ ] **Step 2: Run `NODE_ENV=test node --import tsx --test lib/__tests__/direction-card-source.test.ts`**
- [ ] **Step 3: Remove regenerate entry points, keep original field names, and render each direction in a two-row, six-slot horizontal density layout with auto-occupying fields**
- [ ] **Step 4: Keep append/edit/delete actions only, and preserve lightweight loading feedback**
- [ ] **Step 5: Re-run the same tests until green**

### Task 3: Delete Guard Rules

**Files:**
- Modify: `lib/project-data-modules-internal.ts`
- Modify: `app/api/directions/[id]/route.ts`
- Modify: `app/api/copy-cards/[id]/route.ts`
- Modify: `components/cards/copy-card.tsx`
- Modify: `components/cards/copy-card/copy-item-row.tsx`
- Modify: `lib/copy-card-presenter.ts`
- Test: `lib/__tests__/copy-card-presenter.test.ts`
- Test: `lib/__tests__/project-data.integration.test.ts`
- Test: `lib/__tests__/workspace-routes.test.ts`

- [ ] **Step 1: Write/adjust failing tests for "有下游不能删除" on directions, copies, and copy cards**
- [ ] **Step 2: Run `NODE_ENV=test node --import tsx --test lib/__tests__/copy-card-presenter.test.ts lib/__tests__/project-data.integration.test.ts lib/__tests__/workspace-routes.test.ts`**
- [ ] **Step 3: Enforce delete rejection in data/API layers and disable buttons with concise tooltip/title messaging in the UI**
- [ ] **Step 4: Re-run the same tests until green**

### Task 4: Copy Append And JSON Generation Routes

**Files:**
- Modify: `components/cards/copy-card/copy-card-actions.ts`
- Modify: `app/api/directions/[id]/copy-cards/generate/route.ts`
- Modify: `app/api/projects/[id]/directions/generate/route.ts`
- Modify: `lib/project-data-modules/copy-operations.ts`
- Modify: `lib/project-data.ts`
- Modify: `lib/project-data-modules-internal.ts`
- Test: `lib/__tests__/project-data.integration.test.ts`
- Test: `lib/__tests__/workspace-routes.test.ts`
- Test: `lib/__tests__/api-fetch-source.test.ts`

- [ ] **Step 1: Write/adjust failing tests for append-to-current-card behavior and JSON generation responses**
- [ ] **Step 2: Run `NODE_ENV=test node --import tsx --test lib/__tests__/project-data.integration.test.ts lib/__tests__/workspace-routes.test.ts lib/__tests__/api-fetch-source.test.ts`**
- [ ] **Step 3: Ensure "追加生成文案" appends to the current card and generation routes return JSON rather than SSE**
- [ ] **Step 4: Re-run the same tests until green**

### Task 5: Candidate Pool Visibility And Layout Safety

**Files:**
- Modify: `lib/workflow-graph-builders.ts`
- Modify: `lib/workflow-graph.ts`
- Modify: `lib/canvas-layout.ts`
- Modify: `components/canvas/workflow-canvas.tsx`
- Test: `lib/__tests__/workflow-graph.test.ts`
- Test: `lib/__tests__/canvas-layout.test.ts`

- [ ] **Step 1: Write/adjust failing tests for candidate-pool visibility during pending/generating states and non-overlapping layout after card size changes**
- [ ] **Step 2: Run `NODE_ENV=test node --import tsx --test lib/__tests__/workflow-graph.test.ts lib/__tests__/canvas-layout.test.ts`**
- [ ] **Step 3: Make candidate pools appear as soon as groups exist, and tune auto-layout / default placement so widened cards do not stack or overlap**
- [ ] **Step 4: Re-run the same tests until green**

### Task 6: Final Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-09-execute-final-requirements.md`

- [ ] **Step 1: Run `npm test`**
- [ ] **Step 2: Run `npm run typecheck`**
- [ ] **Step 3: Run `npm run lint`**
- [ ] **Step 4: Update this plan’s checklist state if needed**
