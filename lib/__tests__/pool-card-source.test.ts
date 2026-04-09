import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const candidatePoolCardPath = new URL("../../components/cards/candidate-pool-card.tsx", import.meta.url);
const candidateImageCardPath = new URL("../../components/cards/candidate-pool/candidate-image-card.tsx", import.meta.url);
const candidateGroupCardPath = new URL("../../components/cards/candidate-pool/candidate-group-card.tsx", import.meta.url);
const finalizedPoolCardPath = new URL("../../components/cards/finalized-pool-card.tsx", import.meta.url);
const finalizedPreviewCardPath = new URL("../../components/cards/finalized-pool/finalized-preview-card.tsx", import.meta.url);

test("candidate and finalized pool cards use contain-fit previews and image preview modal", async () => {
  const candidateSource = await readFile(candidatePoolCardPath, "utf8");
  const candidateImageSource = await readFile(candidateImageCardPath, "utf8");
  const candidateGroupSource = await readFile(candidateGroupCardPath, "utf8");
  const finalizedSource = await readFile(finalizedPoolCardPath, "utf8");
  const finalizedPreviewSource = await readFile(finalizedPreviewCardPath, "utf8");

  assert.match(candidateSource, /ImagePreviewModal/);
  assert.match(finalizedSource, /ImagePreviewModal/);
  assert.match(candidateImageSource, /object-contain/);
  assert.match(finalizedPreviewSource, /object-contain/);
  assert.doesNotMatch(candidateSource, /aspect-\[3\/4\]/);
  assert.doesNotMatch(finalizedSource, /aspect-\[3\/4\]/);
  assert.doesNotMatch(candidateSource, /pointer-events-none absolute inset-0 z-10/);
  assert.match(candidateGroupSource, /groupHasGenerating/);
});

test("candidate pool card delegates rendering and action logic", async () => {
  const source = await readFile(candidatePoolCardPath, "utf8");
  const groupSource = await readFile(candidateGroupCardPath, "utf8");

  assert.match(source, /CandidateGroupCard/);
  assert.match(source, /CandidateImageCard/);
  assert.match(source, /candidate-pool-actions/);
  assert.match(groupSource, /最新/);
  assert.doesNotMatch(source, /isAppending/);
  assert.doesNotMatch(source, /追加生成一张/);
  assert.doesNotMatch(source, /追加生成一套/);
});

test("candidate pool keeps failures at the single-image level instead of a pool-level partial-failure banner", async () => {
  const source = await readFile(candidatePoolCardPath, "utf8");
  const imageSource = await readFile(candidateImageCardPath, "utf8");

  assert.doesNotMatch(source, /部分图片生成失败，请重试/);
  assert.match(imageSource, /生成失败/);
});

test("finalized pool card delegates preview and export actions", async () => {
  const source = await readFile(finalizedPoolCardPath, "utf8");

  assert.match(source, /FinalizedPreviewCard/);
  assert.match(source, /finalized-pool-actions/);
});
