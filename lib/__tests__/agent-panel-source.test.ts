import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const agentPanelPath = new URL("../../components/workspace/agent-panel.tsx", import.meta.url);

test("agent panel source uses assistant API routes instead of local keyword parsing", async () => {
  const source = await readFile(agentPanelPath, "utf8");

  assert.match(source, /\/api\/projects\/\$\{workspace\.project\.id\}\/assistant/);
  assert.doesNotMatch(source, /Simple keyword-based field filling/);
  assert.doesNotMatch(source, /featureMap/);
});
