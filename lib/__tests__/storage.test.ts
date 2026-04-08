import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { getProjectImageDirectory, saveImageBuffer } from "../storage";

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
