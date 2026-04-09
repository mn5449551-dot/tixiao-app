import { NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";

import { deleteFileIfExists, saveImageBuffer } from "@/lib/storage";
import { getDb } from "@/lib/db";
import {
  finishGenerationRun,
  GenerationConflictError,
  GenerationLimitError,
  startGenerationRun,
} from "@/lib/generation-runs";
import { getIpAssetMetadata } from "@/lib/ip-assets";
import { readLogoAssetAsDataUrl } from "@/lib/logo-assets";
import { generatedImages, imageConfigs, directions, copies, imageGroups } from "@/lib/schema";
import { generateImageFromPrompt, generateImageFromReference } from "@/lib/ai/image-chat";
import { buildImagePrompt, buildImageSlotPrompt, mergeImagePromptWithSlot } from "@/lib/ai/services/prompt-template";
import sharp from "sharp";

export async function GET(
  _request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const { id } = (await context.params) as { id: string };

    const db = getDb();
    const image = db
      .select({
        id: generatedImages.id,
        imageGroupId: generatedImages.imageGroupId,
        imageConfigId: generatedImages.imageConfigId,
        slotIndex: generatedImages.slotIndex,
        filePath: generatedImages.filePath,
        fileUrl: generatedImages.fileUrl,
        status: generatedImages.status,
        errorMessage: generatedImages.errorMessage,
        seed: generatedImages.seed,
        createdAt: generatedImages.createdAt,
        updatedAt: generatedImages.updatedAt,
      })
      .from(generatedImages)
      .where(eq(generatedImages.id, id))
      .get();

    if (!image) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    return NextResponse.json({ image });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取图片失败" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const { id } = (await context.params) as { id: string };

    const db = getDb();
    const image = db
      .select()
      .from(generatedImages)
      .where(eq(generatedImages.id, id))
      .get();

    if (!image) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    await deleteFileIfExists(image.filePath);

    db.delete(generatedImages).where(eq(generatedImages.id, id)).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除图片失败" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<unknown> },
) {
  let runId: string | null = null;
  let runFinished = false;

  try {
    const { id } = (await context.params) as { id: string };
    await request.json().catch(() => ({}));

    const db = getDb();
    const image = db
      .select()
      .from(generatedImages)
      .where(eq(generatedImages.id, id))
      .get();

    if (!image) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    // Clear old file
    await deleteFileIfExists(image.filePath);

    // Mark as generating
    db.update(generatedImages)
      .set({ status: "generating", filePath: null, fileUrl: null, errorMessage: null, updatedAt: Date.now() })
      .where(eq(generatedImages.id, id))
      .run();

    // Get the image config
    const config = db.select().from(imageConfigs).where(eq(imageConfigs.id, image.imageConfigId)).get();
    if (!config) {
      db.update(generatedImages)
        .set({ status: "failed", errorMessage: "图片配置不存在", updatedAt: Date.now() })
        .where(eq(generatedImages.id, id))
        .run();
      return NextResponse.json({ error: "图片配置不存在" }, { status: 422 });
    }

    // Get direction for projectId
    const direction = db.select().from(directions).where(eq(directions.id, config.directionId)).get();
    if (!direction) {
      db.update(generatedImages)
        .set({ status: "failed", errorMessage: "方向不存在", updatedAt: Date.now() })
        .where(eq(generatedImages.id, id))
        .run();
      return NextResponse.json({ error: "方向不存在" }, { status: 422 });
    }

    runId = startGenerationRun({
      projectId: direction.projectId,
      kind: "image",
      resourceType: "generated-image",
      resourceId: image.id,
    }).id;

    const activeRunId = runId;

    after(async () => {
      await regenerateSingleImage({
        runId: activeRunId,
        image,
        config,
        direction,
        projectId: direction.projectId,
      });
    });

    return NextResponse.json(
      { message: "图片已标记为重新生成", imageId: id },
      { status: 202 },
    );
  } catch (error) {
    if (runId && !runFinished) {
      finishGenerationRun(runId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "重新生成失败",
      });
      runFinished = true;
    }

    if (error instanceof GenerationConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          resource_type: error.resourceType,
          resource_id: error.resourceId,
        },
        { status: 409 },
      );
    }

    if (error instanceof GenerationLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          limit: error.limit,
          active_count: error.activeCount,
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "重新生成失败" },
      { status: 500 },
    );
  }
}

