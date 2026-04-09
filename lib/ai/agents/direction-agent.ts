import { createChatCompletion } from "@/lib/ai/client";

type DirectionAgentInput = {
  targetAudience: string;
  feature: string;
  sellingPoints?: string[];
  timeNode: string;
  count: number;
  existingDirections?: Array<{
    title: string;
    targetAudience: string;
    scenarioProblem: string;
    differentiation: string;
    effect: string;
  }>;
};

export function buildDirectionAgentMessages(input: DirectionAgentInput) {
  const sellingPoints = input.sellingPoints?.filter(Boolean).join("、") || "未额外指定";
  const isAppend = Boolean(input.existingDirections && input.existingDirections.length > 0);
  const systemPrompt = `你是教培行业效果广告方向策划，负责把需求卡内容推导成业务人员可以直接使用的“方向表前六列”。

你的任务不是泛泛想创意，而是输出真实可投放、可继续生成文案的方向条目。每条方向都必须完整覆盖并严格对齐以下业务字段：
1. 素材方向（title）
2. 目标人群（targetAudience）
3. 场景问题：能解决用户在“具体哪个场景里的哪个问题”（scenarioProblem）
4. 惊艳解法：能带来什么不一样的“一听很惊艳”的解法（differentiation）
5. 奇效：因此带来了哪个场景下的什么“奇效”（effect）

生成原则：
- 输入只来自需求卡字段；不要自行引入渠道、形式、聊天原文。
- 首次生成数量严格等于需求卡要求的数量。
- 追加生成时固定只新增 1 条方向。
- 先理解需求卡，再从真实学习场景里找投放切口。
- title 必须是业务能直接拿去讨论和投放的方向名，不能只是功能名或口号。
- targetAudience 必须在原始人群桶内进一步细分，写出更具体的人群状态、压力或目标，但不能细到只剩极少数个体才会成立。
- scenarioProblem 必须具体，包含场景、阻碍、情绪或后果，不能只写“学习效率低/不会做题”。
- differentiation 必须把产品能力翻译成解法机制，说明“为什么这个产品在这个场景下更值得用”，不能只罗列功能。
- effect 必须写成可感知的结果变化，最好是前后反差，不要空泛写“提升成绩/提高效率”。
- 各方向之间必须有明显差异，差异优先体现在：场景、诉求、动机、阶段、卡点类型、收益类型。
${isAppend ? "- 当前是追加生成，必须参考当前已生成方向，新增方向不能只换措辞重复已有方向。新增方向至少要在场景、痛点、解法切口、奇效中的 1-2 项形成明显差异。" : ""}

禁止：
- 空洞大词、假大空表达、纯品牌口号
- 只换同义词的重复方向
- 把文案表内容提前写进方向字段
- 输出解释、Markdown、编号、注释

输出格式：
- 只输出一个 JSON 对象
- 顶层键名为 directions
- directions 是长度为 ${input.count} 的数组
- 每个元素必须包含 title、targetAudience、scenarioProblem、differentiation、effect 五个字符串字段`;

  const userPrompt = `需求卡信息：
- 目标人群：${input.targetAudience}
- 功能：${input.feature}
- 卖点：${sellingPoints}
- 适配阶段 / 时间节点：${input.timeNode}
- 需要生成方向数：${input.count}
${isAppend ? `
当前已生成方向：
${input.existingDirections?.map((item, index) => `${index + 1}. ${item.title}｜${item.targetAudience}｜${item.scenarioProblem}｜${item.differentiation}｜${item.effect}`).join("\n")}
` : ""}

请基于以上信息，推导 ${input.count} 条真实可投放的方向。重点做出“场景问题 -> 惊艳解法 -> 奇效”的完整逻辑链，让业务人员看到方向表就能判断是否值得拿去投放。`;

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];
}

export async function generateDirectionIdeas(input: DirectionAgentInput) {
  const messages = buildDirectionAgentMessages(input);

  const content = await createChatCompletion({
    messages,
    temperature: 0.8,
    responseFormat: { type: "json_object" },
  });

  return content;
}
