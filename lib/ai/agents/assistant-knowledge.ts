import { FEATURE_LIBRARY, TARGET_AUDIENCES, TIME_NODES } from "@/lib/constants";
import { FEATURE_SELLPOINT_KNOWLEDGE } from "@/lib/ai/knowledge/feature-sellpoints-knowledge";
import { TIME_NODE_KNOWLEDGE } from "@/lib/ai/knowledge/time-node-knowledge";

export type AssistantKnowledgeContext = {
  defaultTimeNode: string;
  timeNodeSnippets: string[];
  featureSnippets: string[];
  sellingPointSnippets: string[];
  promptBlock: string;
};

export function inferDefaultTimeNode(now = new Date()) {
  const month = now.getMonth() + 1;
  if (month <= 2) return "期末冲刺";
  if (month >= 3 && month <= 5) return "期中考试";
  if (month >= 6 && month <= 7) return "暑假提升";
  if (month >= 8 && month <= 9) return "开学季";
  if (month >= 10 && month <= 12) return "期末冲刺";
  return "期末冲刺";
}

export function getAudienceButtons() {
  return TARGET_AUDIENCES.map((item) => ({ value: item.value, label: item.label }));
}

export function getFeatureSuggestions(targetAudience: string | null) {
  void targetAudience;
  return FEATURE_LIBRARY.map((item) => ({ value: item.name, label: item.name }));
}

export function getSellingPointSuggestions(featureName: string | null) {
  const feature = FEATURE_LIBRARY.find((item) => item.name === featureName);
  return (feature?.sellingPoints ?? []).map((item) => ({ value: item.label, label: item.label }));
}

export function getTimeNodeSuggestions() {
  return TIME_NODES.map((item) => ({ value: item, label: item }));
}

export function buildAssistantKnowledgeContext(input: {
  now: Date;
  targetAudience: string | null;
  feature: string | null;
  userMentionedTimeNode: boolean;
}): AssistantKnowledgeContext {
  const defaultTimeNode = inferDefaultTimeNode(input.now);
  const timeEntry = TIME_NODE_KNOWLEDGE.entries.find((entry) => entry.node === defaultTimeNode);
  const featureEntry = FEATURE_SELLPOINT_KNOWLEDGE.entries.find((entry) => entry.featureName === input.feature)
    ?? FEATURE_SELLPOINT_KNOWLEDGE.entries[0];

  const timeNodeSnippets = timeEntry
    ? [
        `时间节点：${timeEntry.node}`,
        `时间范围：${timeEntry.timeRange}`,
        `核心痛点：${timeEntry.painPoints.slice(0, 3).join("；")}`,
        `场景描述：${timeEntry.sceneDescription}`,
      ]
    : [];

  const featureSnippets = featureEntry
    ? [
        `功能：${featureEntry.featureName}`,
        `功能描述：${featureEntry.featureDescription}`,
      ]
    : [];

  const sellingPointSnippets = featureEntry
    ? featureEntry.sellingPoints.slice(0, 3).map((item) => `${item.label}：${item.description}`)
    : [];

  const promptSections = [
    `固定提醒：当前仅支持 APP + 图文。`,
    input.userMentionedTimeNode ? null : `当前系统时间默认时间节点建议：${defaultTimeNode}。`,
    timeNodeSnippets.length ? `时间节点知识片段：\n- ${timeNodeSnippets.join("\n- ")}` : null,
    featureSnippets.length ? `功能知识片段：\n- ${featureSnippets.join("\n- ")}` : null,
    sellingPointSnippets.length ? `卖点知识片段：\n- ${sellingPointSnippets.join("\n- ")}` : null,
  ].filter(Boolean);

  return {
    defaultTimeNode,
    timeNodeSnippets,
    featureSnippets,
    sellingPointSnippets,
    promptBlock: promptSections.join("\n\n"),
  };
}
