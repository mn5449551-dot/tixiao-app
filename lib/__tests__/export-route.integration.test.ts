import test from "node:test";
import assert from "node:assert/strict";

import { eq } from "drizzle-orm";

import * as exportRouteModule from "../../app/api/projects/[id]/export/route";
import { createProject, generateDirections, generateCopyCard, saveImageConfig, upsertRequirement } from "../project-data";
import { getDb } from "../db";
import { createSolidPlaceholder, saveImageBuffer } from "../storage";
import { directions, imageConfigs, imageGroups, generatedImages, exportRecords } from "../schema";

const { POST } = exportRouteModule;

test("export route returns a zip response for a project with confirmed finalized images", async () => {
  const project = createProject(`export-route-${Date.now()}`);
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
    aspectRatio: "16:9",
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
    text: "export",
    width: 1280,
    height: 720,
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

  const response = await POST(
    new Request(`http://localhost/api/projects/${project!.id}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_channels: ["OPPO"],
        target_slots: ["富媒体-横版大图"],
        file_format: "jpg",
        naming_rule: "channel_slot_date_version",
      }),
    }),
    { params: Promise.resolve({ id: project!.id }) },
  );

  const errorText = response.status === 200 ? "" : await response.text();
  assert.equal(response.status, 200, errorText);
  assert.equal(response.headers.get("content-type"), "application/zip");

  const records = db.select().from(exportRecords).where(eq(exportRecords.projectId, project!.id)).all();
  assert.equal(records.length, 1);
});
