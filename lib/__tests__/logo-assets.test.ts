import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { LOGO_ASSET_OPTIONS } from "../logo-asset-metadata";
import { createLogoPreviewBuffer, getLogoAssetPath, readLogoAssetAsDataUrl } from "../logo-assets";

test("getLogoAssetPath resolves bundled logo assets", async () => {
  const onionPath = getLogoAssetPath("onion");
  const appPath = getLogoAssetPath("onion_app");

  assert.match(onionPath, new RegExp(path.join("public", "brand").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(appPath, new RegExp(path.join("public", "brand").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await fs.access(onionPath);
  await fs.access(appPath);
});

test("logo asset options expose thumbnail urls for the config card", () => {
  assert.equal(LOGO_ASSET_OPTIONS.length, 2);
  assert.equal(LOGO_ASSET_OPTIONS[0]?.label, "洋葱 Logo");
  assert.equal(LOGO_ASSET_OPTIONS[0]?.thumbnailUrl, "/api/logo-assets/onion");
  assert.equal(LOGO_ASSET_OPTIONS[1]?.label, "洋葱 App Icon");
  assert.equal(LOGO_ASSET_OPTIONS[1]?.thumbnailUrl, "/api/logo-assets/onion_app");
});

test("createLogoPreviewBuffer renders transparent logos onto the card surface color", async () => {
  const buffer = await createLogoPreviewBuffer("onion_app");
  const pixel = await sharp(buffer)
    .ensureAlpha()
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .raw()
    .toBuffer();

  assert.deepEqual([...pixel], [239, 230, 223, 255]);
});

test("readLogoAssetAsDataUrl returns a local logo as a data URL", async () => {
  const dataUrl = await readLogoAssetAsDataUrl("onion");

  assert.match(dataUrl, /^data:image\/png;base64,/);
  assert.ok(dataUrl.length > 100);
});
