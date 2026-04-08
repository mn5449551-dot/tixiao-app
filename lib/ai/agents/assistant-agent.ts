import { createChatCompletion } from "@/lib/ai/client";
import { FEATURE_LIBRARY, TIME_NODES } from "@/lib/constants";
import type { AssistantDraft } from "@/lib/assistant-state";

type AssistantConversationMessage = {
  role: "ai" | "user";
  content: string;
};

type AssistantAgentInput = {
  draft: AssistantDraft;
  conversation: AssistantConversationMessage[];
  hasRequirement: boolean;
};

type AssistantAgentResult = {
  reply: string;
  fields: Partial<AssistantDraft>;
  stage: "collecting" | "confirming" | "done";
};

export function buildRequirementAssistantMessages(input: AssistantAgentInput) {
  const systemPrompt = `你是洋葱学园素材生产系统里的真实 AI 对话助手，负责通过多轮对话帮助用户整理需求卡信息。

必须遵守以下交互规则：
- 确认前不回填需求卡，需求卡必须保持空白/占位，直到用户点击“确认并填充需求卡”后才一次性写入。
- 你当前只负责收集和整理以下需求字段：targetAudience、feature、sellingPoints、timeNode、directionCount。
- 业务目标固定为 app，形式固定为 image_text，不需要再追问。
- 一次只追问一个最关键缺口，不要同时抛多个问题。
- 如果用户表达了“你帮我补全 / 帮我生成剩余字段 / 全部帮忙生成”之类意图，你可以基于已有上下文补全 feature、sellingPoints、timeNode、directionCount。
- targetAudience 优先使用枚举值：parent 或 student。
- directionCount 必须是 1-5 的整数。
- 当需求信息足够形成可检查草稿时，stage 设为 confirming，并在 reply 中简明总结要填充的内容。
- 如果用户还在补充信息，stage 设为 collecting。
- 只有当需求卡已经填充完成且用户只是闲聊时，才允许 stage 为 done。

字段判断标准：
- targetAudience：谁是核心投放对象，家长或学生。
- feature：本次主推功能，必须是业务人员能看懂的文本。
- sellingPoints：本次重点卖点数组，尽量 1-3 条，文本化表达。
- timeNode：时间节点或适配阶段，文本化表达。
- directionCount：需要生成几个方向。

输出要求：
- 只输出 JSON
- 必须包含 reply、fields、stage
- fields 里只能出现上述 5 个字段
- 不要输出 Markdown、解释、额外注释`;

  const userPrompt = `当前字段草稿：
${JSON.stringify(input.draft, null, 2)}

当前需求卡是否已存在：${input.hasRequirement ? "是" : "否"}

最近对话：
${input.conversation.map((item) => `${item.role === "user" ? "用户" : "助手"}：${item.content}`).join("\n")}

请基于以上上下文，输出下一轮助手回复和更新后的字段草稿。`;

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];
}

