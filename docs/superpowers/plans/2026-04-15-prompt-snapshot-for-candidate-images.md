# 候选图真实生图快照 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the candidate-pool prompt modal show each image’s real generation snapshot by persisting a per-image request snapshot and redesigning the modal so prompt text is primary and reference images are secondary.

**Architecture:** Add a `generationRequestJson` snapshot to `generated_images`, populate it before each candidate image request is sent, and have candidate-pool graph data read prompt details only from that per-image snapshot. The modal then renders a snapshot-aware layout: prompt-first, compact reference thumbnails, and an explicit “regenerate to view” state for legacy images without snapshots.

**Tech Stack:** Next.js App Router, TypeScript, SQLite/Drizzle, node:test source/integration tests, existing candidate-pool modal components.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/schema.ts` | Add `generationRequestJson` to `generated_images` |
| `lib/db.ts` | Auto-migrate existing databases to include the new snapshot column |
| `lib/image-generation-service.ts` | Persist the real per-image generation request snapshot before model calls |
| `lib/workflow-graph-builders.ts` | Build candidate prompt details from `generationRequestJson` instead of group-level fallbacks |
| `components/cards/candidate-pool/prompt-details-modal.tsx` | Redesign modal layout: prompt-first, compact reference thumbnails, missing-snapshot state |
| `components/cards/candidate-pool-card.tsx` | Thread the richer prompt details shape into the modal |
| `lib/__tests__/image-generation-routes-source.test.ts` | Source coverage for snapshot persistence in generation flow |
| `lib/__tests__/workflow-graph.test.ts` | Graph coverage for snapshot-backed prompt details and missing-snapshot handling |
| `lib/__tests__/pool-card-source.test.ts` | Source coverage for modal layout and missing-snapshot copy |

---

### Task 1: Add failing tests for per-image snapshot persistence and snapshot-first UI

**Files:**
- Modify: `lib/__tests__/image-generation-routes-source.test.ts`
- Modify: `lib/__tests__/workflow-graph.test.ts`
- Modify: `lib/__tests__/pool-card-source.test.ts`

- [ ] **Step 1: Add a failing source test for `generationRequestJson` persistence**

In `lib/__tests__/image-generation-routes-source.test.ts`, extend the existing `image generation service stores prompt bundles and per-image final prompt snapshots` test with these assertions:

```ts
  assert.match(generateSource, /generationRequestJson|generation_request_json/);
  assert.match(generateSource, /referenceImageUrls/);
  assert.match(generateSource, /promptText:\s*item\.prompt/);
  assert.match(generateSource, /referenceImages:\s*item\.referenceImageUrls\.map/);
```

- [ ] **Step 2: Add a failing graph test for snapshot-backed prompt details**

In `lib/__tests__/workflow-graph.test.ts`, update the candidate image fixture so it includes a `generationRequestJson` string:

```ts
                        generationRequestJson: JSON.stringify({
                          promptText: "真实正向提示词",
                          negativePrompt: "真实负向提示词",
                          model: "doubao-seedream-4-0",
                          aspectRatio: "1:1",
                          referenceImages: [{ url: "/api/reference/demo.png" }],
                        }),
```

Then replace the candidate-image assertions with:

```ts
  assert.equal(candidateImage.promptDetails?.promptText, "真实正向提示词");
  assert.equal(candidateImage.promptDetails?.negativePrompt, "真实负向提示词");
  assert.equal(candidateImage.promptDetails?.model, "doubao-seedream-4-0");
  assert.equal(candidateImage.promptDetails?.hasSnapshot, true);
  assert.equal(candidateImage.promptDetails?.referenceImages[0]?.url, "/api/reference/demo.png");
```

Also add a second image fixture in an existing graph test with `generationRequestJson: null` and assert:

```ts
  assert.equal(candidateImage.promptDetails?.hasSnapshot, false);
