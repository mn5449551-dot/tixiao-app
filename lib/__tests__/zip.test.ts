import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { zipAndCleanupDirectory } from "../export/zip";

test("zipAndCleanupDirectory removes the source directory after archiving", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tixiao-zip-"));
  const sourceDir = path.join(tempRoot, "source");
  const outputZipPath = path.join(tempRoot, "bundle.zip");

  await fs.mkdir(sourceDir, { recursive: true });
  await fs.writeFile(path.join(sourceDir, "file.txt"), "hello");

  const result = await zipAndCleanupDirectory({ sourceDir, outputZipPath });

  assert.equal(result, outputZipPath);
  await fs.access(outputZipPath);
  await assert.rejects(() => fs.access(sourceDir));
  await fs.rm(tempRoot, { recursive: true, force: true });
});
