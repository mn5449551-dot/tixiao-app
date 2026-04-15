# 候选图池提示词查看功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a prompt-inspection modal to the candidate pool so each completed original candidate image can show its real generation inputs: prompt, negative prompt, model, aspect ratio, and reference image, with copy support.

**Architecture:** Reuse the existing canvas graph payload instead of adding a new details API. Extend candidate image node data with `promptDetails`, then surface a local modal from `CandidatePoolCard` and expose a new `查看提示词` button only for completed non-inpaint candidate images.

**Tech Stack:** Next.js App Router, React 19, TypeScript, existing `Modal` component, node:test source-level tests.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/workflow-graph-types.ts` | Candidate pool graph type definitions for prompt details |
| `lib/workflow-graph-builders.ts` | Map DB-backed candidate image data into `promptDetails` |
| `components/cards/candidate-pool-card.tsx` | Manage prompt-details modal state and copy feedback |
| `components/cards/candidate-pool/candidate-image-card.tsx` | Add `查看提示词` button with visibility guard |
| `components/cards/candidate-pool/candidate-group-card.tsx` | Pass prompt-inspection handler through grouped candidate layouts |
| `components/cards/candidate-pool/prompt-details-modal.tsx` | New modal component for reference image and prompt display/copy |
| `lib/__tests__/workflow-graph.test.ts` | Assert candidate nodes carry prompt details |
| `lib/__tests__/pool-card-source.test.ts` | Assert candidate pool UI exposes prompt inspection entry points |

---

### Task 1: Extend candidate graph data with prompt details

**Files:**
- Modify: `lib/workflow-graph-types.ts`
- Modify: `lib/workflow-graph-builders.ts`
- Test: `lib/__tests__/workflow-graph.test.ts`

- [ ] **Step 1: Add a failing graph test for prompt details**

In `lib/__tests__/workflow-graph.test.ts`, extend the existing `buildGraph creates row-level source handles and shows candidate pool when candidate groups exist` test so the fixture image has stored prompt data and the candidate node assertion checks the mapped fields:

```ts
                      {
                        id: "img_1",
                        imageGroupId: "grp_1",
                        imageConfigId: "cfg_1",
                        slotIndex: 1,
                        filePath: "/tmp/img_1.png",
                        fileUrl: "/api/images/img_1/file",
                        status: "done",
                        inpaintParentId: null,
                        errorMessage: null,
                        finalPromptText: "真实正向提示词",
                        finalNegativePrompt: "真实负向提示词",
                        seed: 1,
                        createdAt: 0,
                        updatedAt: 0,
                      },
```

Add these assertions after the candidate node is found:

```ts
  assert.equal(candidateNode?.data.groups[0]?.images[0]?.promptDetails?.promptText, "真实正向提示词");
  assert.equal(candidateNode?.data.groups[0]?.images[0]?.promptDetails?.negativePrompt, "真实负向提示词");
  assert.equal(candidateNode?.data.groups[0]?.images[0]?.promptDetails?.aspectRatio, "1:1");
  assert.equal(candidateNode?.data.groups[0]?.images[0]?.promptDetails?.referenceImageUrl, null);
```

- [ ] **Step 2: Run the graph test to verify it fails**

Run: `npm run test -- lib/__tests__/workflow-graph.test.ts`

Expected: FAIL because `promptDetails` is not part of the candidate node payload yet.

- [ ] **Step 3: Add prompt-details types**

In `lib/workflow-graph-types.ts`, extend the candidate-pool branch of `GraphNodeData` with a reusable prompt-details object:

```ts
type CandidateImagePromptDetails = {
  promptText: string | null;
  negativePrompt: string | null;
  model: string | null;
  aspectRatio: string | null;
  referenceImageUrl: string | null;
};
```

Then add it to the image definition inside the `candidatePool` node type:

```ts
        images: Array<{
          id: string;
          fileUrl: string | null;
          status: "pending" | "generating" | "done" | "failed";
          slotIndex: number;
          aspectRatio?: string;
          updatedAt?: number;
          inpaintParentId?: string | null;
          promptDetails?: CandidateImagePromptDetails | null;
        }>;
