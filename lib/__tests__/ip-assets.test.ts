import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  getIpAssetMetadata,
  getIpAssetPath,
  readIpAssetAsDataUrl,
  resolveReferenceImageUrl,
} from "../ip-assets";

test("getIpAssetPath resolves the bundled asset for each IP role", async () => {
  const assetPath = getIpAssetPath("豆包");

  assert.match(assetPath, new RegExp(path.join("public", "ip-assets", "豆包").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await fs.access(assetPath);
});

test("readIpAssetAsDataUrl converts a local IP asset into a data URL", async () => {
  const dataUrl = await readIpAssetAsDataUrl("小锤");

  assert.match(dataUrl, /^data:image\/png;base64,/);
  assert.ok(dataUrl.length > 100);
});

test("getIpAssetMetadata exposes a prompt description and thumbnail url for UI and generation", () => {
  const metadata = getIpAssetMetadata("雷婷");

  assert.equal(metadata.role, "雷婷");
  assert.match(metadata.promptKeywords, /round glasses|blue school vest|anime illustration style/);
  assert.match(metadata.description, /班长学霸|理性可靠/);
  assert.equal(metadata.thumbnailUrl, "/api/ip-assets/%E9%9B%B7%E5%A9%B7");
});

test("resolveReferenceImageUrl only injects IP asset when an IP role is explicitly selected", async () => {
  const noIpReference = await resolveReferenceImageUrl({
    styleMode: "ip",
    ipRole: null,
    referenceImageUrl: null,
  });
  assert.equal(noIpReference, null);

  const ipReference = await resolveReferenceImageUrl({
    styleMode: "ip",
    ipRole: "豆包",
    referenceImageUrl: null,
  });
  assert.match(ipReference ?? "", /^data:image\/png;base64,/);

  const manualReference = await resolveReferenceImageUrl({
    styleMode: "normal",
    ipRole: null,
    referenceImageUrl: "https://example.com/reference.png",
  });
  assert.equal(manualReference, "https://example.com/reference.png");
});
