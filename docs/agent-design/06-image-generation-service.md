# Image Generation Service (图片生成服务)

## 服务概述

Image Generation Service 是洋葱学园素材生产系统中的图片生成编排服务，负责协调 Image Description Agent、Series Image Agent 和图片生成模型，完成从提示词到实际图片的两阶段生成流程。

**关键特性：**
- 两阶段生成流程：Phase 1 生成所有组的 slot 1，Phase 2 生成每组的 slot 2+
- slot 1 支持参考图生图（`generateImageFromReference`）或纯文生图（`generateImageFromPrompt`）
- slot 2+ 使用纯文生图（`generateImageFromPrompt`），不使用参考图
- 多组并行生成 slot 1，slot 2+ 按组顺序处理
- 生成结果自动转换为 PNG 格式并持久化到存储和数据库

## 在工作流中的位置

```
Image Description Agent → slot 1 提示词 →
Series Image Agent → slot 2+ delta 提示词 →
Image Generation Service → 两阶段图片生成 → 图片素材
```

## 两阶段生成流程

### Phase 1：slot 1 并行生成

1. 调用 `generateImageDescription(sharedBase)` 获取 slot 1 提示词
2. 为所有组的 slot 1 构建 work items
3. 保存 slot 1 的 `generationRequestJson` 到数据库
4. 使用 `Promise.allSettled` 并行生成所有组的 slot 1 图片
5. 处理结果：成功的标记为 `done`，失败的标记为 `failed`

### Phase 2：slot 2+ 按组顺序生成（仅系列图模式）

1. 检查每组 slot 1 是否成功（slot 1 失败则跳过该组的 slot 2+）
2. 为每组调用 `generateSeriesDeltaPrompts` 生成 delta 提示词
3. 更新每组的 `promptBundleJson`（包含 slot 1 + slot 2+ 的完整提示词）
4. 为每组的 slot 2+ 构建 work items
5. 保存 slot 2+ 的 `generationRequestJson` 到数据库
6. 使用 `Promise.allSettled` 并行生成该组的 slot 2+ 图片
7. 处理结果：成功的标记为 `done`，失败的标记为 `failed`

### 流程图

