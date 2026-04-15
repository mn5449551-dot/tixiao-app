# 局部重绘（Inpaint）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement local inpaint in the candidate pool with two modes: text repaint (edit copy text → regenerate whole image) and area repaint (brush mask + instruction → local edit).

**Architecture:** Single fullscreen modal (InpaintModal) with two tabs. Backend reuses existing `editImage()` from `image-chat.ts` with a new `maskDataUrl` parameter. New `GET /api/images/[id]/copy` endpoint fetches copy text from DB. Results stored as new images linked via `inpaintParentId`.

**Tech Stack:** Next.js App Router, SQLite/Drizzle, HTML5 Canvas API for mask drawing, `/v1/images/edits` API for image editing.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/ai/image-chat.ts` | Image generation routing — add mask support to edits path |
| `app/api/images/[id]/inpaint/route.ts` | Inpaint API — implement callInpaintApi, make mask optional |
| `app/api/images/[id]/copy/route.ts` | New — fetch copy text for an image |
| `lib/workflow-graph-builders.ts` | Graph data mapping — pass inpaintParentId |
| `lib/workflow-graph-types.ts` | Type definitions — add inpaintParentId to candidate pool image |
| `components/inpaint/inpaint-modal.tsx` | Fullscreen modal — complete rewrite |
| `components/cards/candidate-pool-card.tsx` | Candidate pool — pass extra props, add inpaintParentId to type |
| `components/cards/candidate-pool/candidate-image-card.tsx` | Image card — show inpaint badge, adopt/discard |
| `lib/__tests__/inpaint.test.ts` | New — source analysis tests for inpaint feature |

---

### Task 1: Add maskDataUrl support to image-chat.ts

**Files:**
- Modify: `lib/ai/image-chat.ts` (lines 271-329 `generateImageViaEdits`, lines 331-353 `editImage`)
- Test: `lib/__tests__/image-chat-source.test.ts`

- [ ] **Step 1: Add test assertions for mask support**

Add to `lib/__tests__/image-chat-source.test.ts`:

```typescript
test("image chat generateImageViaEdits supports optional mask parameter", async () => {
  const source = await readFile(imageChatPath, "utf8");
  assert.match(source, /maskDataUrl/);
  assert.match(source, /body\.mask/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test lib/__tests__/image-chat-source.test.ts`
Expected: FAIL — `maskDataUrl` not found in source

- [ ] **Step 3: Add maskDataUrl to generateImageViaEdits**

In `lib/ai/image-chat.ts`, modify the `generateImageViaEdits` function signature and body at lines 271-288:

```typescript
async function generateImageViaEdits(input: {
  model: string;
  prompt: string;
  imageUrl: string;
  size: string;
  maskDataUrl?: string;
}) {
  const apiKey = process.env.NEW_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 NEW_API_KEY，无法调用图片模型");
  }

  const body: Record<string, unknown> = {
    model: input.model,
    prompt: input.prompt,
    image: input.imageUrl,
    size: input.size,
    n: 1,
  };
  if (input.maskDataUrl) {
    body.mask = input.maskDataUrl;
  }
```

The rest of the function (retry loop, fetch to `/v1/images/edits`, etc.) stays the same. Only the body construction changes from a static `JSON.stringify({...})` to the two-step `const body` + conditional `mask` addition. Update the `requestBody` line that was previously inline to use `JSON.stringify(body)`:

```typescript
  const requestBody = JSON.stringify(body);
```

- [ ] **Step 4: Add maskDataUrl to editImage**

Modify the `editImage` function at lines 331-353:

```typescript
export async function editImage(input: {
  prompt: string;
  imageUrl: string;
  model?: string;
  aspectRatio?: string;
  maskDataUrl?: string;
}) {
  const resolved = resolveImageModel(input.model);

  if (!resolved.supportsEdits) {
    throw new Error(`图像编辑不支持当前模型：${resolved.model}，请改用即梦或通义千问系列模型`);
  }

  return generateImageViaEdits({
    model: resolved.model,
    prompt: input.prompt,
    imageUrl: input.imageUrl,
    size: buildImagesGenerationSize({
      model: resolved.model,
      aspectRatio: input.aspectRatio,
      resolution: DEFAULT_IMAGE_RESOLUTION,
    }),
    maskDataUrl: input.maskDataUrl,
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test lib/__tests__/image-chat-source.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/ai/image-chat.ts lib/__tests__/image-chat-source.test.ts
git commit -m "feat: add mask parameter support to image edits API"
```

---

### Task 2: Implement callInpaintApi and update inpaint route

**Files:**
- Modify: `app/api/images/[id]/inpaint/route.ts`
- Test: `lib/__tests__/inpaint.test.ts` (new)

- [ ] **Step 1: Create test file for inpaint route**

Create `lib/__tests__/inpaint.test.ts`:

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const inpaintRoutePath = new URL("../../app/api/images/[id]/inpaint/route.ts", import.meta.url);
const imageChatPath = new URL("../ai/image-chat.ts", import.meta.url);

test("inpaint route implements callInpaintApi using editImage", async () => {
  const source = await readFile(inpaintRoutePath, "utf8");
  assert.match(source, /import.*editImage.*from.*@\/lib\/ai\/image-chat/);
  assert.match(source, /editImage\(/);
  assert.match(source, /maskDataUrl/);
});

test("inpaint route accepts optional mask_data_url and image_model", async () => {
  const source = await readFile(inpaintRoutePath, "utf8");
  assert.match(source, /mask_data_url/);
  assert.match(source, /image_model/);
  assert.match(source, /inpaint_instruction/);
});

test("inpaint route creates new image with inpaintParentId", async () => {
  const source = await readFile(inpaintRoutePath, "utf8");
  assert.match(source, /inpaintParentId/);
  assert.match(source, /status: "generating"/);
  assert.match(source, /finishGenerationRun/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test lib/__tests__/inpaint.test.ts`
Expected: FAIL — `editImage` import not found in inpaint route

- [ ] **Step 3: Update inpaint route**

Rewrite `app/api/images/[id]/inpaint/route.ts`:

```typescript
import { NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import sharp from "sharp";

import { editImage } from "@/lib/ai/image-chat";
import { getDb } from "@/lib/db";
import {
  finishGenerationRun,
  GenerationConflictError,
  GenerationLimitError,
  startGenerationRun,
} from "@/lib/generation-runs";
import { generatedImages, imageConfigs, directions } from "@/lib/schema";
import { saveImageBuffer } from "@/lib/storage";

export async function POST(
  request: Request,
  context: { params: Promise<unknown> },
) {
  let runId: string | null = null;
  let runFinished = false;

  try {
    const { id } = (await context.params) as { id: string };
    const body = await request.json();

    const { mask_data_url, inpaint_instruction, image_model } = body as {
      mask_data_url?: string;
      inpaint_instruction: string;
      image_model?: string;
    };

    if (!inpaint_instruction?.trim()) {
      return NextResponse.json(
        { error: "缺少必要参数：inpaint_instruction" },
        { status: 400 },
      );
    }

    const db = getDb();
    const image = db
      .select()
      .from(generatedImages)
      .where(eq(generatedImages.id, id))
      .get();

    if (!image) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    const config = db.select().from(imageConfigs).where(eq(imageConfigs.id, image.imageConfigId)).get();
    if (!config) {
      return NextResponse.json({ error: "图片配置不存在" }, { status: 422 });
    }

    const direction = db.select().from(directions).where(eq(directions.id, config.directionId)).get();
    if (!direction) {
      return NextResponse.json({ error: "方向不存在" }, { status: 422 });
    }

    runId = startGenerationRun({
      projectId: direction.projectId,
      kind: "inpaint",
      resourceType: "inpaint-source-image",
      resourceId: image.id,
    }).id;

    const newImageId = `img_inp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    db.insert(generatedImages).values({
      id: newImageId,
      imageGroupId: image.imageGroupId,
      imageConfigId: image.imageConfigId,
      slotIndex: image.slotIndex,
      status: "generating",
      inpaintParentId: image.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }).run();

    const activeRunId = runId;
    const resolvedModel = image_model ?? config.imageModel ?? undefined;
    after(async () => {
      await processInpaintInBackground({
        runId: activeRunId,
        imageId: newImageId,
        projectId: direction.projectId,
        imageUrl: image.fileUrl!,
        maskDataUrl: mask_data_url ?? null,
        instruction: inpaint_instruction,
        model: resolvedModel,
      });
    });

    return NextResponse.json({
      imageId: newImageId,
      status: "generating",
    }, { status: 202 });
  } catch (error) {
    if (runId && !runFinished) {
      finishGenerationRun(runId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "局部重绘失败",
      });
      runFinished = true;
    }

    if (error instanceof GenerationConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          resource_type: error.resourceType,
          resource_id: error.resourceId,
        },
        { status: 409 },
      );
    }

    if (error instanceof GenerationLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          limit: error.limit,
          active_count: error.activeCount,
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "局部重绘失败" },
      { status: 500 },
    );
  }
}

