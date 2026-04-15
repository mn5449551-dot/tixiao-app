# 候选图池提示词查看功能设计

## 目标

在候选图池中为每一张已生成完成的原始候选图增加“查看提示词”按钮。点击后打开弹窗，展示这张图片实际传给生图模型的真实调用信息，帮助用户核对生成依据并快速复制提示词。

本功能只覆盖“从文案卡生成的候选图池原始图片”，不包含局部重绘图、比例适配派生图、定稿池图片，也不处理历史数据补录。

---

## 范围

**纳入范围：**
- 候选图池单图模式下的原始候选图
- 候选图池双图/三图模式下的每一张原始候选图
- 弹窗展示真实正向提示词、`negative prompt`、模型名、比例、实际传入的参考图
- 正向提示词和 `negative prompt` 支持单独复制

**不纳入范围：**
- `inpaintParentId` 非空的局部重绘结果
- `groupType` 为 `derived|...` 的比例适配结果
- 定稿池查看提示词
- 编辑提示词后重生成
- 历史图片缺失字段的兼容修复

---

## 架构

采用“画布节点直出详情”的方案，不新增请求式详情接口。

后端已有可用数据：
- `generated_images.final_prompt_text`
- `generated_images.final_negative_prompt`
- `image_groups.reference_image_url`
- `image_configs.reference_image_url`
- `image_configs.aspect_ratio`
- `image_configs.image_model`

实现方式是在构建候选图池节点时，把每张图片所需的提示词详情一起挂到前端节点数据中。用户点击“查看提示词”时，前端直接在本地打开弹窗展示，不再额外请求详情接口。

这样能保持交互即时、状态简单，也避免新增接口和加载态。

---

## 数据模型

### CandidateImage 扩展

为候选图节点里的单张图片增加提示词详情对象：

```ts
type CandidateImagePromptDetails = {
  promptText: string | null;
  negativePrompt: string | null;
  model: string | null;
  aspectRatio: string | null;
  referenceImageUrl: string | null;
};

type CandidateImage = {
  id: string;
  fileUrl: string | null;
  status: "pending" | "generating" | "done" | "failed";
  slotIndex: number;
  aspectRatio?: string;
  updatedAt?: number;
  inpaintParentId?: string | null;
  promptDetails?: CandidateImagePromptDetails | null;
};
```

### 字段映射规则

- `promptText` ← `generated_images.final_prompt_text`
- `negativePrompt` ← `generated_images.final_negative_prompt`
- `model` ← `image_configs.image_model`
- `aspectRatio` ← `image_groups.aspect_ratio`，为空时回退 `image_configs.aspect_ratio`
- `referenceImageUrl` ← `image_groups.reference_image_url`，为空时回退 `image_configs.reference_image_url`

这里的参考图按“本次候选图生成批次真实传入的参考图”定义，但本次仅针对文案卡生成的候选图池原始图片，因此不需要覆盖局部重绘或比例适配的源图链路。

---

## 交互设计

### 按钮显示规则

“查看提示词”按钮仅在以下条件同时满足时显示：
- 图片 `status === "done"`
- 图片不是局部重绘结果，即 `inpaintParentId` 为空
- 图片属于原始候选图池，而不是派生适配组

以下场景不显示按钮：
- 生成中
- 生成失败
- 局部重绘结果

这样能保证用户点开后看到的都是完整、明确、与本次范围一致的真实数据。

### 弹窗内容

弹窗包含以下区域：

1. 基础参数
   - 模型名
   - 比例

2. 参考图
   - 有参考图时显示缩略图，可点击预览或在当前页面中放大查看
   - 无参考图时显示“未传参考图”

3. 正向提示词
   - 完整文本展示
   - 独立复制按钮

4. `negative prompt`
   - 完整文本展示
   - 独立复制按钮
   - 若为空则显示“未传 negative prompt”

### 复制反馈

- 复制成功时给出轻量成功反馈
- 复制失败时给出轻量失败反馈
- 不阻断弹窗继续查看

