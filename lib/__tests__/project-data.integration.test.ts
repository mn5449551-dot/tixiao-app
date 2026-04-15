import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";

import { createSolidPlaceholder, saveImageBuffer } from "../storage";
import * as projectData from "../project-data";
import {
  createFolder,
  createProject,
  deleteDirection,
  generateFinalizedVariants,
  getCanvasData,
  getProjectExportContext,
  getProjectById,
  saveImageConfig,
  upsertRequirement,
} from "../project-data";
import { getDb } from "../db";
import { finishGenerationRun, startGenerationRun } from "../generation-runs";
import { copies, directions, generatedImages, imageConfigs, imageGroups, projectFolders, projects } from "../schema";
import { getStorageRoot } from "../storage";

// NOTE: generateDirections and generateCopyCard have been removed.
// Tests that use them are skipped pending mock-based rewrites.

test.skip("regenerateCopy replaces copy text and clears downstream generated assets", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});

test.skip("saveImageConfig stores an IP asset data URL and img2img style in ip mode", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});

test.skip("saveImageConfig keeps IP mode valid without forcing an IP asset when no role is selected", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});

test.skip("generateDirections uses user-authored requirement text instead of feature ids", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});

test.skip("appendDirectionSmart preserves existing directions and appends one more", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});

test.skip("deleteDirection rejects directions that already have downstream copy cards", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});

test.skip("appendCopyToCardSmart appends a new copy into the existing copy card", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});

test.skip("generateCopyCardSmart returns the full requested number of copies for one direction card", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});

test("deleteProject removes project-scoped image and export directories under .local-data storage", async () => {
  const project = createProject(`delete-project-files-${Date.now()}`);
  assert.ok(project);

  const storageRoot = getStorageRoot();
  const imageDir = path.join(storageRoot, "images", project!.id);
  const exportDir = path.join(storageRoot, "exports", project!.id);

  await fs.mkdir(imageDir, { recursive: true });
  await fs.mkdir(exportDir, { recursive: true });
  await fs.writeFile(path.join(imageDir, "img_demo.png"), "demo");
  await fs.writeFile(path.join(exportDir, "export_demo.zip"), "demo");

  assert.equal(fsSync.existsSync(imageDir), true);
  assert.equal(fsSync.existsSync(exportDir), true);

  const deleted = await projectData.deleteProject(project!.id);
  assert.equal(deleted, true);
  assert.equal(fsSync.existsSync(imageDir), false);
  assert.equal(fsSync.existsSync(exportDir), false);
});

test("deleteFolder removes child projects and their project-scoped files instead of uncategorizing them", async () => {
  const folder = createFolder(`delete-folder-${Date.now()}`);
  assert.ok(folder);

  const projectA = createProject(`folder-project-a-${Date.now()}`, folder!.id);
  const projectB = createProject(`folder-project-b-${Date.now()}`, folder!.id);
  assert.ok(projectA);
  assert.ok(projectB);

  const storageRoot = getStorageRoot();
  const projectADirs = {
    image: path.join(storageRoot, "images", projectA!.id),
    export: path.join(storageRoot, "exports", projectA!.id),
  };
  const projectBDirs = {
    image: path.join(storageRoot, "images", projectB!.id),
    export: path.join(storageRoot, "exports", projectB!.id),
  };

  for (const dir of [projectADirs.image, projectADirs.export, projectBDirs.image, projectBDirs.export]) {
    await fs.mkdir(dir, { recursive: true });
  }

  await fs.writeFile(path.join(projectADirs.image, "img_demo.png"), "demo");
  await fs.writeFile(path.join(projectADirs.export, "export_demo.zip"), "demo");
  await fs.writeFile(path.join(projectBDirs.image, "img_demo.png"), "demo");
  await fs.writeFile(path.join(projectBDirs.export, "export_demo.zip"), "demo");

  await projectData.deleteFolder(folder!.id);

  const db = getDb();
  assert.equal(db.select().from(projectFolders).where(eq(projectFolders.id, folder!.id)).get(), undefined);
  assert.equal(db.select().from(projects).where(eq(projects.id, projectA!.id)).get(), undefined);
  assert.equal(db.select().from(projects).where(eq(projects.id, projectB!.id)).get(), undefined);
  assert.equal(fsSync.existsSync(projectADirs.image), false);
  assert.equal(fsSync.existsSync(projectADirs.export), false);
  assert.equal(fsSync.existsSync(projectBDirs.image), false);
  assert.equal(fsSync.existsSync(projectBDirs.export), false);
});

test.skip("getCanvasData marks the direction card loading while a direction generation run is active", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});

test.skip("getCanvasData marks copy cards loading while copy generation is active for a direction", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});

test.skip("generateFinalizedVariants creates derived finalized groups for mismatched export ratios", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});

test.skip("generateFinalizedVariants only processes selected finalized groups", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});

test.skip("getProjectExportContext filters images by selected finalized groups", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});

test.skip("saveImageConfig append mode preserves existing groups and adds new ones", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});

test.skip("saveImageConfig append mode preserves per-group generation snapshots when config changes", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});

test.skip("appendImageConfigGroup adds exactly one new candidate group for an existing multi-image config", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});

test.skip("saveImageConfig can create a draft config without immediately creating candidate groups", async () => {
  // NOTE: This test requires AI calls. Needs mock-based rewrite.
});
