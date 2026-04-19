# 系列图连贯生成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 双图/三图场景下，先生成第 1 张图，再以第 1 张图为参考图通过通义千问图生图生成后续图片，保持人物和字体一致性。

**Architecture:** image-description-agent 改为只生成 slot 1 的完整 prompt。新增 series-image-agent 分析文案差异生成最小差异 prompt。image-generation-service 拆为两阶段：slot 1 先生成 → series-image-agent 出差异 prompt → slot 2/3 并行调用通义千问 images/edits。前端区分展示 full/delta prompt。

**Tech Stack:** Next.js 16, Drizzle ORM + SQLite, 通义千问 qwen-image-2.0 images/edits API

---

### Task 1: 数据库 Schema 添加 promptType 字段

**Files:**
- Modify: `tixiao2/lib/schema.ts` (generatedImages 表)
- Modify: `tixiao2/lib/db.ts` (bootstrap 迁移)

- [ ] **Step 1: 在 schema.ts 的 generatedImages 表添加 promptType 字段**

在 `tixiao2/lib/schema.ts` 的 `generatedImages` 表定义中，在 `seed` 字段之后添加：

```typescript
  seed: integer("seed"),
  promptType: text("prompt_type"), // "full" | "delta" | null
  thumbnailPath: text("thumbnail_path"),
```

- [ ] **Step 2: 在 db.ts 的 bootstrap 中添加自动迁移**

在 `tixiao2/lib/db.ts` 的 bootstrap 函数中，在 `thumbnail_url` 迁移之后添加：

```typescript
  if (!generatedImageColumns.some((column) => column.name === "prompt_type")) {
    connection.exec("ALTER TABLE generated_images ADD COLUMN prompt_type TEXT;");
  }
```

- [ ] **Step 3: 运行 typecheck 验证**

Run: `cd tixiao2 && npm run typecheck`
Expected: 无错误

- [ ] **Step 4: 启动 dev server 验证迁移**

Run: `cd tixiao2 && npm run dev`，检查启动日志无报错，数据库自动创建了 `prompt_type` 列。

- [ ] **Step 5: Commit**

```bash
cd tixiao2 && git add lib/schema.ts lib/db.ts && git commit -m "feat: add promptType column to generated_images table"
```

---

### Task 2: 创建 series-image-agent

**Files:**
- Create: `tixiao2/lib/ai/agents/series-image-agent.ts`

- [ ] **Step 1: 创建 series-image-agent.ts**

创建文件 `tixiao2/lib/ai/agents/series-image-agent.ts`，内容如下：

```typescript
import { createMultimodalChatCompletion, type MultimodalChatMessage } from "@/lib/ai/client";
import { logAgentError } from "@/lib/ai/agent-error-log";

export type SeriesDeltaPrompt = {
  slotIndex: number;
  prompt: string;
  negativePrompt: string;
};

export type SeriesImageAgentInput = {
  /** 第 1 张图的完整 prompt */
  slot1Prompt: string;
  /** 第 1 张图的图片 URL（可选，让 agent "看到" 参考图） */
  slot1ImageUrl: string | null;
  /** 后续文案：key 是 slotIndex，value 是文案文字 */
  targetTexts: Map<number, string>;
  /** 文案间的逻辑关系 */
  copyType: string | null;
  /** 图间 slot 角色名（如 ["问题图", "解法图"]） */
  slotRoles: string[];
};

export type SeriesImageAgentOutput = {
  deltas: SeriesDeltaPrompt[];
};

function buildSeriesDeltaSystemPrompt(): string {
  return `你是"系列组图差异描述生成 Agent"。

你的任务是根据第 1 张图的完整提示词和后续文案的变化，生成第 2、3 张图的最小差异提示词。

你不是在写独立的新图片描述，你是在描述"与第 1 张图相比，需要改变什么"。

--------------------------------
【核心原则】
--------------------------------

