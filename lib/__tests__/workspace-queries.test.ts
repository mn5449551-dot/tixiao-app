import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";

import {
  createProject,
  getCanvasData,
  getGenerationStatusData,
  getProjectTreeData,
  getWorkspaceHeader,
  saveImageConfig,
} from "../project-data";
import { getDb } from "../db";
import { copies, copyCards, directions, imageGroups, requirementCards } from "../schema";

function seedWorkspaceQueryFixture(imageForm: "single" | "double" = "single") {
  const db = getDb();
  const timestamp = Date.now();
  const suffix = `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;

  const project = createProject(`workspace-query-${suffix}`);
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
    imageForm,
    copyGenerationCount: 1,
    imageTextRelation: imageForm === "single" ? "单图直给" : "组图递进",
    sortOrder: 0,
    isSelected: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();
  db.insert(copyCards).values({
    id: `cc_${suffix}`,
    directionId: `dir_${suffix}`,
    channel: "应用商店",
    imageForm,
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
    titleSub: imageForm === "single" ? "副标题" : "第二句",
    titleExtra: null,
    copyType: imageForm === "single" ? "单图主副标题" : "双图因果",
    variantIndex: 1,
    isLocked: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  return {
    projectId: project!.id,
    copyId: `copy_${suffix}`,
  };
}

test("workspace query helpers return scoped payloads", async () => {
  const fixture = seedWorkspaceQueryFixture("single");
  const config = await saveImageConfig(fixture.copyId, {
    aspectRatio: "1:1",
    styleMode: "normal",
    logo: "none",
    imageStyle: "realistic",
    count: 1,
    createGroups: true,
  });

  assert.ok(config);

  const header = getWorkspaceHeader(fixture.projectId);
  const tree = getProjectTreeData(fixture.projectId);
  const status = getGenerationStatusData(fixture.projectId);

  assert.ok(header);
  assert.ok(tree);
  assert.ok(status);
  assert.equal("directions" in header, false);
  assert.equal(Array.isArray(tree.directions), true);
  assert.equal(Array.isArray(status.images), true);
});

test("canvas data keeps separate image-config branches available for candidate pool rendering", async () => {
  const db = getDb();
  const fixture = seedWorkspaceQueryFixture("double");

  const config = await saveImageConfig(fixture.copyId, {
    aspectRatio: "3:2",
    styleMode: "normal",
    logo: "none",
    imageStyle: "realistic",
    count: 2,
    createGroups: true,
  });

  assert.ok(config);
  const groups = db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, config.id)).all();
  assert.equal(groups.length, 2);

  const canvas = getCanvasData(fixture.projectId);
  assert.ok(canvas);
  const candidateNodes = canvas.nodes.filter((node) => node.type === "candidatePool");
  assert.equal(candidateNodes.length, 1);
  const candidateData = candidateNodes[0]?.data as { groups: Array<{ id: string }> };
  assert.equal(candidateData.groups.length, 2);
});
