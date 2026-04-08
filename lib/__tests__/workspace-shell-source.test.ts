import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspaceShellPath = new URL("../../components/workspace/workspace-shell.tsx", import.meta.url);

test("workspace shell does not read window inside useState initialization for collapse state", async () => {
  const source = await readFile(workspaceShellPath, "utf8");

  assert.doesNotMatch(source, /useState\(\(\) => \{\s*if \(typeof window !== "undefined"\)/);
  assert.match(source, /useEffect/);
  assert.match(source, /window\.innerWidth < RIGHT_COLLAPSE_BREAKPOINT/);
});
