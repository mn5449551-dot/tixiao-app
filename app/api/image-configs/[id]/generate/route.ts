import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import sharp from "sharp";

import { generateImageDescription } from "@/lib/ai/agents/image-description-agent";
import { generateImageFromPrompt, generateImageFromReference } from "@/lib/ai/image-chat";
import { getIpAssetMetadata } from "@/lib/ip-assets";
import { readLogoAssetAsDataUrl } from "@/lib/logo-assets";
import { buildImageSlotPrompt, buildNegativePrompt, buildImagePrompt } from "@/lib/ai/services/prompt-template";
import { getDb } from "@/lib/db";
import { copies, directions, generatedImages, imageConfigs, imageGroups } from "@/lib/schema";
import { saveImageBuffer } from "@/lib/storage";

export async function POST(
  request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    if (!process.env.NEW_API_KEY) {
      return NextResponse.json(
        { error: "缺少 NEW_API_KEY，无法生成图片" },
        { status: 500 },
      );
    }

    const { id } = (await context.params) as { id: string };

    const db = getDb();
    const config = db.select().from(imageConfigs).where(eq(imageConfigs.id, id)).get();
    if (!config) {
      return NextResponse.json({ error: "图片配置不存在" }, { status: 404 });
    }

    const copy = db.select().from(copies).where(eq(copies.id, config.copyId)).get();
    const direction = db.select().from(directions).where(eq(directions.id, config.directionId)).get();
    if (!copy || !direction) {
      return NextResponse.json({ error: "图片配置关联数据不完整" }, { status: 422 });
    }

    const body = (await request.json().catch(() => ({}))) as { group_ids?: string[] };
    const requestedGroupIds = new Set(body.group_ids ?? []);
    const groups = db
      .select()
      .from(imageGroups)
      .where(eq(imageGroups.imageConfigId, config.id))
      .all()
      .filter((group) => requestedGroupIds.size === 0 || requestedGroupIds.has(group.id));
    if (groups.length === 0) {
      return NextResponse.json({ error: "无候选组，无法生成" }, { status: 422 });
    }

    // Build image group payload with initial "generating" status
    const imageGroupsPayload = [] as Array<{
      id: string;
      group_type: string;
      slot_count: number;
      images: Array<{ id: string; slot_index: number; status: string; file_url: string | null }>;
    }>;

    for (const group of groups) {
      const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
      const imagePayload = [] as Array<{ id: string; slot_index: number; status: string; file_url: string | null }>;

      for (const image of images) {
        db.update(generatedImages)
          .set({ status: "generating", errorMessage: null, updatedAt: Date.now() })
          .where(eq(generatedImages.id, image.id))
          .run();

        imagePayload.push({ id: image.id, slot_index: image.slotIndex, status: "generating", file_url: null });
      }

      imageGroupsPayload.push({
        id: group.id,
        group_type: group.groupType,
        slot_count: group.slotCount,
        images: imagePayload,
      });
    }

    // Process images in background — return 202 immediately
    processImagesInBackground({
      groups,
      config,
      direction,
      copy,
      projectId: direction.projectId,
    });

    return NextResponse.json({ image_groups: imageGroupsPayload }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "候选图生成失败" },
      { status: 500 },
    );
  }
}

/**
 * Process image generation in the background using setImmediate.
 * Uses Agent 5 for scene description, then calls image API.
 */
function processImagesInBackground(input: {
  groups: Array<typeof imageGroups.$inferSelect>;
  config: typeof imageConfigs.$inferSelect;
  direction: typeof directions.$inferSelect;
  copy: typeof copies.$inferSelect;
  projectId: string;
}) {
  setImmediate(async () => {
    const db = getDb();
    const { groups, config, direction, copy, projectId } = input;

    try {
      const ipMetadata = config.ipRole ? getIpAssetMetadata(config.ipRole) : null;

      // Agent 5: Generate scene description
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

      // Generate images for each group and slot
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
                })
              : await generateImageFromPrompt(fullPrompt);

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
            db.update(generatedImages)
              .set({ status: "failed", errorMessage: message, updatedAt: Date.now() })
              .where(eq(generatedImages.id, image.id))
              .run();
          }
        }
      }
    } catch (error) {
      // If Agent 5 or the entire batch fails, mark all images as failed
      const message = error instanceof Error ? error.message : "图片生成流程失败";
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
    }
  });
}
