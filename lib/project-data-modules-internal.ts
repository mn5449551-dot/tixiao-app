import { desc, eq, inArray, sql } from "drizzle-orm";
import sharp from "sharp";
import { readFile } from "node:fs/promises";

import { generateCopyIdeas } from "@/lib/ai/agents/copy-agent";
import { generateImageFromReference } from "@/lib/ai/image-chat";
import { buildCopyKnowledgeContext } from "@/lib/ai/agents/copy-knowledge";
import { generateDirectionIdeas } from "@/lib/ai/agents/direction-agent";
import { logAgentError } from "@/lib/ai/agent-error-log";
import {
  CHANNELS,
  DEFAULT_REQUIREMENT,
  FEATURE_LIBRARY,
  IMAGE_MODELS,
  IMAGE_STYLES,
  IP_ROLES,
  LOGO_OPTIONS,
} from "@/lib/constants";
import { getDb, type DbOrTx } from "@/lib/db";
import { classifyExportAdaptation, isSpecialRatio, resolveExportSlotSpecs } from "@/lib/export/utils";
import { createId } from "@/lib/id";
import { resolveReferenceImageUrl } from "@/lib/ip-assets";
import {
  copies,
  copyCards,
  directions,
  generatedImages,
  imageConfigs,
  imageGroups,
  projectFolders,
  projects,
  projectGenerationRuns,
  requirementCards,
} from "@/lib/schema";
import { fromJson, toJson } from "@/lib/utils";
import { deleteFileIfExists, deleteProjectFiles, saveImageBuffer } from "@/lib/storage";
import { resolveImageStyleForMode } from "@/lib/workflow-defaults";
import { buildGraph } from "@/lib/workflow-graph";

/**
 * Delete an image config and all downstream data (groups, images, files).
 */
export async function deleteImageConfigCascade(configId: string) {
  const db = getDb();
  const groups = db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, configId)).all();
  const filePaths: string[] = [];
  for (const group of groups) {
    const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
    for (const image of images) {
      if (image.filePath) filePaths.push(image.filePath);
      if (image.thumbnailPath) filePaths.push(image.thumbnailPath);
    }
  }
  await Promise.all(filePaths.map((path) => deleteFileIfExists(path)));
  db.delete(generatedImages).where(eq(generatedImages.imageConfigId, configId)).run();
  db.delete(imageGroups).where(eq(imageGroups.imageConfigId, configId)).run();
  db.delete(imageConfigs).where(eq(imageConfigs.id, configId)).run();
}

type DirectionIdea = {
  title: string;
  targetAudience: string;
  adaptationStage: string;
  scenarioProblem: string;
  differentiation: string;
  effect: string;
};

type CopyIdea = {
  titleMain: string;
  titleSub?: string | null;
  titleExtra?: string | null;
  copyType?: string | null;
};

type WorkspaceImageGroup = typeof imageGroups.$inferSelect & {
  images: Array<typeof generatedImages.$inferSelect>;
};

type WorkspaceCopy = typeof copies.$inferSelect & {
  imageConfig: (typeof imageConfigs.$inferSelect) | null;
  groups: WorkspaceImageGroup[];
};

type WorkspaceCopyCard = typeof copyCards.$inferSelect & {
  copies: WorkspaceCopy[];
};

type WorkspaceDirection = typeof directions.$inferSelect & {
  copyCards: WorkspaceCopyCard[];
};

function now() {
  return Date.now();
}

function getDefaultCopyType(imageForm: string): string {
  if (imageForm === "single") {
    return "单图主副标题";
  }

  if (imageForm === "double") {
    return "双图因果";
  }

  return "三图递进";
}

function serializeRequirement(record: typeof requirementCards.$inferSelect | null) {
  if (!record) return null;

  return {
    id: record.id,
    projectId: record.projectId,
    rawInput: record.rawInput,
    businessGoal: record.businessGoal,
    targetAudience: record.targetAudience,
    formatType: record.formatType,
    feature: record.feature,
    sellingPoints: fromJson<string[]>(record.sellingPoints, []),
    timeNode: record.timeNode,
    directionCount: record.directionCount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function imageSlotCount(imageForm: string | null | undefined) {
  if (imageForm === "triple") return 3;
  if (imageForm === "double") return 2;
  return 1;
}

function createCandidateGroupWithImages(input: {
  imageConfigId: string;
  variantIndex: number;
  slotCount: number;
  aspectRatio: string;
  styleMode: string;
  imageStyle: string;
  imageModel: string | null;
  timestamp: number;
}) {
  const db = getDb();
  return createCandidateGroupWithImagesTx(db, input);
}

function createCandidateGroupWithImagesTx(
  dbOrTx: DbOrTx,
  input: {
    imageConfigId: string;
    variantIndex: number;
    slotCount: number;
    aspectRatio: string;
    styleMode: string;
    imageStyle: string;
    imageModel: string | null;
    timestamp: number;
  },
) {
  const groupId = createId("grp");

  dbOrTx.insert(imageGroups)
    .values({
      id: groupId,
      imageConfigId: input.imageConfigId,
      groupType: "candidate",
      variantIndex: input.variantIndex,
      slotCount: input.slotCount,
      aspectRatio: input.aspectRatio,
      styleMode: input.styleMode,
      imageStyle: input.imageStyle,
      imageModel: input.imageModel,
      isConfirmed: 0,
      createdAt: input.timestamp,
      updatedAt: input.timestamp,
    })
    .run();

  for (let slotIndex = 1; slotIndex <= input.slotCount; slotIndex += 1) {
    dbOrTx.insert(generatedImages)
      .values({
        id: createId("img"),
        imageGroupId: groupId,
        imageConfigId: input.imageConfigId,
        slotIndex,
        filePath: null,
        fileUrl: null,
        status: "pending",
        inpaintParentId: null,
        errorMessage: null,
        seed: 1000 + input.variantIndex * 10 + slotIndex,
        createdAt: input.timestamp,
        updatedAt: input.timestamp,
      })
      .run();
  }

  return dbOrTx.select().from(imageGroups).where(eq(imageGroups.id, groupId)).get() ?? null;
}

function getNextCandidateVariantIndex(imageConfigId: string) {
  const db = getDb();
  const rows = db.select({ variantIndex: imageGroups.variantIndex }).from(imageGroups).where(eq(imageGroups.imageConfigId, imageConfigId)).all();
  return Math.max(...rows.map((row) => row.variantIndex), 0) + 1;
}

function getArrayPayload(
  payload: unknown,
  keys: string[],
): unknown[] | null {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return null;
}

function normalizeDirectionIdea(item: unknown): DirectionIdea | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const idea = item as Partial<DirectionIdea>;
  if (!idea.title || !idea.scenarioProblem || !idea.differentiation || !idea.effect) {
    return null;
  }

  return {
    title: idea.title,
    targetAudience: idea.targetAudience ?? "细分人群待补充",
    adaptationStage: idea.adaptationStage ?? "通用",
    scenarioProblem: idea.scenarioProblem,
    differentiation: idea.differentiation,
    effect: idea.effect,
  } satisfies DirectionIdea;
}

function normalizeDirectionIdeas(payload: unknown, count: number) {
  const array = getArrayPayload(payload, ["items", "directions", "ideas"]);
  if (!Array.isArray(array)) return null;

  const ideas = array
    .map((item) => normalizeDirectionIdea(item))
    .filter(Boolean) as DirectionIdea[];

  return ideas.length > 0 ? ideas.slice(0, Math.min(ideas.length, count)) : null;
}

function getTextLength(value: string) {
  return Array.from(value.trim()).length;
}

function isSingleCopyWithinLimits(idea: CopyIdea) {
  const mainLength = getTextLength(idea.titleMain);
  const subLength = getTextLength(idea.titleSub ?? "");
  return mainLength >= 6 && mainLength <= 22 && subLength >= 7 && subLength <= 31;
}

function isMultiCopyWithinLimits(idea: CopyIdea, imageForm: string) {
  const titles = [idea.titleMain, idea.titleSub ?? ""];
  if (imageForm === "triple") {
    titles.push(idea.titleExtra ?? "");
  }

  return titles.every((title) => {
    const length = getTextLength(title);
    return length >= 2 && length <= 15;
  });
}

function normalizeCopyIdea(item: unknown, imageForm: string): CopyIdea | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const idea = item as Partial<CopyIdea>;
  if (!idea.titleMain) return null;
  if (imageForm !== "single" && !idea.titleSub) return null;
  if (imageForm === "triple" && !idea.titleExtra) return null;

  const normalized = {
    titleMain: idea.titleMain,
    titleSub: idea.titleSub ?? null,
    titleExtra: imageForm === "triple" ? (idea.titleExtra ?? null) : null,
    copyType: idea.copyType ?? getDefaultCopyType(imageForm),
  } satisfies CopyIdea;

  if (imageForm === "single") {
    return isSingleCopyWithinLimits(normalized) ? normalized : null;
  }

  return isMultiCopyWithinLimits(normalized, imageForm) ? normalized : null;
}

