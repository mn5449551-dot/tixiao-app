# 图文链路补全 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补全开发文档中已定义但尚未实现的功能（不含 Inpaint mock、不含九宫格）

**Architecture:** 逐项补全后端 API 缺失端点、前端卡片交互连线、画布自动刷新。每个 Task 完成后独立可测。

**Tech Stack:** Next.js 16.2.2 (App Router), Drizzle ORM + SQLite, React Flow, Tailwind CSS

---

### Task 1: 补全 `GET /api/images/[id]` 端点

**Files:**
- Modify: `app/api/images/[id]/route.ts:1-75`

- [ ] **Step 1: 添加 GET handler**

在 `app/api/images/[id]/route.ts` 文件顶部（DELETE handler 之前）添加：

```typescript
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";

import { deleteFileIfExists } from "@/lib/storage";
import { getDb } from "@/lib/db";
import { generatedImages, imageConfigs } from "@/lib/schema";

export async function GET(
  _request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const { id } = (await context.params) as { id: string };

    const db = getDb();
    const image = db
      .select({
        id: generatedImages.id,
        imageGroupId: generatedImages.imageGroupId,
        imageConfigId: generatedImages.imageConfigId,
        slotIndex: generatedImages.slotIndex,
        filePath: generatedImages.filePath,
        fileUrl: generatedImages.fileUrl,
        status: generatedImages.status,
        errorMessage: generatedImages.errorMessage,
        seed: generatedImages.seed,
        createdAt: generatedImages.createdAt,
        updatedAt: generatedImages.updatedAt,
      })
      .from(generatedImages)
      .where(eq(generatedImages.id, id))
      .get();

    if (!image) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    return NextResponse.json({ image });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取图片失败" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: 验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 2: 实现图片实际重生成逻辑

**Files:**
- Modify: `app/api/images/[id]/route.ts` (POST handler)

当前 POST handler 只标记状态为 generating 但未实际调用生图 API。需要改为：标记状态 → 查询关联 imageConfig → 复用 generate/route.ts 中的生图逻辑生成这一张图。

- [ ] **Step 1: 重写 POST handler**

将 POST handler 替换为：

```typescript
export async function POST(
  request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const { id } = (await context.params) as { id: string };
    const body = await request.json().catch(() => ({}));

    const db = getDb();
    const image = db
      .select()
      .from(generatedImages)
      .where(eq(generatedImages.id, id))
      .get();

    if (!image) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    // Clear old file
    await deleteFileIfExists(image.filePath);

    // Mark as generating
    db.update(generatedImages)
      .set({ status: "generating", filePath: null, fileUrl: null, errorMessage: null, updatedAt: Date.now() })
      .where(eq(generatedImages.id, id))
      .run();

    // Get the image config and related data for regeneration
    const config = db.select().from(imageConfigs).where(eq(imageConfigs.id, image.imageConfigId)).get();
    if (!config) {
      db.update(generatedImages)
        .set({ status: "failed", errorMessage: "图片配置不存在", updatedAt: Date.now() })
        .where(eq(generatedImages.id, id))
        .run();
      return NextResponse.json({ error: "图片配置不存在" }, { status: 422 });
    }

    // Trigger background regeneration for this single image
    regenerateSingleImage({
      image,
      config,
      projectId: config.projectId || "", // get from imageConfig or config relation
    });

    return NextResponse.json(
      { message: "图片已标记为重新生成", imageId: id },
      { status: 202 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "重新生成失败" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: 添加 `regenerateSingleImage` 函数**

在同文件底部添加：

```typescript
import { generateImageFromPrompt, generateImageFromReference } from "@/lib/ai/image-chat";
import { buildImagePrompt } from "@/lib/ai/services/prompt-template";
import { saveImageBuffer } from "@/lib/storage";
import { copies, directions } from "@/lib/schema";
import sharp from "sharp";

function regenerateSingleImage(input: {
  image: typeof generatedImages.$inferSelect;
  config: typeof imageConfigs.$inferSelect;
  projectId: string;
}) {
  setImmediate(async () => {
    const db = getDb();
    const { image, config, projectId } = input;

    try {
      // Get copy and direction for prompt building
      const copy = db.select().from(copies).where(eq(copies.id, config.copyId)).get();
      const direction = db.select().from(directions).where(eq(directions.id, config.directionId)).get();

      if (!copy || !direction) {
        throw new Error("图片关联的文案或方向不存在");
      }

      // Use existing prompt (already generated by Agent 5)
      const promptEn = config.promptEn || buildImagePrompt({
        directionTitle: direction.title,
        scenarioProblem: direction.scenarioProblem,
        copyTitleMain: copy.titleMain,
        copyTitleSub: copy.titleSub,
        copyTitleExtra: copy.titleExtra,
        aspectRatio: config.aspectRatio,
        styleMode: config.styleMode,
        imageStyle: config.imageStyle,
        ipRole: config.ipRole,
        logo: config.logo ?? "none",
        imageForm: direction.imageForm ?? "single",
        referenceImageUrl: config.referenceImageUrl,
      });

      // Generate image
      const binaries = config.referenceImageUrl
        ? await generateImageFromReference({
            instruction: promptEn,
            imageUrl: config.referenceImageUrl,
          })
        : await generateImageFromPrompt(promptEn);

      const binary = binaries[0];
      const pngBuffer = await sharp(binary.buffer).png().toBuffer();
      const saved = await saveImageBuffer({
        projectId,
        imageId: image.id,
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
        .where(eq(generatedImages.id, image.id))
        .run();
    } catch (error) {
      const message = error instanceof Error ? error.message : "图片重生成失败";
      db.update(generatedImages)
        .set({ status: "failed", errorMessage: message, updatedAt: Date.now() })
        .where(eq(generatedImages.id, image.id))
        .run();
    }
  });
}
```

- [ ] **Step 3: 验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 3: 补全 Inpaint 后端存根

**Files:**
- Modify: `app/api/images/[id]/inpaint/route.ts`

当前返回 501 "not implemented"。替换为真实的 inpaint 调用。

- [ ] **Step 1: 读取现有 inpaint route 内容**

Read the current file to see what's there.

- [ ] **Step 2: 替换为真实实现**

```typescript
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import sharp from "sharp";

import { getDb } from "@/lib/db";
import { generatedImages } from "@/lib/schema";
import { saveImageBuffer, deleteFileIfExists } from "@/lib/storage";
import { inpaintImage } from "@/lib/ai/image-chat"; // or whatever the inpaint function is

export async function POST(
  request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const { id } = (await context.params) as { id: string };
    const body = await request.json();

    const { mask_data_url, inpaint_instruction } = body as {
      mask_data_url: string;
      inpaint_instruction: string;
    };

    if (!mask_data_url || !inpaint_instruction?.trim()) {
      return NextResponse.json(
        { error: "缺少必要参数：mask_data_url 和 inpaint_instruction" },
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

    // Mark original as still done, create a new image record for inpaint result
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

    // Background inpaint processing
    setImmediate(async () => {
      const db = getDb();
      try {
        // Call inpaint API (implement this in image-chat.ts or a new file)
        const result = await callInpaintApi({
          imageUrl: image.fileUrl!,
          maskDataUrl: mask_data_url,
          instruction: inpaint_instruction,
        });

        const pngBuffer = await sharp(result.buffer).png().toBuffer();
        const saved = await saveImageBuffer({
          projectId: "", // derive from imageConfig
          imageId: newImageId,
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
          .where(eq(generatedImages.id, newImageId))
          .run();
      } catch (error) {
        const message = error instanceof Error ? error.message : "局部重绘失败";
        db.update(generatedImages)
          .set({ status: "failed", errorMessage: message, updatedAt: Date.now() })
          .where(eq(generatedImages.id, newImageId))
          .run();
      }
    });

    return NextResponse.json({
      imageId: newImageId,
      status: "generating",
    }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "局部重绘失败" },
      { status: 500 },
    );
  }
}

async function callInpaintApi(input: {
  imageUrl: string;
  maskDataUrl: string;
  instruction: string;
}): Promise<{ buffer: Buffer }> {
  // TODO: Implement actual inpaint API call
  // This should call your image generation service with inpaint mode
  // For now, this is a placeholder that needs real API integration
  throw new Error("Inpaint API not configured — implement callInpaintApi() in lib/ai/image-chat.ts");
}
```

注意：`callInpaintApi` 需要对接实际的生图 inpaint 能力。这个函数框架已搭好，等待 API 接入。

- [ ] **Step 3: 验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 4: 方向卡按钮连线（编辑保存、删除、重生成、生成文案）

**Files:**
- Modify: `components/cards/direction-card.tsx` (edit save, delete, regenerate, generate buttons)
- Modify: `lib/project-data.ts` (if needed for `updateDirection`)

方向卡已有编辑 UI 和按钮，但 onClick 全是 placeholder。需要接上真实 API。

- [ ] **Step 1: 编辑保存 → PUT /api/directions/[id]**

将方向卡中的保存按钮 handler 从 `cancelEdit()` 改为：

```typescript
onClick={async () => {
  try {
    await fetch(`/api/directions/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editBuffer.title ?? direction.title,
        targetAudience: editBuffer.targetAudience ?? direction.targetAudience,
        scenarioProblem: editBuffer.scenarioProblem ?? direction.scenarioProblem,
        differentiation: editBuffer.differentiation ?? direction.differentiation,
        effect: editBuffer.effect ?? direction.effect,
      }),
    });
    cancelEdit();
    window.dispatchEvent(new CustomEvent("canvas-refresh"));
  } catch (error) {
    console.error("Failed to save direction:", error);
  }
}}
```

- [ ] **Step 2: 删除方向 → DELETE /api/directions/[id]**

将删除按钮 handler 从 `/* delete: placeholder */` 改为：

```typescript
onClick={async () => {
  if (!confirm(`确定删除方向 #${index + 1} 及其所有下游产物？`)) return;
  try {
    await fetch(`/api/directions/${direction.id}`, { method: "DELETE" });
    window.dispatchEvent(new CustomEvent("canvas-refresh"));
  } catch (error) {
    console.error("Failed to delete direction:", error);
  }
}}
```

- [ ] **Step 3: 重新生成方向 → POST /api/projects/[id]/directions/generate**

将重生成按钮 handler 从 `/* regenerate: placeholder */` 改为：

```typescript
onClick={async () => {
  try {
    await fetch(`/api/directions/${direction.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerate: true }),
    });
    window.dispatchEvent(new CustomEvent("canvas-refresh"));
  } catch (error) {
    console.error("Failed to regenerate direction:", error);
  }
}}
```

注意：方向单条重生成需要后端支持。如果 PUT /api/directions/[id] 不支持 regenerate，改为调用 directions/generate 并传入 directionId。

- [ ] **Step 4: 生成文案按钮 → POST /api/directions/[id]/copy-cards/generate**

将底部"生成选中方向的文案"按钮 handler 从 placeholder 改为：

```typescript
onClick={async () => {
  const selected = directions.filter((d) => selectedIds.has(d.id));
  if (selected.length === 0) return;

  for (const direction of selected) {
    try {
      const response = await fetch(`/api/directions/${direction.id}/copy-cards/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: direction.copyGenerationCount ?? 3 }),
      });
      if (!response.ok) {
        console.error(`Failed to generate copy for direction ${direction.id}`);
      }
    } catch (error) {
      console.error(`Error generating copy for direction ${direction.id}:`, error);
    }
  }
  window.dispatchEvent(new CustomEvent("canvas-refresh"));
}}
```

- [ ] **Step 5: 验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 5: 候选池追加生成 + 定稿池导出连线

**Files:**
- Modify: `components/cards/candidate-pool-card.tsx` (add "追加生成" button)
- Modify: `components/cards/finalized-pool-card.tsx` (wire export button)

- [ ] **Step 1: 候选池添加"追加生成"按钮**

在 candidate-pool-card.tsx 底部 bar 的"全选"按钮前，添加追加生成按钮：

```typescript
{/* Top bar: Append generate */}
<div className="mb-2 flex justify-end">
  <Button
    variant="ghost"
    onClick={async () => {
      try {
        // Find the imageConfigId from the first image
        const firstImage = images[0];
        if (!firstImage) return;
        // Need to get imageConfigId from the image — add a data attribute or fetch
        const response = await fetch(`/api/images/${firstImage.id}`);
        if (!response.ok) return;
        const data = await response.json();
        const configId = data.image?.imageConfigId;
        if (!configId) return;

        await fetch(`/api/image-configs/${configId}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ append: true }),
        });
        window.dispatchEvent(new CustomEvent("canvas-refresh"));
      } catch (error) {
        console.error("Failed to append generate:", error);
      }
    }}
    className="text-xs"
  >
    {"\uFF0B"} 追加生成
  </Button>
</div>
```

- [ ] **Step 2: 定稿池导出按钮 → POST /api/projects/[id]/export**

在 finalized-pool-card.tsx 中，将导出按钮的 onClick 从空改为：

```typescript
<Button
  variant="primary"
  className="w-full text-xs"
  onClick={async () => {
    if (confirmedImages.length === 0) return;
    if (selectedChannels.length === 0) return;

    try {
      // Get projectId — need to pass it as data prop
      const response = await fetch(`/api/projects/${projectId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_channels: selectedChannels,
          target_slots: selectedSlots.length > 0 ? selectedSlots : availableSlots.map(s => s.slotName),
          file_format: "jpg",
          naming_rule: "channel_slot_date_version",
        }),
      });

      if (!response.ok) {
        console.error("Export failed");
        return;
      }

      // Download ZIP
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "export.zip";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
    }
  }}
