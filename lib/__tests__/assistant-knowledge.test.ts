import test from "node:test";
import assert from "node:assert/strict";

import { buildAssistantKnowledgeContext, inferDefaultTimeNode } from "../ai/agents/assistant-knowledge";

test("inferDefaultTimeNode defaults April to 期中考试", () => {
  const result = inferDefaultTimeNode(new Date("2026-04-09T08:00:00.000Z"));
  assert.equal(result, "期中考试");
});

test("inferDefaultTimeNode aligns January with requirement-card default", () => {
  const result = inferDefaultTimeNode(new Date("2026-01-10T08:00:00.000Z"));
  assert.equal(result, "期末冲刺");
});

test("buildAssistantKnowledgeContext returns prompt block with original snippets", () => {
  const context = buildAssistantKnowledgeContext({
    now: new Date("2026-04-09T08:00:00.000Z"),
    targetAudience: "student",
    feature: "拍题精学",
    userMentionedTimeNode: false,
  });

  assert.equal(context.defaultTimeNode, "期中考试");
  assert.ok(context.timeNodeSnippets.length > 0);
  assert.ok(context.featureSnippets.length > 0);
  assert.ok(context.sellingPointSnippets.length > 0);
  assert.match(context.promptBlock, /期中考试/);
  assert.match(context.promptBlock, /拍题精学/);
});
