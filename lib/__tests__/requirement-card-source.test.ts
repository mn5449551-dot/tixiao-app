import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const requirementCardPath = new URL("../../components/cards/requirement-card.tsx", import.meta.url);

test("requirement card uses free-text input for time node", async () => {
  const source = await readFile(requirementCardPath, "utf8");

  assert.match(source, /<Field label="时间节点" hint="必填">[\s\S]*?<Input/);
  assert.doesNotMatch(source, /<Field label="时间节点" hint="必填">[\s\S]*?<Select/);
});

test("requirement card syncs local form state when initial props change", async () => {
  const source = await readFile(requirementCardPath, "utf8");

  assert.match(source, /useEffect/);
  assert.match(source, /setFeature\(initial\.feature/);
  assert.match(source, /setSellingPointsText/);
  assert.match(source, /setTimeNode\(initial\.timeNode/);
});