```

- [ ] **Step 3: Add a failing modal source test for the new layout and missing-snapshot copy**

In `lib/__tests__/pool-card-source.test.ts`, extend `candidate pool prompt details modal shows prompt sections and copy actions` with:

```ts
  assert.match(source, /hasSnapshot/);
  assert.match(source, /该图片缺少历史生图快照，请重新生成后查看/);
  assert.match(source, /referenceImages/);
  assert.doesNotMatch(source, /style=\{\{\s*aspectRatio:\s*"1 \/ 1"/);
```

- [ ] **Step 4: Run the focused tests to verify they fail**

Run:

```bash
npm run test -- lib/__tests__/image-generation-routes-source.test.ts lib/__tests__/workflow-graph.test.ts lib/__tests__/pool-card-source.test.ts
```

Expected:
- `image-generation-routes-source.test.ts` fails because `generationRequestJson` is not written yet.
- `workflow-graph.test.ts` fails because graph data does not read snapshot JSON or expose `hasSnapshot/referenceImages`.
- `pool-card-source.test.ts` fails because the modal still uses the large 1:1 reference card and lacks missing-snapshot copy.

- [ ] **Step 5: Commit the red tests**

```bash
git add lib/__tests__/image-generation-routes-source.test.ts lib/__tests__/workflow-graph.test.ts lib/__tests__/pool-card-source.test.ts
git commit -m "test: cover candidate prompt snapshot behavior"
```

---

### Task 2: Persist `generationRequestJson` in schema, migration, and image generation flow

**Files:**
- Modify: `lib/schema.ts`
- Modify: `lib/db.ts`
- Modify: `lib/image-generation-service.ts`
- Test: `lib/__tests__/image-generation-routes-source.test.ts`

- [ ] **Step 1: Add the schema field**

In `lib/schema.ts`, extend `generatedImages` with:

```ts
  generationRequestJson: text("generation_request_json"),
```

Place it next to the existing prompt snapshot fields:

```ts
  finalPromptText: text("final_prompt_text"),
  finalNegativePrompt: text("final_negative_prompt"),
  generationRequestJson: text("generation_request_json"),
  seed: integer("seed"),
```

- [ ] **Step 2: Add the database migration guard**

In `lib/db.ts`, after the existing `final_negative_prompt` migration, add:

```ts
  if (!generatedImageColumns.some((column) => column.name === "generation_request_json")) {
    connection.exec("ALTER TABLE generated_images ADD COLUMN generation_request_json TEXT;");
  }
```

- [ ] **Step 3: Persist the real request snapshot per image**

In `lib/image-generation-service.ts`, keep the existing `workItems` shape and, in the “Save prompt snapshots before generating” loop, write the new JSON snapshot:

```ts
    for (const item of workItems) {
      db.update(generatedImages)
        .set({
          finalPromptText: item.prompt,
          finalNegativePrompt: item.negativePrompt,
          generationRequestJson: JSON.stringify({
            promptText: item.prompt,
            negativePrompt: item.negativePrompt,
            model: config.imageModel ?? null,
            aspectRatio: config.aspectRatio,
            referenceImages: item.referenceImageUrls.map((url) => ({ url })),
          }),
          updatedAt: Date.now(),
        })
        .where(eq(generatedImages.id, item.imageId))
        .run();
    }
```

Do not delay this write until generation succeeds. The snapshot must exist even when model generation fails.

- [ ] **Step 4: Run the focused source test again**

Run:

```bash
npm run test -- lib/__tests__/image-generation-routes-source.test.ts
```

Expected: PASS for the new `generationRequestJson` assertions.

- [ ] **Step 5: Commit the persistence layer**

```bash
git add lib/schema.ts lib/db.ts lib/image-generation-service.ts lib/__tests__/image-generation-routes-source.test.ts
git commit -m "feat: persist per-image candidate generation snapshots"
```

---

### Task 3: Build prompt details from the snapshot and expose missing-snapshot state

**Files:**
- Modify: `lib/workflow-graph-builders.ts`
- Modify: `components/cards/candidate-pool-card.tsx`
- Test: `lib/__tests__/workflow-graph.test.ts`

- [ ] **Step 1: Expand the prompt-details type in the candidate pool card**

In `components/cards/candidate-pool-card.tsx`, replace the imported `PromptDetails` usage shape so `CandidateImage.promptDetails` can carry snapshot state:

```ts
  promptDetails?: {
    promptText: string | null;
    negativePrompt: string | null;
    model: string | null;
    aspectRatio: string | null;
    referenceImages: Array<{ url: string }>;
    hasSnapshot: boolean;
  } | null;
```

No UI logic changes yet in this task; this just aligns the React types with the new graph payload.

- [ ] **Step 2: Parse `generationRequestJson` in the graph builder**

In `lib/workflow-graph-builders.ts`, add a small helper near the top:

```ts
function parseGenerationRequestSnapshot(value: string | null | undefined) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as {
      promptText?: string | null;
      negativePrompt?: string | null;
      model?: string | null;
      aspectRatio?: string | null;
      referenceImages?: Array<{ url?: string | null }>;
    };

    return {
      promptText: parsed.promptText ?? null,
      negativePrompt: parsed.negativePrompt ?? null,
      model: parsed.model ?? null,
      aspectRatio: parsed.aspectRatio ?? null,
      referenceImages: (parsed.referenceImages ?? [])
        .filter((item) => typeof item?.url === "string" && item.url.trim().length > 0)
        .map((item) => ({ url: item.url!.trim() })),
      hasSnapshot: true,
    };
  } catch {
    return null;
  }
}
```

Then replace the current inline `promptDetails` mapping with:

```ts
          promptDetails: parseGenerationRequestSnapshot(img.generationRequestJson) ?? {
            promptText: null,
            negativePrompt: null,
            model: null,
            aspectRatio: null,
            referenceImages: [],
            hasSnapshot: false,
          },
