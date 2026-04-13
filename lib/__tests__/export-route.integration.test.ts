import test from "node:test";
import assert from "node:assert/strict";

import { eq } from "drizzle-orm";

import * as exportRouteModule from "../../app/api/projects/[id]/export/route";
import { createProject, saveImageConfig, upsertRequirement } from "../project-data";
import { getDb } from "../db";
import { createSolidPlaceholder, saveImageBuffer } from "../storage";
import { imageGroups, generatedImages, exportRecords } from "../schema";

// NOTE: generateDirections and generateCopyCard have been removed.
// Tests that use them are skipped pending mock-based rewrites.

const { POST } = exportRouteModule;

test.skip("export route returns a zip response for a project with confirmed finalized images", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});
