# Final Requirements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved workflow requirements so button labels, generation flows, delete guards, and candidate image behavior match the finalized product rules.

**Architecture:** Keep the existing workflow graph and data model, but tighten behavior at the UI and API boundaries. Most changes live in card components and route guards, with targeted data-layer support and regression tests to lock the rules down.

**Tech Stack:** Next.js App Router, React 19, TypeScript, node:test, SQLite/Drizzle

---

### Task 1: Lock In The New Requirement And Card Labels

**Files:**
- Modify: `components/cards/requirement-card.tsx`
- Modify: `components/cards/copy-card.tsx`
- Test: `lib/__tests__/requirement-card-source.test.ts`
- Test: `lib/__tests__/copy-card-source.test.ts`

- [ ] **Step 1: Write the failing source tests**

Add expectations that the requirement card contains `保存并生成方向` and the copy card contains `生成图片配置`, while `生成选中文案` is absent.

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `NODE_ENV=test node --import tsx --test lib/__tests__/requirement-card-source.test.ts lib/__tests__/copy-card-source.test.ts`

- [ ] **Step 3: Update the card labels**

Change the requirement card submit copy to `保存并生成方向` and the copy-card primary action copy to `生成图片配置`.

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run: `NODE_ENV=test node --import tsx --test lib/__tests__/requirement-card-source.test.ts lib/__tests__/copy-card-source.test.ts`

### Task 2: Remove Direction Regeneration And Flatten Direction Presentation

**Files:**
- Modify: `components/cards/direction-card.tsx`
- Modify: `components/cards/direction-card/direction-item-row.tsx`
- Test: `lib/__tests__/direction-card-source.test.ts`

- [ ] **Step 1: Write the failing source tests**

Add expectations that the direction row no longer renders regenerate / expand controls and that the direction card still exposes append generation.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `NODE_ENV=test node --import tsx --test lib/__tests__/direction-card-source.test.ts`

- [ ] **Step 3: Implement the UI changes**

Remove the per-item regenerate action, remove expand/collapse state, render each direction’s full content inline, and reshape the summary/details layout to a wider, flatter presentation.

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `NODE_ENV=test node --import tsx --test lib/__tests__/direction-card-source.test.ts`

### Task 3: Enforce Delete Guards For Directions, Copies, And Copy Cards

**Files:**
- Modify: `components/cards/direction-card.tsx`
- Modify: `components/cards/copy-card.tsx`
- Modify: `components/cards/copy-card/copy-item-row.tsx`
- Modify: `lib/copy-card-presenter.ts`
- Modify: `app/api/copy-cards/[id]/route.ts`
- Modify: `lib/project-data-modules-internal.ts`
- Test: `lib/__tests__/copy-card-presenter.test.ts`
- Test: `lib/__tests__/project-data.integration.test.ts`

- [ ] **Step 1: Write the failing tests**

Add coverage for:
- delete-state presentation when an item has downstream content
- copy-card delete rejection when any copy in the card is locked or downstream-backed
- direction delete rejection when downstream copy cards exist

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `NODE_ENV=test node --import tsx --test lib/__tests__/copy-card-presenter.test.ts lib/__tests__/project-data.integration.test.ts`

- [ ] **Step 3: Implement guard logic**

Make delete affordances explain `已有下游内容，不能删除`, disable or block deletes in the UI, and reject invalid deletes in the API/data layer.

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run: `NODE_ENV=test node --import tsx --test lib/__tests__/copy-card-presenter.test.ts lib/__tests__/project-data.integration.test.ts`

### Task 4: Simplify Generation Routes To JSON And Keep Per-Direction Copy Requests

**Files:**
- Modify: `app/api/projects/[id]/directions/generate/route.ts`
- Modify: `app/api/directions/[id]/copy-cards/generate/route.ts`
- Modify: `app/api/projects/[id]/requirement/route.ts`
- Test: `lib/__tests__/workspace-routes.test.ts`
- Test: `lib/__tests__/direction-card-source.test.ts`

- [ ] **Step 1: Write the failing route/source tests**

Add expectations that direction and copy generation routes return JSON payloads instead of SSE-specific responses, while preserving per-direction request behavior from the UI.

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `NODE_ENV=test node --import tsx --test lib/__tests__/workspace-routes.test.ts lib/__tests__/direction-card-source.test.ts`

- [ ] **Step 3: Implement the route changes**

Replace `createSseResponse` responses with JSON payloads for requirement/direction/copy generation routes without changing the one-request-per-direction client flow.

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run: `NODE_ENV=test node --import tsx --test lib/__tests__/workspace-routes.test.ts lib/__tests__/direction-card-source.test.ts`

### Task 5: Preserve Candidate Pool Append Semantics With Mutable Image Configs

**Files:**
- Modify: `components/cards/image-config-card.tsx`
- Modify: `components/cards/image-config/image-config-actions.ts`
- Modify: `lib/project-data-modules-internal.ts`
- Test: `lib/__tests__/project-data.integration.test.ts`
- Test: `lib/__tests__/workspace-queries.test.ts`

- [ ] **Step 1: Write the failing tests**

Add coverage that repeated generation from image config appends new groups, updates new groups with the latest config values, and leaves older groups intact.

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `NODE_ENV=test node --import tsx --test lib/__tests__/project-data.integration.test.ts lib/__tests__/workspace-queries.test.ts`

- [ ] **Step 3: Implement the image-config behavior**

Keep generation only on the image-config card, preserve append semantics, and ensure newly generated groups snapshot the latest config without mutating old groups.

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run: `NODE_ENV=test node --import tsx --test lib/__tests__/project-data.integration.test.ts lib/__tests__/workspace-queries.test.ts`

### Task 6: Add Minimal Status Feedback For Direction, Copy, And Image Failures

**Files:**
- Modify: `components/cards/direction-card.tsx`
- Modify: `components/cards/copy-card.tsx`
- Modify: `components/cards/candidate-pool-card.tsx`
- Modify: `lib/workspace-graph.ts`
- Modify: `lib/workspace-graph-sync.ts`
- Test: `lib/__tests__/workspace-graph-sync.test.ts`
- Test: `lib/__tests__/direction-card-source.test.ts`
- Test: `lib/__tests__/copy-card-source.test.ts`

- [ ] **Step 1: Write the failing tests**

Add coverage for visible generating states on direction/copy cards and per-image retry-oriented failure handling in candidate pools.

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `NODE_ENV=test node --import tsx --test lib/__tests__/workspace-graph-sync.test.ts lib/__tests__/direction-card-source.test.ts lib/__tests__/copy-card-source.test.ts`

- [ ] **Step 3: Implement the minimal status layer**

Show generating state in direction/copy cards when user-triggered requests are in flight, keep image-config card lightweight, and continue surfacing image failures at the individual image level.

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run: `NODE_ENV=test node --import tsx --test lib/__tests__/workspace-graph-sync.test.ts lib/__tests__/direction-card-source.test.ts lib/__tests__/copy-card-source.test.ts`

### Task 7: Full Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-09-final-requirements-implementation.md`
- Test: `package.json`

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

- [ ] **Step 2: Run static verification**

Run: `npm run typecheck`

- [ ] **Step 3: Run lint**

Run: `npm run lint`

- [ ] **Step 4: Update plan checkboxes and summarize any intentional follow-up**

Mark completed tasks in this document and note any intentionally deferred work.