export function normalizeCopyIdeas(payload: unknown, count: number, imageForm: string) {
  const array = getArrayPayload(payload, ["items", "copies"]);
  if (!Array.isArray(array)) return null;

  const ideas = array
    .map((item) => normalizeCopyIdea(item, imageForm))
    .filter(Boolean) as CopyIdea[];

  return ideas.length > 0 ? ideas.slice(0, count) : null;
}

function getResolvedReferenceImageUrlInput(
  input: Partial<{ referenceImageUrl: string | null }>,
  current: { referenceImageUrl: string | null } | null,
): string | null {
  if (input.referenceImageUrl !== undefined) {
    return input.referenceImageUrl;
  }

  return current?.referenceImageUrl ?? null;
}

function getResolvedImageModel(
  input: Partial<{ imageModel: string | null }>,
  current: { imageModel: string | null } | null,
): string | null {
  if (input.imageModel !== undefined) {
    return input.imageModel;
  }

  return current?.imageModel ?? null;
}

function listImageConfigGroups(imageConfigId: string) {
  const db = getDb();
  return db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, imageConfigId)).all();
}

function listImageConfigGroupsTx(dbOrTx: DbOrTx, imageConfigId: string) {
  return dbOrTx.select().from(imageGroups).where(eq(imageGroups.imageConfigId, imageConfigId)).all();
}

function buildImageConfigInsertValues(input: {
  configId: string;
  copyId: string;
  directionId: string;
  aspectRatio: string;
  styleMode: string;
  ipRole: string | null;
  logo: string;
  imageStyle: string;
  imageModel: string | null;
  referenceImageUrl: string | null;
  ctaEnabled: boolean;
  ctaText: string | null;
  count: number;
  timestamp: number;
}) {
  return {
    id: input.configId,
    copyId: input.copyId,
    directionId: input.directionId,
    aspectRatio: input.aspectRatio,
    styleMode: input.styleMode,
    ipRole: input.ipRole,
    logo: input.logo,
    imageStyle: input.imageStyle,
    imageModel: input.imageModel,
    referenceImageUrl: input.referenceImageUrl,
    ctaEnabled: input.ctaEnabled ? 1 : 0,
    ctaText: input.ctaText,
    promptBundleJson: null,
    count: input.count,
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
  } satisfies typeof imageConfigs.$inferInsert;
}

function buildImageConfigUpdateValues(input: {
  current: typeof imageConfigs.$inferSelect;
  aspectRatio: string | undefined;
  styleMode: string;
  ipRole: string | null;
  logo: string | undefined;
  imageStyle: string;
  imageModel: string | null;
  referenceImageUrl: string | null;
  ctaEnabled: boolean;
  ctaText: string | null;
  count: number;
  timestamp: number;
}) {
  return {
    aspectRatio: input.aspectRatio ?? input.current.aspectRatio,
    styleMode: input.styleMode,
    ipRole: input.ipRole,
    logo: input.logo ?? input.current.logo,
    imageStyle: input.imageStyle,
    imageModel: input.imageModel,
    referenceImageUrl: input.referenceImageUrl,
    ctaEnabled: input.ctaEnabled ? 1 : 0,
    ctaText: input.ctaText,
    count: input.count,
    updatedAt: input.timestamp,
  } satisfies Partial<typeof imageConfigs.$inferInsert>;
}

function createCandidateGroupsForConfig(input: {
  imageConfigId: string;
  directionImageForm: string | null | undefined;
  aspectRatio: string;
  styleMode: string;
  imageStyle: string;
  imageModel: string | null;
  append: boolean;
  requestedCount: number | undefined;
  configCount: number;
  timestamp: number;
}) {
  const db = getDb();
  return createCandidateGroupsForConfigTx(db, input);
}

function createCandidateGroupsForConfigTx(
  dbOrTx: DbOrTx,
  input: {
    imageConfigId: string;
    directionImageForm: string | null | undefined;
    aspectRatio: string;
    styleMode: string;
    imageStyle: string;
    imageModel: string | null;
    append: boolean;
    requestedCount: number | undefined;
    configCount: number;
    timestamp: number;
  },
) {
  const groups = listImageConfigGroupsTx(dbOrTx, input.imageConfigId);
  const startIndex = input.append
    ? Math.max(...groups.map((g) => g.variantIndex), 0) + 1
    : 1;
  const groupCount = input.append ? (input.requestedCount ?? 1) : input.configCount;
  const slotCount = imageSlotCount(input.directionImageForm);
  const createdGroups: Array<typeof imageGroups.$inferSelect> = [];

  for (let offset = 0; offset < groupCount; offset += 1) {
    const group = createCandidateGroupWithImagesTx(dbOrTx, {
      imageConfigId: input.imageConfigId,
      variantIndex: startIndex + offset,
      slotCount,
      aspectRatio: input.aspectRatio,
      styleMode: input.styleMode,
      imageStyle: input.imageStyle,
      imageModel: input.imageModel,
      timestamp: input.timestamp,
    });
    if (group) {
      createdGroups.push(group);
    }
  }

  return createdGroups;
}

