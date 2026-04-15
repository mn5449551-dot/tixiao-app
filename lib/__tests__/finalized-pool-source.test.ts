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