```
┌─────────────────────────────────────────────────────────────┐
│  processPreparedImageGeneration                              │
│                                                              │
│  ┌─ buildSharedBaseContext ──────────────────────────────┐  │
│  │  构建 ImageDescriptionInput（方向+文案+配置+IP+参考图） │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌─ generateImageDescription ────────────────────────────┐  │
│  │  调用 Image Description Agent → slot 1 提示词         │  │
│  │  output.prompts.length === 1                           │  │
│  │  output.prompts[0].slotIndex === 1                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌─ Phase 1: slot 1 ────────────────────────────────────┐  │
│  │  for each group:                                       │  │
│  │    构建 slot1WorkItem (prompt, negativePrompt, refs)   │  │
│  │    保存 generationRequestJson                          │  │
│  │                                                        │  │
│  │  Promise.allSettled → 并行生成所有组的 slot 1          │  │
│  │    有参考图 → generateImageFromReference               │  │
│  │    无参考图 → generateImageFromPrompt                  │  │
│  │                                                        │  │
│  │  结果处理: done/failed → slot1DoneMap                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌─ Phase 2: slot 2+ (仅系列图) ────────────────────────┐  │
│  │  for each group:                                       │  │
│  │    slot1 失败 → 标记 slot 2+ 为 failed, continue      │  │
│  │                                                        │  │
│  │    resolveSeriesSlotRoles → slotRoles                  │  │
│  │    generateSeriesDeltaPrompts → delta 提示词           │  │
│  │    更新 group.promptBundleJson                         │  │
│  │                                                        │  │
│  │    构建 slot2PlusItems (delta prompt, negativePrompt)  │  │
│  │    保存 generationRequestJson                          │  │
│  │                                                        │  │
│  │    Promise.allSettled → 并行生成该组 slot 2+           │  │
│  │    generateImageFromPrompt (纯文生图)                   │  │
│  │                                                        │  │
│  │    结果处理: done/failed                               │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌─ finishGenerationRun ────────────────────────────────┐  │
│  │  status: hadFailure ? "failed" : "done"               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 数据准备

### prepareImageConfigGeneration()

在生成前准备所有必要数据：

```typescript
export function prepareImageConfigGeneration(input: {
  imageConfigId: string;
  groupIds?: string[];
}) {
  // 1. 查询 imageConfig
  // 2. 查询关联的 copy 和 direction
  // 3. 查询 imageGroups（可按 groupIds 过滤）
  // 4. 查询每个 group 的 generatedImages
  // 返回 PreparedImageGeneration 结构
}
```

### PreparedImageGeneration 结构

```typescript
type PreparedImageGeneration = {
  config: ImageConfigRecord;
  direction: DirectionRecord;
  copy: CopyRecord;
  groups: ImageGroupRecord[];
  projectId: string;
  imageGroupsPayload: Array<{
    id: string;
    group_type: string;
    slot_count: number;
    images: Array<{ id: string; slot_index: number; status: string; file_url: string | null }>;
  }>;
};
```

### markPreparedImageGenerationRunning()

将所有图片状态标记为 `generating`：

```typescript
export function markPreparedImageGenerationRunning(prepared: PreparedImageGeneration) {
  // 遍历每个 group 的每张图片
  // 更新 status = "generating", errorMessage = null
  // 返回更新后的 imageGroupsPayload
}
```

## 共享基础上下文

### buildSharedBaseContext()

为 Image Description Agent 构建输入：

```typescript
async function buildSharedBaseContext(input: {
  config: ImageConfigRecord;
  direction: DirectionRecord;
  copy: CopyRecord;
  ipMetadata: ReturnType<typeof getIpAssetMetadata> | null;
}): Promise<ImageDescriptionInput> {
  // 1. 构建参考图列表（referenceImageUrl → role: "ip" 或 "style"）
  // 2. 组装 direction、copySet、config、ip、referenceImages
  // 返回 ImageDescriptionInput
}
```

### 参考图角色判断

```typescript
if (input.config.referenceImageUrl) {
  referenceImages.push({
    role: input.config.ipRole ? "ip" : "style",
    url: input.config.referenceImageUrl,
    usage: input.config.ipRole
      ? "保持角色长相、服装、发型与整体角色识别特征一致。"
      : "参考整体构图、风格或氛围，不要机械复刻。",
  });
}
```

## slot 1 生成细节

### Work Item 构建

```typescript
type Slot1WorkItem = {
  imageId: string;
  groupId: string;
  prompt: string;           // primaryPrompt.prompt
  negativePrompt: string;   // primaryPrompt.negativePrompt
  referenceImageUrls: string[];  // [groupReferenceImageUrl] 或 []
  groupModel: string | null;     // group.imageModel ?? config.imageModel ?? null
};
```

### 参考图来源

```typescript
const groupReferenceImageUrl = group.referenceImageUrl ?? config.referenceImageUrl ?? null;
const groupReferenceImageUrls = [groupReferenceImageUrl].filter(Boolean) as string[];
```

### 生成方式选择

```typescript
// 有参考图 → generateImageFromReference（支持多模型路由）
if (item.referenceImageUrls.length > 0) {
  binaries = await generateImageFromReference({
    instruction: item.prompt,
    imageUrls: item.referenceImageUrls,
    aspectRatio: config.aspectRatio,
    model: item.groupModel ?? undefined,
  });
}

// 无参考图 → generateImageFromPrompt（纯文生图）
else {
  binaries = await generateImageFromPrompt(item.prompt, {
    aspectRatio: config.aspectRatio,
    model: item.groupModel ?? undefined,
  });
}
```

### 图片处理与保存

```typescript
const binary = binaries[0];
const pngBuffer = await sharp(binary.buffer).png().toBuffer();
const saved = await saveImageBuffer({
  projectId,
  imageId: item.imageId,
  buffer: pngBuffer,
  extension: "png",
});
```

### 结果处理

```typescript
// 成功 → markGeneratedImageDone
if (result.status === "fulfilled") {
  markGeneratedImageDone({ imageId, saved: result.value.saved });
  slot1DoneMap.set(groupId, { fileUrl, filePath, imageId });
}

