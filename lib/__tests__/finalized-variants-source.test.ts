import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const internalPath = new URL("../project-data-modules-internal.ts", import.meta.url);
const exportUtilsPath = new URL("../export/utils.ts", import.meta.url);
const variantsRoutePath = new URL("../../app/api/projects/[id]/finalized/variants/route.ts", import.meta.url);
const finalizedPoolActionsPath = new URL("../../components/cards/finalized-pool/finalized-pool-actions.ts", import.meta.url);
const exportRoutePath = new URL("../../app/api/projects/[id]/export/route.ts", import.meta.url);
const regenerateRoutePath = new URL("../../app/api/images/[id]/route.ts", import.meta.url);

test("export utils provides isSpecialRatio for special ratio detection", async () => {
  const source = await readFile(exportUtilsPath, "utf8");
  assert.match(source, /export function isSpecialRatio/);
  assert.match(source, /16:11/);
  assert.match(source, /√2:1/);
});

test("generateFinalizedVariants uses AI image generation instead of Sharp resize", async () => {
  const source = await readFile(internalPath, "utf8");
  assert.match(source, /generateImageFromReference/);
  assert.match(source, /isSpecialRatio/);
  assert.match(source, /skippedSlots/);
  assert.doesNotMatch(source, /parseSlotSize/);
});

test("generateFinalizedVariants builds adaptation prompts based on ratio direction", async () => {
  const source = await readFile(internalPath, "utf8");
  assert.match(source, /buildAdaptationPrompt/);
  assert.match(source, /compareAspectRatios/);
  assert.match(source, /向左右两侧自然延伸场景内容来填充更宽的画幅/);
  assert.match(source, /向上下方向自然延伸场景内容来填充更高的画幅/);
});

test("generateFinalizedVariants creates pending images and updates status after generation", async () => {
  const source = await readFile(internalPath, "utf8");
  assert.match(source, /status: "generating"/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /status: "done"/);
  assert.match(source, /status: "failed"/);
  assert.match(source, /generationRequestJson|generation_request_json/);
  assert.match(source, /referenceImages/);
});

test("variants API route accepts image_model and returns skipped_slots", async () => {
  const source = await readFile(variantsRoutePath, "utf8");
  assert.match(source, /source_group_id/);
  assert.match(source, /target_channel/);
  assert.match(source, /slot_names/);
  assert.match(source, /image_model/);
  assert.match(source, /imageModel/);
  assert.match(source, /skipped_slots/);
  assert.match(source, /skippedSlots/);
});

test("finalized pool actions pass imageModel to API", async () => {
  const source = await readFile(finalizedPoolActionsPath, "utf8");
  assert.match(source, /sourceGroupId/);
  assert.match(source, /targetChannel/);
  assert.match(source, /slotNames/);
  assert.match(source, /imageModel/);
  assert.match(source, /image_model/);
  assert.match(source, /skippedSlots/);
});

test("derived image regenerate stays anchored to the original finalized source image", async () => {
  const source = await readFile(regenerateRoutePath, "utf8");
  assert.match(source, /group\?\.groupType\.startsWith\("derived\|"\)/);
  assert.match(source, /parentImage/);
  assert.match(source, /generateImageFromReference/);
});

test("export route filters out special ratio slots", async () => {
  const source = await readFile(exportRoutePath, "utf8");
  assert.match(source, /isSpecialRatio/);
});
