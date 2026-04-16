import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const servicePath = new URL("../image-generation-service.ts", import.meta.url);

test("processPreparedImageGeneration uses per-group slot1 success tracking", async () => {
  const source = await readFile(servicePath, "utf8");

  // Should NOT have a global slot1Failed boolean
  assert.doesNotMatch(source, /let slot1Failed/);
  // Should check slot1DoneMap per group for series continuation
  assert.match(source, /slot1DoneMap\.get\(group\.id\)/);
  // Should not have a global skip for all slot 2+ when one group fails
  assert.doesNotMatch(source, /if \(isSeries && slot1Failed\)/);
});

test("processPreparedImageGeneration calls series-image-agent per group for delta prompts", async () => {
  const source = await readFile(servicePath, "utf8");

  // Should NOT take only the first entry for all groups
  assert.doesNotMatch(source, /firstSlot1Entry/);
  // Should iterate groups and call series agent for each group with its own slot1
  assert.match(source, /for \(const group of groups\)/);
  assert.match(source, /slot1DoneMap\.get\(group\.id\)/);
});

test("processPreparedImageGeneration removes logo from group snapshot update", async () => {
  const source = await readFile(servicePath, "utf8");

  // The group update block should not set logo
  const groupUpdatePattern = /db\.update\(imageGroups\)[\s\S]*?\.set\(\{[\s\S]*?\}\)/g;
  const matches = source.match(groupUpdatePattern);
  assert.ok(matches, "expected db.update(imageGroups) calls");

  for (const match of matches) {
    if (match.includes("promptBundleJson") && match.includes("updatedAt")) {
      assert.doesNotMatch(match, /logo:/, "group update should not set logo field");
    }
  }
});

test("processPreparedImageGeneration does not pass logo to buildSharedBaseContext", async () => {
  const source = await readFile(servicePath, "utf8");

  // buildSharedBaseContext should not reference config.logo
  const baseContextMatch = source.match(/async function buildSharedBaseContext[\s\S]*?return \{[\s\S]*?\};/);
  assert.ok(baseContextMatch, "expected buildSharedBaseContext function");
  assert.doesNotMatch(baseContextMatch[0], /logo/, "buildSharedBaseContext should not reference logo");
});

test("createCandidateGroupsForConfig uses MAX variantIndex for append mode", async () => {
  const source = await readFile(new URL("../project-data-modules-internal.ts", import.meta.url), "utf8");

  // In createCandidateGroupsForConfig, append mode should use MAX(variantIndex) not groups.length
  const fnMatch = source.match(/function createCandidateGroupsForConfig[\s\S]*?function\s+\w+/);
  assert.ok(fnMatch, "expected createCandidateGroupsForConfig function");

  // The current buggy code uses groups.length + 1
  assert.doesNotMatch(fnMatch[0], /groups\.length\s*\+\s*1/, "should not use groups.length for variantIndex in append mode");
});
