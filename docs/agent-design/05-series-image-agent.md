# Series Image Agent (系列图差异提示词生成 Agent)

## Agent 概述

Series Image Agent 是洋葱学园素材生产系统中负责生成系列图（slot 2+）差异提示词的 Agent。它接收第 1 张图的完整提示词和后续文案，生成与第 1 张图相比的最小差异提示词（delta prompt），用于系列组图中第 2、3 张图的生成。

**关键特性：**
- 只生成 delta（差异）提示词，不是独立的新图片描述
- 使用纯文本消息（不包含 image_url），slot 2+ 通过纯文生图方式生成
- 字体描述必须从第 1 张图提示词中原文提取并逐字复述
- 人物外貌、场景、构图必须保持一致，只允许情绪、动作、氛围等变化

## 在工作流中的位置

```
Image Description Agent → slot 1 提示词 →
Series Image Agent → slot 2+ delta 提示词 →
Image Generation Service → slot 1 图片（参考图/纯文生图）→ slot 2+ 图片（纯文生图）
```

Series Image Agent 在 Image Description Agent 之后、图片生成之前运行。它只在系列图模式（double/triple）下被调用。

## 输入定义

### SeriesImageAgentInput 结构

```typescript
type SeriesImageAgentInput = {
  /** 第 1 张图的完整 prompt */
  slot1Prompt: string;
  /** 后续文案：key 是 slotIndex，value 是文案文字 */
  targetTexts: Map<number, string>;
  /** 文案间的逻辑关系 */
  copyType: string | null;
  /** 图间 slot 角色名（如 ["问题图", "解法图"]） */
  slotRoles: string[];
};
```

### 输入来源

Series Image Agent 的输入由 `lib/image-generation-service.ts` 的 Phase 2 构建：

| 输入字段 | 来源 |
|----------|------|
| `slot1Prompt` | Image Description Agent 输出的 `primaryPrompt.prompt` |
| `targetTexts` | 文案卡（copy）的 `titleMain`、`titleSub`、`titleExtra`，按 slotIndex 映射 |
| `copyType` | 文案卡的 `copyType` 字段 |
| `slotRoles` | `resolveSeriesSlotRoles(copyType, slotCount)` 的返回值 |

### slotRoles 映射规则

`resolveSeriesSlotRoles` 定义在 `lib/ai/agents/image-description-agent.ts`（line 84-97）：

| copyType | double (2 slots) | triple (3 slots) |
|----------|------------------|-------------------|
| 因果 | ["问题图", "解法图"] | ["问题图", "解法图", "结果图"] |
| 递进 | ["起点图", "推进图"] | ["问题图", "解法图", "结果图"] |
| 并列 | ["第一图", "第二图"] | ["卖点一", "卖点二", "卖点三"] |
| 互补 | ["主问题图", "补充解法图"] | ["主问题图", "补充解法图", "补充收益图"] |
| 未指定 | ["第一图", "第二图"] | ["问题图", "解法图", "结果图"] |

## 输出定义

### SeriesImageAgentOutput 结构

```typescript
type SeriesImageAgentOutput = {
  deltas: SeriesDeltaPrompt[];
};

type SeriesDeltaPrompt = {
  slotIndex: number;       // 图位索引（2 或 3）
  prompt: string;          // 与 slot 1 的差异提示词
  negativePrompt: string;  // 负向提示词
};
```

### 输出去向

Series Image Agent 的输出被 `lib/image-generation-service.ts` 的 Phase 2 使用：

- `delta.prompt` → 作为 `generateImageFromPrompt` 的 `prompt` 参数（纯文生图）
- `delta.negativePrompt` → 保存到 `generatedImages.finalNegativePrompt`
- `delta.slotIndex` → 对应 `generatedImages.slotIndex`

**注意：** slot 2+ 使用纯文生图（`generateImageFromPrompt`），不使用参考图（`generateImageFromReference`）。

## 系统提示词

以下是 `buildSeriesDeltaSystemPrompt()` 的完整原文（逐字复制自 `lib/ai/agents/series-image-agent.ts` line 25-123）：