1. 只描述变化，不重复第 1 张图已有的内容
2. 明确标注"保持与参考图完全一致"
3. 字体风格不变，只替换文字内容和适当调整排版
4. 人物只改情绪和动作，外貌特征完全依赖参考图保持
5. 场景 family、配色、画风必须保持一致

--------------------------------
【必须锁定的内容】
--------------------------------
以下内容在第 2、3 张图中不得改变：
- 画风和整体视觉风格
- 字体类型、笔画特征、材质质感、装饰效果
- 配色方案
- 场景 family（可以在同一场景内微调）
- 画面构图的大结构

--------------------------------
【允许变化的内容】
--------------------------------
以下内容可以根据文案变化：
- 文字内容（替换为新的文案文字）
- 人物情绪（根据文案逻辑关系推断情绪走向）
- 人物动作/姿势（配合情绪变化调整）
- 排版（因文字字数不同可适当调整字间距和位置）
- 局部场景细节（在同一场景内微调）

--------------------------------
【情绪变化路径参考】
--------------------------------
根据文案间的逻辑关系，情绪应该有对应的走向：
- 因果：问题图（焦虑/痛苦）→ 解法图（释然/希望）→ 结果图（喜悦/轻松）
- 递进：情绪逐步加强，从平静到兴奋，从轻到重
- 并列：情绪可以不同但风格一致，各图独立表达
- 互补：情绪可以形成对比，主次互补

--------------------------------
【输出格式】
--------------------------------
你只输出 JSON，不要输出解释，不要输出分析过程。

输出格式：
{
  "deltas": [
    {
      "slotIndex": 2,
      "prompt": "最小差异提示词，只描述与第 1 张图的变化",
      "negativePrompt": "负向提示词"
    }
  ]
}

每条 delta prompt 必须包含：
- 参考图说明（"保持与参考图一致的风格、人物、配色、场景"）
- 文字内容替换说明
- 情绪变化说明
- 动作变化说明
- 排版调整说明（如有需要）
- 高质量收尾

每条 delta prompt 的 negativePrompt 至少覆盖：
extra arms, extra hands, floating hands, deformed fingers, deformed body, blurry, low quality, inconsistent face, text distortion, garbled text, split text, watermark, cropped face, messy background, style drift, dark horror mood, adult content`;
}

function buildSeriesDeltaUserPrompt(input: SeriesImageAgentInput): string {
  const targetLines = Array.from(input.targetTexts.entries())
    .sort(([a], [b]) => a - b)
    .map(([slotIndex, text]) => `- 第 ${slotIndex} 张文案：${text}（角色：${input.slotRoles[slotIndex - 1] ?? "未知"}）`)
    .join("\n");

  return `以下是第 1 张图的完整提示词：
---
${input.slot1Prompt}
---

文案间的逻辑关系：${input.copyType ?? "未指定"}

各图角色：
${input.slotRoles.map((role, i) => `- 第 ${i + 1} 张：${role}`).join("\n")}

需要你生成差异描述的后续文案：
${targetLines}

