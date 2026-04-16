import { eq, inArray } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

import {
  generateImageDescription,
  resolveSeriesSlotRoles,
  type ImageDescriptionInput,
} from "@/lib/ai/agents/image-description-agent";
import {
  generateSeriesDeltaPrompts,
  type SeriesImageAgentInput,
} from "@/lib/ai/agents/series-image-agent";
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

function buildGenerationRequestJson(input: {
  promptText: string;
  negativePrompt: string | null;
  model: string | null;
  aspectRatio: string;
  referenceImages: Array<{ url: string }>;
}): string {
  return JSON.stringify({
    promptText: input.promptText,
    negativePrompt: input.negativePrompt,
    model: input.model,
    aspectRatio: input.aspectRatio,
    referenceImages: input.referenceImages,
  });
}

function markGeneratedImageDone(input: {
  imageId: string;
  saved: Awaited<ReturnType<typeof saveImageBuffer>>;
}): void {
  const db = getDb();

  db.update(generatedImages)
    .set({
      filePath: input.saved.filePath,
      fileUrl: input.saved.fileUrl,
      thumbnailPath: input.saved.thumbnailPath,
      thumbnailUrl: input.saved.thumbnailUrl,
      status: "done",
      updatedAt: Date.now(),
    })
    .where(eq(generatedImages.id, input.imageId))
    .run();
}

function markGeneratedImageFailed(imageId: string, message: string): void {
  const db = getDb();

  db.update(generatedImages)
    .set({ status: "failed", errorMessage: message, updatedAt: Date.now() })
    .where(eq(generatedImages.id, imageId))
    .run();
}