async function processInpaintInBackground(input: {
  runId: string;
  imageId: string;
  projectId: string;
  imageUrl: string;
  maskDataUrl: string | null;
  instruction: string;
  model?: string;
}) {
  const db = getDb();
  const { runId, imageId, projectId, imageUrl, maskDataUrl, instruction, model } = input;

  try {
    const result = await callInpaintApi({
      imageUrl,
      maskDataUrl,
      instruction,
      model,
    });

    const pngBuffer = await sharp(result.buffer).png().toBuffer();
    const saved = await saveImageBuffer({
      projectId,
      imageId,
      buffer: pngBuffer,
      extension: "png",
    });

    db.update(generatedImages)
      .set({
        filePath: saved.filePath,
        fileUrl: saved.fileUrl,
        status: "done",
        updatedAt: Date.now(),
      })
      .where(eq(generatedImages.id, imageId))
      .run();
    finishGenerationRun(runId, { status: "done" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "局部重绘失败";
    db.update(generatedImages)
      .set({ status: "failed", errorMessage: message, updatedAt: Date.now() })
      .where(eq(generatedImages.id, imageId))
      .run();
    finishGenerationRun(runId, { status: "failed", errorMessage: message });
  }
}

async function callInpaintApi(input: {
  imageUrl: string;
  maskDataUrl: string | null;
  instruction: string;
  model?: string;
}): Promise<{ buffer: Buffer }> {
  const result = await editImage({
    prompt: input.instruction,
    imageUrl: input.imageUrl,
    model: input.model,
    maskDataUrl: input.maskDataUrl ?? undefined,
  });
  return { buffer: result[0].buffer };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test lib/__tests__/inpaint.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/images/\[id\]/inpaint/route.ts lib/__tests__/inpaint.test.ts
git commit -m "feat: implement inpaint API with editImage and optional mask"
```

---

### Task 3: Create GET /api/images/[id]/copy endpoint

**Files:**
- Create: `app/api/images/[id]/copy/route.ts`
- Test: `lib/__tests__/inpaint.test.ts` (add assertions)

- [ ] **Step 1: Add test assertions for copy endpoint**

Append to `lib/__tests__/inpaint.test.ts`:

```typescript
const copyRoutePath = new URL("../../app/api/images/[id]/copy/route.ts", import.meta.url);

test("copy route returns titleMain, titleSub, titleExtra from DB", async () => {
  const source = await readFile(copyRoutePath, "utf8");
  assert.match(source, /titleMain/);
  assert.match(source, /titleSub/);
  assert.match(source, /titleExtra/);
  assert.match(source, /generatedImages/);
  assert.match(source, /imageConfigs/);
  assert.match(source, /copies/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test lib/__tests__/inpaint.test.ts`
Expected: FAIL — copy route file does not exist

- [ ] **Step 3: Create copy route**

Create `app/api/images/[id]/copy/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { generatedImages, imageConfigs, copies } from "@/lib/schema";

export async function GET(
  _request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const { id } = (await context.params) as { id: string };

    const db = getDb();
    const image = db
      .select()
      .from(generatedImages)
      .where(eq(generatedImages.id, id))
      .get();

    if (!image) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    const config = db
      .select()
      .from(imageConfigs)
      .where(eq(imageConfigs.id, image.imageConfigId))
      .get();

    if (!config?.copyId) {
      return NextResponse.json({
        titleMain: null,
        titleSub: null,
        titleExtra: null,
      });
    }

    const copy = db
      .select()
      .from(copies)
      .where(eq(copies.id, config.copyId))
      .get();

    if (!copy) {
      return NextResponse.json({
        titleMain: null,
        titleSub: null,
        titleExtra: null,
      });
    }

    return NextResponse.json({
      titleMain: copy.titleMain,
      titleSub: copy.titleSub ?? null,
      titleExtra: copy.titleExtra ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取文案失败" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test lib/__tests__/inpaint.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/images/\[id\]/copy/route.ts lib/__tests__/inpaint.test.ts
git commit -m "feat: add GET /api/images/[id]/copy endpoint for inpaint text mode"
```

---

### Task 4: Add inpaintParentId to data types and graph builder

**Files:**
- Modify: `lib/workflow-graph-types.ts` (lines 78-85, candidate pool image type)
- Modify: `lib/workflow-graph-builders.ts` (lines 70-77, image mapping)
- Modify: `components/cards/candidate-pool-card.tsx` (line 36-43, CandidateImage type)
- Test: `lib/__tests__/inpaint.test.ts` (add assertions)

- [ ] **Step 1: Add test assertions**

Append to `lib/__tests__/inpaint.test.ts`:

```typescript
const graphTypesPath = new URL("../workflow-graph-types.ts", import.meta.url);
const graphBuildersPath = new URL("../workflow-graph-builders.ts", import.meta.url);
const candidatePoolCardPath = new URL("../../components/cards/candidate-pool-card.tsx", import.meta.url);

test("workflow graph types include inpaintParentId on candidate pool images", async () => {
  const source = await readFile(graphTypesPath, "utf8");
  assert.match(source, /inpaintParentId/);
});

test("workflow graph builder passes inpaintParentId through", async () => {
  const source = await readFile(graphBuildersPath, "utf8");
  assert.match(source, /inpaintParentId/);
});

test("CandidateImage type includes inpaintParentId", async () => {
  const source = await readFile(candidatePoolCardPath, "utf8");
  assert.match(source, /inpaintParentId\?: string \| null/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test lib/__tests__/inpaint.test.ts`
Expected: FAIL — `inpaintParentId` not found in graph types

- [ ] **Step 3: Add inpaintParentId to workflow-graph-types.ts**

In `lib/workflow-graph-types.ts`, update the candidate pool image shape (lines 78-85). Add `inpaintParentId` to the image array element:

```typescript
        images: Array<{
          id: string;
          fileUrl: string | null;
          status: "pending" | "generating" | "done" | "failed";
          slotIndex: number;
          aspectRatio?: string;
          updatedAt?: number;
          inpaintParentId?: string | null;
        }>;
```

- [ ] **Step 4: Add inpaintParentId to workflow-graph-builders.ts**

In `lib/workflow-graph-builders.ts`, update the image mapping inside `buildCandidatePoolNode` (around line 70-77). Add the field to the `.map()`:

```typescript
        images: group.images.map((img) => ({
          id: img.id,
          fileUrl: toVersionedFileUrl(img.fileUrl, img.updatedAt),
          status: (img.status as "pending" | "generating" | "done" | "failed") ?? "pending",
          slotIndex: img.slotIndex,
          aspectRatio: group.aspectRatio ?? config.aspectRatio,
          updatedAt: img.updatedAt,
          inpaintParentId: img.inpaintParentId ?? null,
        })),
```

- [ ] **Step 5: Add inpaintParentId to CandidateImage type**

In `components/cards/candidate-pool-card.tsx`, update the `CandidateImage` type (around line 36-43):

```typescript
export type CandidateImage = {
  id: string;
  fileUrl: string | null;
  status: "pending" | "generating" | "done" | "failed";
  slotIndex: number;
  aspectRatio?: string;
  updatedAt?: number;
  inpaintParentId?: string | null;
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test lib/__tests__/inpaint.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/workflow-graph-types.ts lib/workflow-graph-builders.ts components/cards/candidate-pool-card.tsx lib/__tests__/inpaint.test.ts
git commit -m "feat: add inpaintParentId to candidate pool data types"
```

---

### Task 5: Rewrite InpaintModal — text mode and model gating

**Files:**
- Rewrite: `components/inpaint/inpaint-modal.tsx`

This is the largest task. The modal is rewritten as a fullscreen component with text editing mode and model compatibility check. Area/mask mode will be added in Task 6.

- [ ] **Step 1: Rewrite InpaintModal**

Replace the entire content of `components/inpaint/inpaint-modal.tsx` with:

```typescript
"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/field";
import { IMAGE_MODELS } from "@/lib/constants";

interface InpaintModalProps {
  imageId: string;
  imageUrl: string | null;
  imageModel?: string | null;
  onClose: () => void;
}

type CopyData = {
  titleMain: string | null;
  titleSub: string | null;
  titleExtra: string | null;
};

type InpaintResult = {
  imageId: string;
  status: "generating" | "done" | "failed";
} | null;

export function InpaintModal({ imageId, imageUrl, imageModel, onClose }: InpaintModalProps) {
  const [activeTab, setActiveTab] = useState<"text" | "area">("text");
  const [copyData, setCopyData] = useState<CopyData | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [editedTitleMain, setEditedTitleMain] = useState("");
  const [editedTitleSub, setEditedTitleSub] = useState("");
  const [editedTitleExtra, setEditedTitleExtra] = useState("");
  const [instruction, setInstruction] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<InpaintResult>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const modelSupportsEdits = useMemo(() => {
    if (!imageModel) return true;
    return IMAGE_MODELS.find((m) => m.value === imageModel)?.supportsEdits ?? false;
  }, [imageModel]);

  const modelLabel = useMemo(() => {
    if (!imageModel) return "";
    return IMAGE_MODELS.find((m) => m.value === imageModel)?.label ?? imageModel;
  }, [imageModel]);

  // Fetch copy data on mount
  useEffect(() => {
    let cancelled = false;
    setCopyLoading(true);
    fetch(`/api/images/${imageId}/copy`)
      .then((res) => res.json())
      .then((data: CopyData) => {
        if (cancelled) return;
        setCopyData(data);
        setEditedTitleMain(data.titleMain ?? "");
        setEditedTitleSub(data.titleSub ?? "");
        setEditedTitleExtra(data.titleExtra ?? "");
      })
      .catch(() => {
        if (cancelled) return;
        setCopyData({ titleMain: null, titleSub: null, titleExtra: null });
      })
      .finally(() => {
        if (!cancelled) setCopyLoading(false);
      });
    return () => { cancelled = true; };
  }, [imageId]);

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleTextGenerate = useCallback(async () => {
    const parts: string[] = [];
    if (editedTitleMain.trim()) parts.push(`主标题「${editedTitleMain.trim()}」`);
    if (editedTitleSub.trim()) parts.push(`副标题「${editedTitleSub.trim()}」`);
    if (editedTitleExtra.trim()) parts.push(`补充文字「${editedTitleExtra.trim()}」`);
    if (parts.length === 0) {
      setError("请至少填写一项文案");
      return;
    }
    const prompt = `请将图片中的文字替换为：${parts.join("，")}。保持图片其他部分不变，仅修改文字内容和排版。`;

    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/images/${imageId}/inpaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inpaint_instruction: prompt,
          image_model: imageModel,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "生成失败");
        return;
      }
      const data = await res.json() as { imageId: string; status: string };
      setResult({ imageId: data.imageId, status: "generating" });
      // Poll for completion
      pollForResult(data.imageId);
    } catch {
      setError("网络错误");
    } finally {
      setGenerating(false);
    }
  }, [editedTitleMain, editedTitleSub, editedTitleExtra, imageId, imageModel]);

  const handleAreaGenerate = useCallback(async () => {
    // Will be implemented in Task 6
  }, []);

  const pollForResult = useCallback((resultImageId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/images/${resultImageId}`);
        if (!res.ok) return;
        const data = await res.json() as { status: string; fileUrl?: string };
        if (data.status === "done" || data.status === "failed") {
          clearInterval(interval);
          setResult({ imageId: resultImageId, status: data.status });
        }
      } catch {
        // Keep polling
      }
    }, 2000);
  }, []);

  const handleAdopt = useCallback(() => {
    setResult(null);
    onClose();
  }, [onClose]);

  const handleDiscard = useCallback(async () => {
    if (!result?.imageId) return;
    try {
      await fetch(`/api/images/${result.imageId}`, { method: "DELETE" });
    } catch {
      // Ignore delete errors
    }
    setResult(null);
  }, [result]);

  return (
    <div className="fixed inset-0 z-50 flex bg-black/90" ref={containerRef}>
      {/* Image canvas area */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {imageUrl ? (
          <div className="relative h-full w-full">
            <Image
              src={imageUrl}
              alt="编辑图片"
              fill
              sizes="70vw"
              className="object-contain"
              priority
            />
          </div>
        ) : (
          <div className="text-sm text-white/50">图片加载中</div>
        )}

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
          title="关闭 (ESC)"
        >
          ✕
        </button>
      </div>

      {/* Right panel */}
      <div className="flex w-[360px] shrink-0 flex-col border-l border-white/10 bg-[#1a1a1a]">
        {/* Header */}
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-semibold text-white">局部重绘</h2>
          <p className="mt-1 text-xs text-white/50">
            {modelLabel ? `当前模型：${modelLabel}` : "编辑图中文字或框选区域进行重绘"}
          </p>
        </div>

        {/* Model warning */}
        {!modelSupportsEdits && (
          <div className="mx-4 mt-4 rounded-lg bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
            当前模型不支持局部重绘，请选择即梦或通义千问系列模型。
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex border-b border-white/10">
          <button
            type="button"
            className={`flex-1 px-4 py-3 text-xs font-medium transition ${
              activeTab === "text"
                ? "border-b-2 border-white text-white"
                : "text-white/40 hover:text-white/70"
            }`}
            onClick={() => setActiveTab("text")}
          >
            文字重绘
          </button>
          <button
            type="button"
            className={`flex-1 px-4 py-3 text-xs font-medium transition ${
              activeTab === "area"
                ? "border-b-2 border-white text-white"
                : "text-white/40 hover:text-white/70"
            }`}
            onClick={() => setActiveTab("area")}
          >
            框选重绘
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {activeTab === "text" && (
            <div className="space-y-4">
              {copyLoading ? (
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Spinner size="sm" /> 加载文案中...
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/70">主标题</label>
                    <Textarea
                      minRows={1}
                      className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30"
                      placeholder="输入主标题"
                      value={editedTitleMain}
                      onChange={(e) => setEditedTitleMain(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/70">副标题</label>
                    <Textarea
                      minRows={1}
                      className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30"
                      placeholder="输入副标题"
                      value={editedTitleSub}
                      onChange={(e) => setEditedTitleSub(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/70">补充文字</label>
                    <Textarea
                      minRows={1}
                      className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30"
                      placeholder="输入补充文字"
                      value={editedTitleExtra}
                      onChange={(e) => setEditedTitleExtra(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="primary"
                    className="w-full text-xs"
                    disabled={generating || !modelSupportsEdits}
                    onClick={handleTextGenerate}
                  >
                    {generating ? "生成中..." : "生成重绘"}
                  </Button>
                </>
              )}
            </div>
          )}

          {activeTab === "area" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-xs text-white/40">
                框选重绘功能开发中
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Result */}
          {result && result.status === "generating" && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <Spinner size="sm" />
                <span className="text-sm text-white/70">重绘生成中...</span>
              </div>
            </div>
          )}

          {result && result.status === "done" && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="mb-3 text-sm font-medium text-white">重绘完成</h3>
              <div className="flex gap-2">
                <Button variant="primary" className="flex-1 text-xs" onClick={handleAdopt}>
                  采纳
                </Button>
                <Button variant="secondary" className="text-xs" onClick={handleDiscard}>
                  放弃
                </Button>
              </div>
            </div>
          )}

          {result && result.status === "failed" && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm text-red-300">重绘失败，请重试</p>
              <Button variant="secondary" className="mt-2 text-xs" onClick={() => setResult(null)}>
                关闭
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update CandidatePoolCard to pass new props**

In `components/cards/candidate-pool-card.tsx`, update the `InpaintModal` rendering (around lines 282-287):

Change from:
```typescript
<InpaintModal
  imageUrl={images.find((img) => img.id === inpaintImageId)?.fileUrl ?? null}
  onClose={() => setInpaintImageId(null)}
/>
```

To:
```typescript
<InpaintModal
  imageId={inpaintImageId}
  imageUrl={images.find((img) => img.id === inpaintImageId)?.fileUrl ?? null}
  imageModel={imageModel}
  onClose={() => setInpaintImageId(null)}
/>
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — no type errors

- [ ] **Step 4: Run all existing tests**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add components/inpaint/inpaint-modal.tsx components/cards/candidate-pool-card.tsx
git commit -m "feat: rewrite InpaintModal with fullscreen text mode and model gating"
```

---

### Task 6: Add canvas mask drawing to InpaintModal — area mode

**Files:**
- Modify: `components/inpaint/inpaint-modal.tsx` (add area tab content)

This task adds the brush painting canvas overlay for area selection, zoom/pan controls, and mask generation.

- [ ] **Step 1: Add canvas drawing state and handlers**

At the top of `InpaintModal` function, after the existing `useRef`, add refs and state for canvas:

```typescript
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageElRef = useRef<HTMLImageElement | null>(null);
  const [brushSize, setBrushSize] = useState(30);
  const [isPanning, setIsPanning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [strokeHistory, setStrokeHistory] = useState<Array<Array<{ x: number; y: number }>>>([]);
  const [currentStroke, setCurrentStroke] = useState<Array<{ x: number; y: number }>>([]);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
```

- [ ] **Step 2: Add space key handler for pan toggle**

Add after the existing ESC keydown effect:

```typescript
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceHeld(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);
```

- [ ] **Step 3: Add zoom handler**

```typescript
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => {
      const next = prev - e.deltaY * 0.001;
      return Math.max(0.25, Math.min(4, next));
    });
  }, []);

  const handleDoubleClick = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);
```

- [ ] **Step 4: Add drawing event handlers**

These functions convert screen coordinates to image coordinates and draw on the mask canvas:

```typescript
  const screenToImage = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageElRef.current) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const img = imageElRef.current;
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = rect.width / rect.height;
    let renderW: number, renderH: number, offsetX: number, offsetY: number;
    if (canvasAspect > imgAspect) {
      renderH = rect.height;
      renderW = renderH * imgAspect;
      offsetX = (rect.width - renderW) / 2;
      offsetY = 0;
    } else {
      renderW = rect.width;
      renderH = renderW / imgAspect;
      offsetX = 0;
      offsetY = (rect.height - renderH) / 2;
    }
    const displayX = ((clientX - rect.left - offsetX) / zoom) - panOffset.x;
    const displayY = ((clientY - rect.top - offsetY) / zoom) - panOffset.y;
    const imgX = (displayX / renderW) * img.naturalWidth;
    const imgY = (displayY / renderH) * img.naturalHeight;
    return { x: imgX, y: imgY };
  }, [zoom, panOffset]);

  const drawStrokeOnMask = useCallback((stroke: Array<{ x: number; y: number }>) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas || stroke.length === 0) return;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "white";
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo(stroke[i].x, stroke[i].y);
    }
    ctx.stroke();
  }, [brushSize]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (!modelSupportsEdits) return;
    if (spaceHeld || activeTab !== "area") {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: panOffset.x, panY: panOffset.y };
      return;
    }
    const pt = screenToImage(e.clientX, e.clientY);
    setIsDrawing(true);
    setCurrentStroke([pt]);
  }, [activeTab, spaceHeld, screenToImage, modelSupportsEdits, panOffset]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const dx = (e.clientX - panStartRef.current.x) / zoom;
      const dy = (e.clientY - panStartRef.current.y) / zoom;
      setPanOffset({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
      return;
    }
    if (!isDrawing) return;
    const pt = screenToImage(e.clientX, e.clientY);
    setCurrentStroke((prev) => [...prev, pt]);
  }, [isPanning, isDrawing, screenToImage, zoom]);

  const handleCanvasMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    if (isDrawing && currentStroke.length > 0) {
      drawStrokeOnMask(currentStroke);
      setStrokeHistory((prev) => [...prev, currentStroke]);
      setCurrentStroke([]);
    }
    setIsDrawing(false);
  }, [isPanning, isDrawing, currentStroke, drawStrokeOnMask]);

  const handleUndo = useCallback(() => {
    setStrokeHistory((prev) => {
      const next = prev.slice(0, -1);
      const maskCanvas = maskCanvasRef.current;
      if (!maskCanvas) return next;
      const ctx = maskCanvas.getContext("2d");
      if (!ctx) return next;
      ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      for (const stroke of next) {
        drawStrokeOnMask(stroke);
      }
      return next;
    });
  }, [drawStrokeOnMask]);

  const handleClearMask = useCallback(() => {
    setStrokeHistory([]);
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  }, []);
```

- [ ] **Step 5: Update handleAreaGenerate with mask generation**

Replace the empty `handleAreaGenerate` from Task 5:

```typescript
  const handleAreaGenerate = useCallback(async () => {
    const maskCanvas = maskCanvasRef.current;
    const img = imageElRef.current;
    if (!maskCanvas || !img) return;

    if (strokeHistory.length === 0) {
      setError("请在图片上涂抹标记重绘区域");
      return;
    }
    if (!instruction.trim()) {
      setError("请输入重绘指令");
      return;
    }

    // Generate mask: black background + white strokes
    const offscreen = document.createElement("canvas");
    offscreen.width = img.naturalWidth;
    offscreen.height = img.naturalHeight;
    const ctx = offscreen.getContext("2d")!;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    // Re-draw all strokes at original image resolution
    ctx.strokeStyle = "white";
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokeHistory) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    }
    const maskDataUrl = offscreen.toDataURL("image/png");

    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/images/${imageId}/inpaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mask_data_url: maskDataUrl,
          inpaint_instruction: instruction,
          image_model: imageModel,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "生成失败");
        return;
      }
      const data = await res.json() as { imageId: string; status: string };
      setResult({ imageId: data.imageId, status: "generating" });
      pollForResult(data.imageId);
    } catch {
      setError("网络错误");
    } finally {
      setGenerating(false);
    }
  }, [brushSize, strokeHistory, instruction, imageId, imageModel, pollForResult]);
