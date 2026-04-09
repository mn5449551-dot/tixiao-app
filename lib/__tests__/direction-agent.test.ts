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
  assert.match(messages[0]?.content ?? "", /directions/);
  assert.match(messages[0]?.content ?? "", /title、targetAudience、scenarioProblem、differentiation、effect/);
  assert.match(messages[0]?.content ?? "", /首次生成数量严格等于/);
  assert.match(messages[1]?.content ?? "", /卖点/);
  assert.match(messages[1]?.content ?? "", /10 秒出解析/);
});

test("buildDirectionAgentMessages encodes append mode as one additional differentiated direction", () => {
  const messages = buildDirectionAgentMessages({
    targetAudience: "student",
    feature: "拍题精学",
    sellingPoints: ["10 秒出解析", "像老师边写边讲"],
    timeNode: "期中考试",
    count: 1,
    existingDirections: [
      {
        title: "作业卡壳秒解决",
        targetAudience: "初中生，作业经常卡题",
        scenarioProblem: "晚间做作业时遇到难题卡住半小时",
        differentiation: "一拍秒出解析，像老师边写边讲",
        effect: "从不会写到能继续写下去",
      },
    ],
  });

  assert.match(messages[0]?.content ?? "", /追加生成时固定只新增 1 条方向/);
  assert.match(messages[0]?.content ?? "", /已有方向/);
  assert.match(messages[0]?.content ?? "", /不能只换措辞重复已有方向/);
  assert.match(messages[1]?.content ?? "", /当前已生成方向/);
  assert.match(messages[1]?.content ?? "", /作业卡壳秒解决/);
});