>
  确认导出
</Button>
```

注意：需要将 `projectId` 传入 FinalizedPoolCard 的 data prop。

- [ ] **Step 3: workflow-canvas 传入 projectId 到 finalizedPool 节点**

在 `workflow-canvas.tsx` 的 finalizedPool 节点 data 中添加 `projectId`：

```typescript
data: {
  images: confirmedImages,
  groupLabel: `${confirmedImages.length} 张已定稿`,
  projectId: workspace.project.id,  // Add this
},
```

并更新 FinalizedPoolCardData 类型：

```typescript
export type FinalizedPoolCardData = {
  images: FinalizedImage[];
  groupLabel?: string;
  projectId?: string;
};
```

- [ ] **Step 4: 验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 6: 画布自动刷新监听

**Files:**
- Modify: `components/canvas/workflow-canvas.tsx`

当前 `canvas-refresh` 事件被 dispatch 但没有监听器。添加 useEffect 监听并在触发时 re-render。

- [ ] **Step 1: 添加刷新监听**

在 WorkflowCanvas 组件中添加：

```typescript
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Inside WorkflowCanvas:
const router = useRouter();
const [refreshKey, setRefreshKey] = useState(0);

useEffect(() => {
  const handler = () => {
    // Simple approach: navigate to same page to trigger SSR re-render
    router.refresh();
    setRefreshKey((k) => k + 1);
  };
  window.addEventListener("canvas-refresh", handler);
  return () => window.removeEventListener("canvas-refresh", handler);
}, [router]);
```

- [ ] **Step 2: 将 refreshKey 传入 buildGraph 以触发重新计算**

```typescript
const initialGraph = useMemo(
  () => buildGraph(workspace),
  [workspace, refreshKey],
);
```

注意：`workspace` 是 SSR 数据，`router.refresh()` 会触发 RSC re-render。对于客户端状态更新，可能需要用 `window.location.reload()` 或更好的方案——在 agent-panel 操作后直接更新 nodes。

**更优方案**：不用全页刷新，而是在 canvas 中监听事件后重新 fetch 数据：

```typescript
useEffect(() => {
  const handler = async () => {
    try {
      const res = await fetch(`/api/projects/${workspace.project.id}`);
      const json = await res.json();
      // Update graph with fresh data
      const { nodes: newNodes } = buildGraph(json);
      setNodes(newNodes);
    } catch (e) {
      console.error("Failed to refresh canvas:", e);
    }
  };
  window.addEventListener("canvas-refresh", handler);
  return () => window.removeEventListener("canvas-refresh", handler);
}, [workspace.project.id]);
```

但 API GET /api/projects/[id] 返回的不一定是 buildGraph 需要的完整数据结构。需要确认 API 返回格式。

**最简单可靠方案**：

```typescript
useEffect(() => {
  const handler = () => {
    window.location.reload();
  };
  window.addEventListener("canvas-refresh", handler);
  return () => window.removeEventListener("canvas-refresh", handler);
}, []);
```

- [ ] **Step 3: 验证**

操作 candidate-pool 的删除/重生成，观察画布是否自动刷新。

---

### Task 7: 连线动画（loading 状态）

**Files:**
- Modify: `components/canvas/workflow-canvas.tsx` (edge building logic)
- Modify: `app/globals.css` or `app/index.css` (add CSS animation)

PRD 要求：处理中的节点，连线显示虚线动画。

- [ ] **Step 1: 添加 CSS 动画**

在 `app/globals.css`（或主 CSS 文件）中添加：

```css
@keyframes dashdraw {
  from { stroke-dashoffset: 10; }
  to { stroke-dashoffset: 0; }
}