```

- [ ] **Step 6: Update the image rendering to use a real img element and add canvas overlay**

Replace the image canvas area in the JSX (the `<div className="relative flex flex-1 ...">` section) with:

```jsx
      {/* Image canvas area */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden bg-black"
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className="relative"
          style={{
            transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
            transformOrigin: "center center",
          }}
        >
          {imageUrl && (
            <img
              ref={imageElRef}
              src={imageUrl}
              alt="编辑图片"
              className="max-h-[90vh] max-w-[90vw] object-contain"
              onLoad={(e) => {
                const img = e.currentTarget;
                imageElRef.current = img;
                // Initialize mask canvas at image resolution
                const maskCanvas = maskCanvasRef.current;
                if (maskCanvas) {
                  maskCanvas.width = img.naturalWidth;
                  maskCanvas.height = img.naturalHeight;
                }
              }}
              style={{ display: "block", width: "100%", height: "100%", maxWidth: "70vw", maxHeight: "90vh", objectFit: "contain" }}
            />
          )}
          {/* Mask canvas overlay — only visible in area mode */}
          {activeTab === "area" && (
            <canvas
              ref={canvasRef}
              className="absolute inset-0 cursor-crosshair"
              style={{
                width: "100%",
                height: "100%",
                pointerEvents: spaceHeld ? "grab" : "auto",
                opacity: 0.4,
              }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            />
          )}
        </div>
        {/* Hidden mask canvas at original image resolution */}
        <canvas ref={maskCanvasRef} className="hidden" />
        {/* Zoom indicator */}
        <div className="absolute bottom-4 left-4 rounded bg-black/50 px-2 py-1 text-xs text-white/70">
          {Math.round(zoom * 100)}%
        </div>
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
          title="关闭 (ESC)"
        >
          ✕
        </button>
      </div>
```

- [ ] **Step 7: Update area tab content**

Replace the placeholder area tab content (the "框选重绘功能开发中" div) with:

```jsx
          {activeTab === "area" && (
            <div className="space-y-4">
              {!modelSupportsEdits ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center text-xs text-amber-300">
                  当前模型不支持框选重绘
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-white/70">画笔大小</label>
                      <span className="text-xs text-white/50">{brushSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex gap-2">
                      <Button variant="ghost" className="flex-1 text-xs text-white/70" onClick={handleUndo} disabled={strokeHistory.length === 0}>
                        撤销
                      </Button>
                      <Button variant="ghost" className="flex-1 text-xs text-white/70" onClick={handleClearMask} disabled={strokeHistory.length === 0}>
                        清除
                      </Button>
                    </div>
                    <p className="text-[10px] text-white/40">
                      在图片上涂抹标记重绘区域。按住空格拖拽平移，滚轮缩放。
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/70">重绘指令</label>
                    <Textarea
                      minRows={3}
                      className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30"
                      placeholder="描述你要重绘的内容，例如：把蓝衣服的人换成红衣服的"
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="primary"
                    className="w-full text-xs"
                    disabled={generating || !modelSupportsEdits || strokeHistory.length === 0 || !instruction.trim()}
                    onClick={handleAreaGenerate}
                  >
                    {generating ? "生成中..." : "生成重绘"}
                  </Button>
                </>
              )}
            </div>
          )}
```

- [ ] **Step 8: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add components/inpaint/inpaint-modal.tsx
git commit -m "feat: add canvas mask drawing for area inpaint mode"
```

---

### Task 7: Add inpaint result display in candidate pool

**Files:**
- Modify: `components/cards/candidate-pool/candidate-image-card.tsx`

- [ ] **Step 1: Add inpaint badge and discard action to CandidateImageCard**

Update `CandidateImageCard` props to include `inpaintParentId` and `onDiscardInpaint`:

```typescript
export function CandidateImageCard({
  image,
  selected,
  loadingKey,
  onToggleSelect,
  onPreview,
  onInpaint,
  onRegenerate,
  onDelete,
  onDiscardInpaint,
  footer,
}: {
  image: CandidateImage;
  selected?: boolean;
  loadingKey: string | null;
  onToggleSelect?: (id: string) => void;
  onPreview: (id: string) => void;
  onInpaint: (id: string) => void;
  onRegenerate: (id: string) => void;
  onDelete?: (id: string) => void;
  onDiscardInpaint?: (id: string) => void;
  footer?: React.ReactNode;
}) {
```

Inside the JSX, after the `{footer}` line (line 73) and before the button group, add the inpaint badge:

```jsx
        {image.inpaintParentId && (
          <div className="flex items-center justify-between">
            <span className="inline-flex rounded bg-[var(--brand-50)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--brand-700)]">
              重绘版本
            </span>
            {onDiscardInpaint && (
              <Button variant="ghost" className="h-6 px-1.5 text-[10px] text-[var(--ink-400)]" onClick={() => onDiscardInpaint(image.id)}>
                放弃
              </Button>
            )}
          </div>
        )}
```

- [ ] **Step 2: Wire up onDiscardInpaint in CandidatePoolCard**

In `components/cards/candidate-pool-card.tsx`, add a handler and pass it through:

```typescript
  const handleDiscardInpaint = useCallback(async (imageId: string) => {
    try {
      setActionError(null);
      setActionLoading(imageId);
      await fetch(`/api/images/${imageId}`, { method: "DELETE" });
      dispatchWorkspaceInvalidated();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "放弃重绘失败");
    } finally {
      setActionLoading(null);
    }
  }, []);
```

Pass `onDiscardInpaint={handleDiscardInpaint}` to both `CandidateImageCard` and `CandidateGroupCard` renderings.

Also update the `CandidateGroupCard` component to accept and pass through `onDiscardInpaint`. Check `components/cards/candidate-pool/candidate-group-card.tsx` for its props interface and add the new prop.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/cards/candidate-pool-card.tsx components/cards/candidate-pool/candidate-image-card.tsx components/cards/candidate-pool/candidate-group-card.tsx
git commit -m "feat: show inpaint badge and discard action in candidate pool"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS — zero errors

- [ ] **Step 2: Run all tests**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: PASS or only pre-existing warnings

- [ ] **Step 4: Manual smoke test checklist**

1. Open a project with candidate images generated by a `supportsEdits` model (e.g., 即梦 4.0)
2. Click "重绘" on a candidate image → fullscreen modal opens
3. Text mode: copy text loads from DB, editable fields, "生成重绘" works
4. Switch to area tab: brush painting works on image, zoom/pan with scroll/space
5. Open with a non-edits model (e.g., Gemini) → warning shown, generate disabled
6. After generation, candidate pool shows "重绘版本" badge
7. "放弃" deletes the new image
