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
import { parseAspectRatio } from "@/lib/export/utils";
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

function extractModelFromRequestJson(json: string | null | undefined): string | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json);
    return parsed.model ?? undefined;
  } catch {
    return undefined;
  }
}

function validateAspectRatio(width: number | null, height: number | null, targetRatio: string): string | null {
  if (!width || !height) {
    return `适配结果缺少实际尺寸，无法确认是否生成成目标比例 ${targetRatio}`;
  }
  const expected = parseAspectRatio(targetRatio);
  if (!expected) return null;
  const actual = width / height;
  const relativeError = Math.abs(actual - expected) / expected;
  if (relativeError <= 0.015) return null;
  return `适配结果实际比例与目标比例不一致：目标 ${targetRatio}，实际 ${width}x${height}`;
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
      actualWidth: null,
      actualHeight: null,
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
      actualWidth: saved.width,
      actualHeight: saved.height,
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
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const requestModel = typeof body.imageModel === "string" ? body.imageModel : undefined;

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
        requestModel,
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
  requestModel?: string;
}) {
  const db = getDb();
  const { runId, image, config, projectId, requestModel } = input;

  try {
    const group = db.select().from(imageGroups).where(eq(imageGroups.id, image.imageGroupId)).get();

    // 派生图（适配版本）：用父图作为参考图 + 适配 prompt 重新生成
    // 也兜住孤儿 derived image（group 已删但 image 记录残留）的情况
    const isDerivedWithParent = (group?.groupType.startsWith("derived|") || !group) && image.inpaintParentId;
    if (isDerivedWithParent) {
      const parentImage = db.select().from(generatedImages).where(eq(generatedImages.id, image.inpaintParentId!)).get();
      if (!parentImage?.filePath) {
        throw new Error("原始定稿图不存在");
      }

      // 从 groupType 提取目标比例：derived|{groupId}|{ratio}
      const targetRatio = group?.groupType.split("|")[2] ?? config.aspectRatio;
      const parentPromptContext = parentImage.finalPromptText ? `原图内容描述：${parentImage.finalPromptText}\n\n` : "";
      const prompt = image.finalPromptText ?? [
        parentPromptContext,
        `基于参考原图，重新生成一张 ${targetRatio} 比例的图片。请严格遵守以下规则：\n\n`,
        "【不可改变】\n",
        "- 画面核心主体（人物、产品、IP 角色等）必须与原图完全一致，包括形象、姿态、表情、服饰、配色。\n",
        "- 整体色调、光影风格、画风（写实/动漫/3D 等）必须与原图保持一致。\n\n",
        "【可以调整】\n",
        "- 背景：根据新比例自然延伸或裁切背景，补充的背景内容须与原图场景风格协调统一。\n",
        "- 文字排版：根据新比例重新布局文字的位置、大小、行数。例如原图一行五个字，新比例下可以变为一行四个字或六个字，字号也可以适当放大或缩小。文字内容本身不变，但排版必须适配新画幅，保证清晰可读且具有设计感。\n",
        "- 元素布局：主体与文字的相对位置可以根据新比例重新编排，确保整体构图平衡、有层次感。\n\n",
        "【整体要求】\n",
        "- 画面必须铺满整个画幅，不能有黑边、白边或空白区域。\n",
        "- 最终成品应具有专业设计感，像是设计师针对该比例专门设计的作品，而非简单的拉伸或裁切。",
      ].join("");
      const imageBuffer = await readFile(parentImage.filePath);
      const mimeType = getMimeTypeFromPath(parentImage.filePath);
      const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

      const adaptationModel = requestModel ?? extractModelFromRequestJson(image.generationRequestJson) ?? config.imageModel ?? undefined;

      const binaries = await generateImageFromReference({
        instruction: prompt,
        imageUrls: [dataUrl],
        aspectRatio: targetRatio,
        model: adaptationModel,
      });

      const binary = binaries[0];
      const pngBuffer = await sharp(binary.buffer).png().toBuffer();
      const saved = await saveImageBuffer({
        projectId,
        imageId: image.id,
        buffer: pngBuffer,
        extension: "png",
      });

      const ratioError = validateAspectRatio(saved.width, saved.height, targetRatio);
      if (ratioError) {
        await deleteFileIfExists(saved.filePath);
        await deleteFileIfExists(saved.thumbnailPath);
        setImageFailed(image.id, ratioError);
        finishGenerationRun(runId, { status: "failed", errorMessage: ratioError });
        return;
      }

      setImageDone(image.id, saved);
      db.update(generatedImages)
        .set({
          finalPromptText: prompt,
          generationRequestJson: JSON.stringify({
            promptText: prompt,
            negativePrompt: null,
            model: adaptationModel,
            aspectRatio: targetRatio,
          }),
        })
        .where(eq(generatedImages.id, image.id))
        .run();
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
