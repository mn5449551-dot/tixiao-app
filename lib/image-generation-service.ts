import { eq, inArray } from "drizzle-orm";
import sharp from "sharp";

import {
  generateImageDescription,
  type ImageDescriptionInput,
} from "@/lib/ai/agents/image-description-agent";
import { generateImageFromPrompt, generateImageFromReference } from "@/lib/ai/image-chat";
import { getDb } from "@/lib/db";
import { finishGenerationRun } from "@/lib/generation-runs";
import { getIpAssetMetadata } from "@/lib/ip-assets";
import { copies, directions, generatedImages, imageConfigs, imageGroups } from "@/lib/schema";
import { saveImageBuffer } from "@/lib/storage";

type ImageConfigRecord = typeof imageConfigs.$inferSelect;
type DirectionRecord = typeof directions.$inferSelect;
type CopyRecord = typeof copies.$inferSelect;
type ImageGroupRecord = typeof imageGroups.$inferSelect;

export type PreparedImageGeneration = {
  config: ImageConfigRecord;
  direction: DirectionRecord;
  copy: CopyRecord;
  groups: ImageGroupRecord[];
  projectId: string;
  imageGroupsPayload: Array<{
    id: string;
    group_type: string;
    slot_count: number;
    images: Array<{ id: string; slot_index: number; status: string; file_url: string | null }>;
  }>;
};

export function prepareImageConfigGeneration(input: {
  imageConfigId: string;
  groupIds?: string[];
}) {
  const db = getDb();
  const config = db.select().from(imageConfigs).where(eq(imageConfigs.id, input.imageConfigId)).get();
  if (!config) {
    throw new Error("图片配置不存在");
  }

  const copy = db.select().from(copies).where(eq(copies.id, config.copyId)).get();
  const direction = db.select().from(directions).where(eq(directions.id, config.directionId)).get();
  if (!copy || !direction) {
    throw new Error("图片配置关联数据不完整");
  }

  const requestedGroupIds = new Set(input.groupIds ?? []);
  const groups = db
    .select()
    .from(imageGroups)
    .where(eq(imageGroups.imageConfigId, config.id))
    .all()
    .filter((group) => requestedGroupIds.size === 0 || requestedGroupIds.has(group.id));

  if (groups.length === 0) {
    throw new Error("无候选组，无法生成");
  }

  return {
    config,
    direction,
    copy,
    groups,
    projectId: direction.projectId,
    imageGroupsPayload: groups.map((group) => ({
      id: group.id,
      group_type: group.groupType,
      slot_count: group.slotCount,
      images: db
        .select()
        .from(generatedImages)
        .where(eq(generatedImages.imageGroupId, group.id))
        .all()
        .map((image) => ({
          id: image.id,
          slot_index: image.slotIndex,
          status: image.status,
          file_url: image.fileUrl,
        })),
    })),
  } satisfies PreparedImageGeneration;
}

export function markPreparedImageGenerationRunning(prepared: PreparedImageGeneration) {
  const db = getDb();
  const timestamp = Date.now();

  return prepared.groups.map((group) => {
    const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();

    const imagePayload = images.map((image) => {
      db.update(generatedImages)
        .set({ status: "generating", errorMessage: null, updatedAt: timestamp })
        .where(eq(generatedImages.id, image.id))
        .run();

      return {
        id: image.id,
        slot_index: image.slotIndex,
        status: "generating",
        file_url: null,
      };
    });

    return {
      id: group.id,
      group_type: group.groupType,
      slot_count: group.slotCount,
      images: imagePayload,
    };
  });
}

export function cleanupImageGroups(groupIds: string[]) {
  if (groupIds.length === 0) return;

  const db = getDb();
  db.delete(generatedImages).where(inArray(generatedImages.imageGroupId, groupIds)).run();
  db.delete(imageGroups).where(inArray(imageGroups.id, groupIds)).run();
}

export function resetImageGroupsToPending(groupIds: string[]) {
  if (groupIds.length === 0) return;

  const db = getDb();
  db.update(generatedImages)
    .set({ status: "pending", errorMessage: null, updatedAt: Date.now() })
    .where(inArray(generatedImages.imageGroupId, groupIds))
    .run();
}

async function buildSharedBaseContext(input: {
  config: ImageConfigRecord;
  direction: DirectionRecord;
  copy: CopyRecord;
  ipMetadata: ReturnType<typeof getIpAssetMetadata> | null;
}): Promise<ImageDescriptionInput> {
  const referenceImages: ImageDescriptionInput["referenceImages"] = [];

  if (input.config.referenceImageUrl) {
    referenceImages.push({
      role: input.config.ipRole ? "ip" : "style",
      url: input.config.referenceImageUrl,
      usage: input.config.ipRole
        ? "保持角色长相、服装、发型与整体角色识别特征一致。"
        : "参考整体构图、风格或氛围，不要机械复刻。",
    });
  }

  return {
    direction: {
      title: input.direction.title,
      targetAudience: input.direction.targetAudience ?? "家长",
      adaptationStage: input.direction.adaptationStage ?? "",
      scenarioProblem: input.direction.scenarioProblem ?? "",
      differentiation: input.direction.differentiation ?? "",
      effect: input.direction.effect ?? "",
      channel: input.direction.channel,
    },
    copySet: {
      titleMain: input.copy.titleMain,
      titleSub: input.copy.titleSub,
      titleExtra: input.copy.titleExtra,
      copyType: input.copy.copyType,
    },
    config: {
      imageForm: (input.direction.imageForm ?? "single") as "single" | "double" | "triple",
      aspectRatio: input.config.aspectRatio,
      styleMode: (input.config.styleMode ?? "normal") as "normal" | "ip",
      imageStyle: input.config.imageStyle,
      logo: (input.config.logo ?? "none") as "onion" | "onion_app" | "none",
      ctaEnabled: input.config.ctaEnabled === 1,
      ctaText: input.config.ctaText,
    },
    ip: {
      ipRole: input.config.ipRole,
      ipDescription: input.ipMetadata?.description ?? null,
      ipPromptKeywords: input.ipMetadata?.promptKeywords ?? null,
    },
    referenceImages,
  };
}

