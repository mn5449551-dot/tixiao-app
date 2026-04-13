import test from "node:test";
import assert from "node:assert/strict";

import {
  createProject,
  getCanvasData,
  getGenerationStatusData,
  getProjectTreeData,
  getWorkspaceHeader,
  saveImageConfig,
  upsertRequirement,
} from "../project-data";

// NOTE: generateDirections and generateCopyCard have been removed.
// These tests require AI calls and should be rewritten with mocks or skipped.

test.skip("workspace query helpers return scoped payloads", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});

test.skip("canvas data keeps separate image-config branches available for candidate pool rendering", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});