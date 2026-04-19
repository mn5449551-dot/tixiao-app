import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const candidatePoolCardPath = new URL("../../components/cards/candidate-pool-card.tsx", import.meta.url);
const candidateImageCardPath = new URL("../../components/cards/candidate-pool/candidate-image-card.tsx", import.meta.url);
const candidateGroupCardPath = new URL("../../components/cards/candidate-pool/candidate-group-card.tsx", import.meta.url);
const modalPath = new URL("../../components/ui/modal.tsx", import.meta.url);
const promptDetailsModalPath = new URL("../../components/cards/candidate-pool/prompt-details-modal.tsx", import.meta.url);
const finalizedPoolCardPath = new URL("../../components/cards/finalized-pool-card.tsx", import.meta.url);
test("candidate and finalized pool cards use contain-fit previews and image preview modal", async () => {
  const candidateSource = await readFile(candidatePoolCardPath, "utf8");
  const candidateImageSource = await readFile(candidateImageCardPath, "utf8");
  const candidateGroupSource = await readFile(candidateGroupCardPath, "utf8");
  const finalizedSource = await readFile(finalizedPoolCardPath, "utf8");

  assert.match(candidateSource, /ImagePreviewModal/);
  assert.match(finalizedSource, /ImagePreviewModal/);
  assert.match(candidateImageSource, /object-contain/);
  assert.match(finalizedSource, /object-contain/);
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

  assert.match(source, /exportFinalizedImages/);
  assert.match(source, /generateFinalizedVariants/);
  assert.match(source, /deleteDerivedGroup/);
  assert.match(source, /finalized-pool-actions/);
});

test("candidate pool defaults to manual selection instead of auto-selecting done images", async () => {
  const source = await readFile(candidatePoolCardPath, "utf8");

  assert.match(source, /const \[selectedIds, setSelectedIds\] = useState<Set<string>>\([\s\S]{0,40}\(\) => new Set\(\)/);
});

test("candidate pool prompt details modal shows prompt sections and copy actions", async () => {
  const [source, modalSource] = await Promise.all([
    readFile(promptDetailsModalPath, "utf8"),
    readFile(modalPath, "utf8"),
  ]);

  assert.match(source, /Modal/);
  assert.match(source, /正向提示词/);
  assert.match(source, /negative prompt/i);
  assert.match(source, /navigator\.clipboard\.writeText|onCopyPrompt|onCopyNegativePrompt|onCopy/);
  assert.match(source, /hasSnapshot/);
  assert.match(source, /该图片缺少历史生图快照，请重新生成后查看/);
  assert.match(source, /referenceImages/);
  assert.doesNotMatch(source, /style=\{\{\s*aspectRatio:\s*"1 \/ 1"/);
  assert.match(source, /scrollable/);
  assert.match(modalSource, /overflow-y-auto/);
});

test("candidate pool exposes prompt inspection only for eligible images", async () => {
  const source = await readFile(candidatePoolCardPath, "utf8");
  const imageSource = await readFile(candidateImageCardPath, "utf8");
  const groupSource = await readFile(candidateGroupCardPath, "utf8");

  assert.match(source, /PromptDetailsModal/);
  assert.match(source, /navigator\.clipboard\.writeText/);
  assert.match(imageSource, /查看提示词/);
  assert.match(imageSource, /image\.status === "done"|isDone/);
  assert.match(imageSource, /!image\.inpaintParentId/);
  assert.match(groupSource, /onViewPromptDetails/);
});

test("finalized pool defaults to manual channel selection", async () => {
  const source = await readFile(finalizedPoolCardPath, "utf8");

  assert.match(source, /const \[activeChannel, setActiveChannel\] = useState<string \| null>\(null\)/);
});

test("finalized pool defaults to manual slot selection instead of selecting all available slots", async () => {
  const source = await readFile(finalizedPoolCardPath, "utf8");

  assert.match(source, /const \[selectedSlotNames, setSelectedSlotNames\] = useState<string\[]>\(\[\]\)/);
  assert.match(source, /directSlots\.filter/);
  assert.doesNotMatch(source, /selectedSlotNames\.length > 0 \? directSlots\.filter\([^)]+\) : directSlots/);
});

test("finalized pool uses channel-scoped slot coverage and per-ratio regeneration", async () => {
  const source = await readFile(finalizedPoolCardPath, "utf8");

  assert.match(source, /splitExportSlotSpecsByCoverage/);
  assert.match(source, /selectedImageRatios:\s*availableRatios/);
  assert.match(source, /请选择渠道后查看该渠道版位/);
  assert.match(source, /可直接导出/);
  assert.match(source, /需适配/);
  assert.match(source, /slotNames:\s*selectedAdaptiveSlotSpecs\.map\(\(slot\) => slot\.slotName\)/);
  assert.match(source, /slotNames:\s*selectedDirectSlotSpecs\.map\(\(slot\) => slot\.slotName\)/);
  assert.match(source, /sourceGroupId:\s*resolvedSourceGroupId/);
  assert.match(source, /targetChannel:\s*activeChannel/);
  assert.match(source, /重新生成/);
  assert.doesNotMatch(source, /mergeSelectedGroupIds/);
  assert.doesNotMatch(source, /以下版位比例与原图不匹配，请先生成适配版本/);
});

test("finalized pool exposes an explicit preview affordance for generated ratio assets", async () => {
  const source = await readFile(finalizedPoolCardPath, "utf8");

  assert.match(source, /已有比例资产/);
  assert.match(source, /查看大图/);
  assert.match(source, /onClick=\{\(\) => image && setPreviewImage\(image\)\}/);
  assert.match(source, /object-contain/);
  assert.match(source, /实际尺寸|实际比例/);
});
