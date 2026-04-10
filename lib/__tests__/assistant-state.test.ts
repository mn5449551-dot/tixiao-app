import test from "node:test";
import assert from "node:assert/strict";

import { emptyDraft, getAssistantState, saveAssistantState } from "../assistant-state";
import { createProject } from "../project-data";

test("new projects start with the guided assistant welcome message", () => {
  const project = createProject("assistant-initial-message");
  assert.ok(project);

  const state = getAssistantState(project.id);

  assert.equal(
    state.messages[0]?.content,
    "这次想做什么素材？你可以直接把需求告诉我，不用想得特别正式。比如这次主要给谁看、想推什么功能、核心卖点是什么、适合什么时间节点、先出几个方向。像“这次想做给家长看的，主推拍题精学，重点是 10 秒出解析，适合期中考试，先来 3 个方向”这样说就可以，我会边聊边帮你整理，确认后再统一填进需求卡。",
  );
});

test("assistant state persists ui metadata without schema changes", () => {
  const project = createProject("assistant-ui-state");
  assert.ok(project);

  const saved = saveAssistantState(project.id, {
    messages: [],
    draft: emptyDraft(),
    stage: "collecting",
    ui: [{ type: "reminder", text: "当前仅支持 APP + 图文" }],
    missingFields: ["targetAudience", "feature"],
    confirmation: null,
  });

  assert.deepEqual(saved.ui, [{ type: "reminder", text: "当前仅支持 APP + 图文" }]);
  assert.deepEqual(saved.missingFields, ["targetAudience", "feature"]);
  assert.equal(saved.confirmation, null);

  const reloaded = getAssistantState(project.id);
  assert.deepEqual(reloaded.ui, saved.ui);
  assert.deepEqual(reloaded.missingFields, saved.missingFields);
});
