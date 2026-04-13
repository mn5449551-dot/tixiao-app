import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const createProjectFormPath = new URL("../../components/dashboard/create-project-form.tsx", import.meta.url);

test("create project form opens a modal and keeps local validation inside the submit handler", async () => {
  const source = await readFile(createProjectFormPath, "utf8");

  assert.match(source, /const \[isOpen, setIsOpen\] = useState\(false\)/);
  assert.match(source, /<Modal[\s\S]*title="新建项目"/);
  assert.match(source, /输入项目名称后即可进入工作台继续编辑/);
  assert.match(source, /placeholder="例如：Q2-期中冲刺拍题精学"/);
  assert.match(source, /const trimmedTitle = title\.trim\(\)/);
  assert.match(source, /if \(!trimmedTitle\) \{/);
  assert.match(source, /setError\("项目标题不能为空"\)/);
  assert.match(source, /onClick=\{\(\) => setIsOpen\(true\)\}/);
  assert.match(source, /onClose=\{handleClose\}/);
  assert.doesNotMatch(source, /disabled=\{!title\.trim\(\) \|\| isPending\}/);
});