export async function runRequirementAssistant(input: AssistantAgentInput): Promise<AssistantAgentResult> {
  try {
    const raw = await createChatCompletion({
      messages: buildRequirementAssistantMessages(input),
      temperature: 0.4,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(raw) as {
      reply?: string;
      stage?: string;
      fields?: Partial<AssistantDraft>;
    };

    return normalizeAssistantResult(input.draft, {
      reply: parsed.reply ?? "好的，我继续帮你整理。",
      fields: parsed.fields ?? {},
      stage: (parsed.stage as AssistantAgentResult["stage"]) ?? "collecting",
    });
  } catch {
    return fallbackRequirementAssistant(input);
  }
}

function normalizeAssistantResult(current: AssistantDraft, input: AssistantAgentResult): AssistantAgentResult {
  const nextFields: Partial<AssistantDraft> = {
    targetAudience:
      input.fields.targetAudience === "parent" || input.fields.targetAudience === "student"
        ? input.fields.targetAudience
        : current.targetAudience,
    feature: (input.fields.feature ?? current.feature ?? "").trim(),
    sellingPoints: normalizeSellingPoints(input.fields.sellingPoints ?? current.sellingPoints),
    timeNode: (input.fields.timeNode ?? current.timeNode ?? "").trim(),
    directionCount: normalizeDirectionCount(input.fields.directionCount ?? current.directionCount),
  };

  const complete =
    Boolean(nextFields.targetAudience) &&
    Boolean(nextFields.feature) &&
    Boolean(nextFields.sellingPoints && nextFields.sellingPoints.length > 0) &&
    Boolean(nextFields.timeNode) &&
    Boolean(nextFields.directionCount);

  return {
    reply: input.reply,
    fields: nextFields,
    stage: complete && input.stage !== "done" ? "confirming" : input.stage,
  };
}

function fallbackRequirementAssistant(input: AssistantAgentInput): AssistantAgentResult {
  const latestUserMessage = [...input.conversation].reverse().find((item) => item.role === "user")?.content ?? "";
  const lower = latestUserMessage.toLowerCase();
  const nextDraft: Partial<AssistantDraft> = {};

  if (lower.includes("家长")) nextDraft.targetAudience = "parent";
  if (lower.includes("学生")) nextDraft.targetAudience = "student";

  const feature = FEATURE_LIBRARY.find((item) => lower.includes(item.name.replace(/精学/g, "")));
  if (feature) {
    nextDraft.feature = feature.name;
  }

  if (lower.includes("卖点") || lower.includes("亮点") || lower.includes("重点")) {
    const tail = latestUserMessage.split(/卖点|亮点|重点/)[1]?.trim();
    if (tail) {
      nextDraft.sellingPoints = normalizeSellingPoints(tail.split(/[，,、]/));
    }
  }

  for (const node of TIME_NODES) {
    if (latestUserMessage.includes(node)) {
      nextDraft.timeNode = node;
      break;
    }
  }

  const countMatch = latestUserMessage.match(/([1-5])\s*个?方向/);
  if (countMatch) {
    nextDraft.directionCount = Number(countMatch[1]);
  }

  const wantsAutofill = /帮我.*补全|帮我.*生成|全部帮忙生成|自动补全|你来填|你来补/.test(latestUserMessage);
  if (wantsAutofill) {
    if (!nextDraft.feature && !input.draft.feature) {
      nextDraft.feature = FEATURE_LIBRARY[0].name;
    }
    if ((!nextDraft.sellingPoints || nextDraft.sellingPoints.length === 0) && input.draft.sellingPoints.length === 0) {
      nextDraft.sellingPoints = FEATURE_LIBRARY[0].sellingPoints.slice(0, 2).map((item) => item.label);
    }
    if (!nextDraft.timeNode && !input.draft.timeNode) {
      nextDraft.timeNode = TIME_NODES[1];
    }
    if (!nextDraft.directionCount && !input.draft.directionCount) {
      nextDraft.directionCount = 3;
    }
  }

  const merged = normalizeAssistantResult(input.draft, {
    reply: "好的，我继续帮你整理。",
    fields: nextDraft,
    stage: "collecting",
  });

  if (merged.stage === "confirming") {
    return {
      ...merged,
      reply: `我先帮你整理成一版需求，请确认：目标人群=${merged.fields.targetAudience === "parent" ? "家长" : "学生"}；功能=${merged.fields.feature}；卖点=${(merged.fields.sellingPoints ?? []).join("、")}；时间节点=${merged.fields.timeNode}；方向数量=${merged.fields.directionCount}。确认后我再一次性填充到需求卡。`,
    };
  }

  const missing = getMissingFields({
    ...input.draft,
    ...merged.fields,
  });
  const nextQuestion = getQuestionForField(missing[0]);

  return {
    ...merged,
    reply: nextQuestion ?? "好的，我继续帮你整理。",
  };
}

function normalizeSellingPoints(value: AssistantDraft["sellingPoints"] | string[]) {
  return (value ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeDirectionCount(value: number | null | undefined) {
  if (!value) return null;
  const count = Math.max(1, Math.min(5, Math.trunc(value)));
  return Number.isFinite(count) ? count : null;
}

function getMissingFields(draft: AssistantDraft) {
  const missing: string[] = [];
  if (!draft.targetAudience) missing.push("targetAudience");
  if (!draft.feature) missing.push("feature");
  if (!draft.sellingPoints.length) missing.push("sellingPoints");
  if (!draft.timeNode) missing.push("timeNode");
  if (!draft.directionCount) missing.push("directionCount");
  return missing;
}

function getQuestionForField(field?: string) {
  switch (field) {
    case "targetAudience":
      return "这次素材的目标人群是家长还是学生？";
    case "feature":
      return "这次主要推广哪个功能？";
    case "sellingPoints":
      return "这次最想重点突出的卖点是什么？可以直接说 1-3 条。";
    case "timeNode":
      return "这次更偏哪个时间节点或阶段，比如期中考试、寒假、开学季？";
    case "directionCount":
      return "这次希望我生成几个方向？1 到 5 个都可以。";
    default:
      return null;
  }
}
