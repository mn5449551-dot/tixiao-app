import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspaceShellPath = new URL("../../components/workspace/workspace-shell.tsx", import.meta.url);
const projectTreePath = new URL("../../components/workspace/project-tree.tsx", import.meta.url);
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
  assert.doesNotMatch(source, /<header/);
  assert.doesNotMatch(source, /Onion Workflow/);
  assert.doesNotMatch(source, /workspace:\s*WorkspaceData/);
  assert.doesNotMatch(source, /workspace\.directions/);
});

test("project tree renders the back-to-project-list entry inside the left panel", async () => {
  const source = await readFile(projectTreePath, "utf8");

  assert.match(source, /href="\/"/);
  assert.match(source, /项目列表/);
  assert.match(source, /dispatchFocusCanvasNode/);
});
