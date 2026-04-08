import test from "node:test";
import assert from "node:assert/strict";

import {
  createProject,
  generateCopyCard,
  generateDirections,
  getCanvasData,
  getGenerationStatusData,
  getProjectTreeData,
  getWorkspaceHeader,
  saveImageConfig,
  upsertRequirement,
} from "../project-data";

test("workspace query helpers return scoped payloads", async () => {
  const project = createProject(`workspace-queries-${Date.now()}`);
  assert.ok(project);

  upsertRequirement(project!.id, {
    targetAudience: "parent",
    feature: "拍题精学",
    sellingPoints: ["10 秒出解析"],
    timeNode: "期中考试",
    directionCount: 1,
  });

  const [direction] = generateDirections(project!.id, "应用商店", "single", 1);
  assert.ok(direction);

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

  const header = getWorkspaceHeader(project!.id);
  const tree = getProjectTreeData(project!.id);
  const canvas = getCanvasData(project!.id);
  const status = getGenerationStatusData(project!.id);

  assert.deepEqual(header, {
    project: {
      id: project!.id,
      title: project!.title,
      status: "active",
    },
  });

  assert.ok(tree);
  assert.equal(tree?.project.id, project!.id);
  assert.equal(tree?.directions.length, 1);
  assert.equal(tree?.directions[0]?.copyCards[0]?.copies[0]?.imageConfigId, config?.id);

  assert.ok(canvas);
  assert.ok(canvas!.nodes.length > 0);
  assert.ok(canvas!.edges.length > 0);

  assert.ok(status);
  assert.equal(status?.projectId, project!.id);
  assert.ok(status!.images.some((image) => image.imageConfigId === config?.id));
});
