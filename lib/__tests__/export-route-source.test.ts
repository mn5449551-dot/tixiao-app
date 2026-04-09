import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const exportRoutePath = new URL("../../app/api/projects/[id]/export/route.ts", import.meta.url);

test("export route delegates project export data loading instead of nesting db selects", async () => {
  const source = await readFile(exportRoutePath, "utf8");

  assert.match(source, /getProjectExportContext/);
  assert.doesNotMatch(source, /flatMap\(\(directionId\) => db\.select\(\)\.from\(copyCards\)/);
  assert.doesNotMatch(source, /flatMap\(\(group\) => db\.select\(\)\.from\(generatedImages\)/);
  assert.doesNotMatch(source, /getLogoAssetPath/);
  assert.doesNotMatch(source, /logoPath/);
});
