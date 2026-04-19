import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cardPath = new URL("../../components/cards/finalized-pool-card.tsx", import.meta.url);

test("finalized card uses finalized adaptation model whitelist instead of IMAGE_MODELS", async () => {
  const source = await readFile(cardPath, "utf8");

  assert.match(source, /FINALIZED_ADAPTATION_MODELS/);
  assert.doesNotMatch(source, /<option key=\{m\.value\} value=\{m\.value\}>[\s\S]*IMAGE_MODELS\.map/);
});
