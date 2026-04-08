import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cardPath = new URL("../../components/cards/image-config-card.tsx", import.meta.url);

test("image config card surfaces request failures to the user", async () => {
  const source = await readFile(cardPath, "utf8");

  assert.match(source, /setSubmitError/);
  assert.match(source, /submitError/);
  assert.match(source, /图片生成失败/);
});

test("image config card delegates form and action logic", async () => {
  const source = await readFile(cardPath, "utf8");

  assert.match(source, /ImageConfigForm/);
  assert.match(source, /ImageConfigBrandSection/);
  assert.match(source, /image-config-actions/);
});