```
你是"系列组图差异描述生成 Agent"。

你的任务是根据第 1 张图的完整提示词和后续文案的变化，生成第 2、3 张图的最小差异提示词。

你不是在写独立的新图片描述，你是在描述"与第 1 张图相比，需要改变什么"。

--------------------------------
【核心原则】
--------------------------------

1. delta prompt 分为"保持部分"和"变化部分"，结构清晰
2. 字体描述必须从第 1 张图提示词中**原文提取**，逐字复述并标注"严格保持不变"
3. 人物外貌特征必须从第 1 张图提示词中提取具体描述，依赖参考图保持
4. 场景、构图、光影必须保持一致，但整体氛围可以根据情绪变化调整
5. 变化部分只描述具体差异，不要笼统地说"适当调整"

--------------------------------
【必须锁定的内容】
--------------------------------
以下内容在第 2、3 张图中不得改变：
- 画风和整体视觉风格
- 字体类型、笔画特征、材质质感、装饰效果、配色、阴影——必须原文复述第 1 张图的字体描述
- 人物外貌（脸部特征、发型、服装）——必须原文复述第 1 张图的人物描述
- 场景（场景不变）
- 画面构图的大结构

--------------------------------
【字体处理规则（最重要）】
--------------------------------

1. 从第 1 张图提示词中找到所有关于字体/文字/标题/文字排版的描述段落
2. 在 delta prompt 中**逐字复述**这些描述，只修改引号内的文字内容，其余一字不改
3. 复述后加上"字体风格严格保持不变"

示例：如果第 1 张图提示词中有：
  主标题内容是"大题写满却丢步骤分？"，放在画面上方清晰区域，面积大、醒目、高对比，采用潮流创意动漫字体，笔画粗壮饱满，带有干净利落的哑光描边质感和适度深色层叠阴影，字体为深蓝色配白色粗描边，主标题旁点缀醒目的红色疑问号小图标和红叉标记

则 delta prompt 中应写：
  主标题内容是"[新文案]"，放在画面上方清晰区域，面积大、醒目、高对比，采用潮流创意动漫字体，笔画粗壮饱满，带有干净利落的哑光描边质感和适度深色层叠阴影，字体为深蓝色配白色粗描边，字体风格严格保持不变，主标题旁点缀[根据情绪更换的装饰图标]

4. 标题周围的装饰元素（如图标）可以根据情绪主题调整，但字体本身不改

--------------------------------
【允许变化的内容】
--------------------------------
以下内容可以根据文案变化：
- 文字内容（替换为新的文案文字）
- 人物情绪（根据文案逻辑关系推断情绪走向）
- 人物动作/姿势（配合情绪变化调整）
- 画面氛围/色调（根据情绪变化自然调整，如从压抑暗沉到明亮温暖，不需要具体规定怎么调，只需描述目标氛围）
- 标题周围的装饰图标（如问号→对勾，红叉→星星）
- 排版（因文字字数不同可适当调整字间距和位置）
- 局部场景细节（在同一场景内微调，如桌面上的道具变化）

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
      "prompt": "差异提示词",
      "negativePrompt": "负向提示词"
    }
  ]
}

每条 delta prompt 的结构必须如下：

【保持部分】
"保持与参考图完全一致的以下内容："然后列出：
- 人物外貌特征（从第 1 张图提示词中提取具体描述，如"棕色微卷发型、蓝背心校服和红白条纹领带"）
- 字体描述（从第 1 张图提示词中**原文复述**字体相关的完整段落，只替换引号内文字）
- 场景、构图、光影风格（简要概括）

【变化部分】
- 主标题文字替换（只改引号内的文字内容，其余字体描述不变）
- 人物情绪变化（从X改为Y，要具体）
- 人物动作变化（从X改为Y，要具体）
- 标题装饰图标变化（如有）
- 画面氛围变化（描述目标氛围）
- 局部道具/细节变化（如有，如试卷上的标记变化）
- 高质量收尾（4k，结构清晰，细节丰富）

每条 delta prompt 的 negativePrompt 至少覆盖：
extra arms, extra hands, floating hands, deformed fingers, deformed body, blurry, low quality, inconsistent face, text distortion, garbled text, split text, watermark, cropped face, messy background, style drift, dark horror mood, adult content
```

## User Prompt 模板

以下是 `buildSeriesDeltaUserPrompt()` 的完整模板（逐字复制自 `lib/ai/agents/series-image-agent.ts` line 126-147）：

```
以下是第 1 张图的完整提示词：
---
${input.slot1Prompt}
---

文案间的逻辑关系：${input.copyType ?? "未指定"}

各图角色：
${input.slotRoles.map((role, i) => `- 第 ${i + 1} 张：${role}`).join("\n")}

需要你生成差异描述的后续文案：
${targetLines}

请为第 ${Array.from(input.targetTexts.keys()).sort().join("、")} 张图生成最小差异提示词。
只描述与第 1 张图的变化，不要重复第 1 张图已有的内容。
```

其中 `targetLines` 的构建逻辑：

```typescript
const targetLines = Array.from(input.targetTexts.entries())
  .sort(([a], [b]) => a - b)
  .map(([slotIndex, text]) => `- 第 ${slotIndex} 张文案：${text}（角色：${input.slotRoles[slotIndex - 1] ?? "未知"}）`)
  .join("\n");
```

## 消息构建

`buildSeriesDeltaMessages()` 构建纯文本消息（不包含 image_url）：

```typescript
export function buildSeriesDeltaMessages(input: SeriesImageAgentInput): MultimodalChatMessage[] {
  return [
    { role: "system", content: buildSeriesDeltaSystemPrompt() },
    { role: "user", content: buildSeriesDeltaUserPrompt(input) },
  ];
}
```

**注意：** 与 Image Description Agent 不同，Series Image Agent 的消息不包含 `image_url` 内容部分。所有内容都是纯文本字符串，不使用多模态消息格式。

## 生成流程

### generateSeriesDeltaPrompts()

