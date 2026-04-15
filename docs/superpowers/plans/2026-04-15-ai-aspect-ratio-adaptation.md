# AI 适配版本生成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将定稿池的适配版本生成从 Sharp 裁切改为 AI 模型智能比例转换，特殊比例暂不支持。

**Architecture:** 复用现有 `generateImageFromReference` 调用链，将原始定稿图作为参考图传入，prompt 要求保持内容不变仅适配比例。创建 pending 状态图片记录，并行 AI 调用后更新状态，走完整的 pending → generating → done 流程。

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, Sharp（仅 logo overlay）, AI Gateway (doubao/qwen/gemini/gpt-image)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/export/utils.ts` | Modify | 新增 `isSpecialRatio()` 辅助函数 |
| `lib/workflow-graph-types.ts` | Modify | 定稿池节点数据新增 `defaultImageModel` |
| `lib/workflow-graph-builders.ts` | Modify | `buildFinalizedPoolNode` 传递 `defaultImageModel` |
| `lib/project-data-modules-internal.ts` | Modify | 重写 `generateFinalizedVariants` 为 AI 生成 |
| `app/api/projects/[id]/finalized/variants/route.ts` | Modify | 新增 `image_model` 参数，返回 `skipped_slots` |
| `components/cards/finalized-pool/finalized-pool-actions.ts` | Modify | `generateFinalizedVariants` 新增 `imageModel` 参数 |
| `components/cards/finalized-pool-card.tsx` | Modify | 新增模型选择器，特殊比例标注"暂不支持" |
| `app/api/projects/[id]/export/route.ts` | Modify | 跳过 `postprocess` 版位 |
| `lib/__tests__/finalized-variants-source.test.ts` | Create | 源码分析测试 |

---

### Task 1: 新增特殊比例判断辅助函数

**Files:**
- Modify: `lib/export/utils.ts`

- [ ] **Step 1: 在 `lib/export/utils.ts` 末尾添加 `isSpecialRatio` 函数**

在文件末尾（`buildExportFileName` 函数之后）添加：

```typescript
export function isSpecialRatio(ratio: string): boolean {
  return ratio === "16:11" || ratio === "√2:1";
}
```

- [ ] **Step 2: 运行 typecheck 验证**

Run: `npx tsc --noEmit`
Expected: 无错误

---

### Task 2: 定稿池节点传递默认模型

**Files:**
- Modify: `lib/workflow-graph-types.ts`
- Modify: `lib/workflow-graph-builders.ts`

- [ ] **Step 1: 在 `lib/workflow-graph-types.ts` 的定稿池节点数据类型中添加 `defaultImageModel`**

找到定稿池对应的 union variant（包含 `displayMode`, `groups`, `groupLabel`, `projectId` 的那个对象），在 `projectId` 后添加：

```typescript
      projectId?: string;
      defaultImageModel?: string | null;