function persistDirections(
  projectId: string,
  requirement: NonNullable<ReturnType<typeof getRequirement>>,
  channel: string,
  imageForm: string,
  ideas: DirectionIdea[],
  copyGenerationCount = 3,
) {
  const db = getDb();
  const timestamp = now();

  return db.transaction((tx) => {
    tx.delete(directions).where(eq(directions.projectId, projectId)).run();

    const created = [] as Array<typeof directions.$inferSelect>;

    ideas.forEach((idea, index) => {
      const directionId = createId("dir");

      tx.insert(directions)
        .values({
          id: directionId,
          projectId,
          requirementCardId: requirement.id,
          title: idea.title,
          targetAudience: idea.targetAudience,
          adaptationStage: idea.adaptationStage,
          scenarioProblem: idea.scenarioProblem,
          differentiation: idea.differentiation,
          effect: idea.effect,
          channel,
          imageForm,
          copyGenerationCount,
          sortOrder: index,
          isSelected: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();

      const record = tx.select().from(directions).where(eq(directions.id, directionId)).get();
      if (record) created.push(record);
    });

    tx.update(projects)
      .set({ status: "active", updatedAt: timestamp })
      .where(eq(projects.id, projectId))
      .run();

    return created;
  });
}

function appendDirections(
  projectId: string,
  requirement: NonNullable<ReturnType<typeof getRequirement>>,
  channel: string,
  imageForm: string,
  ideas: DirectionIdea[],
  copyGenerationCount = 3,
) {
  const db = getDb();
  const timestamp = now();
  const existingCount = db
    .select({ count: sql<number>`count(*)` })
    .from(directions)
    .where(eq(directions.projectId, projectId))
    .get()?.count ?? 0;

  const created = [] as Array<typeof directions.$inferSelect>;

  ideas.forEach((idea, index) => {
    const directionId = createId("dir");

    db.insert(directions)
      .values({
        id: directionId,
        projectId,
        requirementCardId: requirement.id,
        title: idea.title,
        targetAudience: idea.targetAudience,
        adaptationStage: idea.adaptationStage,
        scenarioProblem: idea.scenarioProblem,
        differentiation: idea.differentiation,
        effect: idea.effect,
        channel,
        imageForm,
        copyGenerationCount,
        sortOrder: existingCount + index,
        isSelected: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();

    const record = db.select().from(directions).where(eq(directions.id, directionId)).get();
    if (record) created.push(record);
  });

  db.update(projects)
    .set({ status: "active", updatedAt: timestamp })
    .where(eq(projects.id, projectId))
    .run();

  return created;
}

function persistCopyCard(
  direction: typeof directions.$inferSelect,
  count: number,
  ideas: CopyIdea[],
) {
  const db = getDb();
  const existing = db.select().from(copyCards).where(eq(copyCards.directionId, direction.id)).all();
  const timestamp = now();
  const cardId = createId("cc");
  const version = existing.length + 1;

  db.insert(copyCards)
    .values({
      id: cardId,
      directionId: direction.id,
      channel: direction.channel,
      imageForm: direction.imageForm ?? "single",
      version,
      sourceReason: existing.length === 0 ? "initial" : "manual_regenerate",
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .run();

  ideas.slice(0, count).forEach((idea, index) => {
    db.insert(copies)
      .values({
        id: createId("copy"),
        copyCardId: cardId,
        directionId: direction.id,
        titleMain: idea.titleMain,
        titleSub: idea.titleSub ?? null,
        titleExtra: idea.titleExtra ?? null,
        copyType: idea.copyType ?? null,
        variantIndex: index + 1,
        isLocked: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
  });

  return listCopyCards(direction.id).find((card) => card.id === cardId) ?? null;
}

function appendCopyToExistingCard(
  card: typeof copyCards.$inferSelect,
  direction: typeof directions.$inferSelect,
  idea: CopyIdea,
) {
  const db = getDb();
  const existingCopies = db
    .select()
    .from(copies)
    .where(eq(copies.copyCardId, card.id))
    .orderBy(copies.variantIndex)
    .all();
  const timestamp = now();
  const nextVariantIndex = Math.max(...existingCopies.map((copy) => copy.variantIndex), 0) + 1;

  db.insert(copies)
    .values({
      id: createId("copy"),
      copyCardId: card.id,
      directionId: direction.id,
      titleMain: idea.titleMain,
      titleSub: idea.titleSub ?? null,
      titleExtra: idea.titleExtra ?? null,
      copyType: idea.copyType ?? null,
      variantIndex: nextVariantIndex,
      isLocked: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .run();

  db.update(copyCards)
    .set({ updatedAt: timestamp })
    .where(eq(copyCards.id, card.id))
    .run();

  return listCopyCards(direction.id).find((item) => item.id === card.id) ?? null;
}

// ── Folder operations ──

export function listFolders() {
  const db = getDb();
  return db
    .select({
      id: projectFolders.id,
      name: projectFolders.name,
      sortOrder: projectFolders.sortOrder,
      createdAt: projectFolders.createdAt,
      updatedAt: projectFolders.updatedAt,
      projectCount: sql<number>`count(${projects.id})`.as("projectCount"),
    })
    .from(projectFolders)
    .leftJoin(projects, eq(projects.folderId, projectFolders.id))
    .groupBy(projectFolders.id)
    .orderBy(desc(projectFolders.updatedAt))
    .all();
}

export function createFolder(name: string) {
  const db = getDb();
  const timestamp = now();
  const id = createId("folder");

  db.insert(projectFolders)
    .values({
      id,
      name,
      sortOrder: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .run();

  return db.select().from(projectFolders).where(eq(projectFolders.id, id)).get() ?? null;
}

export async function deleteFolder(folderId: string) {
  const db = getDb();
  const projectsInFolder = db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.folderId, folderId))
    .all();

  for (const project of projectsInFolder) {
    await deleteProject(project.id);
  }

  db.delete(projectFolders).where(eq(projectFolders.id, folderId)).run();
}

// ── Project operations ──

export function listProjects(folderId?: string | null) {
  const db = getDb();
  const conditions = folderId !== undefined
    ? folderId === null
      ? sql`${projects.folderId} IS NULL`
      : eq(projects.folderId, folderId)
    : undefined;

  return db
    .select({
      id: projects.id,
      title: projects.title,
      status: projects.status,
      folderId: projects.folderId,
      directionCount: sql<number>`count(distinct ${directions.id})`,
      copyCardCount: sql<number>`count(distinct ${copyCards.id})`,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .leftJoin(directions, eq(directions.projectId, projects.id))
    .leftJoin(copyCards, eq(copyCards.directionId, directions.id))
    .where(conditions)
    .groupBy(projects.id)
    .orderBy(desc(projects.updatedAt))
    .all();
}

export function createProject(title: string, folderId?: string | null) {
  const db = getDb();
  const timestamp = now();
  const id = createId("proj");

  db.insert(projects)
    .values({
      id,
      title,
      status: "draft",
      folderId: folderId ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .run();

  return db.select().from(projects).where(eq(projects.id, id)).get() ?? null;
}

export function getProjectById(id: string) {
  const db = getDb();
  return db.select().from(projects).where(eq(projects.id, id)).get() ?? null;
}

export async function deleteProject(id: string) {
  const db = getDb();
  const result = db.delete(projects).where(eq(projects.id, id)).run();
  if (result.changes > 0) {
    await deleteProjectFiles(id);
  }
  return result.changes > 0;
}

export function getRequirement(projectId: string) {
  const db = getDb();
  const record =
    db.select().from(requirementCards).where(eq(requirementCards.projectId, projectId)).get() ?? null;

  return serializeRequirement(record);
}

export function upsertRequirement(
  projectId: string,
  input: Partial<{
    rawInput: string | null;
    businessGoal: string;
    targetAudience: string;
    formatType: string;
    feature: string;
    sellingPoints: string[];
    timeNode: string;
    directionCount: number;
  }>,
) {
  const db = getDb();
  const current = getRequirement(projectId);
  const timestamp = now();

  if (!current) {
    const id = createId("rc");
    db.insert(requirementCards)
      .values({
        id,
        projectId,
        rawInput: input.rawInput ?? null,
        businessGoal: input.businessGoal ?? DEFAULT_REQUIREMENT.businessGoal,
        targetAudience: input.targetAudience ?? DEFAULT_REQUIREMENT.targetAudience,
        formatType: input.formatType ?? DEFAULT_REQUIREMENT.formatType,
        feature: input.feature ?? DEFAULT_REQUIREMENT.feature,
        sellingPoints: toJson(input.sellingPoints ?? DEFAULT_REQUIREMENT.sellingPoints),
        timeNode: input.timeNode ?? DEFAULT_REQUIREMENT.timeNode,
        directionCount: input.directionCount ?? DEFAULT_REQUIREMENT.directionCount,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
  } else {
    db.update(requirementCards)
      .set({
        rawInput: input.rawInput ?? current.rawInput ?? null,
        businessGoal: input.businessGoal ?? current.businessGoal ?? DEFAULT_REQUIREMENT.businessGoal,
        targetAudience:
          input.targetAudience ?? current.targetAudience ?? DEFAULT_REQUIREMENT.targetAudience,
        formatType: input.formatType ?? current.formatType ?? DEFAULT_REQUIREMENT.formatType,
        feature: input.feature ?? current.feature ?? DEFAULT_REQUIREMENT.feature,
        sellingPoints: toJson(input.sellingPoints ?? current.sellingPoints),
        timeNode: input.timeNode ?? current.timeNode ?? DEFAULT_REQUIREMENT.timeNode,
        directionCount: input.directionCount ?? current.directionCount ?? DEFAULT_REQUIREMENT.directionCount,
        updatedAt: timestamp,
      })
      .where(eq(requirementCards.projectId, projectId))
      .run();
  }

  const project = getProjectById(projectId);
  if (project?.status === "draft") {
    db.update(projects)
      .set({ status: "active", updatedAt: timestamp })
      .where(eq(projects.id, projectId))
      .run();
  }

  return getRequirement(projectId);
}

export function listDirections(projectId: string) {
  const db = getDb();
  return db
    .select()
    .from(directions)
    .where(eq(directions.projectId, projectId))
    .orderBy(directions.sortOrder)
    .all();
}

export async function generateDirectionsSmart(
  projectId: string,
  channel: string,
  imageForm: string,
  copyGenerationCount = 3,
) {
  const requirement = getRequirement(projectId);
  if (!requirement) throw new Error("请先填写需求卡");

  const raw = await generateDirectionIdeas({
    targetAudience: requirement.targetAudience ?? DEFAULT_REQUIREMENT.targetAudience,
    feature: requirement.feature ?? DEFAULT_REQUIREMENT.feature,
    sellingPoints: requirement.sellingPoints ?? DEFAULT_REQUIREMENT.sellingPoints,
    timeNode: requirement.timeNode ?? DEFAULT_REQUIREMENT.timeNode,
    count: requirement.directionCount,
  });
  const ideas = normalizeDirectionIdeas(raw, requirement.directionCount);
  if (!ideas) {
    logAgentError({
      agent: "direction",
      requestSummary: `生成方向, 目标人群: ${requirement.targetAudience}, 功能: ${requirement.feature}, 数量: ${requirement.directionCount}`,
      rawResponse: JSON.stringify(raw).slice(0, 5000),
      errorMessage: "normalizeDirectionIdeas 返回 null：方向校验失败",
      attemptCount: 1,
    });
    throw new Error("AI 生成的方向格式不正确，请重试");
  }
  return persistDirections(
    projectId,
    requirement,
    channel,
    imageForm,
    ideas,
    copyGenerationCount,
  );
}

export async function appendDirectionSmart(
  projectId: string,
  channel: string,
  imageForm: string,
  copyGenerationCount = 3,
) {
  const requirement = getRequirement(projectId);
  if (!requirement) throw new Error("请先填写需求卡");

  const currentDirections = listDirections(projectId);
  if (currentDirections.length >= 10) {
    throw new Error("方向总数已达上限（10条），无法追加");
  }

  const raw = await generateDirectionIdeas({
    targetAudience: requirement.targetAudience ?? DEFAULT_REQUIREMENT.targetAudience,
    feature: requirement.feature ?? DEFAULT_REQUIREMENT.feature,
    sellingPoints: requirement.sellingPoints ?? DEFAULT_REQUIREMENT.sellingPoints,
    timeNode: requirement.timeNode ?? DEFAULT_REQUIREMENT.timeNode,
    count: 1,
    existingDirections: currentDirections.map((direction) => ({
      title: direction.title,
      targetAudience: direction.targetAudience ?? "",
      adaptationStage: direction.adaptationStage ?? "",
      scenarioProblem: direction.scenarioProblem ?? "",
      differentiation: direction.differentiation ?? "",
      effect: direction.effect ?? "",
    })),
  });
  const ideas = normalizeDirectionIdeas(raw, 1);
  if (!ideas) {
    logAgentError({
      agent: "direction",
      requestSummary: `追加方向, projectId: ${projectId}`,
      rawResponse: JSON.stringify(raw).slice(0, 5000),
      errorMessage: "normalizeDirectionIdeas 返回 null：追加方向校验失败",
      attemptCount: 1,
    });
    throw new Error("AI 生成的方向格式不正确，请重试");
  }
  return appendDirections(
    projectId,
    requirement,
    channel,
    imageForm,
    ideas,
    copyGenerationCount,
  )[0] ?? null;
}

export function updateDirection(
  directionId: string,
  input: Partial<{
    title: string;
    targetAudience: string;
    adaptationStage: string;
    scenarioProblem: string;
    differentiation: string;
    effect: string;
    channel: string;
    imageForm: string;
    copyGenerationCount: number;
  }>,
) {
  const db = getDb();
  const current = db.select().from(directions).where(eq(directions.id, directionId)).get();
  if (!current) return null;

  db.update(directions)
    .set({
      title: input.title ?? current.title,
      targetAudience: input.targetAudience ?? current.targetAudience,
      adaptationStage: input.adaptationStage ?? current.adaptationStage,
      scenarioProblem: input.scenarioProblem ?? current.scenarioProblem,
      differentiation: input.differentiation ?? current.differentiation,
      effect: input.effect ?? current.effect,
      channel: input.channel ?? current.channel,
      imageForm: input.imageForm ?? current.imageForm,
      copyGenerationCount: input.copyGenerationCount ?? current.copyGenerationCount,
      updatedAt: now(),
    })
    .where(eq(directions.id, directionId))
    .run();

  return db.select().from(directions).where(eq(directions.id, directionId)).get() ?? null;
}

export async function deleteDirection(directionId: string) {
  const db = getDb();
  const direction = db.select().from(directions).where(eq(directions.id, directionId)).get();
  if (!direction) return false;

  const downstreamCards = db
    .select({ id: copyCards.id })
    .from(copyCards)
    .where(eq(copyCards.directionId, directionId))
    .all();

  if (downstreamCards.length > 0) {
    throw new Error("已有下游内容，不能删除");
  }

  for (const configId of listDirectionImageConfigIds(directionId)) {
    await deleteImageConfigCascade(configId);
  }

  return db.delete(directions).where(eq(directions.id, directionId)).run().changes > 0;
}

export async function deleteDirectionCard(projectId: string) {
  const db = getDb();
  const cardDirections = db
    .select()
    .from(directions)
    .where(eq(directions.projectId, projectId))
    .all();

  if (cardDirections.length === 0) {
    return false;
  }

  // 检查是否有任何方向存在下游内容
  for (const direction of cardDirections) {
    const downstreamCards = db
      .select({ id: copyCards.id })
      .from(copyCards)
      .where(eq(copyCards.directionId, direction.id))
      .all();

    if (downstreamCards.length > 0) {
      throw new Error("已有下游内容，不能删除方向卡");
    }
  }

  // 删除所有方向及其关联配置
  for (const direction of cardDirections) {
    for (const configId of listDirectionImageConfigIds(direction.id)) {
      await deleteImageConfigCascade(configId);
    }
    db.delete(directions).where(eq(directions.id, direction.id)).run();
  }

  return true;
}

export function listCopyCards(directionId: string) {
  const db = getDb();
  const cards = db
    .select()
    .from(copyCards)
    .where(eq(copyCards.directionId, directionId))
    .orderBy(copyCards.version)
    .all();

  return cards.map((card) => ({
    ...card,
    copies: db.select().from(copies).where(eq(copies.copyCardId, card.id)).orderBy(copies.variantIndex).all(),
  }));
}

export async function generateCopyCardSmart(directionId: string, count: number) {
  const db = getDb();
  const direction = db.select().from(directions).where(eq(directions.id, directionId)).get();
  if (!direction) throw new Error("方向不存在");
  const actualCount = count || direction.copyGenerationCount || 3;

  const knowledge = buildCopyKnowledgeContext({
    channel: direction.channel,
    imageForm: direction.imageForm ?? "single",
    targetAudience: direction.targetAudience ?? "",
    directionTitle: direction.title,
  });
  const raw = await generateCopyIdeas({
    directionTitle: direction.title,
    targetAudience: direction.targetAudience ?? "",
    scenarioProblem: direction.scenarioProblem ?? "",
    differentiation: direction.differentiation ?? "",
    effect: direction.effect ?? "",
    channel: direction.channel,
    imageForm: direction.imageForm ?? "single",
    count: actualCount,
    knowledgeContext: knowledge.promptBlock,
  });
  const ideas = normalizeCopyIdeas(raw, actualCount, direction.imageForm ?? "single");
  if (!ideas) {
    logAgentError({
      agent: "copy",
      requestSummary: `方向: ${direction.title}, 渠道: ${direction.channel}, 形式: ${direction.imageForm}, 数量: ${actualCount}`,
      rawResponse: JSON.stringify(raw).slice(0, 5000),
      errorMessage: "normalizeCopyIdeas 返回 null：AI 返回的文案全部未通过校验（字段缺失或字数超限）",
      attemptCount: 1,
    });
    throw new Error("AI 生成的文案格式不正确，请重试");
  }
  return persistCopyCard(direction, actualCount, ideas);
}

export async function appendCopyToCardSmart(copyCardId: string) {
  const db = getDb();
  const card = db.select().from(copyCards).where(eq(copyCards.id, copyCardId)).get();
  if (!card) return null;

  const direction = db.select().from(directions).where(eq(directions.id, card.directionId)).get();
  if (!direction) {
    throw new Error("方向不存在");
  }

  const existingCopies = db
    .select()
    .from(copies)
    .where(eq(copies.copyCardId, copyCardId))
    .orderBy(copies.variantIndex)
    .all();

  const knowledge = buildCopyKnowledgeContext({
    channel: direction.channel,
    imageForm: direction.imageForm ?? "single",
    targetAudience: direction.targetAudience ?? "",
    directionTitle: direction.title,
  });
  const raw = await generateCopyIdeas({
    directionTitle: direction.title,
    targetAudience: direction.targetAudience ?? "",
    scenarioProblem: direction.scenarioProblem ?? "",
    differentiation: direction.differentiation ?? "",
    effect: direction.effect ?? "",
    channel: direction.channel,
    imageForm: direction.imageForm ?? "single",
    count: 1,
    existingCopies: existingCopies.map((copy) => ({
      titleMain: copy.titleMain,
      titleSub: copy.titleSub,
      titleExtra: copy.titleExtra,
      copyType: copy.copyType,
    })),
    knowledgeContext: knowledge.promptBlock,
  });
  const nextIdea = normalizeCopyIdeas(raw, 1, direction.imageForm ?? "single")?.[0];
  if (!nextIdea) {
    logAgentError({
      agent: "copy",
      requestSummary: `追加文案, 方向: ${direction.title}, 渠道: ${direction.channel}, 形式: ${direction.imageForm}`,
      rawResponse: JSON.stringify(raw).slice(0, 5000),
      errorMessage: "normalizeCopyIdeas 返回 null：追加文案未通过校验",
      attemptCount: 1,
    });
    throw new Error("AI 生成的文案格式不正确，请重试");
  }

  return appendCopyToExistingCard(card, direction, nextIdea);
}

export async function saveImageConfig(
  copyId: string,
  input: Partial<{
    aspectRatio: string;
    styleMode: string;
    ipRole: string | null;
    logo: string;
    imageStyle: string;
    imageModel: string | null;
    count: number;
    referenceImageUrl: string | null;
    ctaEnabled: boolean;
    ctaText: string | null;
    append: boolean;
    createGroups: boolean;
  }>,
) {
  const db = getDb();
  const copy = db.select().from(copies).where(eq(copies.id, copyId)).get();
  if (!copy) throw new Error("文案不存在");

  const direction = db.select().from(directions).where(eq(directions.id, copy.directionId)).get();
  if (!direction) throw new Error("方向不存在");

  const current = db.select().from(imageConfigs).where(eq(imageConfigs.copyId, copyId)).get() ?? null;
  const timestamp = now();
  const nextStyleMode = input.styleMode ?? current?.styleMode ?? "normal";
  const shouldClearIp = nextStyleMode === "normal";
  const nextIpRole = shouldClearIp ? null : (input.ipRole ?? current?.ipRole ?? null);
  const nextImageStyle = resolveImageStyleForMode(
    nextStyleMode,
    input.imageStyle ?? current?.imageStyle ?? IMAGE_STYLES[0],
  );
  const nextReferenceImageUrl = shouldClearIp ? null : await resolveReferenceImageUrl({
    styleMode: nextStyleMode,
    ipRole: nextIpRole,
    referenceImageUrl: getResolvedReferenceImageUrlInput(input, current),
  });
  const nextCount = Math.max(1, Math.min(5, Math.trunc(input.count ?? current?.count ?? 1)));
  const nextCtaEnabled = Boolean(input.ctaEnabled ?? current?.ctaEnabled ?? 0);
  const nextCtaText = nextCtaEnabled ? (input.ctaText ?? current?.ctaText ?? "立即下载") : null;
  const nextImageModel = getResolvedImageModel(input, current);

  if (!current) {
    const configId = createId("imgcfg");
    db.insert(imageConfigs)
      .values(buildImageConfigInsertValues({
        configId,
        copyId,
        directionId: copy.directionId,
        aspectRatio: input.aspectRatio ?? IMAGE_MODELS[0].aspectRatios[0],
        styleMode: nextStyleMode,
        ipRole: nextIpRole,
        logo: input.logo ?? LOGO_OPTIONS[0],
        imageStyle: nextImageStyle,
        imageModel: nextImageModel,
        referenceImageUrl: nextReferenceImageUrl,
        ctaEnabled: nextCtaEnabled,
        ctaText: nextCtaText,
        count: nextCount,
        timestamp,
      }))
      .run();

    db.update(copies).set({ isLocked: 1, updatedAt: timestamp }).where(eq(copies.id, copyId)).run();
  } else {
    db.update(imageConfigs)
      .set(buildImageConfigUpdateValues({
        current,
        aspectRatio: input.aspectRatio,
        styleMode: nextStyleMode,
        ipRole: nextIpRole,
        logo: input.logo,
        imageStyle: nextImageStyle,
        imageModel: nextImageModel,
        referenceImageUrl: nextReferenceImageUrl,
        ctaEnabled: nextCtaEnabled,
        ctaText: nextCtaText,
        count: nextCount,
        timestamp,
      }))
      .where(eq(imageConfigs.id, current.id))
      .run();
  }

  const config = db.select().from(imageConfigs).where(eq(imageConfigs.copyId, copyId)).get();
  if (!config) return null;

  const shouldCreateGroups = input.createGroups ?? true;

  if (!shouldCreateGroups) {
    return {
      ...config,
      createdGroups: [] as Array<typeof imageGroups.$inferSelect>,
      groups: listImageConfigGroups(config.id),
    };
  }

  if (!input.append) {
    return db.transaction((tx) => {
      tx.delete(imageGroups).where(eq(imageGroups.imageConfigId, config.id)).run();

      const createdGroups = createCandidateGroupsForConfigTx(tx, {
        imageConfigId: config.id,
        directionImageForm: direction.imageForm,
        aspectRatio: config.aspectRatio,
        styleMode: config.styleMode,
        imageStyle: config.imageStyle,
        imageModel: config.imageModel,
        append: false,
        requestedCount: input.count,
        configCount: config.count,
        timestamp,
      });

      return {
        ...config,
        createdGroups,
        groups: listImageConfigGroupsTx(tx, config.id),
      };
    });
  }

  const createdGroups = createCandidateGroupsForConfig({
    imageConfigId: config.id,
    directionImageForm: direction.imageForm,
    aspectRatio: config.aspectRatio,
    styleMode: config.styleMode,
    imageStyle: config.imageStyle,
    imageModel: config.imageModel,
    append: Boolean(input.append),
    requestedCount: input.count,
    configCount: config.count,
    timestamp,
  });

  return {
    ...config,
    createdGroups,
    groups: listImageConfigGroups(config.id),
  };
}

export async function appendImageConfigGroup(imageConfigId: string) {
  const db = getDb();
  const config = db.select().from(imageConfigs).where(eq(imageConfigs.id, imageConfigId)).get();
  if (!config) throw new Error("图片配置不存在");

  const direction = db.select().from(directions).where(eq(directions.id, config.directionId)).get();
  if (!direction) throw new Error("方向不存在");

  const timestamp = now();
  const group = createCandidateGroupWithImages({
    imageConfigId: config.id,
    variantIndex: getNextCandidateVariantIndex(config.id),
    slotCount: imageSlotCount(direction.imageForm),
    aspectRatio: config.aspectRatio,
    styleMode: config.styleMode,
    imageStyle: config.imageStyle,
    imageModel: config.imageModel,
    timestamp,
  });

  return {
    ...config,
    group,
    groups: listImageConfigGroups(config.id),
  };
}

export async function generateFinalizedVariants(
  projectId: string,
  input: {
    targetGroupIds?: string[];
    targetChannels?: string[];
    targetSlots?: string[];
    imageModel?: string;
  },
) {
  const db = getDb();
  const selectedGroupIds = new Set(input.targetGroupIds ?? []);
  const slotSpecs = resolveExportSlotSpecs(input);
  const model = input.imageModel ?? "doubao-seedream-4-0";

  const ratioSpecs = new Map(
    slotSpecs
      .filter((slot) => !isSpecialRatio(slot.ratio))
      .map((slot) => [slot.ratio, slot]),
  );

  const skippedSlots = slotSpecs
    .filter((slot) => isSpecialRatio(slot.ratio))
    .map((slot) => `${slot.channel} · ${slot.slotName}`);

  const directionRows = listDirections(projectId);
  const created = [] as Array<typeof imageGroups.$inferSelect>;

  for (const direction of directionRows) {
    const cards = listCopyCards(direction.id);
    for (const card of cards) {
      for (const copy of card.copies) {
        const config = db.select().from(imageConfigs).where(eq(imageConfigs.copyId, copy.id)).get();
        if (!config) continue;

        const groups = db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, config.id)).all();
        const finalizedGroups = groups.filter(
          (group) =>
            group.isConfirmed === 1 &&
            !group.groupType.startsWith("derived|") &&
            (selectedGroupIds.size === 0 || selectedGroupIds.has(group.id)),
        );

        for (const group of finalizedGroups) {
          const sourceImages = db
            .select()
            .from(generatedImages)
            .where(eq(generatedImages.imageGroupId, group.id))
            .all()
            .filter((image) => image.status === "done" && image.filePath);

          if (sourceImages.length === 0) continue;

          for (const [ratio] of ratioSpecs) {
            if (classifyExportAdaptation(config.aspectRatio, ratio) === "direct") continue;

            const derivedGroupType = `derived|${group.id}|${ratio}`;
            const existingDerived = groups.find((item) => item.groupType === derivedGroupType);
            if (existingDerived) {
              const existingImages = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, existingDerived.id)).all();
              for (const image of existingImages) {
                await deleteFileIfExists(image.filePath);
                await deleteFileIfExists(image.thumbnailPath);
              }
              db.delete(imageGroups).where(eq(imageGroups.id, existingDerived.id)).run();
            }

            const allGroups = db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, config.id)).all();
            const nextVariantIndex = Math.max(...allGroups.map((item) => item.variantIndex), 0) + 1;
            const timestamp = now();
            const derivedGroupId = createId("grp");

            db.insert(imageGroups)
              .values({
                id: derivedGroupId,
                imageConfigId: config.id,
                groupType: derivedGroupType,
                aspectRatio: ratio,
                variantIndex: nextVariantIndex,
                slotCount: group.slotCount,
                isConfirmed: 1,
                createdAt: timestamp,
                updatedAt: timestamp,
              })
              .run();

            const workItems: Array<{
              imageId: string;
              sourceImage: typeof sourceImages[number];
              prompt: string;
            }> = [];

            for (const sourceImage of sourceImages) {
              const imageId = createId("img");
              db.insert(generatedImages)
                .values({
                  id: imageId,
                  imageGroupId: derivedGroupId,
                  imageConfigId: config.id,
                  slotIndex: sourceImage.slotIndex,
                  filePath: null,
                  fileUrl: null,
                  status: "generating",
                  inpaintParentId: sourceImage.id,
                  errorMessage: null,
                  seed: sourceImage.seed,
                  finalPromptText: null,
                  finalNegativePrompt: null,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                })
                .run();

              const aspectDirection = compareAspectRatios(config.aspectRatio, ratio);
              const prompt = buildAdaptationPrompt(config.aspectRatio, ratio, aspectDirection);

              workItems.push({ imageId, sourceImage, prompt });
            }

            const generationResults = await Promise.allSettled(
              workItems.map(async (item) => {
                const imageBuffer = await readFile(item.sourceImage.filePath!);
                const mimeType = getMimeTypeFromPath(item.sourceImage.filePath!);
                const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

                const binaries = await generateImageFromReference({
                  instruction: item.prompt,
                  imageUrls: [dataUrl],
                  aspectRatio: ratio,
                  model,
                });

                const binary = binaries[0];
                const pngBuffer = await sharp(binary.buffer).png().toBuffer();
                const saved = await saveImageBuffer({
                  projectId,
                  imageId: item.imageId,
                  buffer: pngBuffer,
                  extension: "png",
                });
                return { imageId: item.imageId, saved, prompt: item.prompt };
              }),
            );

            for (let i = 0; i < generationResults.length; i += 1) {
              const result = generationResults[i];
              const imageId = workItems[i].imageId;

              if (result.status === "fulfilled") {
                db.update(generatedImages)
                  .set({
                    filePath: result.value.saved.filePath,
                    fileUrl: result.value.saved.fileUrl,
                    thumbnailPath: result.value.saved.thumbnailPath,
                    thumbnailUrl: result.value.saved.thumbnailUrl,
                    status: "done",
                    finalPromptText: result.value.prompt,
                    updatedAt: Date.now(),
                  })
                  .where(eq(generatedImages.id, imageId))
                  .run();
              } else {
                const message = result.reason instanceof Error ? result.reason.message : "适配版本生成失败";
                db.update(generatedImages)
                  .set({ status: "failed", errorMessage: message, updatedAt: Date.now() })
                  .where(eq(generatedImages.id, imageId))
                  .run();
              }
            }

            const groupRecord = db.select().from(imageGroups).where(eq(imageGroups.id, derivedGroupId)).get();
            if (groupRecord) created.push(groupRecord);
          }
        }
      }
    }
  }

  return { groups: created, skippedSlots };
}

function compareAspectRatios(source: string, target: string): "wider" | "taller" | "same" {
  function parseRatio(r: string): number {
    if (r === "√2:1") return Math.SQRT2;
    const parts = r.split(":");
    return Number(parts[0]) / Number(parts[1]);
  }
  const s = parseRatio(source);
  const t = parseRatio(target);
  if (Math.abs(s - t) < 0.01) return "same";
  return t > s ? "wider" : "taller";
}

function buildAdaptationPrompt(sourceRatio: string, targetRatio: string, direction: "wider" | "taller" | "same"): string {
  const base = "保持原图内容、构图、主体位置和色调完全不变，";
  const noBorder = "画面必须铺满整个画幅，绝对不能出现黑边、留白、letterboxing或任何空白区域。";
  const style = "扩展区域必须与原图风格、色调、光影完全一致，形成一个完整统一的画面。";

  if (direction === "wider") {
    return `${base}将画面比例从 ${sourceRatio} 扩展为 ${targetRatio}。向左右两侧自然延伸场景内容来填充更宽的画幅，${noBorder}${style}`;
  }
  if (direction === "taller") {
    return `${base}将画面比例从 ${sourceRatio} 扩展为 ${targetRatio}。向上下方向自然延伸场景内容来填充更高的画幅，${noBorder}${style}`;
  }
  return `${base}将画面比例适配为 ${targetRatio}。${noBorder}${style}`;
}

function getMimeTypeFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

export function getProjectWorkspace(projectId: string) {
  const project = getProjectById(projectId);
  if (!project) return null;

  const requirement = getRequirement(projectId);
  const directionsWithChildren = buildWorkspaceDirections(projectId);

  return {
    project,
    requirement,
    directions: directionsWithChildren,
    meta: {
      availableChannels: CHANNELS,
      availableFeatures: FEATURE_LIBRARY,
      availableAspectRatios: IMAGE_MODELS[0].aspectRatios,
      availableImageStyles: IMAGE_STYLES,
      availableLogoOptions: LOGO_OPTIONS,
      availableIpRoles: IP_ROLES,
    },
  };
}

function listProjectGraphRows(projectId: string) {
  const db = getDb();
  const directionRows = listDirections(projectId);
  const directionIds = directionRows.map((direction) => direction.id);

  const cardRows =
    directionIds.length === 0
      ? []
      : db
          .select()
          .from(copyCards)
          .where(inArray(copyCards.directionId, directionIds))
          .orderBy(copyCards.version)
          .all();
  const cardIds = cardRows.map((card) => card.id);

  const copyRows =
    cardIds.length === 0
      ? []
      : db
          .select()
          .from(copies)
          .where(inArray(copies.copyCardId, cardIds))
          .orderBy(copies.variantIndex)
          .all();
  const copyIds = copyRows.map((copy) => copy.id);

  const configRows =
    copyIds.length === 0
      ? []
      : db.select().from(imageConfigs).where(inArray(imageConfigs.copyId, copyIds)).all();
  const configIds = configRows.map((config) => config.id);

  const groupRows =
    configIds.length === 0
      ? []
      : db
          .select()
          .from(imageGroups)
          .where(inArray(imageGroups.imageConfigId, configIds))
          .orderBy(imageGroups.variantIndex)
          .all();
  const groupIds = groupRows.map((group) => group.id);

  const imageRows =
    groupIds.length === 0
      ? []
      : db
          .select()
          .from(generatedImages)
          .where(inArray(generatedImages.imageGroupId, groupIds))
          .orderBy(generatedImages.slotIndex)
          .all();

  return {
    directionRows,
    cardRows,
    copyRows,
    configRows,
    groupRows,
    imageRows,
  };
}

function listDirectionImageConfigIds(directionId: string) {
  const db = getDb();
  const directionCardRows = db
    .select({ id: copyCards.id })
    .from(copyCards)
    .where(eq(copyCards.directionId, directionId))
    .all();
  const cardIds = directionCardRows.map((card) => card.id);
  if (cardIds.length === 0) return [];

  const copyRowsForDirection = db
    .select({ id: copies.id })
    .from(copies)
    .where(inArray(copies.copyCardId, cardIds))
    .all();
  const copyIds = copyRowsForDirection.map((copy) => copy.id);
  if (copyIds.length === 0) return [];

  return db
    .select({ id: imageConfigs.id })
    .from(imageConfigs)
    .where(inArray(imageConfigs.copyId, copyIds))
    .all()
    .map((config) => config.id);
}

function buildWorkspaceDirections(projectId: string): WorkspaceDirection[] {
  const { directionRows, cardRows, copyRows, configRows, groupRows, imageRows } =
    listProjectGraphRows(projectId);

  const imagesByGroupId = new Map(
    groupRows.map((group) => [group.id, [] as Array<typeof generatedImages.$inferSelect>]),
  );
  imageRows.forEach((image) => {
    imagesByGroupId.get(image.imageGroupId)?.push(image);
  });

  const groupsByConfigId = new Map(
    configRows.map((config) => [config.id, [] as WorkspaceImageGroup[]]),
  );
  groupRows.forEach((group) => {
    groupsByConfigId.get(group.imageConfigId)?.push({
      ...group,
      images: imagesByGroupId.get(group.id) ?? [],
    });
  });

  const configByCopyId = new Map(configRows.map((config) => [config.copyId, config]));
  const copiesByCardId = new Map(
    cardRows.map((card) => [
      card.id,
      [] as WorkspaceCopy[],
    ]),
  );

  copyRows.forEach((copy) => {
    const imageConfig = configByCopyId.get(copy.id) ?? null;
    copiesByCardId.get(copy.copyCardId)?.push({
      ...copy,
      imageConfig,
      groups: imageConfig ? (groupsByConfigId.get(imageConfig.id) ?? []) : [],
    });
  });

  const cardsByDirectionId = new Map(
    directionRows.map((direction) => [
      direction.id,
      [] as WorkspaceCopyCard[],
    ]),
  );

  cardRows.forEach((card) => {
    const copiesForCard = copiesByCardId.get(card.id) ?? [];
    cardsByDirectionId.get(card.directionId)?.push({
      ...card,
      copies: copiesForCard,
    });
  });

  return directionRows.map((direction) => ({
    ...direction,
    copyCards: cardsByDirectionId.get(direction.id) ?? [],
  }));
}

export function getWorkspaceHeader(projectId: string) {
  const project = getProjectById(projectId);
  if (!project) return null;

  return {
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
      folderId: project.folderId,
    },
  };
}

export function getProjectTreeData(projectId: string) {
  const project = getProjectById(projectId);
  if (!project) return null;

  const requirement = getRequirement(projectId);
  const directionsWithCards = buildWorkspaceDirections(projectId).map((direction) => ({
    id: direction.id,
    title: direction.title,
    copyCards: direction.copyCards.map((card) => ({
      id: card.id,
      version: card.version,
      copies: card.copies.map((copy) => {
        return {
          id: copy.id,
          variantIndex: copy.variantIndex,
          titleMain: copy.titleMain,
          imageConfigId: copy.imageConfig?.id ?? null,
        };
      }),
    })),
  }));

  return {
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
      folderId: project.folderId,
    },
    requirement,
    directions: directionsWithCards,
  };
}

export function getCanvasData(projectId: string) {
  const project = getProjectById(projectId);
  if (!project) return null;

  const requirement = getRequirement(projectId);
  const directionsWithChildren = buildWorkspaceDirections(projectId);
  const graph = buildGraph({
    project,
    requirement,
    directions: directionsWithChildren,
    meta: {
      availableChannels: CHANNELS,
      availableFeatures: FEATURE_LIBRARY,
      availableAspectRatios: IMAGE_MODELS[0].aspectRatios,
      availableImageStyles: IMAGE_STYLES,
      availableLogoOptions: LOGO_OPTIONS,
      availableIpRoles: IP_ROLES,
    },
  });

  const generationRuns = getDb()
    .select()
    .from(projectGenerationRuns)
    .where(eq(projectGenerationRuns.projectId, projectId))
    .orderBy(desc(projectGenerationRuns.updatedAt))
    .all();

  const directionRun = generationRuns.find((run) => run.resourceType === "project-directions");
  const copyRunsByDirectionId = new Map<string, "loading" | "error">();

  generationRuns
    .filter((run) => run.resourceType === "direction-copy-cards")
    .forEach((run) => {
      if (copyRunsByDirectionId.has(run.resourceId)) return;

      if (run.status === "running") {
        copyRunsByDirectionId.set(run.resourceId, "loading");
        return;
      }

      if (run.status === "failed") {
        copyRunsByDirectionId.set(run.resourceId, "error");
      }
    });

  const nodes = graph.nodes.map((node) => {
    if (node.type === "directionCard" && directionRun) {
      const nextStatus =
        directionRun.status === "running"
          ? "loading"
          : directionRun.status === "failed"
            ? "error"
            : undefined;

      if (nextStatus) {
        return {
          ...node,
          data: {
            ...node.data,
            status: nextStatus,
          },
        };
      }
    }

    if (node.type === "copyCard" && "directionId" in node.data && node.data.directionId) {
      const nextStatus = copyRunsByDirectionId.get(node.data.directionId);
      if (nextStatus) {
        return {
          ...node,
          data: {
            ...node.data,
            status: nextStatus,
          },
        };
      }
    }

    return node;
  });

  return {
    projectId,
    nodes,
    edges: graph.edges,
    hasPendingImages: directionsWithChildren.some((direction) =>
      direction.copyCards.some((card) =>
        card.copies.some((copy) =>
          copy.groups.some((group) =>
            group.images.some(
              (image) => image.status === "generating" || image.status === "pending",
            ),
          ),
        ),
      ),
    ),
  };
}

export function getGenerationStatusData(projectId: string) {
  const project = getProjectById(projectId);
  if (!project) return null;
  const { imageRows } = listProjectGraphRows(projectId);

  return {
    projectId,
    images: imageRows.map((image) => ({
      id: image.id,
      imageConfigId: image.imageConfigId,
      fileUrl: image.fileUrl,
      thumbnailUrl: image.thumbnailUrl,
      status: image.status,
      errorMessage: image.errorMessage,
      updatedAt: image.updatedAt,
    })),
  };
}

export function getProjectExportContext(projectId: string, input?: { targetGroupIds?: string[] }) {
  const project = getProjectById(projectId);
  if (!project) return null;

  const { configRows, groupRows, imageRows } = listProjectGraphRows(projectId);
  const selectedGroupIds = new Set(input?.targetGroupIds ?? []);
  const confirmedGroupIds = new Set(
    groupRows
      .filter((group) => group.isConfirmed === 1)
      .filter((group) => selectedGroupIds.size === 0 || selectedGroupIds.has(group.id))
      .map((group) => group.id),
  );

  return {
    project,
    configMap: new Map(configRows.map((config) => [config.id, config])),
    groupMap: new Map(groupRows.map((group) => [group.id, group])),
    images: imageRows.filter(
      (image) => confirmedGroupIds.has(image.imageGroupId) && Boolean(image.filePath),
    ),
  };
}
