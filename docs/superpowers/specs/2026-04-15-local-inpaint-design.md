# 局部重绘功能设计

## 目标

在候选图池中实现局部重绘，支持两种模式：文字重绘（修改图中文案后整图重生成）和框选重绘（画笔涂抹标记区域 + 指令描述局部修改）。结果生成新图，用户可对比后采纳或放弃。

## 架构

两种模式共用同一个弹窗组件（InpaintModal）、同一个后端端点（`POST /api/images/[id]/inpaint`）、同一个数据模型（`inpaintParentId` 关联源图）。区别仅在参数层面：文字模式不传 mask，框选模式传 mask data URL。

仅 `supportsEdits: true` 的模型可用（doubao-seedream-4-0、doubao-seedream-4-5、doubao-seedream-5-0-lite、qwen-image-2.0）。

---

## 模型能力矩阵

| 模型 | supportsEdits | 文字重绘 | 框选重绘 |
|------|:---:|:---:|:---:|
| doubao-seedream-4-0 | true | 可用 | 可用 |
| doubao-seedream-4-5 | true | 可用 | 可用 |
| doubao-seedream-5-0-lite | true | 可用 | 可用 |
| qwen-image-2.0 | true | 可用 | 可用 |
| gemini-3.1-flash | false | 不可用 | 不可用 |
| gemini-3-pro | false | 不可用 | 不可用 |
| gpt-image-1.5 | false | 不可用 | 不可用 |

不支持 edits 的模型打开重绘弹窗时显示提示，禁用生成按钮。

---

## 全屏弹窗交互

弹窗始终全屏（`fixed inset-0 z-50`），无圆角无外边距，最大化编辑空间。

**布局：**
- 左侧 ~70%：图片画布区域，黑色背景
- 右侧 ~360px：控制面板，可折叠收起

**画布交互：**
- 滚轮缩放图片（0.25x ~ 4x）
- 双击恢复原始大小（1x 适配画布区域）
- 框选模式开启时：鼠标绘制涂抹区域（白色笔刷在黑色遮罩上）
- 框选模式关闭或按住空格时：鼠标拖拽平移画布
- 画笔大小滑块（10px ~ 100px）
- 撤销（Undo）和清除（Clear）按钮
- ESC 关闭弹窗

**右侧面板内容：**
- Tab 切换：文字重绘 / 框选重绘
- 文字模式：文案字段编辑 + 生成按钮
- 框选模式：画笔控制 + 指令输入 + 生成按钮
- 生成结果：原图 vs 新图对比，采纳/放弃按钮

---

## 数据流

### 文字重绘

```
用户点击"重绘"按钮
  → InpaintModal 全屏打开
  → GET /api/images/{id}/copy 获取文案
  → 展示 titleMain / titleSub / titleExtra 可编辑字段
  → 用户修改文字，点击"生成"
  → 前端构建 prompt：
    "请将图片中的文字替换为：主标题{titleMain}，副标题{titleSub}，补充{titleExtra}。保持图片其他部分不变，仅修改文字内容和排版。"
  → POST /api/images/{id}/inpaint
      { mask_data_url: null, inpaint_instruction: prompt }
  → 后端调用 editImage()（无 mask）
  → 新图记录：status=generating, inpaintParentId=源图id
  → 后台处理完成后 status=done
  → UI 刷新，展示对比结果
```

### 框选重绘

```
用户切换到"框选重绘" tab
  → 画布上出现透明覆盖层
  → 用户用画笔涂抹标记重绘区域（白色笔刷）
  → 用户在指令输入框描述修改要求
  → 点击"生成"
  → 前端从 canvas 生成 mask PNG（黑底白色涂抹区域）
    → mask 尺寸与原图实际像素尺寸一致（需坐标映射）
  → POST /api/images/{id}/inpaint
      { mask_data_url: "data:image/png;base64,...", inpaint_instruction: instruction }
  → 后端调用 editImage()（带 mask）
  → 新图记录同上
  → UI 刷新，展示对比结果
```

---

## API 变更

### 新增：GET /api/images/[id]/copy

获取图片关联的文案内容。数据链路：`generatedImages → imageConfigs → copies`。

**响应：**
```json
{
  "titleMain": "拍一下10秒出解析",
  "titleSub": "洋葱学园",
  "titleExtra": null
}
```

图片无关联文案时返回 `{ "titleMain": null, "titleSub": null, "titleExtra": null }`。

### 修改：POST /api/images/[id]/inpaint

- `mask_data_url` 改为可选参数（当前为必填）
- `inpaint_instruction` 保持必填
- 新增可选参数 `image_model`（覆盖默认模型）

### 修改：generateImageViaEdits() — lib/ai/image-chat.ts

添加可选参数 `maskDataUrl?: string`。当提供时，在 JSON body 中加入 `mask` 字段。

```typescript
async function generateImageViaEdits(input: {
  model: string;
  prompt: string;
  imageUrl: string;
  size: string;
  maskDataUrl?: string;  // 新增
}) {
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
  // ... 发送到 /v1/images/edits
}
```

### 修改：editImage() — lib/ai/image-chat.ts

添加可选参数 `maskDataUrl?: string`，透传到 `generateImageViaEdits()`。

### 实现：callInpaintApi() — app/api/images/[id]/inpaint/route.ts

替换占位实现，调用 `editImage()`：

