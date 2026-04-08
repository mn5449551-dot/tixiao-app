import { desc, eq, sql } from "drizzle-orm";
import sharp from "sharp";

import { generateCopyIdeas } from "@/lib/ai/agents/copy-agent";
import { generateDirectionIdeas } from "@/lib/ai/agents/direction-agent";
import {
  ASPECT_RATIOS,
  CHANNELS,
  DEFAULT_REQUIREMENT,
  FEATURE_LIBRARY,
  IMAGE_STYLES,
  IP_ROLES,
  LOGO_OPTIONS,
  TARGET_AUDIENCES,
} from "@/lib/constants";
import { getDb } from "@/lib/db";
import { classifyExportAdaptation, parseSlotSize, resolveExportSlotSpecs } from "@/lib/export/utils";
import { createId } from "@/lib/id";
import { resolveReferenceImageUrl } from "@/lib/ip-assets";
import {
  copies,
  copyCards,
  directions,
  generatedImages,
  imageConfigs,
  imageGroups,
  projects,
  requirementCards,
} from "@/lib/schema";
import { fromJson, toJson } from "@/lib/utils";
import { deleteFileIfExists, saveImageBuffer } from "@/lib/storage";
import { resolveImageStyleForMode } from "@/lib/workflow-defaults";
import { buildGraph } from "@/lib/workflow-graph";

