import { eq, inArray } from "drizzle-orm";
import sharp from "sharp";

import { generateImageDescription } from "@/lib/ai/agents/image-description-agent";
import { generateImageFromPrompt, generateImageFromReference } from "@/lib/ai/image-chat";
import { buildImagePrompt, buildImageSlotPrompt, buildNegativePrompt, mergeImagePromptWithSlot } from "@/lib/ai/services/prompt-template";
import { getDb } from "@/lib/db";
import { finishGenerationRun } from "@/lib/generation-runs";
import { getIpAssetMetadata } from "@/lib/ip-assets";
import { readLogoAssetAsDataUrl } from "@/lib/logo-assets";
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

    const promptZhPayload = await generateImageDescription({
      directionTitle: direction.title,
      targetAudience: direction.targetAudience ?? "家长",
      scenarioProblem: direction.scenarioProblem ?? "",
      differentiation: direction.differentiation ?? "",
      effect: direction.effect ?? "",
      channel: direction.channel,
      copyTitleMain: copy.titleMain,
      copyTitleSub: copy.titleSub,
      copyTitleExtra: copy.titleExtra,
      aspectRatio: config.aspectRatio,
      styleMode: config.styleMode,
      ipRole: config.ipRole,
      ipDescription: ipMetadata?.description ?? null,
      ipPromptKeywords: ipMetadata?.promptKeywords ?? null,
      imageStyle: config.imageStyle,
      logo: config.logo ?? "none",
      imageForm: direction.imageForm ?? "single",
      ctaEnabled: config.ctaEnabled === 1,
      ctaText: config.ctaText,
    });

    const promptEn = buildImagePrompt({
      directionTitle: direction.title,
      scenarioProblem: direction.scenarioProblem,
      copyTitleMain: copy.titleMain,
      copyTitleSub: copy.titleSub,
      copyTitleExtra: copy.titleExtra,
      aspectRatio: config.aspectRatio,
      styleMode: config.styleMode,
      imageStyle: config.imageStyle,
      ipRole: config.ipRole,
      ipDescription: ipMetadata?.description ?? null,
      ipPromptKeywords: ipMetadata?.promptKeywords ?? null,
      logo: config.logo ?? "none",
      imageForm: direction.imageForm ?? "single",
      referenceImageUrl: config.referenceImageUrl,
      channel: direction.channel,
      ctaEnabled: config.ctaEnabled === 1,
      ctaText: config.ctaText,
      descriptionPayload: promptZhPayload,
    });

    const negativePrompt = buildNegativePrompt({ imageStyle: config.imageStyle });
    const promptZh = JSON.stringify(promptZhPayload);

    db.update(imageConfigs)
      .set({ promptZh, promptEn, negativePrompt, updatedAt: Date.now() })
      .where(eq(imageConfigs.id, config.id))
      .run();

    const snapshotTimestamp = Date.now();
    for (const group of groups) {
      db.update(imageGroups)
        .set({
          promptZh,
          promptEn,
          negativePrompt,
          referenceImageUrl: config.referenceImageUrl ?? null,
          logo: config.logo ?? "none",
          updatedAt: snapshotTimestamp,
        })
        .where(eq(imageGroups.id, group.id))
        .run();
    }

    const referenceImageUrls = [
      config.referenceImageUrl ?? null,
      config.logo && config.logo !== "none"
        ? await readLogoAssetAsDataUrl(config.logo as "onion" | "onion_app")
        : null,
    ].filter(Boolean) as string[];

    for (const group of groups) {
      const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
      const groupPromptEn = group.promptEn ?? promptEn;
      const groupReferenceImageUrl = group.referenceImageUrl ?? config.referenceImageUrl ?? null;
      const groupLogo = group.logo ?? config.logo ?? "none";

      const groupReferenceImageUrls = [
        groupReferenceImageUrl,
        groupLogo && groupLogo !== "none"
          ? await readLogoAssetAsDataUrl(groupLogo as "onion" | "onion_app")
          : null,
      ].filter(Boolean) as string[];

      for (const image of images) {
        try {
          const slotDescription = buildImageSlotPrompt({
            slotIndex: image.slotIndex,
            slotCount: group.slotCount,
            imageForm: direction.imageForm ?? "single",
            copyType: copy.copyType,
            copyTitleMain: copy.titleMain,
            copyTitleSub: copy.titleSub,
            copyTitleExtra: copy.titleExtra,
          });
          const fullPrompt = mergeImagePromptWithSlot(groupPromptEn, slotDescription);

          const binaries = groupReferenceImageUrls.length > 0
            ? await generateImageFromReference({
              instruction: fullPrompt,
                imageUrls: groupReferenceImageUrls,
                aspectRatio: config.aspectRatio,
              })
            : await generateImageFromPrompt(fullPrompt, {
                aspectRatio: config.aspectRatio,
              });

          const binary = binaries[0];
          const pngBuffer = await sharp(binary.buffer).png().toBuffer();
          const saved = await saveImageBuffer({
            projectId,
            imageId: image.id,
            buffer: pngBuffer,
            extension: "png",
          });

          db.update(generatedImages)
            .set({
              filePath: saved.filePath,
              fileUrl: saved.fileUrl,
              status: "done",
              updatedAt: Date.now(),
            })
            .where(eq(generatedImages.id, image.id))
            .run();
        } catch (error) {
          const message = error instanceof Error ? error.message : "图片生成失败";
          hadFailure = true;
          db.update(generatedImages)
            .set({ status: "failed", errorMessage: message, updatedAt: Date.now() })
            .where(eq(generatedImages.id, image.id))
            .run();
        }
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
