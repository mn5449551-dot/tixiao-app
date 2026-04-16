import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildDirectionAgentMessages } from "../ai/agents/direction-agent";

test("buildDirectionAgentMessages uses the provided six-field business-direction contract", () => {
  const messages = buildDirectionAgentMessages({
    targetAudience: "student",
    feature: "拍题精学",
    sellingPoints: ["10 秒出解析", "像老师边写边讲"],
    timeNode: "寒假",
    count: 3,
  });

  assert.equal(messages[0]?.role, "system");
  assert.match(messages[0]?.content ?? "", /营销素材方向生成 Agent/);
  assert.match(messages[0]?.content ?? "", /【输入字段】/);
  assert.match(messages[0]?.content ?? "", /【你的核心任务】/);
  assert.match(messages[0]?.content ?? "", /一个方向，只能围绕一个核心卖点展开/);
  assert.match(messages[0]?.content ?? "", /一个方向，只解决一个核心问题/);
  assert.match(messages[0]?.content ?? "", /卖点必须场景化/);
  assert.match(messages[0]?.content ?? "", /方向之间必须有差异/);
  assert.match(messages[0]?.content ?? "", /【你生成方向时的判断逻辑】/);
  assert.match(messages[0]?.content ?? "", /【什么样的方向是好方向】/);
  assert.match(messages[0]?.content ?? "", /【禁止事项】/);
  assert.match(messages[0]?.content ?? "", /你必须只输出 JSON/);
  assert.match(messages[0]?.content ?? "", /【字段要求】/);
  assert.match(messages[0]?.content ?? "", /【输出前自检】/);
  assert.match(messages[0]?.content ?? "", /ideas/);
  assert.match(messages[0]?.content ?? "", /title/);
  assert.match(messages[0]?.content ?? "", /targetAudience/);
  assert.match(messages[0]?.content ?? "", /adaptationStage/);
  assert.match(messages[0]?.content ?? "", /scenarioProblem/);
  assert.match(messages[0]?.content ?? "", /differentiation/);
  assert.match(messages[0]?.content ?? "", /effect/);
  assert.match(messages[0]?.content ?? "", /因此带来了哪个场景下的什么奇效/);
  assert.doesNotMatch(messages[0]?.content ?? "", /###/);
  assert.doesNotMatch(messages[0]?.content ?? "", /思考过程/);
  assert.match(messages[1]?.content ?? "", /卖点/);
  assert.match(messages[1]?.content ?? "", /10 秒出解析/);
});

test("buildDirectionAgentMessages encodes append generation as de-duplication against existing directions", () => {
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
        adaptationStage: "日常学习",
        scenarioProblem: "晚间做作业时遇到难题卡住半小时",
        differentiation: "一拍秒出解析，像老师边写边讲",
        effect: "从不会写到能继续写下去",
      },
    ],
  });

  assert.match(messages[0]?.content ?? "", /追加生成规则/);
  assert.match(messages[0]?.content ?? "", /existingDirections/);
  assert.match(messages[0]?.content ?? "", /不是换句话说/);
  assert.match(messages[1]?.content ?? "", /当前已生成方向/);
  assert.match(messages[1]?.content ?? "", /作业卡壳秒解决/);
});

test("generateDirectionIdeas requests json_object output instead of mixed thought text", async () => {
  const source = await readFile(new URL("../ai/agents/direction-agent.ts", import.meta.url), "utf8");

  assert.match(source, /responseFormat:\s*\{\s*type:\s*"json_object"\s*\}/);
  assert.match(source, /JSON\.parse\(content\) as DirectionAgentOutput/);
  assert.doesNotMatch(source, /###/);
});