function markUndoneGroupImagesFailed(groups: ImageGroupRecord[], message: string): void {
  const db = getDb();

  for (const group of groups) {
    const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
    for (const image of images) {
      if (image.status !== "done") {
        markGeneratedImageFailed(image.id, message);
      }
    }
  }
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

function isSeriesMode(direction: DirectionRecord): boolean {
  return direction.imageForm === "double" || direction.imageForm === "triple";
}

function getSeriesSlotCount(imageForm: string | null | undefined): number {
  if (imageForm === "triple") return 3;
  if (imageForm === "double") return 2;
  return 1;
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
    if (descriptionResult.prompts.length === 0) {
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
          updatedAt: snapshotTimestamp,
        })
        .where(eq(imageGroups.id, group.id))
        .run();
    }

    const isSeries = isSeriesMode(direction);
    const slotCount = isSeries ? getSeriesSlotCount(direction.imageForm) : 1;

    // Phase 1: Build work items for slot 1 only
    const slot1WorkItems: Array<{
      imageId: string;
      groupId: string;
      prompt: string;
      negativePrompt: string | null;
      referenceImageUrls: string[];
      groupModel: string | null;
    }> = [];

    for (const group of groups) {
      const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
      const groupReferenceImageUrl = group.referenceImageUrl ?? config.referenceImageUrl ?? null;
      const groupModel = group.imageModel ?? config.imageModel ?? null;
      const groupReferenceImageUrls = [groupReferenceImageUrl].filter(Boolean) as string[];

      for (const image of images) {
        if (image.slotIndex !== 1) continue;
        const slot1Prompt = promptMap.get(1);
        if (!slot1Prompt) continue;
        slot1WorkItems.push({
          imageId: image.id,
          groupId: group.id,
          prompt: slot1Prompt.prompt,
          negativePrompt: slot1Prompt.negativePrompt,
          referenceImageUrls: groupReferenceImageUrls,
          groupModel,
        });
      }
    }

    // Save slot 1 prompt snapshots
    for (const item of slot1WorkItems) {
      db.update(generatedImages)
        .set({
          finalPromptText: item.prompt,
          finalNegativePrompt: item.negativePrompt,
          promptType: "full",
          generationRequestJson: buildGenerationRequestJson({
            promptText: item.prompt,
            negativePrompt: item.negativePrompt,
            model: item.groupModel,
            aspectRatio: config.aspectRatio,
            referenceImages: item.referenceImageUrls.map((url) => ({ url })),
          }),
          updatedAt: Date.now(),
        })
        .where(eq(generatedImages.id, item.imageId))
        .run();
    }

    // Generate slot 1 images in parallel
    const slot1Results = await Promise.allSettled(
      slot1WorkItems.map(async (item) => {
        const binaries = item.referenceImageUrls.length > 0
          ? await generateImageFromReference({
              instruction: item.prompt,
              imageUrls: item.referenceImageUrls,
              aspectRatio: config.aspectRatio,
              model: item.groupModel ?? undefined,
            })
          : await generateImageFromPrompt(item.prompt, {
              aspectRatio: config.aspectRatio,
              model: item.groupModel ?? undefined,
            });

        const binary = binaries[0];
        const pngBuffer = await sharp(binary.buffer).png().toBuffer();
        const saved = await saveImageBuffer({
          projectId,
          imageId: item.imageId,
          buffer: pngBuffer,
          extension: "png",
        });
        return { imageId: item.imageId, saved };
      }),
    );

    // Process slot 1 results into per-group map
    const slot1DoneMap = new Map<string, { fileUrl: string; filePath: string; imageId: string }>();

    for (let i = 0; i < slot1Results.length; i += 1) {
      const result = slot1Results[i];
      const item = slot1WorkItems[i];
      const imageId = item.imageId;
      const groupId = item.groupId;

      if (result.status === "fulfilled") {
        markGeneratedImageDone({ imageId, saved: result.value.saved });
        const updatedImage = db.select().from(generatedImages).where(eq(generatedImages.id, imageId)).get();
        slot1DoneMap.set(groupId, {
          fileUrl: result.value.saved.fileUrl,
          filePath: updatedImage?.filePath ?? "",
          imageId,
        });
      } else {
        const message = result.reason instanceof Error ? result.reason.message : "图片生成失败";
        hadFailure = true;
        markGeneratedImageFailed(imageId, message);
      }
    }

    // Phase 2: For series mode, generate slot 2+ per group with its own delta prompt
    if (isSeries) {
      for (const group of groups) {
        const slot1Info = slot1DoneMap.get(group.id);
        if (!slot1Info) {
          // Slot 1 failed for this group — mark all slot 2+ as failed
          const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
          for (const image of images) {
            if (image.slotIndex > 1 && image.status !== "done") {
              markGeneratedImageFailed(image.id, "系列图第 1 张生成失败，后续图无法生成");
            }
          }
          hadFailure = true;
          continue;
        }

        // Build delta prompt for this group via series-image-agent
        const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
        const slot1Prompt = promptMap.get(1)?.prompt ?? descriptionResult.prompts[0]!.prompt;
        const copyTexts = [copy.titleMain, copy.titleSub ?? "", copy.titleExtra ?? ""].filter(Boolean);
        const targetTexts = new Map<number, string>();
        for (let i = 1; i < slotCount; i += 1) {
          const text = copyTexts[i] ?? copyTexts[0] ?? "";
          targetTexts.set(i + 1, text);
        }

        const slotRoles = resolveSeriesSlotRoles(copy.copyType, slotCount);
        const deltaResult = await generateSeriesDeltaPrompts({
          slot1Prompt,
          slot1ImageUrl: slot1Info.fileUrl,
          targetTexts,
          copyType: copy.copyType,
          slotRoles,
        });

        const deltaMap = new Map(deltaResult.deltas.map((d) => [d.slotIndex, d]));

        // Update promptBundleJson with delta prompts for this group
        const groupPromptBundleJson = JSON.stringify({
          agentType: "series",
          prompts: [
            { slotIndex: 1, prompt: slot1Prompt, negativePrompt: promptMap.get(1)?.negativePrompt },
            ...deltaResult.deltas.map((d) => ({ slotIndex: d.slotIndex, prompt: d.prompt, negativePrompt: d.negativePrompt })),
          ],
        });

        db.update(imageGroups)
          .set({ promptBundleJson: groupPromptBundleJson, updatedAt: Date.now() })
          .where(eq(imageGroups.id, group.id))
          .run();

        // Build slot 2+ work items for this group
        const slot2PlusItems: Array<{
          imageId: string;
          slotIndex: number;
          prompt: string;
          negativePrompt: string;
        }> = [];

        for (const image of images) {
          if (image.slotIndex <= 1) continue;
          const delta = deltaMap.get(image.slotIndex);
          if (!delta) continue;

          slot2PlusItems.push({
            imageId: image.id,
            slotIndex: image.slotIndex,
            prompt: delta.prompt,
            negativePrompt: delta.negativePrompt,
          });
        }

        // Save slot 2+ prompt snapshots for this group
        for (const item of slot2PlusItems) {
          db.update(generatedImages)
            .set({
              finalPromptText: item.prompt,
              finalNegativePrompt: item.negativePrompt,
              promptType: "delta",
              generationRequestJson: buildGenerationRequestJson({
                promptText: item.prompt,
                negativePrompt: item.negativePrompt,
                model: "qwen-image-2.0",
                aspectRatio: config.aspectRatio,
                referenceImages: [{ url: slot1Info.fileUrl }],
              }),
              updatedAt: Date.now(),
            })
            .where(eq(generatedImages.id, item.imageId))
            .run();
        }

        // Generate slot 2+ for this group via qwen-image-2.0 images/edits
        const slot2PlusResults = await Promise.allSettled(
          slot2PlusItems.map(async (item) => {
            const imageBuffer = await readFile(slot1Info.filePath);
            const ext = slot1Info.filePath.split(".").pop()?.toLowerCase();
            const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
            const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

            const binaries = await generateImageFromReference({
              instruction: item.prompt,
              imageUrl: dataUrl,
              aspectRatio: config.aspectRatio,
              model: "qwen-image-2.0",
            });

            const binary = binaries[0];
            const pngBuffer = await sharp(binary.buffer).png().toBuffer();
            const saved = await saveImageBuffer({
              projectId,
              imageId: item.imageId,
              buffer: pngBuffer,
              extension: "png",
            });
            return { imageId: item.imageId, saved };
          }),
        );

        for (let i = 0; i < slot2PlusResults.length; i += 1) {
          const result = slot2PlusResults[i];
          const imageId = slot2PlusItems[i].imageId;

          if (result.status === "fulfilled") {
            markGeneratedImageDone({ imageId, saved: result.value.saved });
          } else {
            const message = result.reason instanceof Error ? result.reason.message : "图片生成失败";
            hadFailure = true;
            markGeneratedImageFailed(imageId, message);
          }
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "图片生成流程失败";
    hadFailure = true;
    batchErrorMessage = message;
    markUndoneGroupImagesFailed(groups, message);
  } finally {
    finishGenerationRun(runId, {
      status: hadFailure ? "failed" : "done",
      errorMessage: hadFailure ? batchErrorMessage ?? "部分图片生成失败" : null,
    });
  }
}
