import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const candidatePoolCardPath = new URL("../../components/cards/candidate-pool-card.tsx", import.meta.url);
const finalizedPoolCardPath = new URL("../../components/cards/finalized-pool-card.tsx", import.meta.url);

test("candidate and finalized pool cards use contain-fit previews and image preview modal", async () => {
  const candidateSource = await readFile(candidatePoolCardPath, "utf8");
  const finalizedSource = await readFile(finalizedPoolCardPath, "utf8");

  assert.match(candidateSource, /ImagePreviewModal/);
  assert.match(finalizedSource, /ImagePreviewModal/);
  assert.match(candidateSource, /object-contain/);
  assert.match(finalizedSource, /object-contain/);
  assert.doesNotMatch(candidateSource, /aspect-\[3\/4\]/);
  assert.doesNotMatch(finalizedSource, /aspect-\[3\/4\]/);
  assert.doesNotMatch(candidateSource, /pointer-events-none absolute inset-0 z-10/);
  assert.match(candidateSource, /groupHasGenerating/);
});
