import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const finalizedPoolCardPath = new URL("../../components/cards/finalized-pool-card.tsx", import.meta.url);
const finalizedActionsPath = new URL("../../components/cards/finalized-pool/finalized-pool-actions.ts", import.meta.url);

test("finalized pool chooses logo at export time and defaults to none", async () => {
  const [cardSource, actionsSource] = await Promise.all([
    readFile(finalizedPoolCardPath, "utf8"),
    readFile(finalizedActionsPath, "utf8"),
  ]);

  assert.match(cardSource, /exportLogo/);
  assert.match(cardSource, /"none"/);
  assert.match(cardSource, /导出 Logo/);
  assert.match(actionsSource, /logo:\s*input\.logo/);
});

test("finalized pool defaults to manual channel selection and single active channel view", async () => {
  const cardSource = await readFile(finalizedPoolCardPath, "utf8");

  assert.match(cardSource, /const \[activeChannel, setActiveChannel\]/);
  assert.match(cardSource, /请选择渠道后查看该渠道版位/);
  assert.doesNotMatch(cardSource, /const \[selectedChannels, setSelectedChannels\]/);
});

test("finalized pool defaults to manual slot selection and channel-scoped sections", async () => {
  const cardSource = await readFile(finalizedPoolCardPath, "utf8");

  assert.match(cardSource, /const \[selectedSlotNames, setSelectedSlotNames\]/);
  assert.match(cardSource, /可直接导出/);
  assert.match(cardSource, /需适配/);
  assert.match(cardSource, /暂不支持/);
  assert.doesNotMatch(cardSource, /全选|已选 \{selectedGroupIds\.size\}/);
});

test("finalized pool regenerates derived assets per ratio instead of auto-selecting generated groups", async () => {
  const cardSource = await readFile(finalizedPoolCardPath, "utf8");

  assert.match(cardSource, /重新生成/);
  assert.match(cardSource, /handleRegenerateImage/);
  assert.match(cardSource, /sourceGroupId: resolvedSourceGroupId/);
  assert.doesNotMatch(cardSource, /mergeSelectedGroupIds/);
});
