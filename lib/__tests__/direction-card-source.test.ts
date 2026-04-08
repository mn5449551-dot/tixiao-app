import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const directionCardPath = new URL("../../components/cards/direction-card.tsx", import.meta.url);

test("direction card source exposes append generation action", async () => {
  const source = await readFile(directionCardPath, "utf8");

  assert.match(source, /追加生成方向/);
});