type DirectionIdea = {
  title: string;
  targetAudience: string;
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

const singleCopyAngles = [
  ["孩子一做题就卡壳？", "拍一下 10 秒出解析，像老师边写边讲"],
  ["一道题卡半小时", "洋葱学园帮你把思路掰开讲清楚"],
  ["写作业总要等人教", "现在自己拍题就能立刻继续学"],
  ["会做题却不会讲", "看懂解析后，孩子自己也能讲出来"],
  ["难题一拖就放弃", "先拍一下，马上知道从哪一步开始"],
];

const duoCopyAngles = [
  ["卡题不慌", "拍一下就懂", "错题不再拖"],
  ["晚间作业", "秒出解析", "家长少焦虑"],
  ["不会就拍", "思路立现", "越学越稳"],
  ["题目太难", "讲解很清楚", "孩子能复述"],
  ["不会写步骤", "拆成得分点", "考试更稳"],
];

function now() {
  return Date.now();
}

function audienceLabel(value: string | null | undefined) {
  return TARGET_AUDIENCES.find((item) => item.value === value)?.label ?? "家长";
}

function featureLabel(featureId: string | null | undefined) {
  if (!featureId) return FEATURE_LIBRARY[0].name;

  return (
    FEATURE_LIBRARY.find((item) => item.id === featureId)?.name ??
    featureId
  );
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

function buildDirectionBlueprint(index: number, requirement: ReturnType<typeof serializeRequirement>) {
  const feature = featureLabel(requirement?.feature);
  const audience = audienceLabel(requirement?.targetAudience);
  const node = requirement?.timeNode ?? DEFAULT_REQUIREMENT.timeNode;

  const blueprints = [
    {
      title: `${feature}·作业卡壳秒解决`,
      scenarioProblem: `${node}阶段做题频繁卡住，${audience}都在追进度却找不到突破口。`,
      differentiation: `用 ${feature} 把难题拆成可执行的小步骤，孩子能立刻继续写。`,
      effect: "从不会下笔到自己能顺着思路完成整题。",
    },
    {
      title: `${feature}·薄弱点精准击破`,
      scenarioProblem: `${node}阶段刷题很多，但总在同一类题目反复出错。`,
      differentiation: `把错题和知识点快速归因，告诉用户先补什么最值。`,
      effect: "复习不再平均用力，提分更有方向。",
    },
    {
      title: `${feature}·晚间陪学省心版`,
      scenarioProblem: `晚上写作业最容易卡在关键题，家长也未必讲得清。`,
      differentiation: `把讲解交给系统，家长只需要陪伴，不需要硬讲题。`,
      effect: "减少催促和争执，家庭学习氛围更顺。",
    },
    {
      title: `${feature}·考前冲刺抢分`,
      scenarioProblem: `${node}前的复盘时间紧，最怕会做题但步骤扣分。`,
      differentiation: "直接给出得分点与标准步骤表达，帮助快速校准答题方式。",
      effect: "同样会做，写出来更容易拿到完整分数。",
    },
    {
      title: `${feature}·看懂之后会表达`,
      scenarioProblem: "很多孩子看过答案也只是照抄，真正上手还是不会。",
      differentiation: "强调过程解释和语言重构，让孩子知道为什么这么做。",
      effect: "从被动看答案，变成主动讲得出来。",
    },
  ];

  const blueprint = blueprints[index % blueprints.length];

  return {
    ...blueprint,
    targetAudience:
      requirement?.targetAudience === "student"
        ? `面向学生：${node}阶段需要快速提分的在校生`
        : `面向家长：关注孩子${node}阶段学习效率与提分节奏的家长`,
  };
}

function buildCopyVariant(imageForm: string, variantIndex: number) {
  const single = singleCopyAngles[(variantIndex - 1) % singleCopyAngles.length];
  const multi = duoCopyAngles[(variantIndex - 1) % duoCopyAngles.length];

  if (imageForm === "triple") {
    return {
      titleMain: multi[0],
      titleSub: multi[1],
      titleExtra: multi[2],
      copyType: "三图递进",
    };
  }

  if (imageForm === "double") {
    return {
      titleMain: multi[0],
      titleSub: multi[1],
      titleExtra: null,
      copyType: "双图因果",
    };
  }

  return {
    titleMain: single[0],
    titleSub: single[1],
    titleExtra: null,
    copyType: "单图主副标题",
  };
}

function getNextCopyVariantSeed(copy: typeof copies.$inferSelect, imageForm: string) {
  if (imageForm === "single") {
    const currentIndex = singleCopyAngles.findIndex(
      ([main, sub]) => main === copy.titleMain && sub === (copy.titleSub ?? ""),
    );
    return currentIndex >= 0 ? currentIndex + 2 : copy.variantIndex + 1;
  }

  const currentIndex = duoCopyAngles.findIndex(
    ([main, sub, extra]) =>
      main === copy.titleMain &&
      sub === (copy.titleSub ?? "") &&
      (imageForm === "triple" ? extra === (copy.titleExtra ?? "") : true),
  );

  return currentIndex >= 0 ? currentIndex + 2 : copy.variantIndex + 1;
}

function parseJsonBlock<T>(content: string): T | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] ?? trimmed;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeDirectionIdeas(payload: unknown, count: number) {
  const array = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? ((payload as { items?: unknown; directions?: unknown }).items ??
          (payload as { items?: unknown; directions?: unknown }).directions)
      : null;

  if (!Array.isArray(array)) return null;

  const ideas = array
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const idea = item as Partial<DirectionIdea>;
      if (!idea.title || !idea.scenarioProblem || !idea.differentiation || !idea.effect) return null;
      return {
        title: idea.title,
        targetAudience: idea.targetAudience ?? "细分人群待补充",
        scenarioProblem: idea.scenarioProblem,
        differentiation: idea.differentiation,
        effect: idea.effect,
      } satisfies DirectionIdea;
    })
    .filter(Boolean) as DirectionIdea[];

  return ideas.length >= count ? ideas.slice(0, count) : null;
}

function normalizeCopyIdeas(payload: unknown, count: number, imageForm: string) {
  const array = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? ((payload as { items?: unknown; copies?: unknown }).items ??
          (payload as { items?: unknown; copies?: unknown }).copies)
      : null;

  if (!Array.isArray(array)) return null;

  const ideas = array
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const idea = item as Partial<CopyIdea>;
      if (!idea.titleMain) return null;
      if (imageForm !== "single" && !idea.titleSub) return null;
      return {
        titleMain: idea.titleMain,
        titleSub: idea.titleSub ?? null,
        titleExtra: imageForm === "triple" ? (idea.titleExtra ?? null) : null,
        copyType: idea.copyType ?? (imageForm === "single" ? "单图主副标题" : imageForm === "double" ? "双图因果" : "三图递进"),
      } satisfies CopyIdea;
    })
    .filter(Boolean) as CopyIdea[];

  return ideas.length >= count ? ideas.slice(0, count) : null;
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
  db.delete(directions).where(eq(directions.projectId, projectId)).run();

  const timestamp = now();
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
        scenarioProblem: idea.scenarioProblem,
        differentiation: idea.differentiation,
        effect: idea.effect,
        channel,
        imageForm,
        copyGenerationCount,
        imageTextRelation: imageForm === "single" ? "单图直给" : "递进",
        sortOrder: index,
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
        scenarioProblem: idea.scenarioProblem,
        differentiation: idea.differentiation,
        effect: idea.effect,
        channel,
        imageForm,
        copyGenerationCount,
        imageTextRelation: imageForm === "single" ? "单图直给" : "递进",
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

