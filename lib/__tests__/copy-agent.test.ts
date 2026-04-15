import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildCopyAgentMessages } from "../ai/agents/copy-agent";

test("buildCopyAgentMessages follows the provided copy-agent prompt contract", () => {
  const messages = buildCopyAgentMessages({
    directionTitle: "寒假得分点拆解",
    targetAudience: "寒假想学懂压轴题的学生",
    scenarioProblem: "看标准答案还是不知道关键第一步为什么这样写",
    differentiation: "把题拆成得分点清单，还能针对没听懂的地方换个例子继续讲",
    effect: "从看懂答案到能独立做对同类题",
    channel: "应用商店",
    imageForm: "double",
    count: 4,
  });

  assert.equal(messages[0]?.role, "system");
  assert.match(messages[0]?.content ?? "", /营销图文文案生成 Agent/);
  assert.match(messages[0]?.content ?? "", /你的核心职责不是“创作”，而是“压缩表达”/);
  assert.match(messages[0]?.content ?? "", /第一原则：文案必须忠实绑定方向/);
  assert.match(messages[0]?.content ?? "", /第二原则：先看渠道，再决定怎么写/);
  assert.match(messages[0]?.content ?? "", /第三原则：先看图片形式，再决定结构/);
  assert.match(messages[0]?.content ?? "", /第四原则：同一批文案要有明显差异/);
  assert.match(messages[0]?.content ?? "", /信息流（广点通）/);
  assert.match(messages[0]?.content ?? "", /应用商店/);
  assert.match(messages[0]?.content ?? "", /学习机/);
  assert.match(messages[0]?.content ?? "", /single/);
  assert.match(messages[0]?.content ?? "", /double/);
  assert.match(messages[0]?.content ?? "", /triple/);
  assert.match(messages[0]?.content ?? "", /titleMain/);
  assert.match(messages[0]?.content ?? "", /titleSub/);
  assert.match(messages[0]?.content ?? "", /titleExtra/);
  assert.match(messages[0]?.content ?? "", /copyType/);
  assert.match(messages[0]?.content ?? "", /你必须只输出 JSON/);
  assert.doesNotMatch(messages[0]?.content ?? "", /###/);
  assert.doesNotMatch(messages[0]?.content ?? "", /思考过程/);
  assert.match(messages[1]?.content ?? "", /场景问题/);
  assert.match(messages[1]?.content ?? "", /差异化解法/);
  assert.match(messages[1]?.content ?? "", /奇效/);
});

test("buildCopyAgentMessages encodes append mode and existing copy de-duplication", () => {
  const messages = buildCopyAgentMessages({
    directionTitle: "作业卡壳秒解决",
    targetAudience: "初中生，晚间做作业经常卡题",
    scenarioProblem: "晚间做作业时，遇到一道数学题卡了半小时",
    differentiation: "拍完题的瞬间就开始出解析，像老师边写边讲",
    effect: "从不会写到能继续写下去",
    channel: "应用商店",
    imageForm: "single",
    count: 1,
    existingCopies: [
      {
        titleMain: "作业写不动了？",
        titleSub: "来洋葱拍一下！秒解难题",
      },
    ],
  });

  assert.match(messages[0]?.content ?? "", /追加生成规则/);
  assert.match(messages[0]?.content ?? "", /existingCopies/);
  assert.match(messages[0]?.content ?? "", /换几个词/);
  assert.match(messages[1]?.content ?? "", /当前已生成文案/);
  assert.match(messages[1]?.content ?? "", /作业写不动了/);
});

test("generateCopyIdeas requests json_object output instead of mixed thought text", async () => {
  const source = await readFile(new URL("../ai/agents/copy-agent.ts", import.meta.url), "utf8");

  assert.match(source, /responseFormat:\s*\{\s*type:\s*"json_object"\s*\}/);
  assert.match(source, /return JSON\.parse\(content\) as CopyAgentOutput/);
  assert.doesNotMatch(source, /###/);
});
