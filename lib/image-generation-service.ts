import { eq, inArray } from "drizzle-orm";
import sharp from "sharp";

import {
  generateSlotImagePrompt,
  type SharedBaseContext,
  type SlotPromptPayload,
  type SlotSpecificContext,
} from "@/lib/ai/agents/image-description-agent";
import { generateImageFromPrompt, generateImageFromReference } from "@/lib/ai/image-chat";
import { buildImagePrompt, buildNegativePrompt } from "@/lib/ai/services/prompt-template";
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

function resolveSlotRole(copyType: string | null | undefined, slotIndex: number, slotCount: number) {
  if (slotCount <= 1) return "complete_message";

  const normalized = (copyType ?? "").trim();
  if (slotCount === 2) {
    if (normalized.includes("对照")) {
      return slotIndex === 1 ? "before_state" : "after_state";
    }
    if (normalized.includes("递进")) {
      return slotIndex === 1 ? "starting_point" : "next_step";
    }
    return slotIndex === 1 ? "pain_or_cause" : "solution_or_result";
  }

  if (normalized.includes("因果")) {
    return ["cause", "intervention", "effect"][slotIndex - 1] ?? `slot_${slotIndex}`;
  }
  if (normalized.includes("并列")) {
    return ["selling_point_1", "selling_point_2", "selling_point_3"][slotIndex - 1] ?? `slot_${slotIndex}`;
  }
  if (normalized.includes("互补")) {
    return ["main_problem", "supporting_solution", "supporting_benefit"][slotIndex - 1] ?? `slot_${slotIndex}`;
  }
  return ["problem_entry", "process_action", "result_upgrade"][slotIndex - 1] ?? `slot_${slotIndex}`;
}

export function buildSlotSpecificContexts(input: {
  imageForm: string | null | undefined;
  copyType: string | null | undefined;
  titleMain: string;
  titleSub?: string | null;
  titleExtra?: string | null;
  ctaEnabled: boolean;
  ctaText: string | null;
}): SlotSpecificContext[] {
  const titles = [input.titleMain, input.titleSub ?? "", input.titleExtra ?? ""].filter(Boolean);
  const slotCount = input.imageForm === "triple" ? 3 : input.imageForm === "double" ? 2 : 1;

  if (slotCount === 1) {
    return [{
      slotIndex: 1,
      slotCount: 1,
      currentSlotText: [input.titleMain, input.titleSub].filter(Boolean).join(" / "),
      allSlotTexts: [input.titleMain, input.titleSub ?? "", input.titleExtra ?? ""].filter(Boolean),
      slotRole: "complete_message",
      mustShowTextMode: input.titleSub ? "main_and_sub_same_frame" : "single_text",
      mustNotRepeat: "不要偏离当前单图的完整表达任务。",
      layoutExpectation: input.ctaEnabled
        ? `单图完整承载主副标题，并为 CTA「${input.ctaText ?? "立即下载"}」预留清晰区域。`
        : "单图完整承载当前主副标题信息。",
    }];
  }

  return Array.from({ length: slotCount }, (_, index) => {
    const slotIndex = index + 1;
    const currentSlotText = titles[index] ?? titles[titles.length - 1] ?? input.titleMain;
    return {
      slotIndex,
      slotCount,
      currentSlotText,
      allSlotTexts: titles,
      slotRole: resolveSlotRole(input.copyType, slotIndex, slotCount),
      mustShowTextMode: "single_text",
      mustNotRepeat: "不要重复其他图位的文案和职责。",
      layoutExpectation: `当前图位重点服务文案“${currentSlotText}”，并与其他图形成清晰区分。`,
    };
  });
}

async function buildSharedBaseContext(input: {
  config: ImageConfigRecord;
  direction: DirectionRecord;
  copy: CopyRecord;
  ipMetadata: ReturnType<typeof getIpAssetMetadata> | null;
}): Promise<SharedBaseContext> {
  const referenceImages: SharedBaseContext["referenceImages"] = [];

  if (input.config.referenceImageUrl) {
    referenceImages.push({
      role: input.config.ipRole ? "ip" : "style",
      url: input.config.referenceImageUrl,
      usage: input.config.ipRole
        ? "保持角色长相、服装、发型与整体角色识别特征一致。"
        : "参考整体构图、风格或氛围，不要机械复刻。",
    });
  }

  if (input.config.logo && input.config.logo !== "none") {
    referenceImages.push({
      role: "logo",
      url: await readLogoAssetAsDataUrl(input.config.logo as "onion" | "onion_app"),
      usage: "左上角真实露出，不得改字改形，不得重新设计。",
    });
  }

  return {
    direction: {
      title: input.direction.title,
      targetAudience: input.direction.targetAudience ?? "家长",
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
    consistencyConstraints: {
      sameCharacterIdentity: true,
      sameOutfitAndHair: Boolean(input.config.ipRole),
      sameSceneFamily: true,
      sameBrandSystem: true,
      sameLightingTone: true,
      allowPoseChange: true,
      allowCameraVariation: true,
    },
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
    const slotInputs = buildSlotSpecificContexts({
      imageForm: direction.imageForm ?? "single",
      copyType: copy.copyType,
      titleMain: copy.titleMain,
      titleSub: copy.titleSub,
      titleExtra: copy.titleExtra,
      ctaEnabled: config.ctaEnabled === 1,
      ctaText: config.ctaText,
    });
    const slotPayloads = await Promise.all(
      slotInputs.map((slot) => generateSlotImagePrompt({ sharedBase, slot })),
    );
    const slotPayloadMap = new Map<number, SlotPromptPayload>(
      slotPayloads.map((payload) => [payload.slotMeta.slotIndex, payload]),
    );
    const primarySlotPayload = slotPayloadMap.get(1) ?? slotPayloads[0];
    if (!primarySlotPayload) {
      throw new Error("图片描述生成失败：未生成任何 slot prompt");
    }

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
      descriptionPayload: primarySlotPayload,
    });

    const negativePrompt = primarySlotPayload.negativePrompt || buildNegativePrompt({ imageStyle: config.imageStyle });
    const promptZh = JSON.stringify(primarySlotPayload);
    const sharedBaseSnapshot = JSON.stringify(sharedBase);

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
          sharedBaseSnapshot,
          updatedAt: snapshotTimestamp,
        })
        .where(eq(imageGroups.id, group.id))
        .run();
    }

    for (const group of groups) {
      const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
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
          const slotPayload = slotPayloadMap.get(image.slotIndex) ?? primarySlotPayload;
          const fullPrompt = buildImagePrompt({
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
            logo: group.logo ?? config.logo ?? "none",
            imageForm: direction.imageForm ?? "single",
            referenceImageUrl: groupReferenceImageUrl,
            channel: direction.channel,
            ctaEnabled: config.ctaEnabled === 1,
            ctaText: config.ctaText,
            descriptionPayload: slotPayload,
          });

          db.update(generatedImages)
            .set({
              slotPromptSnapshot: JSON.stringify(slotPayload),
              slotNegativePrompt: slotPayload.negativePrompt,
              referencePlanSnapshot: JSON.stringify(slotPayload.referencePlan),
              promptSummaryText: slotPayload.summaryText,
              updatedAt: Date.now(),
            })
            .where(eq(generatedImages.id, image.id))
            .run();

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
