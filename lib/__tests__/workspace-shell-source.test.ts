import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspaceShellPath = new URL("../../components/workspace/workspace-shell.tsx", import.meta.url);
const projectPagePath = new URL("../../app/projects/[id]/page.tsx", import.meta.url);

test("workspace shell does not read window inside useState initialization for collapse state", async () => {
  const source = await readFile(workspaceShellPath, "utf8");

  assert.doesNotMatch(source, /useState\(\(\) => \{\s*if \(typeof window !== "undefined"\)/);
  assert.match(source, /useEffect/);
  assert.match(source, /window\.innerWidth < RIGHT_COLLAPSE_BREAKPOINT/);
});

test("project workspace page reads only the header payload and does not request full workspace data", async () => {
  const source = await readFile(projectPagePath, "utf8");

  assert.match(source, /getWorkspaceHeader/);
  assert.doesNotMatch(source, /getProjectWorkspace/);
});

test("workspace shell renders panel components instead of consuming full workspace directions", async () => {
  const source = await readFile(workspaceShellPath, "utf8");

  assert.match(source, /dynamic\(/);
  assert.match(source, /ProjectTreePanel/);
  assert.match(source, /WorkflowCanvasPanel/);
  assert.doesNotMatch(source, /workspace:\s*WorkspaceData/);
  assert.doesNotMatch(source, /workspace\.directions/);
});
