import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cardPath = new URL("../../components/cards/finalized-pool-card.tsx", import.meta.url);

test("finalized card uses finalized adaptation model whitelist instead of IMAGE_MODELS", async () => {
  const source = await readFile(cardPath, "utf8");

  assert.match(source, /FINALIZED_ADAPTATION_MODELS/);
  assert.doesNotMatch(source, /<option key=\{m\.value\} value=\{m\.value\}>[\s\S]*IMAGE_MODELS\.map/);
});

test("finalized card uses a channel-first workflow for direct export and adaptation", async () => {
  const source = await readFile(cardPath, "utf8");

  assert.match(source, /activeChannel/);
  assert.match(source, /请选择渠道后查看该渠道版位/);
  assert.match(source, /可直接导出/);
  assert.match(source, /需适配/);
  assert.match(source, /暂不支持/);
  assert.match(source, /重新生成/);
  assert.doesNotMatch(source, /selectedChannels/);
});
