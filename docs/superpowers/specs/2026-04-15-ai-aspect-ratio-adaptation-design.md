# AI 适配版本生成设计

## 背景

定稿池的"生成适配版本"功能目前使用 Sharp 库对图片进行裁切/缩放来适配不同投放版位的比例。这种方式会丢失内容（裁切）或留白（letterbox），效果差。

改为使用 AI 模型进行智能比例转换：将原图作为参考图传给模型，保持原图内容和构图不变，由 AI 扩展或调整画面来自然适配目标比例。

特殊比例（16:11、√2:1）暂不支持，标注"功能开发中"。

## 核心流程

```
用户选择定稿组 + 选渠道/版位 + 选模型
→ 点击"生成适配版本"
→ POST /api/projects/{id}/finalized/variants
→ 后端：
    1. 过滤掉特殊比例版位 → 提示"功能开发中"
    2. 过滤掉 direct（比例相同） → 跳过
    3. 对每个需要适配的（源比例 ≠ 目标比例且非特殊比例）：
       a. 创建 derived 分组（groupType = "derived|{源组ID}|{目标比例}"）
       b. 创建 pending 状态的图片记录
    4. 对所有待生成图片并行调用 AI：
       - prompt: 保持原图内容和构图，适配目标比例
       - 参考图：原始定稿图的文件 URL
       - 模型：用户选的模型
       - 目标比例：版位要求的比例
    5. 存储结果图片，更新状态为 done/failed
→ 前端刷新，派生分组以 generating → done 显示
```

## 特殊比例处理

`classifyExportAdaptation` 返回 `"postprocess"` 的比例（16:11、√2:1）：

- 版位列表中标注"暂不支持"
- 生成适配版本时跳过
- 导出时跳过
- 返回信息中提示"功能开发中"

## AI 调用细节

### Prompt

```
保持原图内容和构图不变，将画面比例适配为 {目标比例}，
通过扩展或调整画面来自然适配新比例，不添加额外元素。
```

### 调用方式

复用 `generateImageFromReference()`：

```typescript
await generateImageFromReference({
  instruction: prompt,
  imageUrls: [原始定稿图文件URL],
  aspectRatio: 目标比例,
  model: 用户选择的模型,
});
```

内部路由：
- doubao/qwen → `/v1/images/edits`
- Gemini → chat_completions + image_url
- gpt-image → `generateImageFromPrompt`（纯 prompt，不传参考图）

### 模型选择

定稿池卡片新增模型下拉选择器：
- 默认值：原始定稿图使用的模型（从 imageConfig 中获取）
- 选项：IMAGE_MODELS 列表
- 必选项，未选模型时"生成适配版本"按钮禁用

### 并行生成

所有待生成图片使用 `Promise.allSettled` 并行调用，逐个更新数据库状态。

## 后端 API 改动

### `POST /api/projects/{id}/finalized/variants`

新增请求字段：

```typescript
{
  target_group_ids: string[];
  target_channels: string[];
  target_slots: string[];
  image_model: string;  // 新增：用户选择的模型
}
```

响应新增字段：

```typescript
{
  groups: Array<{ id: string }>;
  skipped_slots: string[];  // 新增：被跳过的特殊比例版位名称
}
```

### `generateFinalizedVariants` 函数

签名变更：

```typescript
async function generateFinalizedVariants(
  projectId: string,
  input: {
    targetGroupIds?: string[];
    targetChannels?: string[];
    targetSlots?: string[];
    imageModel?: string;  // 新增
  },
)
```

核心逻辑变更：
- 遍历时跳过 `postprocess` 类型的版位，收集到 `skippedSlots`
- 对 `transform` 类型的版位，创建 pending 图片记录后调用 AI 生成
- 不再使用 Sharp resize

返回值变更：

```typescript
{
  groups: Array<typeof imageGroups.$inferSelect>;
  skippedSlots: string[];  // 新增
}
```

## UI 改动

### 定稿池卡片（`finalized-pool-card.tsx`）

1. 新增模型选择器（`<Select>`），位于投放版位区域下方
2. 默认值从候选图池节点数据中获取（候选图池已有 `imageModel` 字段），或使用 `DEFAULT_IMAGE_MODEL_VALUE`
3. 生成适配版本时传入 `image_model`
4. 版位列表中，特殊比例版位显示"暂不支持"标签
5. 导出预览中特殊比例版位不计入统计
6. 生成结果反馈中增加"X 个版位暂不支持，功能开发中"

### 候选图池到定稿池的数据传递

候选图池节点已有 `imageModel` 字段。定稿池节点需要新增 `defaultImageModel` 字段，从对应候选图池传递过来，作为模型选择器的默认值。

### 定稿池节点数据结构变更

```typescript
type FinalizedPoolCardData = {
  displayMode: "single" | "double" | "triple";
  groups: FinalizedGroup[];
  groupLabel?: string;
  projectId?: string;
  defaultImageModel?: string | null;  // 新增
};
```

## 导出流程变更

### `getProjectExportContext`

保持排除派生分组（上一轮已修复）。导出路由对每张原始定稿图按版位 resize 时：
- `direct` → 直接输出
- `transform` → Sharp cover 模式裁切（导出时仍用 Sharp，因为导出需要精确尺寸控制）
- `postprocess` → 跳过，不导出

### 导出 UI

导出时若选中的版位中包含特殊比例版位，导出按钮点击后提示"以下版位暂不支持导出：{版位名称}，功能开发中"，并继续导出其余版位。

## 关键文件改动

| 文件 | 改动 |
|------|------|
| `lib/project-data-modules-internal.ts` | `generateFinalizedVariants` 改为 AI 生成，新增 `skippedSlots` |
| `lib/workflow-graph-builders.ts` | `buildFinalizedPoolNode` 新增 `defaultImageModel` |
| `lib/workflow-graph-types.ts` | 定稿池节点数据类型新增 `defaultImageModel` |
| `components/cards/finalized-pool-card.tsx` | 新增模型选择器，特殊比例标注，反馈信息 |
| `components/cards/finalized-pool/finalized-pool-actions.ts` | `generateFinalizedVariants` 新增 `imageModel` 参数 |
| `app/api/projects/[id]/finalized/variants/route.ts` | 新增 `image_model` 参数，返回 `skipped_slots` |
| `app/api/projects/[id]/export/route.ts` | 跳过 postprocess 版位 |
| `lib/export/utils.ts` | `EXPORT_SLOT_SPECS` 新增 `supported` 字段或新增过滤函数 |

## 不改动的部分

- `generateImageFromReference` / `generateImageFromPrompt` 等底层调用 — 不变
- 候选图池的生成逻辑 — 不变
- `imageGroups` / `generatedImages` 表结构 — 不变
- 派生分组的命名规则 `derived|{groupId}|{ratio}` — 不变
