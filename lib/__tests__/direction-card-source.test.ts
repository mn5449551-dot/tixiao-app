import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const directionCardPath = new URL("../../components/cards/direction-card.tsx", import.meta.url);

test("direction card source exposes append generation action", async () => {
  const source = await readFile(directionCardPath, "utf8");

  assert.match(source, /追加生成方向/);
});

test("direction card delegates item rendering and action logic", async () => {
  const source = await readFile(directionCardPath, "utf8");

  assert.match(source, /DirectionItemRow/);
  assert.match(source, /DirectionItemEditor/);
  assert.match(source, /direction-card-actions/);
});

test("direction card source removes regenerate and collapse affordances for direction items", async () => {
  const source = await readFile(directionCardPath, "utf8");

  assert.doesNotMatch(source, /regenerateDirectionItem/);
  assert.doesNotMatch(source, /expandedIds/);
  assert.doesNotMatch(source, /toggleExpand/);
});

test("direction card keeps the original field labels while using a denser horizontal details grid", async () => {
  const source = await readFile(directionCardPath, "utf8");

  assert.match(source, /1 能解决用户在“具体哪个场景里的哪个问题”/);
  assert.match(source, /2 能带来什么不一样的“一听很惊艳”的解法？/);
  assert.match(source, /3 因此带来了哪个场景下的什么“奇效”？/);
  assert.match(source, /md:grid-cols-3/);
});