请为第 ${Array.from(input.targetTexts.keys()).sort().join("、")} 张图生成最小差异提示词。
只描述与第 1 张图的变化，不要重复第 1 张图已有的内容。`;
}

export function buildSeriesDeltaMessages(input: SeriesImageAgentInput): MultimodalChatMessage[] {
  const messages: MultimodalChatMessage[] = [
    { role: "system", content: buildSeriesDeltaSystemPrompt() },
  ];

  const userContent: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    { type: "text", text: buildSeriesDeltaUserPrompt(input) },
  ];

  if (input.slot1ImageUrl) {
    userContent.push({
      type: "image_url",
      image_url: { url: input.slot1ImageUrl },
    });
  }

  messages.push({ role: "user", content: userContent });

  return messages;
}

export async function generateSeriesDeltaPrompts(input: SeriesImageAgentInput): Promise<SeriesImageAgentOutput> {
  const messages = buildSeriesDeltaMessages(input);
  const expectedCount = input.targetTexts.size;

  try {
    const content = await createMultimodalChatCompletion({
      modelKey: "model_image_description",
      messages,
      temperature: 0.6,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(content) as {
      deltas?: Array<{ slotIndex?: number; prompt?: string; negativePrompt?: string }>;
    };

    if (!Array.isArray(parsed.deltas) || parsed.deltas.length !== expectedCount) {
      logAgentError({
        agent: "series-image",
        requestSummary: `预期 ${expectedCount} 条 delta prompt`,
        rawResponse: content,
        errorMessage: Array.isArray(parsed.deltas) ? `deltas 数量不匹配: 期望 ${expectedCount}, 实际 ${parsed.deltas.length}` : `deltas 字段缺失`,
        attemptCount: 1,
      });
      return buildFallbackDeltas(input);
    }

    const fallback = buildFallbackDeltas(input);
    return {
      deltas: parsed.deltas.map((item, index) => ({
        slotIndex: typeof item.slotIndex === "number" && item.slotIndex >= 2
          ? item.slotIndex
          : index + 2,
        prompt: item.prompt?.trim() || fallback.deltas[index]?.prompt || "",
        negativePrompt: item.negativePrompt?.trim() || fallback.deltas[index]?.negativePrompt || "extra arms, extra hands, floating hands, deformed fingers, deformed body, blurry, low quality, inconsistent face, text distortion, garbled text, split text, watermark, cropped face, messy background, style drift, dark horror mood, adult content",
      })),
    };
  } catch (error) {
    logAgentError({
      agent: "series-image",
      requestSummary: `slot1 prompt 长度: ${input.slot1Prompt.length}, 目标 slots: ${Array.from(input.targetTexts.keys()).join(",")}`,
      rawResponse: "",
      errorMessage: error instanceof Error ? error.message : "JSON 解析失败",
      attemptCount: 1,
    });
    return buildFallbackDeltas(input);
  }
}

function buildFallbackDeltas(input: SeriesImageAgentInput): SeriesImageAgentOutput {
  const deltas: SeriesDeltaPrompt[] = [];
  for (const [slotIndex, text] of input.targetTexts.entries()) {
    deltas.push({
      slotIndex,
      prompt: `保持与参考图完全一致的风格、人物、配色、场景和字体，将文字内容替换为"${text}"，根据文案内容适当调整人物情绪和动作，排版根据文字数量微调，4k，结构清晰，细节丰富`,
      negativePrompt: "extra arms, extra hands, floating hands, deformed fingers, deformed body, blurry, low quality, inconsistent face, text distortion, garbled text, split text, watermark, cropped face, messy background, style drift, dark horror mood, adult content",
    });
  }
  return { deltas };
}
```

- [ ] **Step 2: 运行 typecheck 验证**

Run: `cd tixiao2 && npm run typecheck`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
cd tixiao2 && git add lib/ai/agents/series-image-agent.ts && git commit -m "feat: add series-image-agent for generating delta prompts in multi-image scenarios"
```

---

### Task 3: 修改 image-description-agent 只生成 slot 1

**Files:**
- Modify: `tixiao2/lib/ai/agents/image-description-agent.ts`

- [ ] **Step 1: 修改 generateImageDescription 函数的验证和输出逻辑**

在 `tixiao2/lib/ai/agents/image-description-agent.ts` 中，需要修改以下内容：

**1. 修改 `validateImageDescriptionInput`，双图/三图不再要求 titleSub/titleExtra（只生成 slot 1 时不需要验证后续文案）：**

将整个 `validateImageDescriptionInput` 函数替换为：

```typescript
function validateImageDescriptionInput(input: ImageDescriptionInput) {
  if (input.direction.channel === "信息流（广点通）" && input.config.imageForm !== "single") {
    throw new Error("信息流（广点通）仅支持 single 图片描述生成");
  }

  if (!input.copySet.titleMain?.trim()) {
    throw new Error("图片描述生成失败：缺少 titleMain");
  }
}
```

**2. 修改 `buildRoutingMeta`，双图/三图时 agentType 改为 "poster"（使用单图 prompt 系统来生成 slot 1）：**

在 `buildRoutingMeta` 函数中，将 `agentType` 的赋值改为：

```typescript
    agentType: "poster",