```

- [ ] **Step 2: 在 `lib/workflow-graph-builders.ts` 的 `buildFinalizedPoolNode` 中传递 `defaultImageModel`**

找到 `buildFinalizedPoolNode` 函数，在构建 node data 时（`projectId` 所在的对象），添加 `defaultImageModel`：

将函数签名改为接收 `imageModel` 参数：

```typescript
export function buildFinalizedPoolNode(input: {
  copy: WorkspaceData["directions"][number]["copyCards"][number]["copies"][number];
  configY: number;
  projectId: string;
  imageModel?: string | null;
}) {
```

在 node data 的 `projectId` 之后添加：

```typescript
          projectId,
          defaultImageModel: input.imageModel ?? null,
```

在 `buildGraph` 中调用 `buildFinalizedPoolNode` 的地方，传入 `imageModel`：

找到 `workflow-graph.ts` 中调用 `buildFinalizedPoolNode` 的位置，改为：

```typescript
        const finalizedPool = buildFinalizedPoolNode({
          copy,
          configY,
          projectId: workspace.project.id,
          imageModel: config.imageModel ?? null,
        });
```

注意：这里的 `config` 变量在循环体中已经存在（来自 `buildImageConfigNode` 调用处，`config` 是 `copy.imageConfig` 的别名，或者需要从 copy.imageConfig 中读取 imageModel）。实际上在这个循环体中，`copy.imageConfig` 有 `imageModel` 字段。改为：

```typescript
        const finalizedPool = buildFinalizedPoolNode({
          copy,
          configY,
          projectId: workspace.project.id,
          imageModel: copy.imageConfig?.imageModel ?? null,
        });
```

- [ ] **Step 3: 运行 typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

---

### Task 3: 重写 `generateFinalizedVariants` 为 AI 生成

**Files:**
- Modify: `lib/project-data-modules-internal.ts`

这是核心改动。将 `generateFinalizedVariants` 从 Sharp 调用改为 AI 调用。

- [ ] **Step 1: 添加新的 import**

在文件顶部的 import 区域，找到已有的 `import sharp from "sharp";`，在它下面添加：

```typescript
import { readFile } from "node:fs/promises";
```

找到已有的 `import { generateCopyIdeas } from "@/lib/ai/agents/copy-agent";` 所在的 import 区域，添加：

```typescript
import { generateImageFromReference } from "@/lib/ai/image-chat";
```

在 constants import 中确认 `isSpecialRatio` 也被导入：

```typescript
import { isSpecialRatio } from "@/lib/export/utils";
```

需要确认现有 import 语句中 `resolveExportSlotSpecs` 和 `classifyExportAdaptation` 的导入。当前文件头部已有：

```typescript
import { classifyExportAdaptation, parseSlotSize, resolveExportSlotSpecs } from "@/lib/export/utils";
```

改为：

```typescript
import { classifyExportAdaptation, isSpecialRatio, resolveExportSlotSpecs } from "@/lib/export/utils";
```

- [ ] **Step 2: 重写 `generateFinalizedVariants` 函数**

替换整个 `generateFinalizedVariants` 函数（从 `export async function generateFinalizedVariants` 到它的结束 `}`），代码如下：

```typescript
export async function generateFinalizedVariants(
  projectId: string,
  input: {
    targetGroupIds?: string[];
    targetChannels?: string[];
    targetSlots?: string[];
    imageModel?: string;
  },
) {
  const db = getDb();
  const selectedGroupIds = new Set(input.targetGroupIds ?? []);
  const slotSpecs = resolveExportSlotSpecs(input);
  const model = input.imageModel ?? "doubao-seedream-4-0";

  // 按比例去重，跳过特殊比例
  const ratioSpecs = new Map(
    slotSpecs
      .filter((slot) => !isSpecialRatio(slot.ratio))
      .map((slot) => [slot.ratio, slot]),
  );

  // 收集被跳过的特殊比例版位名称
  const skippedSlots = slotSpecs
    .filter((slot) => isSpecialRatio(slot.ratio))
    .map((slot) => `${slot.channel} · ${slot.slotName}`);

  const directionRows = listDirections(projectId);
  const created = [] as Array<typeof imageGroups.$inferSelect>;

  for (const direction of directionRows) {
    const cards = listCopyCards(direction.id);
    for (const card of cards) {
      for (const copy of card.copies) {
        const config = db.select().from(imageConfigs).where(eq(imageConfigs.copyId, copy.id)).get();
        if (!config) continue;

        const groups = db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, config.id)).all();
        const finalizedGroups = groups.filter(
          (group) =>
            group.isConfirmed === 1 &&
            !group.groupType.startsWith("derived|") &&
            (selectedGroupIds.size === 0 || selectedGroupIds.has(group.id)),
        );

        for (const group of finalizedGroups) {
          const sourceImages = db
            .select()
            .from(generatedImages)
            .where(eq(generatedImages.imageGroupId, group.id))
            .all()
            .filter((image) => image.status === "done" && image.filePath);

          if (sourceImages.length === 0) continue;

          for (const [ratio, slotSpec] of ratioSpecs) {
            if (classifyExportAdaptation(config.aspectRatio, ratio) === "direct") continue;

            const derivedGroupType = `derived|${group.id}|${ratio}`;
            const existingDerived = groups.find((item) => item.groupType === derivedGroupType);
            if (existingDerived) {
              const existingImages = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, existingDerived.id)).all();
              for (const image of existingImages) {
                await deleteFileIfExists(image.filePath);
              }
              db.delete(imageGroups).where(eq(imageGroups.id, existingDerived.id)).run();
            }

            const allGroups = db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, config.id)).all();
            const nextVariantIndex = Math.max(...allGroups.map((item) => item.variantIndex), 0) + 1;
            const timestamp = now();
            const derivedGroupId = createId("grp");

            db.insert(imageGroups)
              .values({
                id: derivedGroupId,
                imageConfigId: config.id,
                groupType: derivedGroupType,
                variantIndex: nextVariantIndex,
                slotCount: group.slotCount,
                isConfirmed: 1,
                createdAt: timestamp,
                updatedAt: timestamp,
              })
              .run();

            // 创建 pending 状态的图片记录
            const workItems: Array<{
              imageId: string;
              sourceImage: typeof sourceImages[number];
              prompt: string;
            }> = [];

            for (const sourceImage of sourceImages) {
              const imageId = createId("img");
              db.insert(generatedImages)
                .values({
                  id: imageId,
                  imageGroupId: derivedGroupId,
                  imageConfigId: config.id,
                  slotIndex: sourceImage.slotIndex,
                  filePath: null,
                  fileUrl: null,
                  status: "generating",
                  inpaintParentId: sourceImage.id,
                  errorMessage: null,
                  seed: sourceImage.seed,
                  finalPromptText: null,
                  finalNegativePrompt: null,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                })
                .run();

              const aspectDirection = compareAspectRatios(config.aspectRatio, ratio);
              const prompt = buildAdaptationPrompt(config.aspectRatio, ratio, aspectDirection);

              workItems.push({ imageId, sourceImage, prompt });
            }

            // 并行 AI 生成
            const generationResults = await Promise.allSettled(
              workItems.map(async (item) => {
                const imageBuffer = await readFile(item.sourceImage.filePath!);
                const mimeType = getMimeTypeFromPath(item.sourceImage.filePath!);
                const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

                const binaries = await generateImageFromReference({
                  instruction: item.prompt,
                  imageUrls: [dataUrl],
                  aspectRatio: ratio,
                  model,
                });

                const binary = binaries[0];
                const pngBuffer = await sharp(binary.buffer).png().toBuffer();
                const saved = await saveImageBuffer({
                  projectId,
                  imageId: item.imageId,
                  buffer: pngBuffer,
                  extension: "png",
                });
                return { imageId: item.imageId, saved, prompt: item.prompt };
              }),
            );

            // 顺序更新数据库
            for (let i = 0; i < generationResults.length; i += 1) {
              const result = generationResults[i];
              const imageId = workItems[i].imageId;

              if (result.status === "fulfilled") {
                db.update(generatedImages)
                  .set({
                    filePath: result.value.saved.filePath,
                    fileUrl: result.value.saved.fileUrl,
                    status: "done",
                    finalPromptText: result.value.prompt,
                    updatedAt: Date.now(),
                  })
                  .where(eq(generatedImages.id, imageId))
                  .run();
              } else {
                const message = result.reason instanceof Error ? result.reason.message : "适配版本生成失败";
                db.update(generatedImages)
                  .set({ status: "failed", errorMessage: message, updatedAt: Date.now() })
                  .where(eq(generatedImages.id, imageId))
                  .run();
              }
            }

            const groupRecord = db.select().from(imageGroups).where(eq(imageGroups.id, derivedGroupId)).get();
            if (groupRecord) created.push(groupRecord);
          }
        }
      }
    }
  }

  return { groups: created, skippedSlots };
}

