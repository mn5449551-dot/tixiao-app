import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { eq } from "drizzle-orm";

import { createSolidPlaceholder, saveImageBuffer } from "../storage";
import {
  appendDirectionSmart,
  createProject,
  generateFinalizedVariants,
  generateCopyCard,
  generateDirections,
  getProjectById,
  regenerateCopy,
  saveImageConfig,
  upsertRequirement,
} from "../project-data";
import { getDb } from "../db";
import { copies, directions, generatedImages, imageConfigs, imageGroups } from "../schema";

test("regenerateCopy replaces copy text and clears downstream generated assets", async () => {
  const project = createProject(`regenerate-copy-${Date.now()}`);
  assert.ok(project);

  upsertRequirement(project!.id, {
    targetAudience: "parent",
    feature: "F001",
    sellingPoints: ["F001-S01"],
    timeNode: "期中考试",
    directionCount: 1,
  });

  const [direction] = generateDirections(project!.id, "信息流（广点通）", "single", 3);
  const card = generateCopyCard(direction.id, 1);
  const copy = card?.copies[0];

  assert.ok(copy);

  const oldTitleMain = copy!.titleMain;
  const config = await saveImageConfig(copy!.id, {
    aspectRatio: "1:1",
    styleMode: "normal",
    logo: "none",
    imageStyle: "realistic",
    count: 1,
  });

  assert.ok(config);

  const db = getDb();
  const group = db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, config!.id)).get();
  const image = db.select().from(generatedImages).where(eq(generatedImages.imageConfigId, config!.id)).get();

  assert.ok(group);
  assert.ok(image);

  const placeholder = await createSolidPlaceholder({
    text: "old image",
    width: 240,
    height: 240,
  });
  const saved = await saveImageBuffer({
    projectId: project!.id,
    imageId: image!.id,
    buffer: placeholder,
    extension: "png",
  });

  db.update(generatedImages)
    .set({
      filePath: saved.filePath,
      fileUrl: saved.fileUrl,
      status: "done",
      updatedAt: Date.now(),
    })
    .where(eq(generatedImages.id, image!.id))
    .run();

  const regenerated = await regenerateCopy(copy!.id, false);

  assert.ok(regenerated);
  assert.equal(regenerated?.id, copy!.id);
  assert.notEqual(regenerated?.titleMain, oldTitleMain);
  assert.equal(regenerated?.isLocked, 0);

  const nextCopy = db.select().from(copies).where(eq(copies.id, copy!.id)).get();
  const nextConfig = db.select().from(imageConfigs).where(eq(imageConfigs.copyId, copy!.id)).get();
  const nextImages = db.select().from(generatedImages).where(eq(generatedImages.imageConfigId, config!.id)).all();

  assert.ok(nextCopy);
  assert.equal(nextCopy?.isLocked, 0);
  assert.equal(nextConfig, undefined);
  assert.equal(nextImages.length, 0);
  await assert.rejects(() => fs.access(saved.filePath));

  const persistedProject = getProjectById(project!.id);
  assert.equal(persistedProject?.id, project!.id);
});

test("saveImageConfig stores an IP asset data URL and img2img style in ip mode", async () => {
  const project = createProject(`ip-config-${Date.now()}`);
  assert.ok(project);

  upsertRequirement(project!.id, {
    targetAudience: "parent",
    feature: "F001",
    sellingPoints: ["F001-S01"],
    timeNode: "期中考试",
    directionCount: 1,
  });

  const [direction] = generateDirections(project!.id, "信息流（广点通）", "single", 3);
  const card = generateCopyCard(direction.id, 1);
  const copy = card?.copies[0];

  assert.ok(copy);

  const config = await saveImageConfig(copy!.id, {
    styleMode: "ip",
    ipRole: "豆包",
    imageStyle: "realistic",
    count: 1,
    logo: "onion",
  });

  assert.ok(config);
  assert.equal(config?.styleMode, "ip");
  assert.equal(config?.imageStyle, "animation");
  assert.equal(config?.ipRole, "豆包");
  assert.match(config?.referenceImageUrl ?? "", /^data:image\/png;base64,/);
});

test("saveImageConfig keeps IP mode valid without forcing an IP asset when no role is selected", async () => {
  const project = createProject(`ip-config-no-role-${Date.now()}`);
  assert.ok(project);

  upsertRequirement(project!.id, {
    targetAudience: "parent",
    feature: "F001",
    sellingPoints: ["F001-S01"],
    timeNode: "期中考试",
    directionCount: 1,
  });

  const [direction] = generateDirections(project!.id, "信息流（广点通）", "single", 3);
  const card = generateCopyCard(direction.id, 1);
  const copy = card?.copies[0];

  assert.ok(copy);

  const config = await saveImageConfig(copy!.id, {
    styleMode: "ip",
    ipRole: null,
    imageStyle: "realistic",
    count: 1,
    logo: "onion",
  });

  assert.ok(config);
  assert.equal(config?.styleMode, "ip");
  assert.equal(config?.ipRole, null);
  assert.equal(config?.imageStyle, "animation");
  assert.equal(config?.referenceImageUrl, null);
});

