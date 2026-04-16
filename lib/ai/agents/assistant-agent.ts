import { createChatCompletion } from "@/lib/ai/client";
import {
  buildAssistantKnowledgeContext,
  getAudienceButtons,
  getFeatureSuggestions,
  getSellingPointSuggestions,
  getTimeNodeSuggestions,
  inferDefaultTimeNode,
} from "@/lib/ai/agents/assistant-knowledge";
import type { AssistantConfirmation, AssistantDraft, AssistantUiAction } from "@/lib/assistant-state";

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
  nextField: "targetAudience" | "feature" | "sellingPoints" | "timeNode" | "directionCount" | null;
  missingFields: Array<"targetAudience" | "feature" | "sellingPoints" | "timeNode" | "directionCount">;
  ui: AssistantUiAction[];
  confirmation: AssistantConfirmation | null;
};

function getAssistantTargetAudienceLabel(targetAudience: string | undefined): string {
  if (targetAudience === "parent") {
    return "家长";
  }

  return "学生";
}

function buildAssistantConfirmation(fields: Partial<AssistantDraft>): AssistantConfirmation {
  return {
    businessGoal: "app",
    formatType: "image_text",
    targetAudience: fields.targetAudience ?? "",
    feature: fields.feature ?? "",
    sellingPoints: fields.sellingPoints ?? [],
    timeNode: fields.timeNode ?? "",
    directionCount: fields.directionCount ?? null,
  };
}

export function buildRequirementAssistantMessages(input: AssistantAgentInput) {
  const latestUserMessage = [...input.conversation].reverse().find((item) => item.role === "user")?.content ?? "";
  const userMentionedTimeNode = /开学季|期中|期末|寒假|暑假/.test(latestUserMessage);
  const knowledge = buildAssistantKnowledgeContext({
    now: new Date(),
    targetAudience: input.draft.targetAudience || null,
    feature: input.draft.feature || null,
    userMentionedTimeNode,
  });
  const systemPrompt = `角色定位：
你是洋葱学园素材生产系统里的真实 AI 对话助手，也是需求采集与结构化整理助手。

业务背景：
你处在图文素材生产链路的最前置入口，职责是通过多轮对话帮助用户整理需求卡信息，方便后续方向生成与文案生成继续使用。
当前仅支持 APP + 图文。
businessGoal 固定为 app，formatType 固定为 image_text，不需要再追问。

核心任务：
你当前只负责收集和整理以下需求字段：targetAudience、feature、sellingPoints、timeNode、directionCount。
当需求信息足够形成可检查草稿时，stage 设为 confirming，并在 reply 中简明总结要填充的内容。
如果用户还在补充信息，stage 设为 collecting。
只有当需求卡已经填充完成且用户只是闲聊时，才允许 stage 为 done。

可信输入：
- 当前字段草稿
- 最近对话
- 轻量知识补充上下文
- 当前需求卡是否已存在

决策规则：
- 一次只追问一个最关键缺口，不要同时抛多个问题。
- 如果用户表达了“你帮我补全 / 帮我生成剩余字段 / 全部帮忙生成”之类意图，你可以基于已有上下文补全 feature、sellingPoints、timeNode、directionCount。
- targetAudience 优先使用枚举值：parent 或 student。
- directionCount 必须是 1-5 的整数。
- 如果用户没提 timeNode，可以使用系统时间推断的默认时间节点。
- 如果用户没提 directionCount，默认使用 3。

字段判断标准：
- targetAudience：谁是核心投放对象，家长或学生。
- feature：本次主推功能，必须是业务人员能看懂的文本。
- sellingPoints：本次重点卖点数组，尽量 1-3 条，文本化表达。
- timeNode：时间节点或适配阶段，文本化表达。
- directionCount：需要生成几个方向。

硬性边界：
- 确认前不回填需求卡，需求卡必须保持空白/占位，直到用户点击“确认并填充需求卡”后才一次性写入。
- 确认后只回填左侧需求卡，不自动生成方向卡。
- 不要输出方向建议、创意方案、执行建议。
- 不要输出 Markdown、解释、额外注释。

输出契约：
- 只输出 JSON
- 必须包含 reply、fields、stage、nextField、missingFields、ui、confirmation
- fields 里只能出现上述 5 个字段`;

  const userPrompt = `当前字段草稿：
${JSON.stringify(input.draft, null, 2)}

当前需求卡是否已存在：${input.hasRequirement ? "是" : "否"}

最近对话：
${input.conversation.map((item) => `${item.role === "user" ? "用户" : "助手"}：${item.content}`).join("\n")}

知识补充上下文：
${knowledge.promptBlock}

请基于以上上下文，输出下一轮助手回复和更新后的字段草稿。`;

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];
}

