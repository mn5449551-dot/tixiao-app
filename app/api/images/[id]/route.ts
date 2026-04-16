import { NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";

import { getRouteErrorMessage, jsonError, readIdParam } from "@/lib/api-route";
import { deleteFileIfExists, saveImageBuffer } from "@/lib/storage";
import { getDb } from "@/lib/db";
import {
  finishGenerationRun,
  GenerationConflictError,
  GenerationLimitError,
  startGenerationRun,
} from "@/lib/generation-runs";
import { generatedImages, imageConfigs, directions, copies, imageGroups } from "@/lib/schema";
import { generateImageFromPrompt, generateImageFromReference } from "@/lib/ai/image-chat";
import sharp from "sharp";

function getMimeTypeFromPath(filePath: string | null | undefined): string {
  const ext = filePath?.split(".").pop()?.toLowerCase();

  if (ext === "jpg" || ext === "jpeg") {
    return "image/jpeg";
  }

  if (ext === "webp") {
    return "image/webp";
  }

  return "image/png";
}

function getImageById(imageId: string) {
  const db = getDb();
  return db
    .select()
    .from(generatedImages)
    .where(eq(generatedImages.id, imageId))
    .get();
}

function setImageRegenerating(imageId: string): void {
  const db = getDb();
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
    .where(eq(generatedImages.id, imageId))
    .run();
}

function setImageDone(imageId: string, saved: Awaited<ReturnType<typeof saveImageBuffer>>): void {
  const db = getDb();
  db.update(generatedImages)
    .set({
      filePath: saved.filePath,
      fileUrl: saved.fileUrl,
      thumbnailPath: saved.thumbnailPath,
      thumbnailUrl: saved.thumbnailUrl,
      status: "done",
      updatedAt: Date.now(),
    })
    .where(eq(generatedImages.id, imageId))
    .run();
}

function setImageFailed(imageId: string, message: string): void {
  const db = getDb();
  db.update(generatedImages)
    .set({ status: "failed", errorMessage: message, updatedAt: Date.now() })
    .where(eq(generatedImages.id, imageId))
    .run();
}

function finishFailedImageRun(runId: string | null, error: unknown, fallbackMessage: string): void {
  if (!runId) {
    return;
  }

  finishGenerationRun(runId, {
    status: "failed",
    errorMessage: getRouteErrorMessage(error, fallbackMessage),
  });
}

function loadRegenerationContext(imageId: string) {
  const db = getDb();
  const image = getImageById(imageId);
  if (!image) {
    return null;
  }

  const config = db.select().from(imageConfigs).where(eq(imageConfigs.id, image.imageConfigId)).get();
  const direction = config
    ? db.select().from(directions).where(eq(directions.id, config.directionId)).get()
    : null;

  return { image, config, direction };
}

export async function GET(
  _request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const id = await readIdParam(context);

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
      return jsonError("图片不存在", 404);
    }

    return NextResponse.json({ image });
  } catch (error) {
    return jsonError(getRouteErrorMessage(error, "获取图片失败"));
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const id = await readIdParam(context);

    const db = getDb();
    const image = getImageById(id);

    if (!image) {
      return jsonError("图片不存在", 404);
    }

    await deleteFileIfExists(image.filePath);
    await deleteFileIfExists(image.thumbnailPath);

    db.delete(generatedImages).where(eq(generatedImages.id, id)).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(getRouteErrorMessage(error, "删除图片失败"));
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<unknown> },
) {
  let runId: string | null = null;

  try {
    const id = await readIdParam(context);
    await request.json().catch(() => ({}));

    const regenerationContext = loadRegenerationContext(id);
    if (!regenerationContext) {
      return jsonError("图片不存在", 404);
    }
    const { image, config, direction } = regenerationContext;

    // Clear old file
    await deleteFileIfExists(image.filePath);
    await deleteFileIfExists(image.thumbnailPath);

    setImageRegenerating(id);

    if (!config) {
      setImageFailed(id, "图片配置不存在");
      return jsonError("图片配置不存在", 422);
    }

    if (!direction) {
      setImageFailed(id, "方向不存在");
      return jsonError("方向不存在", 422);
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
        projectId: direction.projectId,
      });
    });

    return NextResponse.json(
      { message: "图片已标记为重新生成", imageId: id },
      { status: 202 },
    );
  } catch (error) {
    finishFailedImageRun(runId, error, "重新生成失败");

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

    return jsonError(getRouteErrorMessage(error, "重新生成失败"));
  }
}

async function regenerateSingleImage(input: {
  runId: string;
  image: typeof generatedImages.$inferSelect;
  config: typeof imageConfigs.$inferSelect;
  projectId: string;
}) {
  const db = getDb();
  const { runId, image, config, projectId } = input;

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
      const mimeType = getMimeTypeFromPath(parentImage.filePath);
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

      setImageDone(image.id, saved);
      finishGenerationRun(runId, { status: "done" });
      return;
    }

    // 系列图差异重绘（slot 2/3）：拿同组 slot 1 作参考图
    if (image.promptType === "delta" && image.slotIndex > 1) {
      const slot1Image = db
        .select()
        .from(generatedImages)
        .where(eq(generatedImages.imageGroupId, image.imageGroupId))
        .all()
        .find((img) => img.slotIndex === 1);

      if (!slot1Image?.filePath) {
        throw new Error("系列图第 1 张不存在，无法重绘后续图");
      }

      const prompt = image.finalPromptText ?? "保持与参考图一致的风格，重新生成";
      const imageBuffer = await readFile(slot1Image.filePath);
      const mimeType = getMimeTypeFromPath(slot1Image.filePath);
      const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

      const binaries = await generateImageFromReference({
        instruction: prompt,
        imageUrls: [dataUrl],
        aspectRatio: group?.aspectRatio ?? config.aspectRatio,
        model: "qwen-image-2.0",
      });

      const binary = binaries[0];
      const pngBuffer = await sharp(binary.buffer).png().toBuffer();
      const saved = await saveImageBuffer({
        projectId,
        imageId: image.id,
        buffer: pngBuffer,
        extension: "png",
      });

      setImageDone(image.id, saved);
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
    const pngBuffer = await sharp(binary.buffer).png().toBuffer();
    const saved = await saveImageBuffer({
      projectId,
      imageId: image.id,
      buffer: pngBuffer,
      extension: "png",
    });

    setImageDone(image.id, saved);
    finishGenerationRun(runId, { status: "done" });
  } catch (error) {
    const message = getRouteErrorMessage(error, "图片重生成失败");
    setImageFailed(image.id, message);
    finishGenerationRun(runId, { status: "failed", errorMessage: message });
  }
}
