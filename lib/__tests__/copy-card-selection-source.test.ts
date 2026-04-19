import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const copyCardPath = new URL("../../components/cards/copy-card.tsx", import.meta.url);
const copyCardActionsPath = new URL("../../components/cards/copy-card/copy-card-actions.ts", import.meta.url);

test("copy card source supports checkbox selection and bottom batch generation", async () => {
  const source = await readFile(copyCardPath, "utf8");
  await readFile(copyCardActionsPath, "utf8");

  assert.match(source, /const \[selectedIds, setSelectedIds\]/);
  assert.match(source, /toggleSelect/);
  assert.doesNotMatch(source, /toggleSelectAll/);
  assert.match(source, /生成图片配置/);
});

test("copy card defaults to manual selection instead of auto-selecting copy items", async () => {
  const source = await readFile(copyCardPath, "utf8");

  assert.match(source, /const \[selectedIds, setSelectedIds\] = useState<Set<string>>\(\s*\(\) => new Set\(\),/);
});
