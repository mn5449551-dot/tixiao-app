import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const generateRoutePath = new URL("../../app/api/image-configs/[id]/generate/route.ts", import.meta.url);
const appendRoutePath = new URL("../../app/api/image-configs/[id]/append/route.ts", import.meta.url);
const generationServicePath = new URL("../image-generation-service.ts", import.meta.url);
const regenerateRoutePath = new URL("../../app/api/images/[id]/route.ts", import.meta.url);
const referenceModeRoutePath = new URL("../../app/api/reference-mode/route.ts", import.meta.url);

test("image generation routes pass aspect ratio through the shared OpenAI-compatible image client", async () => {
  const generateSource = await readFile(generationServicePath, "utf8");
  const regenerateSource = await readFile(regenerateRoutePath, "utf8");
  const referenceSource = await readFile(referenceModeRoutePath, "utf8");

  assert.match(generateSource, /generateImageFromReference/);
  assert.match(generateSource, /generateImageFromPrompt/);
  assert.match(regenerateSource, /generateImageFromReference/);
  assert.match(regenerateSource, /generateImageFromPrompt/);
  assert.match(referenceSource, /generateImageFromReference/);
  assert.match(generateSource, /generateImageFromReference\([\s\S]{0,240}aspectRatio:\s*config\.aspectRatio/);
  assert.match(generateSource, /generateImageFromPrompt\(fullPrompt,\s*\{[\s\S]{0,180}aspectRatio:\s*config\.aspectRatio/);
  assert.match(regenerateSource, /generateImageFromReference\([\s\S]{0,280}aspectRatio:\s*group\?\.aspectRatio \?\? config\.aspectRatio/);
  assert.match(regenerateSource, /generateImageFromPrompt\(fullPrompt,\s*\{[\s\S]{0,200}aspectRatio:\s*group\?\.aspectRatio \?\? config\.aspectRatio/);
  assert.match(referenceSource, /aspect_ratio\?:/);
  assert.match(referenceSource, /aspectRatio:\s*body\.aspect_ratio/);
});

test("single-image regenerate prefers slot prompt snapshots over rebuilding group prompt", async () => {
  const regenerateSource = await readFile(regenerateRoutePath, "utf8");

  assert.match(regenerateSource, /slotPromptSnapshot|slot_prompt_snapshot/);
  assert.match(regenerateSource, /instruction:\s*fullPrompt/);
  assert.match(regenerateSource, /generateImageFromPrompt\(fullPrompt/);
  assert.doesNotMatch(regenerateSource, /mergeImagePromptWithSlot\(/);
});

test("logo remains part of the reference image inputs for both initial generation and regenerate", async () => {
  const generateSource = await readFile(generationServicePath, "utf8");
  const regenerateSource = await readFile(regenerateRoutePath, "utf8");

  assert.match(generateSource, /config\.logo && config\.logo !== "none"/);
  assert.match(generateSource, /readLogoAssetAsDataUrl/);
  assert.match(regenerateSource, /group\?\.logo \?\? config\.logo/);
  assert.match(regenerateSource, /readLogoAssetAsDataUrl/);
});

test("image config generate route completes generation work in-request instead of fire-and-forget background scheduling", async () => {
  const generateSource = await readFile(generateRoutePath, "utf8");

  assert.doesNotMatch(generateSource, /setImmediate\(/);
  assert.match(generateSource, /import \{ NextResponse,\s*after \} from "next\/server"/);
  assert.match(generateSource, /after\(async \(\) =>/);
});

test("single-image regenerate route also uses after instead of setImmediate", async () => {
  const regenerateSource = await readFile(regenerateRoutePath, "utf8");

  assert.doesNotMatch(regenerateSource, /setImmediate\(/);
  assert.match(regenerateSource, /import \{ NextResponse,\s*after \} from "next\/server"/);
  assert.match(regenerateSource, /after\(async \(\) =>/);
});

test("image append route uses the shared image generation service instead of calling another route module", async () => {
  const appendSource = await readFile(appendRoutePath, "utf8");

  assert.doesNotMatch(appendSource, /generateRouteModule/);
  assert.doesNotMatch(appendSource, /@\/app\/api\/image-configs\/\[id\]\/generate\/route/);
  assert.match(appendSource, /@\/lib\/image-generation-service/);
});

test("image generation service snapshots shared-base and slot prompt payloads for multimodal slot generation", async () => {
  const [generateSource, regenerateSource] = await Promise.all([
    readFile(generationServicePath, "utf8"),
    readFile(regenerateRoutePath, "utf8"),
  ]);

  assert.match(generateSource, /db\.update\(imageGroups\)/);
  assert.match(generateSource, /generateSlotImagePrompt/);
  assert.match(generateSource, /Promise\.all/);
  assert.match(generateSource, /sharedBaseSnapshot|shared_base_snapshot/);
  assert.match(generateSource, /slotPromptSnapshot|slot_prompt_snapshot/);
  assert.match(generateSource, /referencePlanSnapshot|reference_plan_snapshot/);
  assert.match(generateSource, /promptSummaryText|prompt_summary_text/);
  assert.match(regenerateSource, /group\?\.promptEn \|\| config\.promptEn/);
  assert.match(regenerateSource, /group\?\.promptZh \?\? config\.promptZh/);
});
