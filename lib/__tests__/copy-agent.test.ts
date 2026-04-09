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
  assert.match(messages[0]?.content ?? "", /角色定位/);
  assert.match(messages[0]?.content ?? "", /业务背景/);
  assert.match(messages[0]?.content ?? "", /核心任务/);
  assert.match(messages[0]?.content ?? "", /硬性边界/);
  assert.match(messages[0]?.content ?? "", /输出契约/);
  assert.match(messages[0]?.content ?? "", /顶层键名为 copies/);
  assert.match(messages[0]?.content ?? "", /当前请求只服务一个方向/);
  assert.match(messages[0]?.content ?? "", /不能只看方向标题/);
  assert.match(messages[0]?.content ?? "", /双图/);
  assert.match(messages[0]?.content ?? "", /图间关系/);
  assert.match(messages[1]?.content ?? "", /场景问题/);
  assert.match(messages[1]?.content ?? "", /差异化解法/);
  assert.match(messages[1]?.content ?? "", /奇效/);
});

test("buildCopyAgentMessages encodes append mode as a single differentiated copy", () => {
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

  assert.match(messages[0]?.content ?? "", /当前请求只服务一个方向/);
  assert.match(messages[0]?.content ?? "", /决策规则/);
  assert.match(messages[0]?.content ?? "", /当前是追加生成/);
  assert.match(messages[0]?.content ?? "", /只新增 1 条文案/);
  assert.match(messages[0]?.content ?? "", /不能只是机械改写已有文案/);
  assert.match(messages[1]?.content ?? "", /当前已生成文案/);
  assert.match(messages[1]?.content ?? "", /作业写不动了/);
});