test("generateDirections uses user-authored requirement text instead of feature ids", () => {
  const project = createProject(`text-feature-${Date.now()}`);
  assert.ok(project);

  upsertRequirement(project!.id, {
    targetAudience: "parent",
    feature: "拍题精学",
    sellingPoints: ["10 秒出解析", "像老师边写边讲"],
    timeNode: "期中考试",
    directionCount: 1,
  });

  const [direction] = generateDirections(project!.id, "应用商店", "double", 3);

  assert.ok(direction);
  assert.match(direction.title, /拍题精学/);
});

test("appendDirectionSmart preserves existing directions and appends one more", async () => {
  const project = createProject(`append-direction-${Date.now()}`);
  assert.ok(project);

  upsertRequirement(project!.id, {
    targetAudience: "parent",
    feature: "拍题精学",
    sellingPoints: ["10 秒出解析"],
    timeNode: "期中考试",
    directionCount: 2,
  });

  const initial = generateDirections(project!.id, "应用商店", "double", 3);
  assert.equal(initial.length, 2);

  const appended = await appendDirectionSmart(project!.id, "应用商店", "double", 3, false);

  assert.ok(appended);
  assert.equal(appended?.sortOrder, 2);

  const db = getDb();
  const rows = db.select().from(directions).all();
  const projectRows = rows.filter((item) => item.projectId === project!.id);
  assert.equal(projectRows.length, 3);
});

test("generateFinalizedVariants creates derived finalized groups for mismatched export ratios", async () => {
  const project = createProject(`finalized-variants-${Date.now()}`);
  assert.ok(project);

  upsertRequirement(project!.id, {
    targetAudience: "parent",
    feature: "拍题精学",
    sellingPoints: ["10 秒出解析"],
    timeNode: "期中考试",
    directionCount: 1,
  });

  const [direction] = generateDirections(project!.id, "应用商店", "single", 1);
  const card = generateCopyCard(direction.id, 1);
  const copy = card?.copies[0];
  assert.ok(copy);

  const config = await saveImageConfig(copy!.id, {
    aspectRatio: "1:1",
    styleMode: "normal",
    logo: "none",
    imageStyle: "realistic",
    count: 1,
  });
  assert.ok(config);

  const db = getDb();
  const group = db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, config!.id)).get();
  const image = db.select().from(generatedImages).where(eq(generatedImages.imageConfigId, config!.id)).get();
  assert.ok(group);
  assert.ok(image);

  const placeholder = await createSolidPlaceholder({
    text: "variant source",
    width: 640,
    height: 640,
  });
  const saved = await saveImageBuffer({
    projectId: project!.id,
    imageId: image!.id,
    buffer: placeholder,
    extension: "png",
  });

  db.update(generatedImages)
    .set({
      filePath: saved.filePath,
      fileUrl: saved.fileUrl,
      status: "done",
      updatedAt: Date.now(),
    })
    .where(eq(generatedImages.id, image!.id))
    .run();

  db.update(imageGroups)
    .set({ isConfirmed: 1, groupType: "finalized", updatedAt: Date.now() })
    .where(eq(imageGroups.id, group!.id))
    .run();

  const created = await generateFinalizedVariants(project!.id, {
    targetChannels: ["OPPO"],
    targetSlots: ["富媒体-横版大图"],
  });

  assert.equal(created.length, 1);
  assert.match(created[0].groupType, /^derived\|/);
  assert.equal(created[0].isConfirmed, 1);

  const derivedImages = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, created[0].id)).all();
  assert.equal(derivedImages.length, 1);
  assert.ok(derivedImages[0].filePath);
});

test("saveImageConfig append mode preserves existing groups and adds new ones", async () => {
  const project = createProject(`append-groups-${Date.now()}`);
  assert.ok(project);

  upsertRequirement(project!.id, {
    targetAudience: "parent",
    feature: "拍题精学",
    sellingPoints: ["10 秒出解析"],
    timeNode: "期中考试",
    directionCount: 1,
  });

  const [direction] = generateDirections(project!.id, "应用商店", "double", 1);
  const card = generateCopyCard(direction.id, 1);
  const copy = card?.copies[0];
  assert.ok(copy);

  const first = await saveImageConfig(copy!.id, {
    aspectRatio: "3:2",
    styleMode: "normal",
    logo: "none",
    imageStyle: "realistic",
    count: 1,
  });
  assert.ok(first);

  const db = getDb();
  const firstGroups = db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, first!.id)).all();
  assert.equal(firstGroups.length, 1);

  const second = await saveImageConfig(copy!.id, {
    count: 1,
    append: true,
  });
  assert.ok(second);

  const allGroups = db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, second!.id)).all();
  assert.equal(allGroups.length, 2);
});