export function listProjects() {
  const db = getDb();
  const rows = db.select().from(projects).orderBy(desc(projects.updatedAt)).all();

  return rows.map((project) => {
    const directionCount =
      db
        .select({ count: sql<number>`count(*)` })
        .from(directions)
        .where(eq(directions.projectId, project.id))
        .get()?.count ?? 0;

    const copyCardCount =
      db
        .select({ count: sql<number>`count(*)` })
        .from(copyCards)
        .innerJoin(directions, eq(copyCards.directionId, directions.id))
        .where(eq(directions.projectId, project.id))
        .get()?.count ?? 0;

    return {
      id: project.id,
      title: project.title,
      status: project.status,
      directionCount,
      copyCardCount,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  });
}

export function createProject(title: string) {
  const db = getDb();
  const timestamp = now();
  const id = createId("proj");

  db.insert(projects)
    .values({
      id,
      title,
      status: "draft",
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

export function deleteProject(id: string) {
  const db = getDb();
  const result = db.delete(projects).where(eq(projects.id, id)).run();
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

export function generateDirections(
  projectId: string,
  channel: string,
  imageForm: string,
  copyGenerationCount = 3,
) {
  const requirement = getRequirement(projectId);
  if (!requirement) throw new Error("请先填写需求卡");

  const ideas = Array.from({ length: requirement.directionCount }, (_, index) =>
    buildDirectionBlueprint(index, requirement),
  );

  return persistDirections(projectId, requirement, channel, imageForm, ideas, copyGenerationCount);
}

export async function generateDirectionsSmart(
  projectId: string,
  channel: string,
  imageForm: string,
  copyGenerationCount = 3,
  useAi = false,
) {
  const requirement = getRequirement(projectId);
  if (!requirement) throw new Error("请先填写需求卡");

  if (useAi) {
    try {
      const raw = await generateDirectionIdeas({
        targetAudience: requirement.targetAudience ?? DEFAULT_REQUIREMENT.targetAudience,
        feature: requirement.feature ?? DEFAULT_REQUIREMENT.feature,
        sellingPoints: requirement.sellingPoints ?? DEFAULT_REQUIREMENT.sellingPoints,
        timeNode: requirement.timeNode ?? DEFAULT_REQUIREMENT.timeNode,
        count: requirement.directionCount,
      });
      const parsed = parseJsonBlock<unknown>(raw);
      const ideas = normalizeDirectionIdeas(parsed, requirement.directionCount);
      if (ideas) {
        return persistDirections(
          projectId,
          requirement,
          channel,
          imageForm,
          ideas,
          copyGenerationCount,
        );
      }
    } catch {
      // Fallback to local rule generation.
    }
  }

  return generateDirections(projectId, channel, imageForm, copyGenerationCount);
}

export async function appendDirectionSmart(
  projectId: string,
  channel: string,
  imageForm: string,
  copyGenerationCount = 3,
  useAi = false,
) {
  const requirement = getRequirement(projectId);
  if (!requirement) throw new Error("请先填写需求卡");

  const currentDirections = listDirections(projectId);
  if (currentDirections.length >= 10) {
    throw new Error("方向总数已达上限（10条），无法追加");
  }

  const nextIndex = currentDirections.length;

  if (useAi) {
    try {
      const raw = await generateDirectionIdeas({
        targetAudience: requirement.targetAudience ?? DEFAULT_REQUIREMENT.targetAudience,
        feature: requirement.feature ?? DEFAULT_REQUIREMENT.feature,
        sellingPoints: requirement.sellingPoints ?? DEFAULT_REQUIREMENT.sellingPoints,
        timeNode: requirement.timeNode ?? DEFAULT_REQUIREMENT.timeNode,
        count: 1,
      });
      const parsed = parseJsonBlock<unknown>(raw);
      const ideas = normalizeDirectionIdeas(parsed, 1);
      if (ideas) {
        return appendDirections(
          projectId,
          requirement,
          channel,
          imageForm,
          ideas,
          copyGenerationCount,
        )[0] ?? null;
      }
    } catch {
      // Fallback to local rule generation.
    }
  }

  const idea = buildDirectionBlueprint(nextIndex, requirement);
  return appendDirections(
    projectId,
    requirement,
    channel,
    imageForm,
    [idea],
    copyGenerationCount,
  )[0] ?? null;
}

export function updateDirection(
  directionId: string,
  input: Partial<{
    title: string;
    targetAudience: string;
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

export function regenerateDirection(directionId: string) {
  const db = getDb();
  const current = db.select().from(directions).where(eq(directions.id, directionId)).get();
  if (!current) return null;

  const requirement = getRequirement(current.projectId);
  if (!requirement) {
    throw new Error("请先填写需求卡");
  }

  const idea = buildDirectionBlueprint(current.sortOrder ?? 0, requirement);
  const timestamp = now();

  db.update(directions)
    .set({
      title: idea.title,
      targetAudience: idea.targetAudience,
      scenarioProblem: idea.scenarioProblem,
      differentiation: idea.differentiation,
      effect: idea.effect,
      updatedAt: timestamp,
    })
    .where(eq(directions.id, directionId))
    .run();

  return db.select().from(directions).where(eq(directions.id, directionId)).get() ?? null;
}

export async function deleteDirection(directionId: string) {
  const db = getDb();
  const direction = db.select().from(directions).where(eq(directions.id, directionId)).get();
  if (!direction) return false;

  // Collect all image file paths before deletion
  const directionCopyCards = db.select().from(copyCards).where(eq(copyCards.directionId, directionId)).all();
  for (const card of directionCopyCards) {
    const copiesList = db.select().from(copies).where(eq(copies.copyCardId, card.id)).all();
    for (const copy of copiesList) {
      const config = db.select().from(imageConfigs).where(eq(imageConfigs.copyId, copy.id)).get();
      if (config) {
        const groups = db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, config.id)).all();
        for (const group of groups) {
          const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
          for (const image of images) {
            if (image.filePath) {
              try { await import("fs/promises").then((fs) => fs.unlink(image.filePath!)); } catch { /* ignore */ }
            }
          }
        }
      }
    }
  }

  return db.delete(directions).where(eq(directions.id, directionId)).run().changes > 0;
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

export function generateCopyCard(directionId: string, count: number) {
  const db = getDb();
  const direction = db.select().from(directions).where(eq(directions.id, directionId)).get();
  if (!direction) throw new Error("方向不存在");

  const actualCount = count || direction.copyGenerationCount || 3;

  const ideas = Array.from({ length: actualCount }, (_, index) =>
    buildCopyVariant(direction.imageForm ?? "single", index + 1),
  );

  return persistCopyCard(direction, actualCount, ideas);
}

export async function generateCopyCardSmart(directionId: string, count: number, useAi = false) {
  const db = getDb();
  const direction = db.select().from(directions).where(eq(directions.id, directionId)).get();
  if (!direction) throw new Error("方向不存在");
  const actualCount = count || direction.copyGenerationCount || 3;

  if (useAi) {
    try {
      const raw = await generateCopyIdeas({
        directionTitle: direction.title,
        targetAudience: direction.targetAudience ?? "",
        scenarioProblem: direction.scenarioProblem ?? "",
        differentiation: direction.differentiation ?? "",
        effect: direction.effect ?? "",
        channel: direction.channel,
        imageForm: direction.imageForm ?? "single",
        count: actualCount,
      });
      const parsed = parseJsonBlock<unknown>(raw);
      const ideas = normalizeCopyIdeas(parsed, actualCount, direction.imageForm ?? "single");
      if (ideas) {
        return persistCopyCard(direction, actualCount, ideas);
      }
    } catch {
      // Fallback to local rule generation.
    }
  }

  return generateCopyCard(directionId, actualCount);
}

export async function regenerateCopy(copyId: string, useAi = false) {
  const db = getDb();
  const copy = db.select().from(copies).where(eq(copies.id, copyId)).get();
  if (!copy) return null;

  const direction = db.select().from(directions).where(eq(directions.id, copy.directionId)).get();
  if (!direction) {
    throw new Error("方向不存在");
  }

  let nextIdea: CopyIdea | null = null;
  if (useAi) {
    try {
      const raw = await generateCopyIdeas({
        directionTitle: direction.title,
        targetAudience: direction.targetAudience ?? "",
        scenarioProblem: direction.scenarioProblem ?? "",
        differentiation: direction.differentiation ?? "",
        effect: direction.effect ?? "",
        channel: direction.channel,
        imageForm: direction.imageForm ?? "single",
        count: 1,
      });
      const parsed = parseJsonBlock<unknown>(raw);
      nextIdea = normalizeCopyIdeas(parsed, 1, direction.imageForm ?? "single")?.[0] ?? null;
    } catch {
      nextIdea = null;
    }
  }

  if (!nextIdea) {
    nextIdea = buildCopyVariant(
      direction.imageForm ?? "single",
      getNextCopyVariantSeed(copy, direction.imageForm ?? "single"),
    );
  }

  const currentConfig = db.select().from(imageConfigs).where(eq(imageConfigs.copyId, copyId)).get();
  if (currentConfig) {
    const groups = db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, currentConfig.id)).all();
    for (const group of groups) {
      const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
      for (const image of images) {
        await deleteFileIfExists(image.filePath);
      }
    }
    db.delete(generatedImages).where(eq(generatedImages.imageConfigId, currentConfig.id)).run();
    db.delete(imageGroups).where(eq(imageGroups.imageConfigId, currentConfig.id)).run();
    db.delete(imageConfigs).where(eq(imageConfigs.copyId, copyId)).run();
  }

  db.update(copies)
    .set({
      titleMain: nextIdea.titleMain,
      titleSub: nextIdea.titleSub ?? null,
      titleExtra: nextIdea.titleExtra ?? null,
      copyType: nextIdea.copyType ?? null,
      isLocked: 0,
      updatedAt: now(),
    })
    .where(eq(copies.id, copyId))
    .run();

  return db.select().from(copies).where(eq(copies.id, copyId)).get() ?? null;
}

export async function saveImageConfig(
  copyId: string,
  input: Partial<{
    aspectRatio: string;
    styleMode: string;
    ipRole: string | null;
    logo: string;
    imageStyle: string;
    count: number;
    referenceImageUrl: string | null;
    append: boolean;
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
  const nextIpRole = input.ipRole ?? current?.ipRole ?? null;
  const nextImageStyle = resolveImageStyleForMode(
    nextStyleMode,
    input.imageStyle ?? current?.imageStyle ?? IMAGE_STYLES[0],
  );
  const nextReferenceImageUrl = await resolveReferenceImageUrl({
    styleMode: nextStyleMode,
    ipRole: nextIpRole,
    referenceImageUrl: input.referenceImageUrl ?? current?.referenceImageUrl ?? null,
  });

  if (!current) {
    const configId = createId("imgcfg");
    db.insert(imageConfigs)
      .values({
        id: configId,
        copyId,
        directionId: copy.directionId,
        aspectRatio: input.aspectRatio ?? ASPECT_RATIOS[0],
        styleMode: nextStyleMode,
        ipRole: nextIpRole,
        logo: input.logo ?? LOGO_OPTIONS[0],
        imageStyle: nextImageStyle,
        referenceImageUrl: nextReferenceImageUrl,
        promptZh: `围绕 ${direction.title} 生成画面描述，左上角预留 Logo 留白。`,
        promptEn: `Hero visual for ${direction.title}`,
        negativePrompt: "distorted text, messy layout, unrelated characters",
        count: input.count ?? 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();

    db.update(copies).set({ isLocked: 1, updatedAt: timestamp }).where(eq(copies.id, copyId)).run();
  } else {
    db.update(imageConfigs)
      .set({
        aspectRatio: input.aspectRatio ?? current.aspectRatio,
        styleMode: nextStyleMode,
        ipRole: nextIpRole,
        logo: input.logo ?? current.logo,
        imageStyle: nextImageStyle,
        referenceImageUrl: nextReferenceImageUrl,
        count: input.count ?? current.count,
        updatedAt: timestamp,
      })
      .where(eq(imageConfigs.id, current.id))
      .run();
  }

  const config = db.select().from(imageConfigs).where(eq(imageConfigs.copyId, copyId)).get();
  if (!config) return null;

  if (!input.append) {
    db.delete(imageGroups).where(eq(imageGroups.imageConfigId, config.id)).run();
  }

  const existingGroups = db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, config.id)).all();
  const startIndex = input.append ? existingGroups.length + 1 : 1;
  const groupCount = input.append ? (input.count ?? 1) : config.count;

  for (let offset = 0; offset < groupCount; offset += 1) {
    const index = startIndex + offset;
    const groupId = createId("grp");
    db.insert(imageGroups)
      .values({
        id: groupId,
        imageConfigId: config.id,
        groupType: "candidate",
        variantIndex: index,
        slotCount: imageSlotCount(direction.imageForm),
        isConfirmed: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();

    for (let slotIndex = 1; slotIndex <= imageSlotCount(direction.imageForm); slotIndex += 1) {
      db.insert(generatedImages)
        .values({
          id: createId("img"),
          imageGroupId: groupId,
          imageConfigId: config.id,
          slotIndex,
          filePath: null,
          fileUrl: null,
          status: "pending",
          inpaintParentId: null,
          errorMessage: null,
          seed: 1000 + index * 10 + slotIndex,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
    }
  }

  return {
    ...config,
    groups: db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, config.id)).all(),
  };
}

export async function generateFinalizedVariants(
  projectId: string,
  input: {
    targetChannels?: string[];
    targetSlots?: string[];
  },
) {
  const db = getDb();
  const slotSpecs = resolveExportSlotSpecs(input);
  const ratioSpecs = new Map(
    slotSpecs.map((slot) => [slot.ratio, slot]),
  );

  const directionRows = listDirections(projectId);
  const created = [] as Array<typeof imageGroups.$inferSelect>;

  for (const direction of directionRows) {
    const cards = listCopyCards(direction.id);
    for (const card of cards) {
      for (const copy of card.copies) {
        const config = db.select().from(imageConfigs).where(eq(imageConfigs.copyId, copy.id)).get();
        if (!config) continue;

        const groups = db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, config.id)).all();
        const finalizedGroups = groups.filter((group) => group.isConfirmed === 1 && !group.groupType.startsWith("derived|"));

        for (const group of finalizedGroups) {
          const sourceImages = db
            .select()
            .from(generatedImages)
            .where(eq(generatedImages.imageGroupId, group.id))
            .all()
            .filter((image) => image.filePath);

          if (sourceImages.length === 0) continue;

          for (const [ratio, slotSpec] of ratioSpecs) {
            if (classifyExportAdaptation(config.aspectRatio, ratio) === "direct") continue;

            const derivedGroupType = `derived|${group.id}|${ratio}`;
            const existingDerived = groups.find((item) => item.groupType === derivedGroupType);
            if (existingDerived) {
              const existingImages = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, existingDerived.id)).all();
              for (const image of existingImages) {
                await deleteFileIfExists(image.filePath);
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
                variantIndex: nextVariantIndex,
                slotCount: group.slotCount,
                isConfirmed: 1,
                createdAt: timestamp,
                updatedAt: timestamp,
              })
              .run();

            const targetSize = parseSlotSize(slotSpec.size);
            for (const sourceImage of sourceImages) {
              const imageId = createId("img");
              const pipeline = sharp(sourceImage.filePath!);
              const buffer = await pipeline
                .resize({
                  width: targetSize?.width,
                  height: targetSize?.height,
                  fit: classifyExportAdaptation(config.aspectRatio, ratio) === "postprocess" ? "contain" : "cover",
                  position: "centre",
                  background: "#ffffff",
                })
                .png()
                .toBuffer();
              const saved = await saveImageBuffer({
                projectId,
                imageId,
                buffer,
                extension: "png",
              });

              db.insert(generatedImages)
                .values({
                  id: imageId,
                  imageGroupId: derivedGroupId,
                  imageConfigId: config.id,
                  slotIndex: sourceImage.slotIndex,
                  filePath: saved.filePath,
                  fileUrl: saved.fileUrl,
                  status: "done",
                  inpaintParentId: sourceImage.id,
                  errorMessage: null,
                  seed: sourceImage.seed,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                })
                .run();
            }

            const groupRecord = db.select().from(imageGroups).where(eq(imageGroups.id, derivedGroupId)).get();
            if (groupRecord) created.push(groupRecord);
          }
        }
      }
    }
  }

  return created;
}

export function getProjectWorkspace(projectId: string) {
  const project = getProjectById(projectId);
  if (!project) return null;

  const db = getDb();
  const requirement = getRequirement(projectId);
  const directionRows = listDirections(projectId);
  const directionsWithChildren = directionRows.map((direction) => {
    const cards = listCopyCards(direction.id).map((card) => ({
      ...card,
      copies: card.copies.map((copy) => {
        const imageConfig = db.select().from(imageConfigs).where(eq(imageConfigs.copyId, copy.id)).get() ?? null;
        const groups = imageConfig
          ? db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, imageConfig.id)).all().map((group) => ({
              ...group,
              images: db
                .select()
                .from(generatedImages)
                .where(eq(generatedImages.imageGroupId, group.id))
                .orderBy(generatedImages.slotIndex)
                .all(),
            }))
          : [];

        return {
          ...copy,
          imageConfig,
          groups,
        };
      }),
    }));

    return {
      ...direction,
      copyCards: cards,
    };
  });

  return {
    project,
    requirement,
    directions: directionsWithChildren,
    meta: {
      availableChannels: CHANNELS,
      availableFeatures: FEATURE_LIBRARY,
      availableAspectRatios: ASPECT_RATIOS,
      availableImageStyles: IMAGE_STYLES,
      availableLogoOptions: LOGO_OPTIONS,
      availableIpRoles: IP_ROLES,
    },
  };
}

export function getWorkspaceHeader(projectId: string) {
  const project = getProjectById(projectId);
  if (!project) return null;

  return {
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
    },
  };
}