---

## 数据流

### 生成阶段

候选图生成流程已在数据库中保存每张图片的最终 prompt 快照：

```text
prepareImageConfigGeneration / processPreparedImageGeneration
  → 为每张 generated_image 写入 final_prompt_text / final_negative_prompt
  → 为每个 image_group 写入 reference_image_url
  → image_config 保留 image_model / aspect_ratio / reference_image_url
```

本次不修改生成流程，只消费现有持久化数据。

### 画布构建阶段

```text
getProjectWorkspace
  → buildWorkspaceDirections
  → buildCandidatePoolNode
  → 为每张 CandidateImage 注入 promptDetails
  → 前端 CandidatePoolCard 接收到完整展示数据
```

### 前端展示阶段

```text
用户点击“查看提示词”
  → CandidatePoolCard 记录当前选中图片
  → 打开 PromptDetailsModal
  → 使用当前图片自带的 promptDetails 渲染弹窗
  → 用户复制 prompt 或关闭弹窗
```

---

## UI 变更

### CandidateImageCard

在图片底部操作区新增一个 `查看提示词` 按钮。

按钮位置与现有 `重绘`、`重生成`、`删除` 保持同级，遵循当前候选图卡片的按钮布局，不额外引入下拉菜单或二级入口。

### CandidatePoolCard

新增本地状态：
- 当前查看详情的图片 ID 或图片对象
- 弹窗开关状态
- 复制反馈状态

该组件负责：
- 判断当前图片是否允许查看提示词
- 把详情数据传给弹窗
- 处理关闭和复制反馈

### 新增 PromptDetailsModal

基于现有 `Modal` 封装一个轻量新组件，避免把复杂展示逻辑塞进 `CandidatePoolCard`。

组件职责：
- 展示基础参数
- 展示参考图
- 展示正向提示词和 `negative prompt`
- 提供复制按钮

不承担数据请求职责。

---

## 错误处理

本方案不新增接口，因此没有新的网络失败路径。

字段级兜底规则如下：
- `promptText` 为空：显示“未记录”
- `negativePrompt` 为空：显示“未传 negative prompt”
- `model` 为空：显示“未记录模型”
- `aspectRatio` 为空：显示“未记录比例”
- `referenceImageUrl` 为空：显示“未传参考图”

这些兜底仅作为异常保护，不作为本期主路径能力。

---

## 测试与验证

### 自动化测试

补充源代码层测试，覆盖：
- 候选图节点包含 `promptDetails` 数据通路
- `CandidateImageCard` 源码包含“查看提示词”入口
- 入口只面向本次范围内的候选图，不回退成请求式详情实现

### 手动验证

1. 单图候选池
   - 已完成图片显示“查看提示词”
   - 点开后可看到模型、比例、参考图、正向提示词、`negative prompt`
   - 两个提示词都可以复制

2. 双图/三图候选池
   - 每张图片都能独立打开自己的详情
   - 不同图位看到的是各自实际 prompt，而不是整组共用文本

3. 非目标图片
   - 生成中图片不显示按钮
   - 失败图片不显示按钮
   - 局部重绘结果不显示按钮

---

## 影响文件

预计涉及以下文件：

- `lib/workflow-graph-builders.ts`
- `components/cards/candidate-pool-card.tsx`
- `components/cards/candidate-pool/candidate-image-card.tsx`
- `components/cards/candidate-pool/candidate-group-card.tsx`
- `components/ui/modal.tsx` 或新增独立弹窗组件文件
- 与候选图池相关的源代码测试文件

---

## 实施边界

本次实现目标是“让用户能在候选图池里查看真实生图输入信息”，而不是建立完整的提示词审计系统。

因此：
- 不新增独立详情 API
- 不做提示词版本历史
- 不做导出
- 不做编辑后回写
- 不扩展到其他图片来源

等该能力在候选图池中稳定后，再考虑是否向定稿池或其他生成链路复用。
