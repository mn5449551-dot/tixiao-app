# Export And Copy Regeneration Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix export correctness and safety issues, add true single-copy regeneration, and remove stale image cache behavior without changing the excluded inpaint scope.

**Architecture:** Extract export-specific logic into focused helper functions so export filtering, naming, and format conversion are testable in isolation. Extend the project-data layer with a dedicated single-copy regeneration path that preserves the copy record while clearing and rebuilding downstream assets, then expose it through a small API surface used by the UI.

**Tech Stack:** Next.js 16 App Router, Node.js test runner, better-sqlite3, Drizzle ORM, sharp

---

### Task 1: Cover Export Helper Behavior

**Files:**
- Create: `lib/__tests__/export-utils.test.ts`
- Create: `lib/export/utils.ts`

- [ ] Add failing tests for safe file naming, naming-rule compatibility, and target-slot expansion.
- [ ] Run `npm test -- lib/__tests__/export-utils.test.ts` and confirm failure.
- [ ] Implement minimal export helper functions in `lib/export/utils.ts`.
- [ ] Re-run `npm test -- lib/__tests__/export-utils.test.ts` and confirm pass.

### Task 2: Cover Single-Copy Regeneration Behavior

**Files:**
- Modify: `lib/__tests__/project-data.integration.test.ts`
- Modify: `lib/db.ts`
- Modify: `lib/project-data.ts`

- [ ] Add a failing integration test proving that single-copy regeneration updates copy text, unlocks the copy, and removes downstream image config and files.
- [ ] Run `npm test -- lib/__tests__/project-data.integration.test.ts` and confirm failure.
- [ ] Add the minimal DB reset/test hook support needed for isolated integration testing.
- [ ] Implement the single-copy regeneration function in `lib/project-data.ts`.
- [ ] Re-run `npm test -- lib/__tests__/project-data.integration.test.ts` and confirm pass.

### Task 3: Wire The Export Route To The Tested Helpers

**Files:**
- Modify: `app/api/projects/[id]/export/route.ts`
- Modify: `lib/storage.ts`
- Modify: `app/api/images/[id]/file/route.ts`

- [ ] Refactor export route to sanitize filenames, honor `target_slots`, accept `channel_slot_date_version`, and always write bytes in the requested format.
- [ ] Update storage/export helpers if needed so format conversion happens in one place.
- [ ] Relax image file cache headers so regenerated content is not served as immutable.
- [ ] Run targeted tests, then `npm run typecheck`.

### Task 4: Wire Real Copy Regeneration

**Files:**
- Modify: `app/api/copies/[id]/route.ts`
- Modify: `components/cards/copy-card.tsx`

- [ ] Extend the copy route with a regeneration action that calls the new `lib/project-data.ts` function.
- [ ] Update the copy card button to use the regeneration action instead of deletion.
- [ ] Verify the button still refreshes the canvas and that explicit delete behavior is unchanged.

### Task 5: Verification And Review

**Files:**
- Modify: `README.md` if behavior documentation changes become necessary

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Request code review and address any important findings before closing out.
