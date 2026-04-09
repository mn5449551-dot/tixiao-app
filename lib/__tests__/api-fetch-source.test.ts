import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const createProjectFormPath = new URL("../../components/dashboard/create-project-form.tsx", import.meta.url);
const projectListPath = new URL("../../components/dashboard/project-list.tsx", import.meta.url);
const copyCardActionsPath = new URL("../../components/cards/copy-card/copy-card-actions.ts", import.meta.url);
const directionCardActionsPath = new URL("../../components/cards/direction-card/direction-card-actions.ts", import.meta.url);

test("dashboard and card actions use the shared api-fetch helper instead of raw fetch", async () => {
  const [createProjectFormSource, projectListSource, copyCardActionsSource, directionCardActionsSource] =
    await Promise.all([
      readFile(createProjectFormPath, "utf8"),
      readFile(projectListPath, "utf8"),
      readFile(copyCardActionsPath, "utf8"),
      readFile(directionCardActionsPath, "utf8"),
    ]);

  for (const source of [
    createProjectFormSource,
    projectListSource,
    copyCardActionsSource,
    directionCardActionsSource,
  ]) {
    assert.match(source, /@\/lib\/api-fetch/);
    assert.doesNotMatch(source, /await fetch\(/);
  }
});