```

This explicitly avoids falling back to `group.referenceImageUrl` for display.

- [ ] **Step 3: Run the workflow graph tests**

Run:

```bash
npm run test -- lib/__tests__/workflow-graph.test.ts
```

Expected: PASS for both the snapshot-backed details and the missing-snapshot state assertions.

- [ ] **Step 4: Commit the graph/data mapping**

```bash
git add lib/workflow-graph-builders.ts components/cards/candidate-pool-card.tsx lib/__tests__/workflow-graph.test.ts
git commit -m "feat: read candidate prompt details from per-image snapshots"
```

---

### Task 4: Redesign the modal to be prompt-first and snapshot-aware

**Files:**
- Modify: `components/cards/candidate-pool/prompt-details-modal.tsx`
- Modify: `components/cards/candidate-pool-card.tsx`
- Test: `lib/__tests__/pool-card-source.test.ts`

- [ ] **Step 1: Update the modal props to the richer snapshot shape**

In `components/cards/candidate-pool/prompt-details-modal.tsx`, change the exported type to:

```ts
export type PromptDetails = {
  promptText: string | null;
  negativePrompt: string | null;
  model: string | null;
  aspectRatio: string | null;
  referenceImages: Array<{ url: string }>;
  hasSnapshot: boolean;
};
```

- [ ] **Step 2: Implement the missing-snapshot state**

Add the derived state at the top of the modal:

```ts
  const hasSnapshot = details?.hasSnapshot ?? false;
  const promptText = hasSnapshot ? (details?.promptText?.trim() || "") : "该图片缺少历史生图快照，请重新生成后查看。";
  const negativePrompt = hasSnapshot
    ? (details?.negativePrompt?.trim() || "未传 negative prompt")
    : "该图片缺少历史生图快照，请重新生成后查看。";
  const referenceImages = hasSnapshot ? (details?.referenceImages ?? []) : [];
```

Disable copy actions when `!hasSnapshot`:

```tsx
            <Button
              variant="secondary"
              className="h-8 shrink-0 px-3 text-xs"
              disabled={!hasSnapshot}
              onClick={() => onCopy("正向提示词", promptText)}
            >
              复制
            </Button>
```

Apply the same pattern to the negative-prompt copy button.

- [ ] **Step 3: Make prompt text primary and shrink reference images**

In the modal layout:

1. Keep the model/aspect ratio summary block first.
2. Move the prompt section directly after it.
3. Replace the large square reference image block with a compact thumbnail strip:

```tsx
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--ink-900)]">参考图</h3>
          {referenceImages.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {referenceImages.map((item) => (
                <div
                  key={item.url}
                  className="relative h-24 w-24 overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-2)]"
                >
                  <Image src={item.url} alt="参考图" fill sizes="96px" className="object-contain" />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--line-soft)] px-4 py-4 text-sm text-[var(--ink-500)]">
              {hasSnapshot ? "未传参考图" : "该图片缺少历史生图快照，请重新生成后查看。"}
            </div>
          )}
        </section>
