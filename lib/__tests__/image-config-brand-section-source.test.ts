import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const brandSectionPath = new URL("../../components/cards/image-config/image-config-brand-section.tsx", import.meta.url);

test("image config brand section no longer exposes logo selection and only manages IP controls", async () => {
  const source = await readFile(brandSectionPath, "utf8");

  assert.doesNotMatch(source, /LOGO_ASSET_OPTIONS/);
  assert.doesNotMatch(source, /Logo/);
  assert.match(source, /普通模式不可选，切换到 IP 风格后才可选择/);
  assert.match(source, /showIpAssetSelector \? \(/);
});
