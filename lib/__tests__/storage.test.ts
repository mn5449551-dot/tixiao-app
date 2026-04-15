import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { applyFixedLogoOverlay, getProjectImageDirectory, saveImageBuffer } from "../storage";
import { getLogoAssetPath } from "../logo-assets";

test("saveImageBuffer removes partially written files when metadata parsing fails", async () => {
  const projectId = `bad-buffer-${Date.now()}`;
  const imageId = "img_bad";
  const filePath = path.join(getProjectImageDirectory(projectId), `${imageId}.png`);

  await assert.rejects(() =>
    saveImageBuffer({
      projectId,
      imageId,
      buffer: Buffer.alloc(0),
      extension: "png",
    }),
  );

  await assert.rejects(() => fs.access(filePath));
});

test("applyFixedLogoOverlay places the logo at a fixed top-left position", async () => {
  const baseImage = await sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 4,
      background: "#ffffff",
    },
  })
    .png()
    .toBuffer();

  const overlaid = await applyFixedLogoOverlay({
    buffer: baseImage,
    logoPath: getLogoAssetPath("onion"),
  });

  const topLeftRegion = await sharp(overlaid)
    .ensureAlpha()
    .extract({ left: 24, top: 24, width: 320, height: 220 })
    .raw()
    .toBuffer();
  const bottomRightPixel = await sharp(overlaid)
    .ensureAlpha()
    .extract({ left: 1160, top: 760, width: 1, height: 1 })
    .raw()
    .toBuffer();
  const hasNonWhitePixel = topLeftRegion.some((value, index) => {
    const channel = index % 4;
    if (channel === 3) return value !== 255;
    return value !== 255;
  });

  assert.equal(hasNonWhitePixel, true);
  assert.deepEqual([...bottomRightPixel], [255, 255, 255, 255]);
});