```typescript
export async function generateSeriesDeltaPrompts(input: SeriesImageAgentInput): Promise<SeriesImageAgentOutput> {
  const messages = buildSeriesDeltaMessages(input);
  const expectedCount = input.targetTexts.size;

  const content = await createMultimodalChatCompletion({
    modelKey: "model_image_description",
    messages,
    temperature: 0.6,
    responseFormat: { type: "json_object" },
  });

  // 解析 JSON，验证 deltas 数量
  // 数量不匹配时记录错误日志并返回 fallback
  // ...
}
```

### 模型配置

| 参数 | 值 |
|------|-----|
| modelKey | `model_image_description` |
| temperature | 0.6 |
| responseFormat | `{ type: "json_object" }` |

## 验证与容错

### 数量验证

生成结果必须满足 `deltas.length === expectedCount`（即 `input.targetTexts.size`）。不匹配时：

1. 记录错误日志到 `agentErrorLogs` 表（通过 `logAgentError`）
2. 返回 `buildFallbackDeltas(input)` 作为兜底

### slotIndex 修正

每条 delta 的 `slotIndex` 如果不是有效数字（≥2），则修正为 `index + 2`：

```typescript
slotIndex: typeof item.slotIndex === "number" && item.slotIndex >= 2
  ? item.slotIndex
  : index + 2,
```

### 空值兜底

`prompt` 或 `negativePrompt` 为空时，使用 fallback delta 的对应字段：

```typescript
prompt: item.prompt?.trim() || fallback.deltas[index]?.prompt || "",
negativePrompt: item.negativePrompt?.trim() || fallback.deltas[index]?.negativePrompt || FALLBACK_NEGATIVE_PROMPT,
```

## Fallback 机制

### buildFallbackDeltas()

当 AI 生成失败或结果不合法时，使用 fallback 生成基础 delta prompt：

```typescript
function buildFallbackDeltas(input: SeriesImageAgentInput): SeriesImageAgentOutput {
  const deltas: SeriesDeltaPrompt[] = [];
  const fontAnchor = extractFontAnchor(input.slot1Prompt);
  for (const [slotIndex, text] of input.targetTexts.entries()) {
    const keepSection = `保持与参考图完全一致的风格、人物外貌、配色、场景和构图。${fontAnchor ? `字体描述原文保持：${fontAnchor}，字体风格严格保持不变。` : "字体风格严格保持不变。"}`;
    deltas.push({
      slotIndex,
      prompt: `${keepSection}主标题文字内容替换为"${text}"，人物情绪根据文案内容从困惑转为释然或自信，人物动作配合情绪调整，画面氛围相应变化，排版根据文字数量微调，4k，结构清晰，细节丰富`,
      negativePrompt: FALLBACK_NEGATIVE_PROMPT,
    });
  }
  return { deltas };
}
```

### extractFontAnchor()

从 slot1 prompt 中提取字体/标题相关的描述段落，用于在 fallback delta 中复述：

```typescript
function extractFontAnchor(slot1Prompt: string): string | null {
  const fontKeywords = /字体|标题|描边|笔画|字号|排版|文字/;
  const sentences = slot1Prompt.split(/[，。；\n]/);
  const fontSentences = sentences.filter((s) => fontKeywords.test(s) && s.trim().length > 5);
  if (fontSentences.length === 0) return null;
  return fontSentences
    .map((s) => s.replace(/["「」'"""].*?["「」'"""]/, "[新文案]"))
    .join("，");
}
```

### FALLBACK_NEGATIVE_PROMPT

```
extra arms, extra hands, floating hands, deformed fingers, deformed body, blurry, low quality, inconsistent face, text distortion, garbled text, split text, watermark, cropped face, messy background, style drift, dark horror mood, adult content
```

## 调用方式

### 在 image-generation-service.ts 中调用

```typescript
// Phase 2: 系列图模式，为每个 group 生成 slot 2+ delta prompt
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

## 限制与边界

1. **只生成 slot 2+ 的 delta prompt**：不生成 slot 1 的提示词，slot 1 由 Image Description Agent 负责
2. **纯文本消息**：不包含 image_url，slot 2+ 通过纯文生图方式生成
3. **delta 不是完整 prompt**：描述的是与 slot 1 的差异，不是独立的新图片描述
4. **字体必须原文复述**：从 slot1 prompt 中逐字提取字体描述，只替换引号内文字
5. **情绪变化有路径**：根据 copyType 推断情绪走向（因果→递进→并列→互补）
6. **数量必须匹配**：deltas 数量必须等于 targetTexts.size，否则使用 fallback
7. **slotIndex ≥ 2**：每条 delta 的 slotIndex 必须大于 1

## 文件位置

- Agent 实现: `lib/ai/agents/series-image-agent.ts`
- 调用方: `lib/image-generation-service.ts`（Phase 2）
- slotRoles 来源: `lib/ai/agents/image-description-agent.ts`（`resolveSeriesSlotRoles`）
- AI 客户端: `lib/ai/client.ts`（`createMultimodalChatCompletion`）
- 错误日志: `lib/ai/agent-error-log.ts`（`logAgentError`）