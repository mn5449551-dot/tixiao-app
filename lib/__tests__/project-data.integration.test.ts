import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";

import { createSolidPlaceholder, saveImageBuffer } from "../storage";
import * as projectData from "../project-data";
import {
  appendCopyToCardSmart,
  appendDirectionSmart,
  appendImageConfigGroup,
  createFolder,
  createProject,
  deleteDirection,
  generateCopyCardSmart,
  generateDirectionsSmart,
  generateFinalizedVariants,
  getCanvasData,
  getProjectExportContext,
  saveImageConfig,
  upsertRequirement,
  } from "../project-data";
import { getDb } from "../db";
import { startGenerationRun } from "../generation-runs";
import { copies, copyCards, directions, generatedImages, imageConfigs, imageGroups, projectFolders, projects, requirementCards } from "../schema";
import { getStorageRoot } from "../storage";

// NOTE: generateDirections and generateCopyCard have been removed.
// Tests that use them are skipped pending mock-based rewrites.

function seedImageConfigFixture(options?: {
  imageForm?: "single" | "double" | "triple";
  channel?: string;
}): { projectId: string; copyId: string; directionId: string; timestamp: number } {
  const db = getDb();
  const timestamp = Date.now();
  const suffix = `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
  const imageForm = options?.imageForm ?? "single";
  const channel = options?.channel ?? "应用商店";

  db.insert(projects).values({
    id: `proj_${suffix}`,
    title: "Image Config Test",
    status: "active",
    folderId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();
  db.insert(requirementCards).values({
    id: `req_${suffix}`,
    projectId: `proj_${suffix}`,
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
    projectId: `proj_${suffix}`,
    requirementCardId: `req_${suffix}`,
    title: "方向测试",
    targetAudience: "家长",
    channel,
    imageForm,
    copyGenerationCount: 1,
    sortOrder: 0,
    isSelected: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();
  db.insert(copyCards).values({
    id: `cc_${suffix}`,
    directionId: `dir_${suffix}`,
    channel,
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
    titleExtra: imageForm === "triple" ? "第三句" : null,
    copyType: imageForm === "single" ? "单图主副标题" : imageForm === "double" ? "双图因果" : "三图递进",
    variantIndex: 1,
    isLocked: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  return {
    projectId: `proj_${suffix}`,
    copyId: `copy_${suffix}`,
    directionId: `dir_${suffix}`,
    timestamp,
  };
}

function seedDirectionOnlyFixture(options?: {
  imageForm?: "single" | "double" | "triple";
  channel?: string;
  feature?: string;
}): { projectId: string; directionId: string } {
  const db = getDb();
  const timestamp = Date.now();
  const suffix = `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
  const imageForm = options?.imageForm ?? "single";
  const channel = options?.channel ?? "应用商店";

  db.insert(projects).values({
    id: `proj_${suffix}`,
    title: "Direction Test",
    status: "active",
    folderId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();
  db.insert(requirementCards).values({
    id: `req_${suffix}`,
    projectId: `proj_${suffix}`,
    rawInput: null,
    businessGoal: "app",
    targetAudience: "parent",
    formatType: "image_text",
    feature: options?.feature ?? "拍题精学",
    sellingPoints: '["10秒出解析"]',
    timeNode: "期中考试",
    directionCount: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();
  db.insert(directions).values({
    id: `dir_${suffix}`,
    projectId: `proj_${suffix}`,
    requirementCardId: `req_${suffix}`,
    title: "已有方向",
    targetAudience: "家长",
    channel,
    imageForm,
    copyGenerationCount: 1,
    sortOrder: 0,
    isSelected: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  return {
    projectId: `proj_${suffix}`,
    directionId: `dir_${suffix}`,
  };
}

function createMockChatCompletionResponse(content: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: typeof content === "string" ? content : JSON.stringify(content),
          },
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

async function createMockImageGenerationResponse(input?: {
  width?: number;
  height?: number;
}): Promise<Response> {
  const buffer = await createSolidPlaceholder({
    text: "生成图",
    width: input?.width ?? 512,
    height: input?.height ?? 512,
  });

  return new Response(
    JSON.stringify({
      data: [{ b64_json: buffer.toString("base64") }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

test("saveImageConfig stores an IP asset data URL and img2img style in ip mode", async () => {
  const db = getDb();
  const fixture = seedImageConfigFixture({ imageForm: "single" });

  const config = await saveImageConfig(fixture.copyId, {
    aspectRatio: "1:1",
    styleMode: "ip",
    ipRole: "豆包",
    logo: "onion",
    imageStyle: "realistic",
    createGroups: false,
  });

  assert.ok(config);
  const stored = db.select().from(imageConfigs).where(eq(imageConfigs.copyId, fixture.copyId)).get();
  assert.ok(stored);
  assert.equal(stored.styleMode, "ip");
  assert.equal(stored.imageStyle, "animation");
  assert.equal(stored.ipRole, "豆包");
  assert.match(stored.referenceImageUrl ?? "", /^data:image\/png;base64,/);
});

test("saveImageConfig keeps IP mode valid without forcing an IP asset when no role is selected", async () => {
  const db = getDb();
  const fixture = seedImageConfigFixture({ imageForm: "single" });

  const config = await saveImageConfig(fixture.copyId, {
    aspectRatio: "1:1",
    styleMode: "ip",
    ipRole: null,
    logo: "onion",
    imageStyle: "realistic",
    createGroups: false,
  });

  assert.ok(config);
  const stored = db.select().from(imageConfigs).where(eq(imageConfigs.copyId, fixture.copyId)).get();
  assert.ok(stored);
  assert.equal(stored.styleMode, "ip");
  assert.equal(stored.imageStyle, "animation");
  assert.equal(stored.ipRole, null);
  assert.equal(stored.referenceImageUrl, null);
});

test("generateDirections uses user-authored requirement text instead of feature ids", async () => {
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.NEW_API_KEY;
  process.env.NEW_API_KEY = "test-key";

  const project = createProject(`direction-feature-${Date.now()}`);
  assert.ok(project);
  upsertRequirement(project!.id, {
    targetAudience: "parent",
    feature: "家长自定义功能文案",
    sellingPoints: ["10 秒出解析"],
    timeNode: "期中考试",
    directionCount: 1,
  });

  let requestBody = "";
  globalThis.fetch = (async (_input, init) => {
    requestBody = String(init?.body ?? "");
    return createMockChatCompletionResponse({
      ideas: [
        {
          title: "方向一",
          targetAudience: "家长",
          adaptationStage: "期中考试",
          scenarioProblem: "作业不会",
          differentiation: "快速拆题",
          effect: "继续学下去",
        },
      ],
    });
  }) as typeof fetch;

  try {
    const directionsCreated = await generateDirectionsSmart(project!.id, "应用商店", "single", 1);
    assert.equal(directionsCreated.length, 1);
    assert.match(requestBody, /家长自定义功能文案/);
  } finally {
    globalThis.fetch = previousFetch;
    process.env.NEW_API_KEY = previousApiKey;
  }
});

test("appendDirectionSmart preserves existing directions and appends one more", async () => {
  const db = getDb();
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.NEW_API_KEY;
  process.env.NEW_API_KEY = "test-key";

  const fixture = seedDirectionOnlyFixture({ imageForm: "single" });

  globalThis.fetch = (async () =>
    createMockChatCompletionResponse({
      ideas: [
        {
          title: "新增方向",
          targetAudience: "家长",
          adaptationStage: "期中考试",
          scenarioProblem: "孩子卡题",
          differentiation: "快速拆解思路",
          effect: "继续写下去",
        },
      ],
    })) as typeof fetch;

  try {
    const appended = await appendDirectionSmart(fixture.projectId, "应用商店", "single", 1);
    assert.ok(appended);

    const allDirections = db.select().from(directions).where(eq(directions.projectId, fixture.projectId)).all();
    assert.equal(allDirections.length, 2);
    assert.ok(allDirections.some((item) => item.title === "已有方向"));
    assert.ok(allDirections.some((item) => item.title === "新增方向"));
  } finally {
    globalThis.fetch = previousFetch;
    process.env.NEW_API_KEY = previousApiKey;
  }
});

test("deleteDirection rejects directions that already have downstream copy cards", async () => {
  const fixture = seedImageConfigFixture({ imageForm: "single" });

  await assert.rejects(
    () => deleteDirection(fixture.directionId),
    /已有下游内容，不能删除/,
  );
});

test("appendCopyToCardSmart appends a new copy into the existing copy card", async () => {
  const db = getDb();
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.NEW_API_KEY;
  process.env.NEW_API_KEY = "test-key";

  const fixture = seedImageConfigFixture({ imageForm: "double" });
  const copyCard = db.select().from(copyCards).where(eq(copyCards.directionId, fixture.directionId)).get();
  assert.ok(copyCard);

  globalThis.fetch = (async () =>
    createMockChatCompletionResponse({
      copies: [
        {
          titleMain: "追加第一句",
          titleSub: "追加第二句",
          titleExtra: null,
          copyType: "因果",
        },
      ],
    })) as typeof fetch;

  try {
    const appended = await appendCopyToCardSmart(copyCard.id);
    assert.ok(appended);
    assert.equal(appended.id, copyCard.id);
    assert.equal(appended.copies.length, 2);
    assert.equal(appended.copies[1]?.variantIndex, 2);
  } finally {
    globalThis.fetch = previousFetch;
    process.env.NEW_API_KEY = previousApiKey;
  }
});

test("generateCopyCardSmart returns the full requested number of copies for one direction card", async () => {
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.NEW_API_KEY;
  process.env.NEW_API_KEY = "test-key";

  const fixture = seedDirectionOnlyFixture({ imageForm: "double" });

  globalThis.fetch = (async () =>
    createMockChatCompletionResponse({
      copies: [
        { titleMain: "卡题别慌", titleSub: "一拍就懂", titleExtra: null, copyType: "因果" },
        { titleMain: "看懂难题", titleSub: "继续写题", titleExtra: null, copyType: "递进" },
        { titleMain: "步骤拆清", titleSub: "思路学会", titleExtra: null, copyType: "并列" },
      ],
    })) as typeof fetch;

  try {
    const card = await generateCopyCardSmart(fixture.directionId, 3);
    assert.ok(card);
    assert.equal(card.copies.length, 3);
  } finally {
    globalThis.fetch = previousFetch;
    process.env.NEW_API_KEY = previousApiKey;
  }
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

test("getCanvasData marks the direction card loading while a direction generation run is active", async () => {
  const fixture = seedImageConfigFixture({ imageForm: "single" });

  startGenerationRun({
    projectId: fixture.projectId,
    kind: "direction",
    resourceType: "project-directions",
    resourceId: fixture.projectId,
  });

  const canvas = getCanvasData(fixture.projectId);
  assert.ok(canvas);
  const directionNode = canvas.nodes.find((node) => node.type === "directionCard");
  assert.ok(directionNode);
  assert.equal((directionNode.data as { status?: string }).status, "loading");
});

test("getCanvasData marks copy cards loading while copy generation is active for a direction", async () => {
  const fixture = seedImageConfigFixture({ imageForm: "single" });

  startGenerationRun({
    projectId: fixture.projectId,
    kind: "copy",
    resourceType: "direction-copy-cards",
    resourceId: fixture.directionId,
  });

  const canvas = getCanvasData(fixture.projectId);
  assert.ok(canvas);
  const copyNode = canvas.nodes.find((node) => node.type === "copyCard");
  assert.ok(copyNode);
  assert.equal((copyNode.data as { status?: string }).status, "loading");
});

test("generateFinalizedVariants creates derived finalized groups for mismatched export ratios", async () => {
  const db = getDb();
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.NEW_API_KEY;
  process.env.NEW_API_KEY = "test-key";

  const fixture = seedImageConfigFixture({ imageForm: "single" });
  const config = await saveImageConfig(fixture.copyId, {
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
  const sourceBuffer = await createSolidPlaceholder({
    text: "原图",
    width: 768,
    height: 512,
  });
  const saved = await saveImageBuffer({
    projectId: fixture.projectId,
    imageId: image.id,
    buffer: sourceBuffer,
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

  globalThis.fetch = (async () => createMockImageGenerationResponse({ width: 1600, height: 900 })) as typeof fetch;

  try {
    const result = await generateFinalizedVariants(fixture.projectId, {
      targetGroupIds: [group.id],
      targetChannels: ["OPPO"],
      targetSlots: ["富媒体-横版大图"],
      imageModel: "doubao-seedream-4-0",
    });

    assert.equal(result.groups.length, 1);
    const derivedGroup = result.groups[0];
    assert.ok(derivedGroup);
    assert.match(derivedGroup.groupType, /^derived\|/);
    const derivedImages = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, derivedGroup.id)).all();
    assert.equal(derivedImages.length, 1);
    assert.equal(derivedImages[0]?.status, "done");
    assert.ok(derivedImages[0]?.filePath);
    assert.ok(derivedImages.every((item) => item.generationRequestJson));
    assert.ok(derivedImages.every((item) => item.inpaintParentId));
    assert.equal(derivedImages[0]?.actualWidth, 1600);
    assert.equal(derivedImages[0]?.actualHeight, 900);
  } finally {
    globalThis.fetch = previousFetch;
    process.env.NEW_API_KEY = previousApiKey;
  }
});

test("generateFinalizedVariants uses the finalized source group's real aspect ratio instead of the mutable config ratio", async () => {
  const db = getDb();
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.NEW_API_KEY;
  process.env.NEW_API_KEY = "test-key";

  const fixture = seedImageConfigFixture({ imageForm: "single" });
  const config = await saveImageConfig(fixture.copyId, {
    aspectRatio: "16:9",
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
  const saved = await saveImageBuffer({
    projectId: fixture.projectId,
    imageId: image.id,
    buffer: await createSolidPlaceholder({ text: "16:9 原图", width: 768, height: 432 }),
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

  // Simulate the mutable image-config ratio drifting after this finalized source image was produced.
  db.update(imageConfigs)
    .set({ aspectRatio: "9:16", updatedAt: Date.now() })
    .where(eq(imageConfigs.id, config.id))
    .run();

  globalThis.fetch = (async () => createMockImageGenerationResponse({ width: 900, height: 1600 })) as typeof fetch;

  try {
    const result = await generateFinalizedVariants(fixture.projectId, {
      sourceGroupId: group.id,
      targetChannel: "OPPO",
      slotNames: ["富媒体-横版两图"],
      imageModel: "doubao-seedream-4-0",
    });

    assert.equal(result.groups.length, 1);
    assert.ok(result.groups[0]);
    assert.equal(result.groups[0]!.aspectRatio, "9:16");
  } finally {
    globalThis.fetch = previousFetch;
    process.env.NEW_API_KEY = previousApiKey;
  }
});

test("generateFinalizedVariants fails when the generated image's real dimensions do not match the target ratio", async () => {
  const db = getDb();
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.NEW_API_KEY;
  process.env.NEW_API_KEY = "test-key";

  const fixture = seedImageConfigFixture({ imageForm: "single" });
  const config = await saveImageConfig(fixture.copyId, {
    aspectRatio: "16:9",
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
  const saved = await saveImageBuffer({
    projectId: fixture.projectId,
    imageId: image.id,
    buffer: await createSolidPlaceholder({ text: "16:9 原图", width: 768, height: 432 }),
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

  globalThis.fetch = (async () => createMockImageGenerationResponse({ width: 512, height: 768 })) as typeof fetch;

  try {
    const result = await generateFinalizedVariants(fixture.projectId, {
      sourceGroupId: group.id,
      targetChannel: "OPPO",
      slotNames: ["富媒体-横版两图"],
      imageModel: "doubao-seedream-4-0",
    });

    assert.equal(result.groups.length, 0);
    const failedDerivedImages = db.select().from(generatedImages).where(eq(generatedImages.inpaintParentId, image.id)).all();
    assert.ok(failedDerivedImages.length > 0);
    assert.equal(failedDerivedImages[0]?.status, "failed");
    assert.match(failedDerivedImages[0]?.errorMessage ?? "", /实际比例|目标比例/);
    assert.equal(failedDerivedImages[0]?.actualWidth, 512);
    assert.equal(failedDerivedImages[0]?.actualHeight, 768);
  } finally {
    globalThis.fetch = previousFetch;
    process.env.NEW_API_KEY = previousApiKey;
  }
});

test("generateFinalizedVariants only processes selected finalized groups", async () => {
  const db = getDb();
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.NEW_API_KEY;
  process.env.NEW_API_KEY = "test-key";

  const fixture = seedImageConfigFixture({ imageForm: "single" });
  const config = await saveImageConfig(fixture.copyId, {
    aspectRatio: "3:2",
    styleMode: "normal",
    logo: "none",
    imageStyle: "realistic",
    count: 2,
    createGroups: true,
  });

  assert.ok(config);
  assert.equal(config.groups.length, 2);

  globalThis.fetch = (async () => createMockImageGenerationResponse({ width: 1600, height: 900 })) as typeof fetch;

  try {
    for (const group of config.groups) {
      db.update(imageGroups).set({ isConfirmed: 1 }).where(eq(imageGroups.id, group.id)).run();
      const [image] = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
      assert.ok(image);
      const saved = await saveImageBuffer({
        projectId: fixture.projectId,
        imageId: image.id,
        buffer: await createSolidPlaceholder({ text: group.id, width: 768, height: 512 }),
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
    }

    const selectedGroup = config.groups[0];
    assert.ok(selectedGroup);
    const result = await generateFinalizedVariants(fixture.projectId, {
      targetGroupIds: [selectedGroup.id],
      targetChannels: ["OPPO"],
      targetSlots: ["富媒体-横版大图"],
      imageModel: "doubao-seedream-4-0",
    });

    assert.equal(result.groups.length, 1);
    assert.match(result.groups[0]?.groupType ?? "", new RegExp(`^derived\\|${selectedGroup.id}\\|16:9$`));
  } finally {
    globalThis.fetch = previousFetch;
    process.env.NEW_API_KEY = previousApiKey;
  }
});

test("getProjectExportContext filters images by selected finalized groups", async () => {
  const db = getDb();
  const fixture = seedImageConfigFixture({ imageForm: "double" });

  const config = await saveImageConfig(fixture.copyId, {
    aspectRatio: "3:2",
    styleMode: "normal",
    logo: "none",
    imageStyle: "realistic",
    count: 2,
    createGroups: true,
  });

  assert.ok(config);
  assert.equal(config.groups.length, 2);

  const [groupA, groupB] = config.groups;
  assert.ok(groupA && groupB);

  db.update(imageGroups).set({ isConfirmed: 1 }).where(eq(imageGroups.id, groupA.id)).run();
  db.update(imageGroups).set({ isConfirmed: 1 }).where(eq(imageGroups.id, groupB.id)).run();

  const [imageA] = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, groupA.id)).all();
  const [imageB] = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, groupB.id)).all();
  assert.ok(imageA && imageB);

  const placeholder = await createSolidPlaceholder({
    text: "测试图",
    width: 512,
    height: 512,
  });
  const savedA = await saveImageBuffer({
    projectId: fixture.projectId,
    imageId: imageA.id,
    buffer: placeholder,
    extension: "png",
  });
  const savedB = await saveImageBuffer({
    projectId: fixture.projectId,
    imageId: imageB.id,
    buffer: placeholder,
    extension: "png",
  });

  db.update(generatedImages)
    .set({
      filePath: savedA.filePath,
      fileUrl: savedA.fileUrl,
      thumbnailPath: savedA.thumbnailPath,
      thumbnailUrl: savedA.thumbnailUrl,
      status: "done",
      updatedAt: Date.now(),
    })
    .where(eq(generatedImages.id, imageA.id))
    .run();
  db.update(generatedImages)
    .set({
      filePath: savedB.filePath,
      fileUrl: savedB.fileUrl,
      thumbnailPath: savedB.thumbnailPath,
      thumbnailUrl: savedB.thumbnailUrl,
      status: "done",
      updatedAt: Date.now(),
    })
    .where(eq(generatedImages.id, imageB.id))
    .run();

  const exportContext = getProjectExportContext(fixture.projectId, {
    targetGroupIds: [groupA.id],
  });

  assert.ok(exportContext);
  assert.equal(exportContext.images.length, 1);
  assert.equal(exportContext.images[0]?.imageGroupId, groupA.id);
});

test("saveImageConfig append mode preserves existing groups and adds new ones", async () => {
  const db = getDb();
  const fixture = seedImageConfigFixture({ imageForm: "double" });

  const initialConfig = await saveImageConfig(fixture.copyId, {
    aspectRatio: "3:2",
    styleMode: "normal",
    logo: "none",
    imageStyle: "realistic",
    count: 2,
    createGroups: true,
  });

  assert.ok(initialConfig);
  assert.equal(initialConfig.createdGroups.length, 2);
  assert.equal(initialConfig.groups.length, 2);

  const appendedConfig = await saveImageConfig(fixture.copyId, {
    append: true,
    count: 1,
    createGroups: true,
  });

  assert.ok(appendedConfig);
  assert.equal(appendedConfig.createdGroups.length, 1);
  assert.equal(appendedConfig.groups.length, 3);
  assert.deepEqual(
    appendedConfig.groups.map((group) => group.variantIndex),
    [1, 2, 3],
  );

  const groupsInDb = db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, initialConfig.id)).all();
  assert.equal(groupsInDb.length, 3);
});

test("saveImageConfig append mode preserves per-group generation snapshots when config changes", async () => {
  const db = getDb();
  const fixture = seedImageConfigFixture({ imageForm: "double" });

  const initialConfig = await saveImageConfig(fixture.copyId, {
    aspectRatio: "3:2",
    styleMode: "normal",
    logo: "onion",
    imageStyle: "realistic",
    count: 1,
    createGroups: true,
  });

  assert.ok(initialConfig);
  const originalGroup = initialConfig.groups[0];
  assert.ok(originalGroup);

  db.update(imageGroups)
    .set({
      promptBundleJson: '{"prompts":[{"slotIndex":1}]}',
      referenceImageUrl: "https://example.com/reference.png",
      logo: "onion_app",
    })
    .where(eq(imageGroups.id, originalGroup.id))
    .run();

  const nextConfig = await saveImageConfig(fixture.copyId, {
    append: true,
    count: 1,
    aspectRatio: "1:1",
    createGroups: true,
  });

  assert.ok(nextConfig);
  const preservedGroup = db.select().from(imageGroups).where(eq(imageGroups.id, originalGroup.id)).get();
  assert.ok(preservedGroup);
  assert.equal(preservedGroup.promptBundleJson, '{"prompts":[{"slotIndex":1}]}');
  assert.equal(preservedGroup.referenceImageUrl, "https://example.com/reference.png");
  assert.equal(preservedGroup.logo, "onion_app");
});

test("appendImageConfigGroup adds exactly one new candidate group for an existing multi-image config", async () => {
  const db = getDb();
  const fixture = seedImageConfigFixture({ imageForm: "double" });

  const initialConfig = await saveImageConfig(fixture.copyId, {
    aspectRatio: "3:2",
    styleMode: "normal",
    logo: "none",
    imageStyle: "realistic",
    count: 1,
    createGroups: true,
  });

  assert.ok(initialConfig);
  assert.equal(initialConfig.groups.length, 1);

  const appended = await appendImageConfigGroup(initialConfig.id);
  assert.ok(appended.group);
  assert.equal(appended.groups.length, 2);
  assert.equal(appended.group?.variantIndex, 2);

  const appendedImages = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, appended.group!.id)).all();
  assert.equal(appendedImages.length, 2);
});

test("saveImageConfig can create a draft config without immediately creating candidate groups", async () => {
  const db = getDb();
  const fixture = seedImageConfigFixture({ imageForm: "single" });

  const config = await saveImageConfig(fixture.copyId, {
    aspectRatio: "1:1",
    styleMode: "normal",
    logo: "none",
    imageStyle: "realistic",
    createGroups: false,
  });

  assert.ok(config);
  assert.equal(config.createdGroups.length, 0);
  assert.equal(config.groups.length, 0);

  const storedConfig = db.select().from(imageConfigs).where(eq(imageConfigs.copyId, fixture.copyId)).get();
  assert.ok(storedConfig);
  const groups = db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, storedConfig.id)).all();
  assert.equal(groups.length, 0);
});

test("saveImageConfig clears ipRole and referenceImageUrl when switching to normal mode", async () => {
  const db = getDb();
  const timestamp = Date.now();
  const suffix = `ip-clear-${timestamp}`;

  db.insert(projects).values({
    id: `proj_${suffix}`, title: "IP Test", status: "active",
    folderId: null, createdAt: timestamp, updatedAt: timestamp,
  }).run();
  db.insert(requirementCards).values({
    id: `req_${suffix}`, projectId: `proj_${suffix}`, rawInput: null,
    businessGoal: "app", targetAudience: "parent", formatType: "image_text",
    feature: "拍题精学", sellingPoints: '["10秒出解析"]', timeNode: "期中考试",
    directionCount: 1, createdAt: timestamp, updatedAt: timestamp,
  }).run();
  db.insert(directions).values({
    id: `dir_${suffix}`, projectId: `proj_${suffix}`, requirementCardId: `req_${suffix}`,
    title: "方向IP", targetAudience: "家长", channel: "信息流（广点通）",
    imageForm: "single", copyGenerationCount: 1,
    sortOrder: 0, isSelected: 1, createdAt: timestamp, updatedAt: timestamp,
  }).run();
  db.insert(copyCards).values({
    id: `cc_${suffix}`, directionId: `dir_${suffix}`, channel: "信息流（广点通）",
    imageForm: "single", version: 1, sourceReason: "initial",
    createdAt: timestamp, updatedAt: timestamp,
  }).run();
  db.insert(copies).values({
    id: `copy_${suffix}`, copyCardId: `cc_${suffix}`, directionId: `dir_${suffix}`,
    titleMain: "主标题", titleSub: "副标题", copyType: "单图主副标题",
    variantIndex: 1, isLocked: 0, createdAt: timestamp, updatedAt: timestamp,
  }).run();

  // 1. 先保存为 IP 模式
  await saveImageConfig(`copy_${suffix}`, {
    aspectRatio: "1:1",
    styleMode: "ip",
    ipRole: "豆包",
    logo: "onion",
    imageStyle: "realistic",
    createGroups: false,
  });

  const ipConfig = db.select().from(imageConfigs)
    .where(eq(imageConfigs.copyId, `copy_${suffix}`)).get();
  assert.ok(ipConfig);
  assert.equal(ipConfig.styleMode, "ip");
  assert.equal(ipConfig.ipRole, "豆包");

  // 2. 切换回普通模式
  await saveImageConfig(`copy_${suffix}`, {
    styleMode: "normal",
    createGroups: false,
  });

  const normalConfig = db.select().from(imageConfigs)
    .where(eq(imageConfigs.copyId, `copy_${suffix}`)).get();
  assert.ok(normalConfig);
  assert.equal(normalConfig.styleMode, "normal");
  assert.equal(normalConfig.ipRole, null);
  assert.equal(normalConfig.referenceImageUrl, null);
});