// 失败 → markGeneratedImageFailed
else {
  const message = result.reason instanceof Error ? result.reason.message : "图片生成失败";
  hadFailure = true;
  markGeneratedImageFailed(imageId, message);
}
```

## slot 2+ 生成细节（仅系列图模式）

### 前置条件

```typescript
const isSeries = isSeriesMode(direction);  // imageForm === "double" || "triple"
const slotCount = isSeries ? getSeriesSlotCount(direction.imageForm) : 1;
```

### slot 1 失败处理

如果某组的 slot 1 生成失败，该组的所有 slot 2+ 也标记为失败：

```typescript
const slot1Info = slot1DoneMap.get(group.id);
if (!slot1Info) {
  // 标记所有 slot 2+ 为 failed
  for (const image of images) {
    if (image.slotIndex > 1 && image.status !== "done") {
      markGeneratedImageFailed(image.id, "系列图第 1 张生成失败，后续图无法生成");
    }
  }
  hadFailure = true;
  continue;
}
```

### delta 提示词生成

```typescript
const slotRoles = resolveSeriesSlotRoles(copy.copyType, slotCount);
const deltaResult = await generateSeriesDeltaPrompts({
  slot1Prompt,
  targetTexts,
  copyType: copy.copyType,
  slotRoles,
});
```

### targetTexts 构建

```typescript
const copyTexts = [copy.titleMain, copy.titleSub ?? "", copy.titleExtra ?? ""].filter(Boolean);
const targetTexts = new Map<number, string>();
for (let i = 1; i < slotCount; i += 1) {
  const text = copyTexts[i] ?? copyTexts[0] ?? "";
  targetTexts.set(i + 1, text);
}
```

### promptBundleJson 更新

每组的 `promptBundleJson` 包含 slot 1 + slot 2+ 的完整提示词：

```typescript
const groupPromptBundleJson = JSON.stringify({
  agentType: "series",
  prompts: [
    { slotIndex: 1, prompt: slot1Prompt, negativePrompt: promptMap.get(1)?.negativePrompt },
    ...deltaResult.deltas.map((d) => ({
      slotIndex: d.slotIndex,
      prompt: d.prompt,
      negativePrompt: d.negativePrompt,
    })),
  ],
});
```

### slot 2+ Work Item 构建

```typescript
type Slot2PlusWorkItem = {
  imageId: string;
  slotIndex: number;
  prompt: string;           // delta.prompt
  negativePrompt: string;   // delta.negativePrompt
  groupModel: string | null;
};
```

### slot 2+ 生成方式

slot 2+ 使用纯文生图（`generateImageFromPrompt`），不使用参考图：

```typescript
const binaries = await generateImageFromPrompt(item.prompt, {
  aspectRatio: config.aspectRatio,
  model: item.groupModel ?? config.imageModel ?? "qwen-image-2.0",
});
```

**注意：** slot 2+ 的 `generationRequestJson` 中 `referenceImages` 为空数组 `[]`。

## 图片生成模型路由

### resolveImageModel()

`lib/ai/image-chat.ts` 中的 `resolveImageModel` 根据模型能力自动选择传输方式：

```typescript
function resolveImageModel(model?: string): {
  model: string;
  transport: ImageTransport;           // "chat_completions" | "images_generations"
  supportsReference: boolean;
  supportsEdits: boolean;
}
```

### 传输方式

| 传输方式 | API 端点 | 适用模型 | 特点 |
|----------|---------|---------|------|
| `chat_completions` | `/v1/chat/completions` | Gemini 系列 | 支持多模态输入（文+图） |
| `images_generations` | `/v1/images/generations` | gpt-image-1 等 | 纯文生图，size 参数控制尺寸 |
| `images/edits` | `/v1/images/edits` | doubao/qwen 系列 | 支持参考图编辑 + mask 局部重绘 |

### generateImageFromPrompt()

纯文本生图，根据模型选择传输方式：

```typescript
export async function generateImageFromPrompt(
  prompt: string,
  options?: { aspectRatio?: string; resolution?: ImageResolution; model?: string },
) {
  const resolved = resolveImageModel(options?.model);

  if (resolved.transport === "images_generations") {
    return generateImageViaImagesGenerations({ model, prompt, size });
  }

  return generateImageViaChatCompletions({ model, messages, aspectRatio, resolution });
}
```

### generateImageFromReference()

参考图生图，根据模型能力选择传输方式：

```typescript
export async function generateImageFromReference(input: {
  instruction: string;
  imageUrl?: string;
  imageUrls?: string[];
  aspectRatio?: string;
  resolution?: ImageResolution;
  model?: string;
}) {
  const resolved = resolveImageModel(input.model);
  const urls = input.imageUrls?.filter(Boolean) ?? (input.imageUrl ? [input.imageUrl] : []);

  // Gemini 系列：chat_completions + image_url
  if (resolved.transport === "chat_completions") {
    return generateImageViaChatCompletions({ model, messages: [text + imageUrls], ... });
  }

  // doubao/qwen 系列：/v1/images/edits（支持参考图）
  if (resolved.supportsEdits && urls.length > 0) {
    return generateImageViaEdits({ model, prompt, imageUrl, size, ... });
  }

  // 不支持 edits 的模型：退化为纯文生图
  return generateImageViaImagesGenerations({ model, prompt, size });
}
```

### editImage()

图片编辑/局部重绘，仅支持 edits 的模型：

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
  return generateImageViaEdits({ model, prompt, imageUrl, size, maskDataUrl });
}
```

