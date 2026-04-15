import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const candidatePoolCardPath = new URL("../../components/cards/candidate-pool-card.tsx", import.meta.url);
const copyCardPath = new URL("../../components/cards/copy-card.tsx", import.meta.url);
const directionCardPath = new URL("../../components/cards/direction-card.tsx", import.meta.url);
const directionActionsPath = new URL("../../components/cards/direction-card/direction-card-actions.ts", import.meta.url);
const finalizedActionsPath = new URL("../../components/cards/finalized-pool/finalized-pool-actions.ts", import.meta.url);
const requirementCardPath = new URL("../../components/cards/requirement-card.tsx", import.meta.url);

test("interactive cards surface action failures instead of silently swallowing them", async () => {
  const [candidateSource, copySource, directionSource, requirementSource] = await Promise.all([
    readFile(candidatePoolCardPath, "utf8"),
    readFile(copyCardPath, "utf8"),
    readFile(directionCardPath, "utf8"),
    readFile(requirementCardPath, "utf8"),
  ]);

  assert.match(candidateSource, /setActionError/);
  assert.match(copySource, /setActionError/);
  assert.match(directionSource, /setActionError/);
  assert.doesNotMatch(copySource, /Silently fail/);
  assert.match(requirementSource, /@\/lib\/api-fetch/);
});

test("finalized pool actions use the shared api-fetch helper", async () => {
  const source = await readFile(finalizedActionsPath, "utf8");

  assert.match(source, /@\/lib\/api-fetch/);
  assert.doesNotMatch(source, /await fetch\(/);
  assert.match(source, /target_group_ids/);
});

test("direction card actions do not swallow copy generation API errors behind boolean false", async () => {
  const source = await readFile(directionActionsPath, "utf8");

  assert.match(source, /apiFetch/);
  assert.doesNotMatch(source, /catch\s*\{\s*return false;\s*\}/);
});
