import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routePath = new URL("../../app/api/image-configs/[id]/generate/route.ts", import.meta.url);
const saveRoutePath = new URL("../../app/api/copies/[id]/image-config/route.ts", import.meta.url);

test("image config generate route checks for NEW_API_KEY before starting background work", async () => {
  const source = await readFile(routePath, "utf8");

  assert.match(source, /NEW_API_KEY/);
  assert.match(source, /缺少 NEW_API_KEY/);
  assert.match(source, /group_ids/);
  assert.match(source, /prepareImageConfigGeneration/);
  assert.match(source, /groupIds:\s*body\.group_ids/);
});

test("image config save route exposes the ids of groups created in the current save operation", async () => {
  const source = await readFile(saveRoutePath, "utf8");

  assert.match(source, /created_group_ids/);
  assert.match(source, /config\.createdGroups/);
});

test("image config save route accepts CTA fields", async () => {
  const source = await readFile(saveRoutePath, "utf8");

  assert.match(source, /cta_enabled/);
  assert.match(source, /cta_text/);
});