```

- [ ] **Step 4: Map prompt details in the candidate pool builder**

In `lib/workflow-graph-builders.ts`, update `buildCandidatePoolNode()` so each mapped image includes prompt details derived from the group/config fallback chain:

```ts
        images: group.images.map((img) => ({
          id: img.id,
          fileUrl: toVersionedFileUrl(img.fileUrl, img.updatedAt),
          status: (img.status as "pending" | "generating" | "done" | "failed") ?? "pending",
          slotIndex: img.slotIndex,
          aspectRatio: group.aspectRatio ?? config.aspectRatio,
          updatedAt: img.updatedAt,
          inpaintParentId: img.inpaintParentId ?? null,
          promptDetails: {
            promptText: img.finalPromptText ?? null,
            negativePrompt: img.finalNegativePrompt ?? null,
            model: config.imageModel ?? null,
            aspectRatio: group.aspectRatio ?? config.aspectRatio ?? null,
            referenceImageUrl: group.referenceImageUrl ?? config.referenceImageUrl ?? null,
          },
        })),
```

Do not add any API calls or new database writes in this task.

- [ ] **Step 5: Run the graph test again**

Run: `npm run test -- lib/__tests__/workflow-graph.test.ts`

Expected: PASS with the new prompt-details assertions succeeding.

- [ ] **Step 6: Commit**

```bash
git add lib/workflow-graph-types.ts lib/workflow-graph-builders.ts lib/__tests__/workflow-graph.test.ts
git commit -m "feat: expose candidate prompt details in graph data"
```

---

### Task 2: Add the prompt-details modal component

**Files:**
- Create: `components/cards/candidate-pool/prompt-details-modal.tsx`
- Modify: `lib/__tests__/pool-card-source.test.ts`

- [ ] **Step 1: Add a failing source-level test for the new modal**

In `lib/__tests__/pool-card-source.test.ts`, add a new file handle and a new test:

```ts
const promptDetailsModalPath = new URL("../../components/cards/candidate-pool/prompt-details-modal.tsx", import.meta.url);
```

```ts
test("candidate pool prompt details modal shows prompt sections and copy actions", async () => {
  const source = await readFile(promptDetailsModalPath, "utf8");

  assert.match(source, /Modal/);
  assert.match(source, /正向提示词/);
  assert.match(source, /negative prompt/i);
  assert.match(source, /navigator\.clipboard\.writeText|onCopyPrompt|onCopyNegativePrompt/);
  assert.match(source, /未传参考图/);
});
```

- [ ] **Step 2: Run the source test to verify it fails**

Run: `npm run test -- lib/__tests__/pool-card-source.test.ts`

Expected: FAIL because `prompt-details-modal.tsx` does not exist yet.

- [ ] **Step 3: Create the modal component**

Create `components/cards/candidate-pool/prompt-details-modal.tsx` with a focused, presentational component:

```tsx
"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type PromptDetails = {
  promptText: string | null;
  negativePrompt: string | null;
  model: string | null;
  aspectRatio: string | null;
  referenceImageUrl: string | null;
};