```

并删除 `consistencySummary` 和 `slotRoles` 的赋值，改为：

```typescript
    consistencySummary: null,
    slotRoles: ["完整海报图"],
```

完整替换 `buildRoutingMeta` 函数为：

```typescript
function buildRoutingMeta(input: ImageDescriptionInput): ImageDescriptionRouteMeta {
  validateImageDescriptionInput(input);

  const allowCTA =
    input.direction.channel === "信息流（广点通）" &&
    input.config.imageForm === "single" &&
    input.config.ctaEnabled &&
    Boolean(input.config.ctaText);

  return {
    agentType: "poster",
    allowCTA,
    referenceMode: input.config.styleMode === "ip" ? "ip_identity" : "style_reference",
    primaryReferenceLabel: input.referenceImages.length > 0 ? "参考图1" : null,
    seriesGoal: null,
    slotRoles: ["完整海报图"],
    consistencySummary: null,
  };
}
```

**3. 修改 `buildPosterUserPrompt`，双图/三图时使用 titleMain 作为主标题、titleSub 作为副标题，并标注这是系列图第 1 张：**

在 `buildPosterUserPrompt` 函数中，修改图片形式和文案部分。将函数体中的以下行：

```
图片形式：single
```

替换为：

```
图片形式：${input.config.imageForm}（仅生成第 1 张图的 prompt）
```

将：

```
主标题：${input.copySet.titleMain}
副标题：${input.copySet.titleSub ?? ""}
```

保持不变（因为 slot 1 的文案就是 titleMain，副标题用 titleSub）。

- [ ] **Step 2: 修改 generateImageDescription 的输出验证，始终只返回 1 个 prompt**

在 `generateImageDescription` 函数中，将 `count` 变量的使用改为始终为 1：

```typescript
  const count = 1;
```

替换原来的：

```typescript
  const count = getPromptCount(input.config.imageForm);