```

Do not keep the old `style={{ aspectRatio: "1 / 1" }}` large-card pattern.

- [ ] **Step 4: Keep the candidate pool copy handler unchanged, but ensure the modal still receives `promptDetails`**

No behavior rewrite is needed in `components/cards/candidate-pool-card.tsx`; just keep:

```tsx
      <PromptDetailsModal
        details={promptDetailsImage?.promptDetails ?? null}
        isOpen={Boolean(promptDetailsImage)}
        onClose={() => setPromptDetailsImageId(null)}
        onCopy={handleCopyPromptText}
      />
```

Only update any local types/imports if TypeScript requires it.

- [ ] **Step 5: Run the modal source tests**

Run:

```bash
npm run test -- lib/__tests__/pool-card-source.test.ts
```

Expected: PASS for the missing-snapshot copy and the no-large-1:1-reference-card assertions.

- [ ] **Step 6: Commit the modal redesign**

```bash
git add components/cards/candidate-pool/prompt-details-modal.tsx components/cards/candidate-pool-card.tsx lib/__tests__/pool-card-source.test.ts
git commit -m "feat: show candidate prompt snapshots in a prompt-first modal"
```

---

### Task 5: Full verification and wrap-up

**Files:**
- Modify: none unless verification uncovers issues
- Test: `lib/__tests__/image-generation-routes-source.test.ts`
- Test: `lib/__tests__/workflow-graph.test.ts`
- Test: `lib/__tests__/pool-card-source.test.ts`

- [ ] **Step 1: Run the focused regression suite**

Run:

```bash
npm run test -- lib/__tests__/image-generation-routes-source.test.ts lib/__tests__/workflow-graph.test.ts lib/__tests__/pool-card-source.test.ts
```

Expected: PASS for snapshot persistence, graph mapping, and modal layout/state.

- [ ] **Step 2: Run type checking**

Run:

```bash
npm run typecheck
```

Expected: PASS with no type regressions from `generationRequestJson`, `referenceImages`, or `hasSnapshot`.

- [ ] **Step 3: Run the full test suite**

Run:

```bash
npm run test
```

Expected: PASS, confirming the new snapshot field and modal redesign did not regress unrelated workspace flows.

- [ ] **Step 4: Manual verification**

Run the app:

```bash
npm run dev
```

Then verify:
- A newly generated candidate image opens a modal showing its real prompt text, negative prompt, model, ratio, and compact reference thumbnails.
- A legacy image without `generationRequestJson` shows “该图片缺少历史生图快照，请重新生成后查看。”
- Prompt text is visible before scrolling and reference images no longer dominate the modal.
- Copy buttons are disabled for missing-snapshot images and enabled for new images.

- [ ] **Step 5: Commit the verified implementation state**

```bash
git add lib/schema.ts lib/db.ts lib/image-generation-service.ts lib/workflow-graph-builders.ts
git add components/cards/candidate-pool/prompt-details-modal.tsx components/cards/candidate-pool-card.tsx
git add lib/__tests__/image-generation-routes-source.test.ts lib/__tests__/workflow-graph.test.ts lib/__tests__/pool-card-source.test.ts
git commit -m "feat: persist and display candidate image generation snapshots"
```

---

## Self-Review

### Spec coverage

- Per-image real request snapshot: covered in Task 2.
- No legacy backfill / explicit missing-snapshot messaging: covered in Tasks 3 and 4.
- Prompt-first modal layout with smaller reference images: covered in Task 4.
- Snapshot-backed candidate prompt details instead of group-level fallback: covered in Task 3.

### Placeholder scan

- No `TODO`/`TBD` placeholders.
- Every task includes concrete files, code snippets, and exact commands.

### Type consistency

- `generationRequestJson` is used consistently across schema, db migration, generation service, and graph builder.
- `PromptDetails` uses `referenceImages` and `hasSnapshot` consistently across graph data and modal rendering.

