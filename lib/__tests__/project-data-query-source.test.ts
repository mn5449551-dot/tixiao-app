import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const projectDataPath = new URL("../project-data.ts", import.meta.url);
const directionOperationsPath = new URL("../project-data-modules/direction-operations.ts", import.meta.url);
const projectDataInternalPath = new URL("../project-data-modules-internal.ts", import.meta.url);

test("scoped workspace query helpers do not rebuild the full workspace for graph and status payloads", async () => {
  const [source, internalSource] = await Promise.all([
    readFile(projectDataPath, "utf8"),
    readFile(projectDataInternalPath, "utf8"),
  ]);

  const canvasSection = source.slice(
    source.indexOf("export function getCanvasData"),
    source.indexOf("export function getGenerationStatusData"),
  );
  const statusSection = internalSource.slice(
    internalSource.indexOf("export function getGenerationStatusData"),
    internalSource.indexOf("export function getProjectExportContext"),
  );

  assert.doesNotMatch(canvasSection, /getProjectWorkspace\(/);
  assert.doesNotMatch(statusSection, /getProjectWorkspace\(/);
  assert.match(statusSection, /thumbnailUrl:\s*image\.thumbnailUrl/);
});

test("image deletion paths clear thumbnail files alongside originals", async () => {
  const [imageRouteSource, directionOperationsSource] = await Promise.all([
    readFile(new URL("../../app/api/images/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../project-data-modules-internal.ts", import.meta.url), "utf8"),
  ]);

  assert.match(imageRouteSource, /deleteFileIfExists\(image\.thumbnailPath\)/);
  assert.match(directionOperationsSource, /if \(image\.thumbnailPath\) filePaths\.push\(image\.thumbnailPath\)/);
  assert.match(directionOperationsSource, /existingDerived[\s\S]{0,220}deleteFileIfExists\(image\.thumbnailPath\)/);
});

test("deleteDirection uses a batched config-id lookup instead of querying configs inside nested copy loops", async () => {
  const source = await readFile(directionOperationsPath, "utf8");

  assert.match(source, /project-data-modules-internal/);
  assert.match(source, /deleteDirection/);
});

test("project-data delegates major concerns to focused submodules", async () => {
  const source = await readFile(projectDataPath, "utf8");

  assert.match(source, /project-data-modules\/project-queries/);
  assert.match(source, /project-data-modules\/direction-operations/);
  assert.match(source, /project-data-modules\/copy-operations/);
  assert.match(source, /project-data-modules\/image-config-operations/);
  assert.match(source, /project-data-modules\/export-context/);
});
