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
  return [
    { role: "system", content: buildSeriesDeltaSystemPrompt() },
    { role: "user", content: buildSeriesDeltaUserPrompt(input) },
  ];
}

const FALLBACK_NEGATIVE_PROMPT = "extra arms, extra hands, floating hands, deformed fingers, deformed body, blurry, low quality, inconsistent face, text distortion, garbled text, split text, watermark, cropped face, messy background, style drift, dark horror mood, adult content";

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
        errorMessage: Array.isArray(parsed.deltas)
          ? `deltas 数量不匹配: 期望 ${expectedCount}, 实际 ${parsed.deltas.length}`
          : `deltas 字段缺失`,
        attemptCount: 1,
      });
      return buildFallbackDeltas(input);
    }

    const fallback = buildFallbackDeltas(input);
    return {
      deltas: parsed.deltas.map((item, index) => ({
        slotIndex:
          typeof item.slotIndex === "number" && item.slotIndex >= 2
            ? item.slotIndex
            : index + 2,
        prompt: item.prompt?.trim() || fallback.deltas[index]?.prompt || "",
        negativePrompt:
          item.negativePrompt?.trim() || fallback.deltas[index]?.negativePrompt || FALLBACK_NEGATIVE_PROMPT,
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
  // 尝试从 slot1 prompt 中提取字体相关描述段落作为锚点
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

/** 从 slot1 prompt 中提取字体/标题相关的描述段落，用于在 fallback delta 中复述 */
function extractFontAnchor(slot1Prompt: string): string | null {
  // 匹配包含"字体"、"标题"、"描边"、"笔画"等关键词的句子
  const fontKeywords = /字体|标题|描边|笔画|字号|排版|文字/;
  const sentences = slot1Prompt.split(/[，。；\n]/);
  const fontSentences = sentences.filter((s) => fontKeywords.test(s) && s.trim().length > 5);
  if (fontSentences.length === 0) return null;
  // 去掉引号内的具体文字内容（因为 fallback 会替换为新文字）
  return fontSentences
    .map((s) => s.replace(/["「」'""].*?["「」'"""]/, "[新文案]"))
    .join("，");
}
