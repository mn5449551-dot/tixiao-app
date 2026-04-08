import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const copyCardPath = new URL("../../components/cards/copy-card.tsx", import.meta.url);

test("copy card source does not render the removed metadata summary block", async () => {
  const source = await readFile(copyCardPath, "utf8");

  assert.equal(source.includes("渠道："), false);
  assert.equal(source.includes("文案格式："), false);
});

test("copy card source supports per-item expand and edit state", async () => {
  const source = await readFile(copyCardPath, "utf8");

  assert.match(source, /const \[expandedIds, setExpandedIds\]/);
  assert.match(source, /const \[editingId, setEditingId\]/);
  assert.match(source, /title=\{isExpanded \? "收起" : "展开"\}/);
});
