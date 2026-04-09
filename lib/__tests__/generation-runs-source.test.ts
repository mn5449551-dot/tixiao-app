import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const imageAppendRoutePath = new URL("../../app/api/image-configs/[id]/append/route.ts", import.meta.url);
const candidatePoolActionsPath = new URL("../../components/cards/candidate-pool/candidate-pool-actions.ts", import.meta.url);
const directionCardPath = new URL("../../components/cards/direction-card.tsx", import.meta.url);

test("candidate append flow uses the append route for append-and-generate in a single request", async () => {
  const [routeSource, actionSource] = await Promise.all([
    readFile(imageAppendRoutePath, "utf8"),
    readFile(candidatePoolActionsPath, "utf8"),
  ]);

  assert.match(routeSource, /generate/);
  assert.doesNotMatch(actionSource, /\/api\/image-configs\/\$\{input\.imageConfigId\}\/append/);
  assert.doesNotMatch(actionSource, /appendCandidateGeneration/);
});

test("direction card source test tracks the new no-regenerate direction-card behavior", async () => {
  const source = await readFile(directionCardPath, "utf8");

  assert.match(source, /追加生成方向/);
  assert.doesNotMatch(source, /regenerateDirectionItem/);
});
