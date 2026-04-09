import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const copyCardPath = new URL("../../components/cards/copy-card.tsx", import.meta.url);
const copyItemRowPath = new URL("../../components/cards/copy-card/copy-item-row.tsx", import.meta.url);

test("copy card source does not render the removed metadata summary block", async () => {
  const source = await readFile(copyCardPath, "utf8");

  assert.equal(source.includes("渠道："), false);
  assert.equal(source.includes("文案格式："), false);
});

test("copy card source supports per-item expand and edit state", async () => {
  const source = await readFile(copyCardPath, "utf8");
  const rowSource = await readFile(copyItemRowPath, "utf8");

  assert.match(source, /const \[expandedIds, setExpandedIds\]/);
  assert.match(source, /const \[editingId, setEditingId\]/);
  assert.match(rowSource, /title=\{expanded \? "收起" : "展开"\}/);
});

test("copy card delegates item rendering and action logic", async () => {
  const source = await readFile(copyCardPath, "utf8");

  assert.match(source, /CopyItemRow/);
  assert.match(source, /CopyItemEditor/);
  assert.match(source, /copy-card-actions/);
  assert.match(source, /copyCardId/);
});
