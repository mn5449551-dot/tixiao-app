import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const logoAssetsPath = new URL("../logo-assets.ts", import.meta.url);

test("logo assets resolve bundled files without process cwd lookups", async () => {
  const source = await readFile(logoAssetsPath, "utf8");

  assert.match(source, /import\.meta\.url/);
  assert.doesNotMatch(source, /process\.cwd\(/);
});