export async function runRequirementAssistant(input: AssistantAgentInput): Promise<AssistantAgentResult> {
  try {
    const raw = await createChatCompletion({
      modelKey: "model_assistant",
      messages: buildRequirementAssistantMessages(input),
      temperature: 0.4,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(raw) as {
      reply?: string;
      stage?: string;
      fields?: Partial<AssistantDraft>;
      nextField?: AssistantAgentResult["nextField"];
      missingFields?: AssistantAgentResult["missingFields"];
      ui?: AssistantUiAction[];
      confirmation?: AssistantConfirmation | null;
    };

    return normalizeAssistantResult(input.draft, {
      reply: parsed.reply ?? "好的，我继续帮你整理。",
      fields: parsed.fields ?? {},
      stage: (parsed.stage as AssistantAgentResult["stage"]) ?? "collecting",
      nextField: parsed.nextField ?? null,
      missingFields: parsed.missingFields ?? [],
      ui: parsed.ui ?? [],
      confirmation: parsed.confirmation ?? null,
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

  const missingFields = getMissingFields({
    ...current,
    ...nextFields,
  }) as AssistantAgentResult["missingFields"];

  const ui = input.ui.length > 0 ? input.ui : buildUiActions(nextFields, missingFields);
  const stage = complete && input.stage !== "done" ? "confirming" : input.stage;

  return {
    reply: input.reply,
    fields: nextFields,
    stage,
    nextField: missingFields[0] ?? null,
    missingFields,
    ui,
    confirmation: stage === "confirming" ? buildAssistantConfirmation(nextFields) : null,
  };
}

function fallbackRequirementAssistant(input: AssistantAgentInput): AssistantAgentResult {
  const latestUserMessage = [...input.conversation].reverse().find((item) => item.role === "user")?.content ?? "";
  const lower = latestUserMessage.toLowerCase();
  const nextDraft: Partial<AssistantDraft> = {};

  if (lower.includes("家长")) nextDraft.targetAudience = "parent";
  if (lower.includes("学生")) nextDraft.targetAudience = "student";

  const featureSuggestion = getFeatureSuggestions(input.draft.targetAudience || null).find((item) =>
    lower.includes(item.label.replace(/精学/g, "")),
  );
  if (featureSuggestion) nextDraft.feature = featureSuggestion.value;

  if (lower.includes("卖点") || lower.includes("亮点") || lower.includes("重点")) {
    const tail = latestUserMessage.split(/卖点|亮点|重点/)[1]?.trim();
    if (tail) {
      nextDraft.sellingPoints = normalizeSellingPoints(tail.split(/[，,、]/));
    }
  }

  for (const node of getTimeNodeSuggestions().map((item) => item.value)) {
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
      nextDraft.feature = getFeatureSuggestions(input.draft.targetAudience || null)[0]?.value ?? "";
    }
    if ((!nextDraft.sellingPoints || nextDraft.sellingPoints.length === 0) && input.draft.sellingPoints.length === 0) {
      nextDraft.sellingPoints = getSellingPointSuggestions(nextDraft.feature ?? input.draft.feature ?? null)
        .slice(0, 2)
        .map((item) => item.value);
    }
    if (!nextDraft.timeNode && !input.draft.timeNode) {
      nextDraft.timeNode = inferDefaultTimeNode(new Date());
    }
    if (!nextDraft.directionCount && !input.draft.directionCount) {
      nextDraft.directionCount = 3;
    }
  }

  if (!nextDraft.timeNode && !input.draft.timeNode) {
    nextDraft.timeNode = inferDefaultTimeNode(new Date());
  }

  if (!nextDraft.directionCount && !input.draft.directionCount) {
    nextDraft.directionCount = 3;
  }

  const merged = normalizeAssistantResult(input.draft, {
    reply: "好的，我继续帮你整理。",
    fields: nextDraft,
    stage: "collecting",
    nextField: null,
    missingFields: [],
    ui: [],
    confirmation: null,
  });

  if (merged.stage === "confirming") {
    return {
      ...merged,
      reply: `我先帮你整理成一版需求，请确认：业务目标=APP；形式=图文；目标人群=${getAssistantTargetAudienceLabel(merged.fields.targetAudience)}；功能=${merged.fields.feature}；卖点=${(merged.fields.sellingPoints ?? []).join("、")}；时间节点=${merged.fields.timeNode}；方向数量=${merged.fields.directionCount}。确认后我再一次性填充到需求卡。`,
    };
  }

  const nextQuestion = getQuestionForField(merged.missingFields[0]);

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

function buildUiActions(
  fields: Partial<AssistantDraft>,
  missingFields: AssistantAgentResult["missingFields"],
): AssistantUiAction[] {
  const ui: AssistantUiAction[] = [{ type: "reminder", text: "当前仅支持 APP + 图文" }];
  if (missingFields.includes("targetAudience")) {
    ui.push({ type: "audience_buttons", options: getAudienceButtons() });
  }
  if (missingFields.includes("feature")) {
    ui.push({ type: "feature_suggestions", options: getFeatureSuggestions(fields.targetAudience ?? null) });
  }
  if (missingFields.includes("sellingPoints") && fields.feature) {
    ui.push({ type: "selling_point_suggestions", options: getSellingPointSuggestions(fields.feature) });
  }
  if (fields.timeNode) {
    ui.push({ type: "time_node_suggestions", options: getTimeNodeSuggestions() });
  }
  return ui;
}