async function regenerateSingleImage(input: {
  runId: string;
  image: typeof generatedImages.$inferSelect;
  config: typeof imageConfigs.$inferSelect;
  direction: typeof directions.$inferSelect;
  projectId: string;
}) {
  const db = getDb();
  const { runId, image, config, direction, projectId } = input;

  try {
    const ipMetadata = config.ipRole ? getIpAssetMetadata(config.ipRole) : null;
    const group = db.select().from(imageGroups).where(eq(imageGroups.id, image.imageGroupId)).get();
    // Get copy for prompt building
    const copy = db.select().from(copies).where(eq(copies.id, config.copyId)).get();

    if (!copy) {
      throw new Error("文案不存在");
    }

    // Use existing prompt if available, otherwise build new one
    const promptEn = group?.promptEn || config.promptEn || buildImagePrompt({
      directionTitle: direction.title,
      scenarioProblem: direction.scenarioProblem,
      copyTitleMain: copy.titleMain,
      copyTitleSub: copy.titleSub,
      copyTitleExtra: copy.titleExtra,
      aspectRatio: group?.aspectRatio ?? config.aspectRatio,
      styleMode: group?.styleMode ?? config.styleMode,
      imageStyle: group?.imageStyle ?? config.imageStyle,
      ipRole: config.ipRole,
      ipDescription: ipMetadata?.description ?? null,
      ipPromptKeywords: ipMetadata?.promptKeywords ?? null,
      logo: group?.logo ?? config.logo ?? "none",
      imageForm: direction.imageForm ?? "single",
      referenceImageUrl: group?.referenceImageUrl ?? config.referenceImageUrl,
      channel: direction.channel,
      ctaEnabled: config.ctaEnabled === 1,
      ctaText: config.ctaText,
      descriptionPayload: group?.promptZh ?? config.promptZh ?? undefined,
    });

    const referenceImageUrls = [
      group?.referenceImageUrl ?? config.referenceImageUrl ?? null,
      (group?.logo ?? config.logo) && (group?.logo ?? config.logo) !== "none"
        ? await readLogoAssetAsDataUrl((group?.logo ?? config.logo) as "onion" | "onion_app")
        : null,
    ].filter(Boolean) as string[];

    // Generate image
    const slotPrompt = buildImageSlotPrompt({
      imageForm: direction.imageForm ?? "single",
      slotIndex: image.slotIndex,
      slotCount: direction.imageForm === "triple" ? 3 : direction.imageForm === "double" ? 2 : 1,
      copyType: copy.copyType,
      copyTitleMain: copy.titleMain,
      copyTitleSub: copy.titleSub,
      copyTitleExtra: copy.titleExtra,
    });
    const fullPrompt = mergeImagePromptWithSlot(promptEn, slotPrompt);
    const binaries = referenceImageUrls.length > 0
      ? await generateImageFromReference({
          instruction: fullPrompt,
          imageUrls: referenceImageUrls,
          aspectRatio: group?.aspectRatio ?? config.aspectRatio,
        })
      : await generateImageFromPrompt(fullPrompt, {
          aspectRatio: group?.aspectRatio ?? config.aspectRatio,
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
    finishGenerationRun(runId, { status: "done" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "图片重生成失败";
    db.update(generatedImages)
      .set({ status: "failed", errorMessage: message, updatedAt: Date.now() })
      .where(eq(generatedImages.id, image.id))
      .run();
    finishGenerationRun(runId, { status: "failed", errorMessage: message });
  }
}