function compareAspectRatios(source: string, target: string): "wider" | "taller" | "same" {
  function parseRatio(r: string): number {
    if (r === "√2:1") return Math.SQRT2;
    const parts = r.split(":");
    return Number(parts[0]) / Number(parts[1]);
  }
  const s = parseRatio(source);
  const t = parseRatio(target);
  if (Math.abs(s - t) < 0.01) return "same";
  return t > s ? "wider" : "taller";
}

function buildAdaptationPrompt(sourceRatio: string, targetRatio: string, direction: "wider" | "taller" | "same"): string {
  if (direction === "wider") {
    return `保持原图内容和构图不变，将画面比例从 ${sourceRatio} 适配为 ${targetRatio}，通过向左右两侧自然扩展画面来适配更宽的比例，不添加额外元素，保持与原图一致的风格和色调。`;
  }
  if (direction === "taller") {
    return `保持原图内容和构图不变，将画面比例从 ${sourceRatio} 适配为 ${targetRatio}，通过向上下方向自然扩展画面来适配更高的比例，不添加额外元素，保持与原图一致的风格和色调。`;
  }
  return `保持原图内容和构图不变，将画面比例适配为 ${targetRatio}，不添加额外元素，保持与原图一致的风格和色调。`;
}

function getMimeTypeFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}
```

注意：`sharp` 仍然被使用（仅用于将 AI 输出二进制转 PNG buffer 和 logo overlay），`parseSlotSize` 不再使用可以从 import 中移除。

更新文件头部 import：

```typescript
import { classifyExportAdaptation, isSpecialRatio, resolveExportSlotSpecs } from "@/lib/export/utils";
```

（移除 `parseSlotSize` 因为不再使用）

- [ ] **Step 3: 运行 typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

---

### Task 4: 更新 API route 和 actions

**Files:**
- Modify: `app/api/projects/[id]/finalized/variants/route.ts`
- Modify: `components/cards/finalized-pool/finalized-pool-actions.ts`

- [ ] **Step 1: 更新 `app/api/projects/[id]/finalized/variants/route.ts`**

替换整个文件内容为：

```typescript
import { NextResponse } from "next/server";