```typescript
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

---

## UI 变更

### InpaintModal — 完全重写

**Props 扩展：**
```typescript
interface InpaintModalProps {
  imageId: string;                // 新增：图片 ID
  imageUrl: string | null;
  imageModel?: string | null;     // 新增：当前模型，用于兼容性检查
  onClose: () => void;
}
```

**子组件拆分：**
- `InpaintCanvas` — 全屏画布，处理图片显示、缩放、平移、画笔涂抹
- `InpaintPanel` — 右侧控制面板（tab 切换、文案编辑、画笔控制、结果展示）
- 保持在同一文件中，用函数组件内联即可，无需单独文件

**模型兼容性检查：**
- 检查 `IMAGE_MODELS` 中当前模型的 `supportsEdits`
- 不支持时显示提示横幅，禁用生成按钮
- 仍然允许查看文案（只读模式）

**Canvas 画笔实现要点：**
- 底层显示图片（`<img>` 或 `<canvas>` 绘制）
- 上层透明 `<canvas>` 用于涂抹
- 画笔使用 `globalCompositeOperation = 'source-over'`，白色笔刷
- 生成 mask 时：创建与原图同尺寸的离屏 canvas，黑色背景，将涂抹路径按缩放比例映射后绘制白色
- 缩放/平移状态用 `transform: scale(x) translate(dx, dy)` CSS 管理
- 鼠标事件需要从屏幕坐标反算到图片坐标

### CandidateImage 类型扩展 — candidate-pool-card.tsx

```typescript
export type CandidateImage = {
  id: string;
  fileUrl: string | null;
  status: "pending" | "generating" | "done" | "failed";
  slotIndex: number;
  aspectRatio?: string;
  updatedAt?: number;
  inpaintParentId?: string | null;  // 新增：标记重绘结果
};
```

### CandidatePoolCard — 传递额外 props 给 InpaintModal

```typescript
<InpaintModal
  imageId={inpaintImageId}
  imageUrl={images.find((img) => img.id === inpaintImageId)?.fileUrl ?? null}
  imageModel={imageModel}
  onClose={() => setInpaintImageId(null)}
/>
```

### workflow-graph-builders.ts — 传递 inpaintParentId

`buildCandidatePoolNode` 中的 image 映射需要新增 `inpaintParentId` 字段：

```typescript
images: group.images.map((img) => ({
  id: img.id,
  fileUrl: toVersionedFileUrl(img.fileUrl, img.updatedAt),
  status: (img.status as "pending" | "generating" | "done" | "failed") ?? "pending",
  slotIndex: img.slotIndex,
  aspectRatio: group.aspectRatio ?? config.aspectRatio,
  updatedAt: img.updatedAt,
  inpaintParentId: img.inpaintParentId ?? null,  // 新增
})),
```

---

## 结果展示与采纳

生成完成后（通过 `dispatchWorkspaceInvalidated()` 触发刷新）：

- 候选图池中，重绘结果图与源图共享同一 `imageGroupId`，自然出现在同一组内
- 重绘结果图（`inpaintParentId` 非空）标记为"重绘版本"Badge
- 支持"采纳"（保留）和"放弃"（调用 `DELETE /api/images/{id}` 删除新图）操作
- "放弃"后只保留源图

---

## 关键难点

### 1. Mask 坐标映射

Canvas 显示尺寸（受缩放和容器大小影响）与原图实际像素尺寸不同。生成 mask 时必须：
- 获取原图实际尺寸（从 `<img>` naturalWidth/naturalHeight 或 sharp 读取）
- 将画笔路径从 canvas 坐标映射到原图坐标
- 生成与原图同尺寸的 mask PNG

映射公式：
```
原图坐标 = (canvas坐标 - 偏移量) / 当前缩放比例
```

### 2. 画布缩放与平移的交互冲突

画笔涂抹和画布平移都使用鼠标，需要明确区分：
- 画笔工具激活时：鼠标绘制
- 按住空格或切换到移动工具时：鼠标平移
- 滚轮始终用于缩放

### 3. 异步生成状态管理

Inpaint 是异步的（202 响应），UI 需要：
- 弹窗内显示 loading 状态
- 后台完成后刷新候选图池
- 弹窗可通过 `dispatchWorkspaceInvalidated()` 获知完成

### 4. 大图 Mask Data URL

高分辨率图片的 mask PNG 可能较大。生成时使用 PNG 压缩，实际传输中以 data URL 形式放在 JSON body 中。预估 4K 图的黑白 mask 约 100-500KB base64，在可接受范围内。

---

## 文件清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `components/inpaint/inpaint-modal.tsx` | 重写 | 全屏弹窗、画笔、文案编辑、结果对比 |
| `components/cards/candidate-pool-card.tsx` | 修改 | 传递 imageId/imageModel 给 InpaintModal，CandidateImage 类型加 inpaintParentId |
| `components/cards/candidate-pool/candidate-image-card.tsx` | 修改 | 重绘结果显示 Badge 和采纳/放弃操作 |
| `lib/workflow-graph-builders.ts` | 修改 | buildCandidatePoolNode 传递 inpaintParentId 字段 |
| `lib/ai/image-chat.ts` | 修改 | generateImageViaEdits 和 editImage 添加 maskDataUrl 参数 |
| `app/api/images/[id]/inpaint/route.ts` | 修改 | 实现 callInpaintApi、mask 改为可选、接收 image_model |
| `app/api/images/[id]/copy/route.ts` | 新增 | 获取图片关联文案的 API |
| `lib/__tests__/inpaint.test.ts` | 新增 | API 层和 mask 生成的单元测试 |

---

## 不在范围内

- OCR 文字识别（文案从 DB 获取，不需要 OCR）
- 多区域框选（v1 只支持单次涂抹整体区域）
- 重绘历史记录（只保留最新一次重绘结果）
- 定稿池的重绘（仅候选图池支持）
