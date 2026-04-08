import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const copyCardPath = new URL("../../components/cards/copy-card.tsx", import.meta.url);

test("copy card source supports checkbox selection and bottom batch generation", async () => {
  const source = await readFile(copyCardPath, "utf8");

  assert.match(source, /const \[selectedIds, setSelectedIds\]/);
  assert.match(source, /toggleSelectAll/);
  assert.match(source, /生成选中文案/);
});
