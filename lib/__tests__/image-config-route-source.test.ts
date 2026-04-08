import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routePath = new URL("../../app/api/image-configs/[id]/generate/route.ts", import.meta.url);

test("image config generate route checks for NEW_API_KEY before starting background work", async () => {
  const source = await readFile(routePath, "utf8");

  assert.match(source, /NEW_API_KEY/);
  assert.match(source, /缺少 NEW_API_KEY/);
  assert.match(source, /group_ids/);
  assert.match(source, /requestedGroupIds/);
  assert.match(source, /requestedGroupIds\.size === 0 \|\| requestedGroupIds\.has\(group\.id\)/);
});
