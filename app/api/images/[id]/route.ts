import { NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";

import { deleteFileIfExists, saveImageBuffer } from "@/lib/storage";
import { getDb } from "@/lib/db";
import {
  finishGenerationRun,
  GenerationConflictError,
  GenerationLimitError,
  startGenerationRun,
} from "@/lib/generation-runs";
import { getIpAssetMetadata } from "@/lib/ip-assets";
import { generatedImages, imageConfigs, directions, copies, imageGroups } from "@/lib/schema";
import { generateImageFromPrompt, generateImageFromReference } from "@/lib/ai/image-chat";
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
    await deleteFileIfExists(image.thumbnailPath);

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
    await deleteFileIfExists(image.thumbnailPath);

    // Mark as generating
    db.update(generatedImages)
      .set({
        status: "generating",
        filePath: null,
        fileUrl: null,
        thumbnailPath: null,
        thumbnailUrl: null,
        errorMessage: null,
        updatedAt: Date.now(),
      })
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
    const group = db.select().from(imageGroups).where(eq(imageGroups.id, image.imageGroupId)).get();

    // 派生图（适配版本）：用父图作为参考图 + 适配 prompt 重新生成
    if (group?.groupType.startsWith("derived|") && image.inpaintParentId) {
      const parentImage = db.select().from(generatedImages).where(eq(generatedImages.id, image.inpaintParentId)).get();
      if (!parentImage?.filePath) {
        throw new Error("原始定稿图不存在");
      }

      const prompt = image.finalPromptText ?? "保持原图内容和构图不变，扩展画面适配目标比例，画面必须铺满整个画幅，不能有黑边。";
      const imageBuffer = await readFile(parentImage.filePath);
      const ext = parentImage.filePath.split(".").pop()?.toLowerCase();
      const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
      const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

      // 从 groupType 提取目标比例：derived|{groupId}|{ratio}
      const targetRatio = group.groupType.split("|")[2] ?? config.aspectRatio;

      const binaries = await generateImageFromReference({
        instruction: prompt,
        imageUrls: [dataUrl],
        aspectRatio: targetRatio,
        model: config.imageModel ?? undefined,
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
          thumbnailPath: saved.thumbnailPath,
          thumbnailUrl: saved.thumbnailUrl,
          status: "done",
          updatedAt: Date.now(),
        })
        .where(eq(generatedImages.id, image.id))
        .run();
      finishGenerationRun(runId, { status: "done" });
      return;
    }

    // 常规候选图重新生成：复用 prompt 快照
    const copy = db.select().from(copies).where(eq(copies.id, config.copyId)).get();

    if (!copy) {
      throw new Error("文案不存在");
    }

    if (!image.finalPromptText) {
      throw new Error("当前图片缺少最终提示词快照，旧版图片请重新生成候选图");
    }

    const ipMetadata = config.ipRole ? getIpAssetMetadata(config.ipRole) : null;

    const referenceImageUrls = [
      group?.referenceImageUrl ?? config.referenceImageUrl ?? null,
    ].filter(Boolean) as string[];

    const fullPrompt = image.finalPromptText;
    const binaries = referenceImageUrls.length > 0
      ? await generateImageFromReference({
          instruction: fullPrompt,
          imageUrls: referenceImageUrls,
          aspectRatio: group?.aspectRatio ?? config.aspectRatio,
          model: config.imageModel ?? undefined,
        })
      : await generateImageFromPrompt(fullPrompt, {
          aspectRatio: group?.aspectRatio ?? config.aspectRatio,
          model: config.imageModel ?? undefined,
        });

    const binary = binaries[0];
    let pngBuffer = await sharp(binary.buffer).png().toBuffer();
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
        thumbnailPath: saved.thumbnailPath,
        thumbnailUrl: saved.thumbnailUrl,
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