export async function processPreparedImageGeneration(input: {
  runId: string;
  prepared: PreparedImageGeneration;
}) {
  const db = getDb();
  const { runId, prepared } = input;
  const { groups, config, direction, copy, projectId } = prepared;
  let hadFailure = false;
  let batchErrorMessage: string | null = null;

  try {
    const ipMetadata = config.ipRole ? getIpAssetMetadata(config.ipRole) : null;
    const sharedBase = await buildSharedBaseContext({
      config,
      direction,
      copy,
      ipMetadata,
    });
    const descriptionResult = await generateImageDescription(sharedBase);
    const promptMap = new Map(
      descriptionResult.prompts.map((prompt) => [prompt.slotIndex, prompt]),
    );
    const primaryPrompt = promptMap.get(1) ?? descriptionResult.prompts[0];
    if (!primaryPrompt) {
      throw new Error("图片描述生成失败：未生成任何 prompt");
    }

    const promptBundleJson = JSON.stringify({
      agentType: (direction.imageForm ?? "single") === "single" ? "poster" : "series",
      prompts: descriptionResult.prompts,
    });

    db.update(imageConfigs)
      .set({ promptBundleJson, updatedAt: Date.now() })
      .where(eq(imageConfigs.id, config.id))
      .run();

    const snapshotTimestamp = Date.now();
    for (const group of groups) {
      db.update(imageGroups)
        .set({
          promptBundleJson,
          referenceImageUrl: config.referenceImageUrl ?? null,
          logo: config.logo ?? "none",
          updatedAt: snapshotTimestamp,
        })
        .where(eq(imageGroups.id, group.id))
        .run();
    }

    // Build work items for all images across all groups, then generate in parallel
    const workItems: Array<{
      imageId: string;
      prompt: string;
      negativePrompt: string | null;
      referenceImageUrls: string[];
      groupLogo: string;
    }> = [];

    for (const group of groups) {
      const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
      const groupReferenceImageUrl = group.referenceImageUrl ?? config.referenceImageUrl ?? null;
      const groupLogo = group.logo ?? config.logo ?? "none";
      const groupReferenceImageUrls = [groupReferenceImageUrl].filter(Boolean) as string[];

      for (const image of images) {
        const promptEntry = promptMap.get(image.slotIndex) ?? primaryPrompt;
        workItems.push({
          imageId: image.id,
          prompt: promptEntry.prompt,
          negativePrompt: promptEntry.negativePrompt,
          referenceImageUrls: groupReferenceImageUrls,
          groupLogo,
        });
      }
    }

    // Save prompt snapshots before generating
    for (const item of workItems) {
      db.update(generatedImages)
        .set({
          finalPromptText: item.prompt,
          finalNegativePrompt: item.negativePrompt,
          generationRequestJson: JSON.stringify({
            promptText: item.prompt,
            negativePrompt: item.negativePrompt,
            model: config.imageModel ?? null,
            aspectRatio: config.aspectRatio,
            referenceImages: item.referenceImageUrls.map((url) => ({ url })),
          }),
          updatedAt: Date.now(),
        })
        .where(eq(generatedImages.id, item.imageId))
        .run();
    }

    // Generate all images in parallel
    const generationResults = await Promise.allSettled(
      workItems.map(async (item) => {
        const binaries = item.referenceImageUrls.length > 0
          ? await generateImageFromReference({
              instruction: item.prompt,
              imageUrls: item.referenceImageUrls,
              aspectRatio: config.aspectRatio,
              model: config.imageModel ?? undefined,
            })
          : await generateImageFromPrompt(item.prompt, {
              aspectRatio: config.aspectRatio,
              model: config.imageModel ?? undefined,
            });

        const binary = binaries[0];
        let pngBuffer = await sharp(binary.buffer).png().toBuffer();
        const saved = await saveImageBuffer({
          projectId,
          imageId: item.imageId,
          buffer: pngBuffer,
          extension: "png",
        });
        return { imageId: item.imageId, saved };
      }),
    );

    // Update DB with results sequentially (SQLite doesn't support concurrent writes)
    for (let i = 0; i < generationResults.length; i += 1) {
      const result = generationResults[i];
      const imageId = workItems[i].imageId;

      if (result.status === "fulfilled") {
        db.update(generatedImages)
          .set({
            filePath: result.value.saved.filePath,
            fileUrl: result.value.saved.fileUrl,
            status: "done",
            updatedAt: Date.now(),
          })
          .where(eq(generatedImages.id, imageId))
          .run();
      } else {
        const message = result.reason instanceof Error ? result.reason.message : "图片生成失败";
        hadFailure = true;
        db.update(generatedImages)
          .set({ status: "failed", errorMessage: message, updatedAt: Date.now() })
          .where(eq(generatedImages.id, imageId))
          .run();
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "图片生成流程失败";
    hadFailure = true;
    batchErrorMessage = message;

    for (const group of groups) {
      const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
      for (const image of images) {
        if (image.status !== "done") {
          db.update(generatedImages)
            .set({ status: "failed", errorMessage: message, updatedAt: Date.now() })
            .where(eq(generatedImages.id, image.id))
            .run();
        }
      }
    }
  } finally {
    finishGenerationRun(runId, {
      status: hadFailure ? "failed" : "done",
      errorMessage: hadFailure ? batchErrorMessage ?? "部分图片生成失败" : null,
    });
  }
}
