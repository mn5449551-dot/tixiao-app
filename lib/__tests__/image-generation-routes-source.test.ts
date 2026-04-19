import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const generateRoutePath = new URL("../../app/api/image-configs/[id]/generate/route.ts", import.meta.url);
const appendRoutePath = new URL("../../app/api/image-configs/[id]/append/route.ts", import.meta.url);
const generationServicePath = new URL("../image-generation-service.ts", import.meta.url);
const regenerateRoutePath = new URL("../../app/api/images/[id]/route.ts", import.meta.url);
const inpaintRoutePath = new URL("../../app/api/images/[id]/inpaint/route.ts", import.meta.url);

test("image generation routes pass aspect ratio through the shared OpenAI-compatible image client", async () => {
  const generateSource = await readFile(generationServicePath, "utf8");
  const regenerateSource = await readFile(regenerateRoutePath, "utf8");

  assert.match(generateSource, /generateImageFromReference/);
  assert.match(generateSource, /generateImageFromPrompt/);
  assert.match(regenerateSource, /generateImageFromReference/);
  assert.match(regenerateSource, /generateImageFromPrompt/);
  assert.match(generateSource, /generateImageFromReference\([\s\S]{0,240}aspectRatio:\s*config\.aspectRatio/);
  assert.match(generateSource, /generateImageFromPrompt\(item\.prompt,\s*\{[\s\S]{0,180}aspectRatio:\s*config\.aspectRatio/);
  assert.match(regenerateSource, /generateImageFromReference\([\s\S]{0,280}aspectRatio:\s*group\?\.aspectRatio \?\? config\.aspectRatio/);
  assert.match(regenerateSource, /generateImageFromPrompt\(fullPrompt,\s*\{[\s\S]{0,200}aspectRatio:\s*group\?\.aspectRatio \?\? config\.aspectRatio/);
});

test("single-image regenerate reads final prompt snapshots directly", async () => {
  const regenerateSource = await readFile(regenerateRoutePath, "utf8");

  assert.match(regenerateSource, /finalPromptText|final_prompt_text/);
  assert.match(regenerateSource, /当前图片缺少最终提示词快照/);
  assert.match(regenerateSource, /generateImageFromPrompt\(fullPrompt/);
  assert.doesNotMatch(regenerateSource, /buildImagePrompt\(/);
});

test("logo is excluded from generation and handled as an export-phase overlay", async () => {
  const generateSource = await readFile(generationServicePath, "utf8");
  const regenerateSource = await readFile(regenerateRoutePath, "utf8");

  assert.doesNotMatch(generateSource, /readLogoAssetAsDataUrl/);
  assert.doesNotMatch(regenerateSource, /readLogoAssetAsDataUrl/);
  assert.doesNotMatch(generateSource, /applyFixedLogoOverlay/);
  assert.doesNotMatch(regenerateSource, /applyFixedLogoOverlay/);
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

test("image generation service stores prompt bundles and per-image final prompt snapshots", async () => {
  const [generateSource, regenerateSource] = await Promise.all([
    readFile(generationServicePath, "utf8"),
    readFile(regenerateRoutePath, "utf8"),
  ]);

  assert.match(generateSource, /db\.update\(imageGroups\)/);
  assert.match(generateSource, /generateImageDescription/);
  assert.match(generateSource, /promptBundleJson|prompt_bundle_json/);
  assert.match(generateSource, /finalPromptText|final_prompt_text/);
  assert.match(generateSource, /finalNegativePrompt|final_negative_prompt/);
  assert.match(generateSource, /generationRequestJson|generation_request_json/);
  assert.match(generateSource, /referenceImageUrls/);
  assert.match(generateSource, /promptText:\s*item\.prompt/);
  assert.match(generateSource, /referenceImages:\s*item\.referenceImageUrls\.map/);
  assert.match(regenerateSource, /finalPromptText|final_prompt_text/);
});

test("inpaint route persists thumbnail metadata together with the regenerated file", async () => {
  const inpaintSource = await readFile(inpaintRoutePath, "utf8");

  assert.match(inpaintSource, /thumbnailPath:\s*saved\.thumbnailPath/);
  assert.match(inpaintSource, /thumbnailUrl:\s*saved\.thumbnailUrl/);
});