export function getProjectTreeData(projectId: string) {
  const project = getProjectById(projectId);
  if (!project) return null;

  const db = getDb();
  const requirement = getRequirement(projectId);
  const directionRows = listDirections(projectId);
  const directionsWithCards = directionRows.map((direction) => ({
    id: direction.id,
    title: direction.title,
    copyCards: listCopyCards(direction.id).map((card) => ({
      id: card.id,
      version: card.version,
      copies: card.copies.map((copy) => {
        const imageConfig =
          db
            .select({ id: imageConfigs.id })
            .from(imageConfigs)
            .where(eq(imageConfigs.copyId, copy.id))
            .get() ?? null;

        return {
          id: copy.id,
          variantIndex: copy.variantIndex,
          titleMain: copy.titleMain,
          imageConfigId: imageConfig?.id ?? null,
        };
      }),
    })),
  }));

  return {
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
    },
    requirement,
    directions: directionsWithCards,
  };
}

export function getCanvasData(projectId: string) {
  const workspace = getProjectWorkspace(projectId);
  if (!workspace) return null;

  const graph = buildGraph(workspace);
  return {
    projectId,
    nodes: graph.nodes,
    edges: graph.edges,
  };
}

export function getGenerationStatusData(projectId: string) {
  const workspace = getProjectWorkspace(projectId);
  if (!workspace) return null;

  return {
    projectId,
    images: workspace.directions.flatMap((direction) =>
      direction.copyCards.flatMap((card) =>
        card.copies.flatMap((copy) =>
          copy.groups.flatMap((group) =>
            group.images.map((image) => ({
              id: image.id,
              imageConfigId: image.imageConfigId,
              fileUrl: image.fileUrl,
              status: image.status,
              errorMessage: image.errorMessage,
              updatedAt: image.updatedAt,
            })),
          ),
        ),
      ),
    ),
  };
}
