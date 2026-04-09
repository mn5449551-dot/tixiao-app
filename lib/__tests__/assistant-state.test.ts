import test from "node:test";
import assert from "node:assert/strict";

import { emptyDraft, getAssistantState, saveAssistantState } from "../assistant-state";
import { createProject } from "../project-data";

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