.react-flow__edge.animated path {
  stroke-dasharray: 5;
  animation: dashdraw 0.5s linear infinite;
}
```

- [ ] **Step 2: 在 buildGraph 中为 loading 状态的节点相关连线添加 animated 标记**

修改 `edgeOf` 函数，增加 `animated` 参数：

```typescript
function edgeOf(source: string, target: string, label: string, animated = false): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    label,
    animated,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#ff8a00" },
    style: { stroke: "#ff8a00", strokeWidth: 1.5 },
    labelStyle: { fill: "#8b7355", fontSize: 10 },
    labelBgStyle: { fill: "#fffdfb", fillOpacity: 1 },
  };
}
```

- [ ] **Step 3: 在 buildGraph 中传递 status 到 edge**

在生成 edge 时，判断 source 或 target 节点是否处于 loading 状态，若是则设置 `animated: true`。

需要修改 buildGraph 中各处 `edges.push(edgeOf(...))` 调用，传递 animated 标志。例如方向卡 loading 时：

```typescript
edges.push(edgeOf("requirement", "direction-board", "生成", dirStatus === "loading"));
```

- [ ] **Step 4: 验证**

触发方向生成，观察连线是否显示虚线流动动画。

---

### Task 8: 清理 & 最终验证

**Files:**
- All modified files

- [ ] **Step 1: 最终 TypeScript 检查**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: 构建检查**

Run: `npx next build` (or `npx next dev` to verify)
Expected: No runtime errors

- [ ] **Step 3: 手动功能验证**

逐项验证：
1. GET /api/images/[id] 返回图片状态
2. 图片重生成按钮实际生成新图
3. 方向卡编辑保存后字段更新
4. 方向卡删除后级联清理
5. 方向卡生成文案按钮触发 SSE 生成
6. 候选池追加生成新增一组候选
7. 定稿池导出按钮触发下载 ZIP
8. 删除候选图后画布自动刷新
9. Loading 状态节点连线有虚线动画
