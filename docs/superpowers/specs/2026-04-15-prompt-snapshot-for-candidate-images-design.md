# 候选图真实生图快照设计

## 目标

修正候选图池“查看提示词”弹窗，使用户点击某一张候选图时，看到的是这张图当次真实传给生图模型的请求快照，而不是组级配置的推断值或缺失时的模糊占位。

本次重点解决两个问题：
- 正向提示词经常显示“未记录”，无法满足查看真实生图提示词的需求
- 参考图区域过大，挤占了提示词展示空间

---

## 范围

**纳入范围：**
- 为每张候选图持久化单图级真实生图请求快照
- 弹窗优先展示这张图的真实正向提示词、`negative prompt`、模型、比例、参考图
- 缺少历史快照的图片明确提示“重新生成后查看”
- 缩小参考图展示面积，避免其成为弹窗主视觉

**不纳入范围：**
- 历史图片批量补录快照
- 重新设计候选图池主卡片布局
- 为历史图片自动从组级 `promptBundleJson` 回推真实提示词
- 局部重绘、适配图、定稿池的快照统一化

---

## 当前问题

当前实现存在结构性缺口：

1. `generated_images` 只保存了：
   - `final_prompt_text`
   - `final_negative_prompt`

2. “参考图”仍然来自组级：
   - `image_groups.reference_image_url`

3. 前端 `promptDetails` 是由候选图节点在构图阶段拼出来的，来源混合：
   - 提示词来自单图字段
   - 参考图来自组级字段回退

这导致：
- 某张图只要缺少 `final_prompt_text`，弹窗就会显示“未记录”
- 即使显示了参考图，也不能证明它是该图当次真实传入的单图请求快照
- UI 把大面积空间给了参考图，而不是提示词本身

---

## 设计原则

### 1. 点哪张图，就看哪张图的真实快照

弹窗展示的数据必须来自该图片自己的持久化快照，不再依赖组级回退拼装。

### 2. 缺失就明确说缺失

历史已生成图片如果没有单图真实快照，不做推断性补全，不假装“有数据”。

### 3. 提示词优先于参考图

这个弹窗的主要用途是“看真实生图提示词”，参考图应该是辅助信息，不应该占据主视觉区域。

---

## 数据模型

### `generated_images` 新增字段

新增：

```ts
generationRequestJson: text("generation_request_json")
```

建议存储结构：

```ts
type GeneratedImageRequestSnapshot = {
  promptText: string;
  negativePrompt: string | null;
  model: string | null;
  aspectRatio: string | null;
  referenceImages: Array<{
    url: string;
  }>;
};
```

说明：
- 这是“真实传给模型的请求快照”
- 只记录展示所需的最小信息，不强行存所有底层调用细节
- `referenceImages` 使用数组结构，为后续多参考图兼容留口子

---

## 迁移策略

### 新库

`CREATE TABLE generated_images` 时直接带上 `generation_request_json TEXT`

### 已有库

在 `lib/db.ts` 的自动迁移逻辑中增加：

```sql
ALTER TABLE generated_images ADD COLUMN generation_request_json TEXT;
```

仅在列不存在时执行。

---

## 生成链路变更

在候选图生成流程里，为每张 `workItem` 在生成前写入单图真实快照。

当前已有的单图快照写入：

```text
final_prompt_text
final_negative_prompt
```

本次扩展为：

```text
final_prompt_text
final_negative_prompt
generation_request_json
```

快照内容应按每张图真实请求写入：

```ts
{
  promptText: item.prompt,
  negativePrompt: item.negativePrompt,
  model: config.imageModel ?? null,
  aspectRatio: config.aspectRatio,
  referenceImages: item.referenceImageUrls.map((url) => ({ url })),
}
```

注意：
- 快照写入时机应在真正调用模型前
- 这样即使后续生成失败，也能保留“本来想怎么生成”的请求快照

---

## 前端数据装配

### 候选图节点数据来源调整

`buildCandidatePoolNode()` 不再依赖组级 `referenceImageUrl` 拼 `promptDetails`。

改为：
- 优先解析 `generated_images.generation_request_json`
- 若存在，按这份快照构造 `promptDetails`
- 若不存在，则构造“缺失快照”的前端状态

建议前端展示对象：

```ts
type PromptDetails = {
  promptText: string | null;
  negativePrompt: string | null;
  model: string | null;
  aspectRatio: string | null;
  referenceImages: Array<{ url: string }>;
  hasSnapshot: boolean;
};
```

这样前端不需要再根据空字符串猜语义。

---

## 历史图片策略

对已经生成好、但没有 `generation_request_json` 的图片：

- 不补录
- 不回退到组级拼装
- 弹窗明确显示：

```text
该图片缺少历史生图快照，请重新生成后查看。
```

这比“未记录”更准确，也能明确告诉用户为什么看不到。

---

## 弹窗交互设计

### 信息优先级调整

弹窗内容顺序调整为：

1. 基础参数
   - 模型
   - 比例

2. 正向提示词
   - 主展示区
   - 默认大块文本区域
   - 支持复制

3. `negative prompt`
   - 次展示区
   - 支持复制

4. 参考图
   - 缩略图形式展示
   - 不再占用大面积主卡片

### 参考图展示方式

当前 1:1 大卡片改为小缩略图区，例如：
- 96px 到 120px 的缩略图卡片
- 单参考图时小卡片展示
- 多参考图时横向排列

目标：
- 参考图可见，但不抢主信息焦点

### 缺失快照时的展示

当 `hasSnapshot = false`：
- 正向提示词区域显示：
  - `该图片缺少历史生图快照，请重新生成后查看。`
- `negative prompt` 区域显示同类提示或留空说明
- 复制按钮禁用
- 参考图区显示缺失提示，而不是拿大卡片占位

---

## 测试与验证

### 自动化测试

补充以下覆盖：

1. 生成链路 source test
   - 断言 `image-generation-service.ts` 会写入 `generationRequestJson`

2. graph/source/integration test
   - 断言候选图节点优先使用单图快照装配 `promptDetails`
   - 断言缺失快照时能进入缺失状态，而不是继续回退组级字段

3. modal/source test
   - 断言弹窗优先展示正向提示词
   - 断言参考图是缩略图区而不是大面积主卡片
   - 断言缺失快照提示存在

### 手动验证

1. 新生成候选图
   - 打开弹窗能看到真实正向提示词
   - 能看到真实参考图缩略图
   - 提示词复制正常

2. 历史无快照候选图
   - 打开弹窗显示“重新生成后查看”
   - 不再显示“未记录”这类模糊文案

3. 视觉验证
   - 参考图不再占大面积
   - 第一屏主要是提示词文本

---

## 影响文件

预计涉及：

- `lib/schema.ts`
- `lib/db.ts`
- `lib/image-generation-service.ts`
- `lib/workflow-graph-builders.ts`
- `components/cards/candidate-pool/prompt-details-modal.tsx`
- `components/cards/candidate-pool-card.tsx`
- 相关测试文件

---

## 实施边界

本次目标是让候选图提示词弹窗真正读取“单图真实生图快照”。

因此：
- 不做历史补录
- 不做跨链路统一快照框架
- 不把局部重绘、适配图一起纳入
- 不扩展为完整审计系统

后续如果这个快照模式稳定，再考虑推广到其他图片生成链路。
