import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflowCanvasPath = new URL("../../components/canvas/workflow-canvas.tsx", import.meta.url);
const generationPollingPath = new URL("../../lib/hooks/use-generation-polling.ts", import.meta.url);
const workflowCanvasPanelPath = new URL("../../components/workspace/workflow-canvas-panel.tsx", import.meta.url);
const projectTreePanelPath = new URL("../../components/workspace/project-tree-panel.tsx", import.meta.url);

test("workflow canvas uses scoped invalidation instead of page refresh", async () => {
  const source = await readFile(workflowCanvasPath, "utf8");

  assert.doesNotMatch(source, /window\.location\.reload\(\)/);
  assert.match(source, /WORKSPACE_CANVAS_INVALIDATED/);
  assert.match(source, /workflow-canvas-overlay-root/);
  assert.match(source, /new Map\(/);
  assert.match(source, /revealedMaxTierRef/);
  assert.doesNotMatch(source, /setMaxVisibleTier\(0\);/);
  assert.doesNotMatch(source, /router\.refresh\(\)/);
});

test("generation polling fetches status updates without router refresh", async () => {
  const source = await readFile(generationPollingPath, "utf8");

  assert.match(source, /fetch\(`/);
  assert.doesNotMatch(source, /router\.refresh\(\)/);
});

test("workspace panels fetch fresh graph and tree payloads without reusing cached GET responses", async () => {
  const canvasPanelSource = await readFile(workflowCanvasPanelPath, "utf8");
  const treePanelSource = await readFile(projectTreePanelPath, "utf8");

  assert.match(canvasPanelSource, /fetch\(`\/api\/projects\/\$\{projectId\}\/graph`,\s*\{[\s\S]{0,120}cache:\s*"no-store"/);
  assert.match(treePanelSource, /fetch\(`\/api\/projects\/\$\{projectId\}\/tree`,\s*\{[\s\S]{0,120}cache:\s*"no-store"/);
});
