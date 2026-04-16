import test from "node:test";
import assert from "node:assert/strict";

import { eq } from "drizzle-orm";

import * as exportRouteModule from "../../app/api/projects/[id]/export/route";
import { createProject, saveImageConfig } from "../project-data";
import { getDb } from "../db";
import { createSolidPlaceholder, saveImageBuffer } from "../storage";
import { copies, copyCards, directions, exportRecords, generatedImages, imageGroups, requirementCards } from "../schema";

const { POST } = exportRouteModule;

test("export route returns a zip response for a project with confirmed finalized images", async () => {
  const db = getDb();
  const timestamp = Date.now();
  const suffix = `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
  const project = createProject(`export-route-${suffix}`);
  assert.ok(project);

  db.insert(requirementCards).values({
    id: `req_${suffix}`,
    projectId: project!.id,
    rawInput: null,
    businessGoal: "app",
    targetAudience: "parent",
    formatType: "image_text",
    feature: "拍题精学",
    sellingPoints: '["10秒出解析"]',
    timeNode: "期中考试",
    directionCount: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();
  db.insert(directions).values({
    id: `dir_${suffix}`,
    projectId: project!.id,
    requirementCardId: `req_${suffix}`,
    title: "方向测试",
    targetAudience: "家长",
    channel: "应用商店",
    imageForm: "single",
    copyGenerationCount: 1,
    imageTextRelation: "单图直给",
    sortOrder: 0,
    isSelected: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();
  db.insert(copyCards).values({
    id: `cc_${suffix}`,
    directionId: `dir_${suffix}`,
    channel: "应用商店",
    imageForm: "single",
    version: 1,
    sourceReason: "initial",
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();
  db.insert(copies).values({
    id: `copy_${suffix}`,
    copyCardId: `cc_${suffix}`,
    directionId: `dir_${suffix}`,
    titleMain: "主标题",
    titleSub: "副标题",
    titleExtra: null,
    copyType: "单图主副标题",
    variantIndex: 1,
    isLocked: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  const config = await saveImageConfig(`copy_${suffix}`, {
    aspectRatio: "3:2",
    styleMode: "normal",
    logo: "none",
    imageStyle: "realistic",
    count: 1,
    createGroups: true,
  });
  assert.ok(config);

  const [group] = config.groups;
  assert.ok(group);
  db.update(imageGroups).set({ isConfirmed: 1 }).where(eq(imageGroups.id, group.id)).run();

  const [image] = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
  assert.ok(image);

  const buffer = await createSolidPlaceholder({ text: "导出图", width: 768, height: 512 });
  const saved = await saveImageBuffer({
    projectId: project!.id,
    imageId: image.id,
    buffer,
    extension: "png",
  });
  db.update(generatedImages)
    .set({
      filePath: saved.filePath,
      fileUrl: saved.fileUrl,
      thumbnailPath: saved.thumbnailPath,
      thumbnailUrl: saved.thumbnailUrl,
      status: "done",
      updatedAt: Date.now(),
    })
    .where(eq(generatedImages.id, image.id))
    .run();

  const response = await POST(
    new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_group_ids: [group.id],
        target_channels: ["VIVO"],
        target_slots: ["搜索富媒体-三图"],
        logo: "none",
        file_format: "png",
      }),
    }),
    { params: Promise.resolve({ id: project!.id }) },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/zip/);
  const records = db.select().from(exportRecords).where(eq(exportRecords.projectId, project!.id)).all();
  assert.equal(records.length, 1);
});
