import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const projectDataPath = new URL("../project-data.ts", import.meta.url);

test("scoped workspace query helpers do not rebuild the full workspace for graph and status payloads", async () => {
  const source = await readFile(projectDataPath, "utf8");

  const canvasSection = source.slice(
    source.indexOf("export function getCanvasData"),
    source.indexOf("export function getGenerationStatusData"),
  );
  const statusSection = source.slice(source.indexOf("export function getGenerationStatusData"));

  assert.doesNotMatch(canvasSection, /getProjectWorkspace\(/);
  assert.doesNotMatch(statusSection, /getProjectWorkspace\(/);
});

test("deleteDirection uses a batched config-id lookup instead of querying configs inside nested copy loops", async () => {
  const source = await readFile(projectDataPath, "utf8");

  const deleteDirectionSection = source.slice(
    source.indexOf("export async function deleteDirection"),
    source.indexOf("export function listCopyCards"),
  );

  assert.match(deleteDirectionSection, /listDirectionImageConfigIds/);
  assert.doesNotMatch(deleteDirectionSection, /where\(eq\(imageConfigs\.copyId/);
});
