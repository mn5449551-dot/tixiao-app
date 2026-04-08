import test from "node:test";
import assert from "node:assert/strict";

import { buildDirectionAgentMessages } from "../ai/agents/direction-agent";

test("buildDirectionAgentMessages encodes business-table logic and concrete field requirements", () => {
  const messages = buildDirectionAgentMessages({
    targetAudience: "student",
    feature: "拍题精学",
    sellingPoints: ["10 秒出解析", "像老师边写边讲"],
    timeNode: "寒假",
    count: 3,
  });

  assert.equal(messages[0]?.role, "system");
  assert.match(messages[0]?.content ?? "", /前六列/);
  assert.match(messages[0]?.content ?? "", /场景问题/);
  assert.match(messages[0]?.content ?? "", /惊艳/);
  assert.match(messages[0]?.content ?? "", /奇效/);
  assert.match(messages[1]?.content ?? "", /卖点/);
  assert.match(messages[1]?.content ?? "", /10 秒出解析/);
});
