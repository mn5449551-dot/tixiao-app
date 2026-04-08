import test from "node:test";
import assert from "node:assert/strict";

import { buildCopyAgentMessages } from "../ai/agents/copy-agent";

test("buildCopyAgentMessages uses full direction context and channel format constraints", () => {
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
  assert.match(messages[0]?.content ?? "", /不能只看方向标题/);
  assert.match(messages[0]?.content ?? "", /双图/);
  assert.match(messages[0]?.content ?? "", /图间关系/);
  assert.match(messages[1]?.content ?? "", /场景问题/);
  assert.match(messages[1]?.content ?? "", /差异化解法/);
  assert.match(messages[1]?.content ?? "", /奇效/);
});
