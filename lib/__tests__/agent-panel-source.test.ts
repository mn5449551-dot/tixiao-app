import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const agentPanelPath = new URL("../../components/workspace/agent-panel.tsx", import.meta.url);

test("agent panel source uses assistant API routes instead of local keyword parsing", async () => {
  const source = await readFile(agentPanelPath, "utf8");

  assert.match(source, /\/api\/projects\/\$\{projectId\}\/assistant/);
  assert.doesNotMatch(source, /Simple keyword-based field filling/);
  assert.doesNotMatch(source, /featureMap/);
  assert.match(source, /当前仅支持 APP \+ 图文/);
  assert.match(source, /audience_buttons/);
  assert.match(source, /confirmation/);
});

test("agent panel optimistically clears input and appends the user message before awaiting assistant reply", async () => {
  const source = await readFile(agentPanelPath, "utf8");

  assert.match(source, /const trimmedMessage = message\.trim\(\)/);
  assert.match(source, /setConversationInput\(""\)/);
  assert.match(source, /setAssistantState\(\(current\) =>/);
  assert.match(source, /role:\s*"user"/);
});

test("agent panel groups recommendations by field and exposes failed message feedback", async () => {
  const source = await readFile(agentPanelPath, "utf8");

  assert.match(source, /推荐功能/);
  assert.match(source, /推荐卖点/);
  assert.match(source, /推荐时间节点/);
  assert.match(source, /发送失败/);
  assert.match(source, /重试/);
});

test("agent panel shows existing requirement summary when editing an already-filled requirement", async () => {
  const source = await readFile(agentPanelPath, "utf8");

  assert.match(source, /当前需求摘要/);
  assert.match(source, /继续补充或修改/);
});