export function PromptDetailsModal({
  details,
  isOpen,
  onClose,
  onCopy,
}: {
  details: PromptDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onCopy: (label: string, value: string) => void;
}) {
  const promptText = details?.promptText?.trim() || "未记录";
  const negativePrompt = details?.negativePrompt?.trim() || "未传 negative prompt";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="生图提示词"
      description="查看该候选图真实传入模型的提示词与参考信息。"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[var(--surface-1)] p-4 text-sm">
          <div>
            <p className="text-[11px] text-[var(--ink-400)]">模型</p>
            <p className="mt-1 font-medium text-[var(--ink-900)]">{details?.model || "未记录模型"}</p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--ink-400)]">比例</p>
            <p className="mt-1 font-medium text-[var(--ink-900)]">{details?.aspectRatio || "未记录比例"}</p>
          </div>
        </div>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--ink-900)]">参考图</h3>
          </div>
          {details?.referenceImageUrl ? (
            <div className="relative overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-2)]" style={{ aspectRatio: "1 / 1" }}>
              <Image src={details.referenceImageUrl} alt="参考图" fill sizes="240px" className="object-contain" />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--line-soft)] px-4 py-6 text-sm text-[var(--ink-500)]">
              未传参考图
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--ink-900)]">正向提示词</h3>
            <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => onCopy("正向提示词", promptText)}>
              复制
            </Button>
          </div>
          <pre className="whitespace-pre-wrap rounded-2xl bg-[var(--surface-1)] p-4 text-sm leading-6 text-[var(--ink-800)]">
            {promptText}
          </pre>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--ink-900)]">Negative Prompt</h3>
            <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => onCopy("negative prompt", negativePrompt)}>
              复制
            </Button>
          </div>
          <pre className="whitespace-pre-wrap rounded-2xl bg-[var(--surface-1)] p-4 text-sm leading-6 text-[var(--ink-800)]">
            {negativePrompt}
          </pre>
        </section>
      </div>
    </Modal>
  );
}
```

Keep the component presentation-only. It should not own fetch logic or workspace invalidation.

- [ ] **Step 4: Run the source test again**

Run: `npm run test -- lib/__tests__/pool-card-source.test.ts`

Expected: PASS for the new modal-source assertions, while existing pool-card source tests remain green.

- [ ] **Step 5: Commit**

```bash
git add components/cards/candidate-pool/prompt-details-modal.tsx lib/__tests__/pool-card-source.test.ts
git commit -m "feat: add candidate prompt details modal"
```

---

### Task 3: Wire the modal and button into candidate pool cards

**Files:**
- Modify: `components/cards/candidate-pool-card.tsx`
- Modify: `components/cards/candidate-pool/candidate-image-card.tsx`
- Modify: `components/cards/candidate-pool/candidate-group-card.tsx`
- Test: `lib/__tests__/pool-card-source.test.ts`

- [ ] **Step 1: Add failing source assertions for the new button and modal wiring**

In `lib/__tests__/pool-card-source.test.ts`, add this test:

```ts
test("candidate pool exposes prompt inspection only for eligible images", async () => {
  const source = await readFile(candidatePoolCardPath, "utf8");
  const imageSource = await readFile(candidateImageCardPath, "utf8");
  const groupSource = await readFile(candidateGroupCardPath, "utf8");

  assert.match(source, /PromptDetailsModal/);
  assert.match(source, /navigator\.clipboard\.writeText/);
  assert.match(imageSource, /查看提示词/);
  assert.match(imageSource, /image\.status === "done"/);
  assert.match(imageSource, /!image\.inpaintParentId/);
  assert.match(groupSource, /onViewPromptDetails/);
});
```

- [ ] **Step 2: Run the source test to verify it fails**

Run: `npm run test -- lib/__tests__/pool-card-source.test.ts`

Expected: FAIL because the button, modal wiring, and grouped-card prop do not exist yet.

- [ ] **Step 3: Update CandidateImageCard to expose the button**

In `components/cards/candidate-pool/candidate-image-card.tsx`, add a new optional callback prop:

```tsx
  onViewPromptDetails?: (id: string) => void;
```

Compute the visibility guard near the top of the component:

```tsx
  const canViewPromptDetails = isDone && !image.inpaintParentId && Boolean(onViewPromptDetails);
```

Then add the button in the existing actions row:

```tsx
          {canViewPromptDetails ? (
            <Button variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => onViewPromptDetails?.(image.id)}>
              查看提示词
            </Button>
          ) : null}
```

Do not show this button for generating, failed, or inpaint-derived images.

- [ ] **Step 4: Update CandidateGroupCard to pass the prompt handler through**

In `components/cards/candidate-pool/candidate-group-card.tsx`, add the prop:

```tsx
  onViewPromptDetails?: (id: string) => void;
```

Pass it through to each nested `CandidateImageCard`:

```tsx
            onViewPromptDetails={onViewPromptDetails}
```

- [ ] **Step 5: Wire modal state, copy action, and button handling in CandidatePoolCard**

In `components/cards/candidate-pool-card.tsx`:

1. Import the modal:

```tsx
import { PromptDetailsModal } from "@/components/cards/candidate-pool/prompt-details-modal";
```

2. Extend the `CandidateImage` type so the UI can access prompt details:

```tsx
export type CandidateImage = {
  id: string;
  fileUrl: string | null;
  status: "pending" | "generating" | "done" | "failed";
  slotIndex: number;
  aspectRatio?: string;
  updatedAt?: number;
  inpaintParentId?: string | null;
  promptDetails?: {
    promptText: string | null;
    negativePrompt: string | null;
    model: string | null;
    aspectRatio: string | null;
    referenceImageUrl: string | null;
  } | null;
};
```

3. Add local state:

```tsx
  const [promptDetailsImageId, setPromptDetailsImageId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
```

4. Add a copy helper:

```tsx
  const handleCopyPromptText = useCallback(async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFeedback(`${label}已复制`);
      window.setTimeout(() => setCopyFeedback(null), 1600);
    } catch {
      setCopyFeedback(`${label}复制失败`);
    }
  }, []);
