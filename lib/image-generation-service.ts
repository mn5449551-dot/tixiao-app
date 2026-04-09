import { eq } from "drizzle-orm";
import sharp from "sharp";

import { generateImageDescription } from "@/lib/ai/agents/image-description-agent";
import { generateImageFromPrompt, generateImageFromReference } from "@/lib/ai/image-chat";
import { buildImagePrompt, buildImageSlotPrompt, buildNegativePrompt } from "@/lib/ai/services/prompt-template";
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

  const timestamp = Date.now();
  const imageGroupsPayload = [] as PreparedImageGeneration["imageGroupsPayload"];

  for (const group of groups) {
    const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
    const imagePayload = [] as PreparedImageGeneration["imageGroupsPayload"][number]["images"];

    for (const image of images) {
      db.update(generatedImages)
        .set({ status: "generating", errorMessage: null, updatedAt: timestamp })
        .where(eq(generatedImages.id, image.id))
        .run();

      imagePayload.push({
        id: image.id,
        slot_index: image.slotIndex,
        status: "generating",
        file_url: null,
      });
    }

    imageGroupsPayload.push({
      id: group.id,
      group_type: group.groupType,
      slot_count: group.slotCount,
      images: imagePayload,
    });
  }

  return {
    config,
    direction,
    copy,
    groups,
    projectId: direction.projectId,
    imageGroupsPayload,
  } satisfies PreparedImageGeneration;
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

    const promptZh = await generateImageDescription({
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
    });

    const negativePrompt = buildNegativePrompt({ imageStyle: config.imageStyle });

    db.update(imageConfigs)
      .set({ promptZh, promptEn, negativePrompt, updatedAt: Date.now() })
      .where(eq(imageConfigs.id, config.id))
      .run();

    const referenceImageUrls = [
      config.referenceImageUrl ?? null,
      config.logo && config.logo !== "none"
        ? await readLogoAssetAsDataUrl(config.logo as "onion" | "onion_app")
        : null,
    ].filter(Boolean) as string[];

    for (const group of groups) {
      const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();

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
          const fullPrompt = `${promptZh}。${slotDescription}`;

          const binaries = referenceImageUrls.length > 0
            ? await generateImageFromReference({
                instruction: fullPrompt,
                imageUrls: referenceImageUrls,
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