```

同时，修改验证逻辑中的 `count` 引用。将：

```typescript
    if (!Array.isArray(parsed.prompts) || parsed.prompts.length !== count) {
```

改为：

```typescript
    if (!Array.isArray(parsed.prompts) || parsed.prompts.length < 1) {
```

- [ ] **Step 3: 修改 buildFallbackOutput 始终只返回 1 个 prompt**

将 `buildFallbackOutput` 函数中的 `const count = getPromptCount(input.config.imageForm);` 改为 `const count = 1;`。

- [ ] **Step 4: 运行 typecheck**

Run: `cd tixiao2 && npm run typecheck`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
cd tixiao2 && git add lib/ai/agents/image-description-agent.ts && git commit -m "feat: image-description-agent now only generates slot 1 prompt for series mode"
```

---

### Task 4: 修改 image-generation-service 两阶段生成

**Files:**
- Modify: `tixiao2/lib/image-generation-service.ts`

- [ ] **Step 1: 添加 import**

在 `tixiao2/lib/image-generation-service.ts` 文件顶部，添加 series-image-agent 的导入：

```typescript
import {
  generateSeriesDeltaPrompts,
  type SeriesImageAgentInput,
} from "@/lib/ai/agents/series-image-agent";
```

添加 `resolveSeriesSlotRoles` 的导入（从 image-description-agent 复用）：

```typescript
import { resolveSeriesSlotRoles } from "@/lib/ai/agents/image-description-agent";
```

- [ ] **Step 2: 导出 resolveSeriesSlotRoles**

在 `tixiao2/lib/ai/agents/image-description-agent.ts` 中，在 `resolveSeriesSlotRoles` 函数定义前加上 `export`：

```typescript
export function resolveSeriesSlotRoles(copyType: string | null | undefined, count: number) {
```

- [ ] **Step 3: 添加判断是否为系列图模式的辅助函数**

在 `tixiao2/lib/image-generation-service.ts` 中，`buildSharedBaseContext` 函数之后，添加：

```typescript
function isSeriesMode(direction: DirectionRecord): boolean {
  return direction.imageForm === "double" || direction.imageForm === "triple";
}

function getSeriesSlotCount(imageForm: string | null | undefined): number {
  if (imageForm === "triple") return 3;
  if (imageForm === "double") return 2;
  return 1;
}
```

- [ ] **Step 4: 重写 processPreparedImageGeneration 为两阶段**

将 `processPreparedImageGeneration` 函数体替换为两阶段逻辑。核心改动：

1. 生成 prompt 时始终只有 slot 1 的 prompt
2. 如果是系列图模式（double/triple），先生成 slot 1 的所有图片
3. slot 1 完成后，调用 series-image-agent 生成差异 prompt
4. 用差异 prompt + slot 1 图片作为参考图，通过通义千问生成 slot 2/3

将 `processPreparedImageGeneration` 函数从 `// Build work items` 注释处开始，直到函数末尾的 `finally` 块，替换为：

```typescript
    const isSeries = isSeriesMode(direction);
    const slotCount = isSeries ? getSeriesSlotCount(direction.imageForm) : 1;

    // Phase 1: 只生成 slot 1 的图片
    const slot1WorkItems: Array<{
      imageId: string;
      prompt: string;
      negativePrompt: string | null;
      referenceImageUrls: string[];
      groupLogo: string;
      groupModel: string | null;
    }> = [];

    for (const group of groups) {
      const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
      const groupReferenceImageUrl = group.referenceImageUrl ?? config.referenceImageUrl ?? null;
      const groupLogo = group.logo ?? config.logo ?? "none";
      const groupModel = group.imageModel ?? config.imageModel ?? null;
      const groupReferenceImageUrls = [groupReferenceImageUrl].filter(Boolean) as string[];

      for (const image of images) {
        if (image.slotIndex !== 1) continue;
        slot1WorkItems.push({
          imageId: image.id,
          prompt: primaryPrompt.prompt,
          negativePrompt: primaryPrompt.negativePrompt,
          referenceImageUrls: groupReferenceImageUrls,
          groupLogo,
          groupModel,
        });
      }
    }

    // 保存 slot 1 的 prompt 快照
    for (const item of slot1WorkItems) {
      db.update(generatedImages)
        .set({
          finalPromptText: item.prompt,
          finalNegativePrompt: item.negativePrompt,
          promptType: "full",
          generationRequestJson: buildGenerationRequestJson({
            promptText: item.prompt,
            negativePrompt: item.negativePrompt,
            model: item.groupModel,
            aspectRatio: config.aspectRatio,
            referenceImages: item.referenceImageUrls.map((url) => ({ url })),
          }),
          updatedAt: Date.now(),
        })
        .where(eq(generatedImages.id, item.imageId))
        .run();
    }

    // 如果是系列图，标记 slot 2/3 为 pending（保持 generating 状态让前端知道在处理中）
    if (isSeries) {
      for (const group of groups) {
        const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
        for (const image of images) {
          if (image.slotIndex > 1) {
            // 保持 generating 状态
          }
        }
      }
    }

    // 并行生成所有 slot 1 图片
    const slot1Results = await Promise.allSettled(
      slot1WorkItems.map(async (item) => {
        const binaries = item.referenceImageUrls.length > 0
          ? await generateImageFromReference({
              instruction: item.prompt,
              imageUrls: item.referenceImageUrls,
              aspectRatio: config.aspectRatio,
              model: item.groupModel ?? undefined,
            })
          : await generateImageFromPrompt(item.prompt, {
              aspectRatio: config.aspectRatio,
              model: item.groupModel ?? undefined,
            });

        const binary = binaries[0];
        const pngBuffer = await sharp(binary.buffer).png().toBuffer();
        const saved = await saveImageBuffer({
          projectId,
          imageId: item.imageId,
          buffer: pngBuffer,
          extension: "png",
        });
        return { imageId: item.imageId, saved };
      }),
    );

    // 处理 slot 1 结果
    let slot1Failed = false;
    for (let i = 0; i < slot1Results.length; i += 1) {
      const result = slot1Results[i];
      const imageId = slot1WorkItems[i].imageId;

      if (result.status === "fulfilled") {
        markGeneratedImageDone({ imageId, saved: result.value.saved });
      } else {
        const message = result.reason instanceof Error ? result.reason.message : "图片生成失败";
        hadFailure = true;
        slot1Failed = true;
        markGeneratedImageFailed(imageId, message);
      }
    }

    // 如果是系列图且 slot 1 有成功的，进入 Phase 2
    if (isSeries && !slot1Failed) {
      // 收集 slot 1 的图片 URL 和 prompt
      const slot1ImageMap = new Map<string, { fileUrl: string; prompt: string }>();
      for (let i = 0; i < slot1WorkItems.length; i += 1) {
        const result = slot1Results[i];
        if (result.status === "fulfilled") {
          const groupId = db.select().from(generatedImages).where(eq(generatedImages.id, slot1WorkItems[i].imageId)).get()?.imageGroupId;
          if (groupId) {
            slot1ImageMap.set(groupId, {
              fileUrl: result.value.saved.fileUrl,
              prompt: slot1WorkItems[i].prompt,
            });
          }
        }
      }

      // 构建文案 map
      const copyTexts = [copy.titleMain, copy.titleSub ?? "", copy.titleExtra ?? ""].filter(Boolean);
      const targetTexts = new Map<number, string>();
      for (let i = 1; i < slotCount; i += 1) {
        const text = copyTexts[i] ?? copyTexts[0] ?? "";
        targetTexts.set(i + 1, text);
      }

      const slotRoles = resolveSeriesSlotRoles(copy.copyType, slotCount);

      // 调用 series-image-agent 生成差异 prompt
      const firstSlot1Entry = slot1ImageMap.values().next().value;
      const deltaResult = await generateSeriesDeltaPrompts({
        slot1Prompt: primaryPrompt.prompt,
        slot1ImageUrl: firstSlot1Entry?.fileUrl ?? null,
        targetTexts,
        copyType: copy.copyType,
        slotRoles,
      });

      const deltaMap = new Map(deltaResult.deltas.map((d) => [d.slotIndex, d]));

      // 更新 promptBundleJson，补充 slot 2/3 的 prompt
      const updatedPromptBundleJson = JSON.stringify({
        agentType: "series",
        prompts: [
          { slotIndex: 1, prompt: primaryPrompt.prompt, negativePrompt: primaryPrompt.negativePrompt },
          ...deltaResult.deltas.map((d) => ({ slotIndex: d.slotIndex, prompt: d.prompt, negativePrompt: d.negativePrompt })),
        ],
      });

      db.update(imageConfigs)
        .set({ promptBundleJson: updatedPromptBundleJson, updatedAt: Date.now() })
        .where(eq(imageConfigs.id, config.id))
        .run();

      for (const group of groups) {
        db.update(imageGroups)
          .set({ promptBundleJson: updatedPromptBundleJson, updatedAt: Date.now() })
          .where(eq(imageGroups.id, group.id))
          .run();
      }

      // Phase 2: 并行生成 slot 2/3
      const slot2PlusWorkItems: Array<{
        imageId: string;
        groupId: string;
        slotIndex: number;
        prompt: string;
        negativePrompt: string;
        slot1FileUrl: string;
      }> = [];

      for (const group of groups) {
        const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
        const slot1Info = slot1ImageMap.get(group.id);

        for (const image of images) {
          if (image.slotIndex <= 1) continue;
          if (!slot1Info) continue;

          const delta = deltaMap.get(image.slotIndex);
          if (!delta) continue;

          slot2PlusWorkItems.push({
            imageId: image.id,
            groupId: group.id,
            slotIndex: image.slotIndex,
            prompt: delta.prompt,
            negativePrompt: delta.negativePrompt,
            slot1FileUrl: slot1Info.fileUrl,
          });
        }
      }

      // 保存 slot 2/3 的 prompt 快照
      for (const item of slot2PlusWorkItems) {
        db.update(generatedImages)
          .set({
            finalPromptText: item.prompt,
            finalNegativePrompt: item.negativePrompt,
            promptType: "delta",
            inpaintParentId: slot1WorkItems.find((w) => {
              const img = db.select().from(generatedImages).where(eq(generatedImages.id, w.imageId)).get();
              return img?.imageGroupId === item.groupId && img?.slotIndex === 1;
            })?.imageId ?? null,
            generationRequestJson: buildGenerationRequestJson({
              promptText: item.prompt,
              negativePrompt: item.negativePrompt,
              model: "qwen-image-2.0",
              aspectRatio: config.aspectRatio,
              referenceImages: [{ url: item.slot1FileUrl }],
            }),
            updatedAt: Date.now(),
          })
          .where(eq(generatedImages.id, item.imageId))
          .run();
      }

      // 并行生成 slot 2/3（使用通义千问 images/edits）
      const slot2PlusResults = await Promise.allSettled(
        slot2PlusWorkItems.map(async (item) => {
          const binaries = await generateImageFromReference({
            instruction: item.prompt,
            imageUrl: item.slot1FileUrl,
            aspectRatio: config.aspectRatio,
            model: "qwen-image-2.0",
          });

          const binary = binaries[0];
          const pngBuffer = await sharp(binary.buffer).png().toBuffer();
          const saved = await saveImageBuffer({
            projectId,
            imageId: item.imageId,
            buffer: pngBuffer,
            extension: "png",
          });
          return { imageId: item.imageId, saved };
        }),
      );

      for (let i = 0; i < slot2PlusResults.length; i += 1) {
        const result = slot2PlusResults[i];
        const imageId = slot2PlusWorkItems[i].imageId;

        if (result.status === "fulfilled") {
          markGeneratedImageDone({ imageId, saved: result.value.saved });
        } else {
          const message = result.reason instanceof Error ? result.reason.message : "图片生成失败";
          hadFailure = true;
          markGeneratedImageFailed(imageId, message);
        }
      }
    } else if (isSeries && slot1Failed) {
      // slot 1 失败，标记所有 slot 2/3 为失败
      for (const group of groups) {
        const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
        for (const image of images) {
          if (image.slotIndex > 1 && image.status !== "done") {
            markGeneratedImageFailed(image.id, "系列图第 1 张生成失败，后续图无法生成");
          }
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "图片生成流程失败";
    hadFailure = true;
    batchErrorMessage = message;
    markUndoneGroupImagesFailed(groups, message);
  } finally {
    finishGenerationRun(runId, {
      status: hadFailure ? "failed" : "done",
      errorMessage: hadFailure ? batchErrorMessage ?? "部分图片生成失败" : null,
    });
  }
```

注意：需要删除原来的 `// Build work items` 到 `finally` 之间的所有代码，替换为上面的新逻辑。

- [ ] **Step 5: 运行 typecheck**

Run: `cd tixiao2 && npm run typecheck`
Expected: 无错误（可能有需要调整的导入）

- [ ] **Step 6: Commit**

```bash
cd tixiao2 && git add lib/image-generation-service.ts lib/ai/agents/image-description-agent.ts && git commit -m "feat: two-phase image generation for double/triple mode"
```

---

### Task 5: 前端区分展示 full/delta prompt

**Files:**
- Modify: `tixiao2/components/cards/candidate-pool/prompt-details-modal.tsx`
- Modify: `tixiao2/lib/workflow-graph-builders.ts`

- [ ] **Step 1: 在 parseGenerationRequestSnapshot 中传递 promptType**

在 `tixiao2/lib/workflow-graph-builders.ts` 的 `parseGenerationRequestSnapshot` 函数中，解析结果添加 `promptType` 字段。

先在函数中解析新的字段。将 `generationRequestJson` 的 JSON 结构增加 `promptType` 字段解析。

具体做法：`generationRequestJson` 中本身不存储 `promptType`，它是存在 `generatedImages` 表的独立字段。需要在 `buildCandidatePoolNode` 中传递这个字段。

首先，在 `buildCandidatePoolNode` 中找到图片映射部分（约第 98-116 行），在 `promptDetails` 构建旁边添加 `promptType`：

```typescript
          promptDetails: parseGenerationRequestSnapshot(img.generationRequestJson) ?? {
            promptText: null,
            negativePrompt: null,
            model: null,
            aspectRatio: null,
            referenceImages: [],
            hasSnapshot: false,
          },
          promptType: img.promptType ?? null,
```

注意：需要在 graph node 的类型定义中也添加 `promptType` 字段。查看 `tixiao2/lib/workflow-graph.ts` 中的类型定义，在 image 类型中添加 `promptType: string | null`。

- [ ] **Step 2: 在 PromptDetailsModal 中展示差异 prompt 标识**

在 `tixiao2/components/cards/candidate-pool/prompt-details-modal.tsx` 中：

1. 在 `PromptDetails` 类型中添加 `promptType`:

```typescript
export type PromptDetails = {
  promptText: string | null;
  negativePrompt: string | null;
  model: string | null;
  aspectRatio: string | null;
  referenceImages: Array<{ url: string }>;
  hasSnapshot: boolean;
  promptType: string | null;
};
```

2. 在 Modal 的 `title` prop 中，根据 `promptType` 显示不同的标题：

将 `title="生图提示词"` 改为：

```typescript
title={details?.promptType === "delta" ? "差异提示词（基于第 1 张图的变化）" : "生图提示词"}
```

3. 在 `description` prop 中也做调整：

将 `description="查看该候选图真实传入模型的提示词与参考信息。"` 改为：

```typescript
description={details?.promptType === "delta" ? "此图基于第 1 张图通过图生图生成，以下为差异部分的描述。" : "查看该候选图真实传入模型的提示词与参考信息。"}
```

- [ ] **Step 3: 运行 typecheck**

Run: `cd tixiao2 && npm run typecheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
cd tixiao2 && git add components/cards/candidate-pool/prompt-details-modal.tsx lib/workflow-graph-builders.ts lib/workflow-graph.ts && git commit -m "feat: show delta/full prompt type in prompt details modal"
```

---

### Task 6: 集成测试与验证

**Files:**
- 无新文件，验证现有功能

- [ ] **Step 1: 运行全部测试**

Run: `cd tixiao2 && npm run test`
Expected: 所有现有测试通过（单图生成逻辑不受影响）

- [ ] **Step 2: 运行 typecheck**

Run: `cd tixiao2 && npm run typecheck`
Expected: 无错误

- [ ] **Step 3: 启动 dev server 验证启动无报错**

Run: `cd tixiao2 && npm run dev`
Expected: 正常启动，无报错

- [ ] **Step 4: 手动测试单图生成不受影响**

在浏览器中操作一个 single 图片配置的生成，验证流程正常，prompt 仍然是完整 prompt，`promptType` 为 "full"。

- [ ] **Step 5: 手动测试双图/三图生成**

在浏览器中操作一个 double 或 triple 图片配置的生成，验证：
- 第 1 张图先完成
- 第 2/3 张图随后完成
- 第 2/3 张图的 prompt 是差异 prompt
- 前端 prompt 详情弹窗中显示"差异提示词"标识

- [ ] **Step 6: Final commit**

```bash
cd tixiao2 && git add -A && git commit -m "feat: series image coherent generation - two-phase with reference image"
```