import { generateFinalizedVariants } from "@/lib/project-data";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      target_group_ids?: string[];
      target_channels?: string[];
      target_slots?: string[];
      image_model?: string;
    };

    const result = await generateFinalizedVariants(id, {
      targetGroupIds: body.target_group_ids,
      targetChannels: body.target_channels,
      targetSlots: body.target_slots,
      imageModel: body.image_model,
    });

    return NextResponse.json({
      groups: result.groups.map((g) => ({ id: g.id })),
      skipped_slots: result.skippedSlots,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成适配版本失败" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: 更新 `components/cards/finalized-pool/finalized-pool-actions.ts`**

在 `generateFinalizedVariants` 函数中，添加 `imageModel` 参数并传给 API：

将函数签名和 body 改为：

```typescript
export async function generateFinalizedVariants(input: {
  projectId: string;
  selectedGroupIds: string[];
  selectedChannels: string[];
  slotNames: string[];
  imageModel: string;
}) {
  try {
    const payload = await apiFetch<{ groups?: Array<{ id: string }>; skipped_slots?: string[] }>(
      `/api/projects/${input.projectId}/finalized/variants`,
      {
        method: "POST",
        body: {
          target_group_ids: input.selectedGroupIds,
          target_channels: input.selectedChannels,
          target_slots: input.slotNames,
          image_model: input.imageModel,
        },
      },
    );

    return {
      ok: true,
      error: null as string | null,
      groups: payload.groups ?? [],
      skippedSlots: payload.skipped_slots ?? [],
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ApiError ? error.message : "生成适配版本失败",
      groups: [],
      skippedSlots: [],
    };
  }
}
```

- [ ] **Step 3: 运行 typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

---

### Task 5: 定稿池 UI — 模型选择器和特殊比例标注

**Files:**
- Modify: `components/cards/finalized-pool-card.tsx`

- [ ] **Step 1: 添加 import**

在文件顶部的 import 区域，添加：

```typescript
import { IMAGE_MODELS } from "@/lib/constants";
import { isSpecialRatio } from "@/lib/export/utils";
import { Field, Input, Select } from "@/components/ui/field";
```

确认 `Field` 和 `Select` 已在 import 中（当前文件只 import 了 `Field, Input, Select`，所以确认即可，不需要额外添加）。检查后发现 `Field` 和 `Input` 已经 import，`Select` 也已经 import。

在 import `{ IMAGE_MODELS }` 需要添加。

- [ ] **Step 2: 添加模型 state 和更新版位标注**

在组件内，找到 `const [namingRule, setNamingRule]` 这行之后，添加：

```typescript
  const [imageModel, setImageModel] = useState<string>(data.defaultImageModel ?? IMAGE_MODELS[0]?.value ?? "doubao-seedream-4-0");
```

- [ ] **Step 3: 更新版位列表中特殊比例的显示**

找到版位按钮渲染区域（`availableSlots.map`），将 `statusLabel` 的计算改为跳过特殊比例：

在版位列表按钮内部，`statusLabel` 计算逻辑改为：

```typescript
              const isSpecial = isSpecialRatio(slot.ratio);
              const statusLabel = isSpecial
                ? "暂不支持"
                : hasPostprocess
                  ? "需后处理"
                  : hasTransform
                    ? "需适配"
                    : "可直接导出";
```

同时更新按钮样式，特殊比例时灰显：

```typescript
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs transition",
                    isSpecial
                      ? "cursor-not-allowed bg-[var(--surface-2)] text-[var(--ink-400)] opacity-60"
                      : active
                        ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
                        : "bg-white text-[var(--ink-600)]",
                  )}
                  onClick={() => { if (!isSpecial) toggleSlot(slot.slotName); }}
```

- [ ] **Step 4: 在投放版位区域和导出预览之间添加模型选择器**

找到 `{availableSlots.length > 0 && (` 这个区块的结束位置（`</div>` 之后），在导出预览区域之前，添加模型选择器：

```tsx
      <div className="mb-3 rounded-[22px] bg-[var(--surface-1)] p-3">
        <Field label="生成模型">
          <Select value={imageModel} onChange={(e) => setImageModel(e.target.value)}>
            {IMAGE_MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
```

- [ ] **Step 5: 更新导出预览统计，排除特殊比例版位**

找到 `selectedSlotSpecs` 的 useMemo，修改为排除特殊比例：

```typescript
  const exportableSlotSpecs = useMemo(
    () => selectedSlotSpecs.filter((slot) => !isSpecialRatio(slot.ratio)),
    [selectedSlotSpecs],
  );
```

将导出预览中的 `selectedSlotSpecs.length` 改为 `exportableSlotSpecs.length`：

```tsx
          将导出 {exportCount} {displayMode === "single" ? "张" : "套"} × {exportableSlotSpecs.length} 个版位
```

`adaptationSummary` 中的 `selectedSlotSpecs` 也改为 `exportableSlotSpecs`：

```typescript
  const adaptationSummary = useMemo(() => {
    let direct = 0;
    let transform = 0;
    let postprocess = 0;

    for (const slot of exportableSlotSpecs) {
      for (const image of selectedImages) {
        const mode = classifyExportAdaptation(image.aspectRatio, slot.ratio);
        if (mode === "direct") direct += 1;
        else if (mode === "transform") transform += 1;
        else postprocess += 1;
      }
    }

    return { direct, transform, postprocess };
  }, [selectedImages, exportableSlotSpecs]);
```

- [ ] **Step 6: 更新"生成适配版本"按钮逻辑**

找到"生成适配版本"按钮，更新 onClick 处理函数：

将 `generateFinalizedVariants` 调用改为传入 `imageModel`：

```typescript
              const result = await generateFinalizedVariants({
                projectId,
                selectedGroupIds: [...selectedGroupIds],
                selectedChannels,
                slotNames: selectedSlotSpecs.map((slot) => slot.slotName),
                imageModel,
              });
```

更新反馈信息，增加 skippedSlots 提示：

```typescript
              if (result.skippedSlots.length > 0) {
                setFeedback(`以下版位暂不支持，功能开发中：${result.skippedSlots.join("、")}${result.groups.length > 0 ? `。已生成 ${result.groups.length} 个适配版本。` : ""}`);
              } else if (result.groups.length === 0) {
                setFeedback("当前选中版位都可直接导出，无需生成适配版本。");
              } else {
                setFeedback(`已生成 ${result.groups.length} 个适配版本。`);
              }
```

同时更新按钮 disabled 条件，增加对模型的要求：

```typescript
          disabled={isGeneratingVariants || exportableSlotSpecs.length === 0 || selectedGroupIds.size === 0 || !projectId}
```

- [ ] **Step 7: 更新导出按钮，排除特殊比例版位**

将导出按钮的 disabled 条件和 onClick 中的 `selectedSlotSpecs` 改为 `exportableSlotSpecs`：

disabled:
```typescript
        disabled={isExporting || selectedGroupIds.size === 0 || selectedChannels.length === 0 || exportableSlotSpecs.length === 0}
```

onClick 中的 slotNames:
```typescript
              slotNames: exportableSlotSpecs.map((slot) => slot.slotName),
```

- [ ] **Step 8: 运行 typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

---

### Task 6: 导出路由跳过特殊比例版位

**Files:**
- Modify: `app/api/projects/[id]/export/route.ts`

- [ ] **Step 1: 在 export route 中过滤特殊比例版位**

在文件头部添加 import：

```typescript
import { isSpecialRatio } from "@/lib/export/utils";
```

找到 `const slotSpecs = resolveExportSlotSpecs(...)` 这行，在它之后添加过滤：

```typescript
    const slotSpecs = resolveExportSlotSpecs({
      targetChannels: body.target_channels,
      targetSlots: body.target_slots,
    }).filter((spec) => !isSpecialRatio(spec.ratio));
```

- [ ] **Step 2: 运行 typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

---

### Task 7: 更新现有测试

**Files:**
- Create: `lib/__tests__/finalized-variants-source.test.ts`

- [ ] **Step 1: 创建测试文件**

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const internalPath = new URL("../project-data-modules-internal.ts", import.meta.url);
const exportUtilsPath = new URL("../export/utils.ts", import.meta.url);
const variantsRoutePath = new URL("../../app/api/projects/[id]/finalized/variants/route.ts", import.meta.url);
const finalizedPoolActionsPath = new URL("../../components/cards/finalized-pool/finalized-pool-actions.ts", import.meta.url);
const exportRoutePath = new URL("../../app/api/projects/[id]/export/route.ts", import.meta.url);

test("export utils provides isSpecialRatio for special ratio detection", async () => {
  const source = await readFile(exportUtilsPath, "utf8");
  assert.match(source, /export function isSpecialRatio/);
  assert.match(source, /16:11/);
  assert.match(source, /√2:1/);
});

test("generateFinalizedVariants uses AI image generation instead of Sharp resize", async () => {
  const source = await readFile(internalPath, "utf8");
  assert.match(source, /generateImageFromReference/);
  assert.match(source, /isSpecialRatio/);
  assert.match(source, /skippedSlots/);
  assert.doesNotMatch(source, /parseSlotSize/);
});

test("generateFinalizedVariants builds adaptation prompts based on ratio direction", async () => {
  const source = await readFile(internalPath, "utf8");
  assert.match(source, /buildAdaptationPrompt/);
  assert.match(source, /compareAspectRatios/);
  assert.match(source, /向左右两侧自然扩展/);
  assert.match(source, /向上下方向自然扩展/);
});

test("generateFinalizedVariants creates pending images and updates status after generation", async () => {
  const source = await readFile(internalPath, "utf8");
  assert.match(source, /status: "generating"/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /status: "done"/);
  assert.match(source, /status: "failed"/);
});

test("variants API route accepts image_model and returns skipped_slots", async () => {
  const source = await readFile(variantsRoutePath, "utf8");
  assert.match(source, /image_model/);
  assert.match(source, /imageModel/);
  assert.match(source, /skipped_slots/);
  assert.match(source, /skippedSlots/);
});

test("finalized pool actions pass imageModel to API", async () => {
  const source = await readFile(finalizedPoolActionsPath, "utf8");
  assert.match(source, /imageModel/);
  assert.match(source, /image_model/);
  assert.match(source, /skippedSlots/);
});

test("export route filters out special ratio slots", async () => {
  const source = await readFile(exportRoutePath, "utf8");
  assert.match(source, /isSpecialRatio/);
});
```

- [ ] **Step 2: 运行全部测试**

Run: `npm run test`
Expected: 所有测试通过（包括新增的 7 个）

- [ ] **Step 3: 运行完整 typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

---

### Task 8: 移除不再使用的 import

**Files:**
- Modify: `lib/project-data-modules-internal.ts`

- [ ] **Step 1: 检查 `parseSlotSize` 是否还在文件其他位置使用**

Run: `grep -n parseSlotSize lib/project-data-modules-internal.ts`

如果 `parseSlotSize` 不再在文件中使用（只有被替换的 `generateFinalizedVariants` 使用了它），从 import 行中移除：

```typescript
import { classifyExportAdaptation, isSpecialRatio, resolveExportSlotSpecs } from "@/lib/export/utils";
```

- [ ] **Step 2: 检查 `sharp` 是否仍需 import**

`sharp` 仍在新版 `generateFinalizedVariants` 中使用（将 AI 输出二进制转 PNG buffer：`await sharp(binary.buffer).png().toBuffer()`），所以保留 `import sharp from "sharp";`。

- [ ] **Step 3: 最终验证**

Run: `npm run typecheck && npm run test`
Expected: 全部通过
