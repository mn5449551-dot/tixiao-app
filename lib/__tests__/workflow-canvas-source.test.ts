import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflowCanvasPath = new URL("../../components/canvas/workflow-canvas.tsx", import.meta.url);

test("workflow canvas refreshes data without forcing a full page reload", async () => {
  const source = await readFile(workflowCanvasPath, "utf8");

  assert.doesNotMatch(source, /window\.location\.reload\(\)/);
  assert.match(source, /useRouter/);
  assert.match(source, /router\.refresh\(\)/);
  assert.match(source, /revealedMaxTierRef/);
  assert.doesNotMatch(source, /setMaxVisibleTier\(0\);/);
});
