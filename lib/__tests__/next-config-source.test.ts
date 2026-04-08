import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const nextConfigPath = new URL("../../next.config.ts", import.meta.url);

test("next config suppresses the known db NFT warning for turbopack", async () => {
  const source = await readFile(nextConfigPath, "utf8");

  assert.match(source, /ignoreIssue/);
  assert.match(source, /next\\\.config\\\.ts/);
  assert.match(source, /Encountered unexpected file in NFT list/);
  assert.match(source, /whole project was traced unintentionally/i);
});