## 重试机制

### 重试参数

```typescript
const IMAGE_REQUEST_RETRY_ATTEMPTS = 3;    // 最大重试次数
const IMAGE_REQUEST_RETRY_DELAY_MS = 400;  // 基础延迟（毫秒）
// 实际延迟 = IMAGE_REQUEST_RETRY_DELAY_MS * attempt（递增延迟）
```

### 可重试的网络错误

```typescript
function shouldRetryImageRequestError(error: unknown) {
  // ECONNRESET, ECONNREFUSED, ENOTFOUND, EAI_AGAIN, UND_ERR_SOCKET, FETCH FAILED
}
```

### 可重试的 HTTP 状态码

```typescript
function shouldRetryImageResponseStatus(status: number) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}
```

### 超时设置

- 单次请求超时：300,000ms（5 分钟）
- 图片下载超时：120,000ms（2 分钟）

## 图片响应解析

### extractImageBinaries()

支持解析多种图片响应格式：

| 格式 | 来源模型 | 解析方式 |
|------|---------|---------|
| `inlineData` | Gemini | `{ mimeType, data }` → base64 解码 |
| Markdown 图片 | 通用 | `![...](data:image/...;base64,...)` → data URL 解析 |
| Data URL | 通用 | `data:image/...;base64,...` → base64 解码 |
| `b64_json` / `image_base64` / `base64` | OpenAI / doubao | 直接 base64 解码 |
| `url` / `image_url` | doubao | HTTP URL → 下载图片 |

## 数据库操作

### generationRequestJson 构建

```typescript
function buildGenerationRequestJson(input: {
  promptText: string;
  negativePrompt: string | null;
  model: string | null;
  aspectRatio: string;
  referenceImages: Array<{ url: string }>;
}): string
```

slot 1 的 `referenceImages` 包含参考图 URL；slot 2+ 的 `referenceImages` 为空数组。

### markGeneratedImageDone()

```typescript
function markGeneratedImageDone(input: {
  imageId: string;
  saved: Awaited<ReturnType<typeof saveImageBuffer>>;
}): void {
  // 更新 filePath, fileUrl, thumbnailPath, thumbnailUrl, status = "done"
}
```

### markGeneratedImageFailed()

```typescript
function markGeneratedImageFailed(imageId: string, message: string): void {
  // 更新 status = "failed", errorMessage = message
}
```

### promptBundleJson 保存

- `imageConfigs.promptBundleJson`：保存所有组的共享提示词（Phase 1 后写入）
- `imageGroups.promptBundleJson`：每组独立的提示词（Phase 2 后更新，包含 slot 1 + slot 2+ delta）

## 辅助函数

### isSeriesMode()

