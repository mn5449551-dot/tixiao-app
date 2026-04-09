import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const createProjectFormPath = new URL("../../components/dashboard/create-project-form.tsx", import.meta.url);

test("create project form keeps the button clickable before hydration and validates empty titles locally", async () => {
  const source = await readFile(createProjectFormPath, "utf8");

  assert.match(source, /const trimmedTitle = title\.trim\(\)/);
  assert.match(source, /if \(!trimmedTitle\) \{/);
  assert.match(source, /setError\("项目标题不能为空"\)/);
  assert.match(source, /disabled=\{isPending\}/);
  assert.match(source, /onClick=\{handleSubmit\}/);
  assert.doesNotMatch(source, /disabled=\{!title\.trim\(\) \|\| isPending\}/);
});