```

5. Derive the selected image once and reuse it:

```tsx
  const promptDetailsImage = promptDetailsImageId
    ? images.find((img) => img.id === promptDetailsImageId) ?? null
    : null;
```

6. Pass the new handler into both single-image and grouped-image render paths:

```tsx
                  onViewPromptDetails={setPromptDetailsImageId}
```

and

```tsx
                onViewPromptDetails={setPromptDetailsImageId}
```

7. Render the modal near the existing preview/inpaint modals:

```tsx
      <PromptDetailsModal
        details={promptDetailsImage?.promptDetails ?? null}
        isOpen={Boolean(promptDetailsImage)}
        onClose={() => setPromptDetailsImageId(null)}
        onCopy={handleCopyPromptText}
      />
```

8. Show copy feedback above the card body using the same lightweight inline banner style as other action feedback:

```tsx
      {copyFeedback ? (
        <div className="mb-3 rounded-lg bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--ink-600)]">
          {copyFeedback}
        </div>
      ) : null}
```

- [ ] **Step 6: Run the pool-card source tests again**

Run: `npm run test -- lib/__tests__/pool-card-source.test.ts`

Expected: PASS, including the new prompt-inspection assertions.

- [ ] **Step 7: Commit**

```bash
git add components/cards/candidate-pool-card.tsx components/cards/candidate-pool/candidate-image-card.tsx components/cards/candidate-pool/candidate-group-card.tsx lib/__tests__/pool-card-source.test.ts
git add components/cards/candidate-pool/prompt-details-modal.tsx
git commit -m "feat: add prompt inspection entrypoint to candidate pool"
```

---

### Task 4: Verify focused behavior and finish

**Files:**
- Modify: none unless verification uncovers issues
- Test: `lib/__tests__/workflow-graph.test.ts`
- Test: `lib/__tests__/pool-card-source.test.ts`

- [ ] **Step 1: Run the focused automated checks**

Run:

```bash
npm run test -- lib/__tests__/workflow-graph.test.ts lib/__tests__/pool-card-source.test.ts
```

Expected: PASS with the candidate graph and prompt-inspection source assertions all green.

- [ ] **Step 2: Run a type check**

Run:

```bash
npm run typecheck
```

Expected: PASS with no TypeScript errors from the new modal, prop threading, or candidate image type changes.

- [ ] **Step 3: Manual UI verification in the workspace**

Run the app and verify these cases in a project with newly generated candidate images:

```bash
npm run dev
```

Expected:
- Single-image candidate cards show `查看提示词` only after generation completes.
- Double/triple candidate groups show the button per eligible image.
- Inpaint-derived images do not show the button.
- Modal shows model, ratio, reference image, prompt, and negative prompt.
- Copying either prompt shows inline feedback and keeps the modal open.

- [ ] **Step 4: Commit the verification-complete implementation**

```bash
git add components/cards/candidate-pool-card.tsx components/cards/candidate-pool/candidate-image-card.tsx components/cards/candidate-pool/candidate-group-card.tsx components/cards/candidate-pool/prompt-details-modal.tsx
git add lib/workflow-graph-types.ts lib/workflow-graph-builders.ts
git add lib/__tests__/workflow-graph.test.ts lib/__tests__/pool-card-source.test.ts
git commit -m "feat: add candidate prompt inspection modal"
```

---

## Self-Review

### Spec coverage

- Prompt, negative prompt, model, ratio, reference image: covered in Tasks 1-3.
- Copy support: covered in Task 3.
- Visibility rules for done/non-inpaint candidate images only: covered in Task 3 and Task 4 manual verification.
- No new details API: preserved by Tasks 1-3.

### Placeholder scan

- No `TODO`/`TBD` placeholders.
- Every code-changing task includes concrete code snippets and exact commands.

### Type consistency

- `promptDetails` naming is consistent across graph types, builder output, and React props.
- `onViewPromptDetails` naming is consistent between card components.