```typescript
function isSeriesMode(direction: DirectionRecord): boolean {
  return direction.imageForm === "double" || direction.imageForm === "triple";
}
```

### getSeriesSlotCount()

```typescript
function getSeriesSlotCount(imageForm: string | null | undefined): number {
  if (imageForm === "triple") return 3;
  if (imageForm === "double") return 2;
  return 1;
}
```

### cleanupImageGroups()

删除指定组及其关联图片：

```typescript
export function cleanupImageGroups(groupIds: string[]) {
  db.delete(generatedImages).where(inArray(generatedImages.imageGroupId, groupIds)).run();
  db.delete(imageGroups).where(inArray(imageGroups.id, groupIds)).run();
}
```

### resetImageGroupsToPending()

将指定组的所有图片重置为 pending 状态：

```typescript
export function resetImageGroupsToPending(groupIds: string[]) {
  db.update(generatedImages)
    .set({ status: "pending", errorMessage: null, updatedAt: Date.now() })
    .where(inArray(generatedImages.imageGroupId, groupIds))
    .run();
}
```

## 错误处理

### 批量失败

如果整个流程抛出异常（如 Image Description Agent 调用失败），所有未完成的图片标记为 failed：

```typescript
catch (error) {
  const message = error instanceof Error ? error.message : "图片生成流程失败";
  hadFailure = true;
  batchErrorMessage = message;
  markUndoneGroupImagesFailed(groups, message);
}
```

### 最终状态

```typescript
finishGenerationRun(runId, {
  status: hadFailure ? "failed" : "done",
  errorMessage: hadFailure ? batchErrorMessage ?? "部分图片生成失败" : null,
});
```

## 支持的图片模型

7 个模型，定义在 `lib/constants.ts` 的 `IMAGE_MODELS`：

| 模型 | transport | supportsEdits | 返回格式 | 支持比例 |
|------|-----------|---------------|---------|---------|
| doubao-seedream-4-0 | images_generations | true | URL | 全部 |
| doubao-seedream-4-5 | images_generations | true | URL | 全部 |
| doubao-seedream-5-0-lite | images_generations | true | URL | 全部 |
| qwen-image-2.0 | images_generations | true | b64_json | 全部 |
| gemini-3.1-flash | chat_completions | false | inlineData | 全部 |
| gemini-3-pro | chat_completions | false | inlineData | 全部 |
| gpt-image-1.5 | images_generations | false | b64_json | 仅 1:1 |

## 限制与边界

1. **slot 1 失败阻断 slot 2+**：系列图中 slot 1 失败会导致该组所有 slot 2+ 无法生成
2. **slot 2+ 纯文生图**：不使用参考图，依赖 delta prompt 描述差异
3. **超时限制**：单次请求最大 5 分钟（300,000ms）
4. **重试次数**：最多 3 次重试
5. **API Key 必需**：必须配置 `NEW_API_KEY` 环境变量
6. **PNG 输出**：所有生成图片通过 sharp 转换为 PNG 格式后保存
7. **并行 vs 顺序**：slot 1 所有组并行，slot 2+ 每组顺序处理（组内 slot 2+ 并行）

## 文件位置

| 文件 | 说明 |
|------|------|
| `lib/image-generation-service.ts` | 图片生成服务（两阶段流程） |
| `lib/ai/image-chat.ts` | 图片生成实现（多传输方式） |
| `lib/ai/agents/image-description-agent.ts` | Image Description Agent（slot 1 提示词） |
| `lib/ai/agents/series-image-agent.ts` | Series Image Agent（slot 2+ delta 提示词） |
| `lib/ai/client.ts` | AI 客户端（文本和图片） |
| `lib/storage.ts` | 图片文件管理（saveImageBuffer） |
| `lib/ip-assets.ts` | IP 资产元数据（getIpAssetMetadata） |
| `lib/generation-runs.ts` | 生成运行管理（finishGenerationRun） |
| `lib/constants.ts` | 常量定义（IMAGE_MODELS） |
| `lib/schema.ts` | 数据库 Schema |
| `app/api/image-configs/[id]/generate/route.ts` | 图片生成 API 路由 |