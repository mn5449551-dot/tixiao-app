import test from "node:test";
import assert from "node:assert/strict";

import { buildRequirementAssistantMessages } from "../ai/agents/assistant-agent";

test("buildRequirementAssistantMessages encodes PRD collection rules and structured JSON output", () => {
  const messages = buildRequirementAssistantMessages({
    draft: {
      targetAudience: "",
      feature: "",
      sellingPoints: [],
      timeNode: "",
      directionCount: null,
    },
    conversation: [
      { role: "ai", content: "今天想做什么素材？" },
      { role: "user", content: "想做图文，推拍题精学" },
    ],
    hasRequirement: false,
  });

  assert.equal(messages[0]?.role, "system");
  assert.match(messages[0]?.content ?? "", /确认前不回填需求卡/);
  assert.match(messages[0]?.content ?? "", /一次只追问一个最关键缺口/);
  assert.match(messages[0]?.content ?? "", /JSON/);
  assert.match(messages[1]?.content ?? "", /当前字段草稿/);
  assert.match(messages[1]?.content ?? "", /推拍题精学/);
});
