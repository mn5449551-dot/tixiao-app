import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const fieldPath = new URL("../../components/ui/field.tsx", import.meta.url);

test("Textarea supports auto-growing height", async () => {
  const source = await readFile(fieldPath, "utf8");

  assert.match(source, /scrollHeight/);
  assert.match(source, /minRows/);
  assert.match(source, /style\.height = "0px"/);
  assert.match(source, /nodrag/);
  assert.match(source, /nopan/);
});
