import { NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import sharp from "sharp";

import { editImage } from "@/lib/ai/image-chat";
import { getDb } from "@/lib/db";
import {
  finishGenerationRun,
  GenerationConflictError,
  GenerationLimitError,
  startGenerationRun,
} from "@/lib/generation-runs";
import { generatedImages, imageConfigs, directions } from "@/lib/schema";
import { saveImageBuffer } from "@/lib/storage";

export async function POST(
  request: Request,
  context: { params: Promise<unknown> },
) {
  let runId: string | null = null;
  let runFinished = false;

  try {
    const { id } = (await context.params) as { id: string };
    const body = await request.json();

    const { mask_data_url, inpaint_instruction, image_model } = body as {
      mask_data_url?: string;
      inpaint_instruction: string;
      image_model?: string;
    };

    if (!inpaint_instruction?.trim()) {
      return NextResponse.json(
        { error: "缺少必要参数：inpaint_instruction" },
        { status: 400 },
      );
    }

    const db = getDb();
    const image = db
      .select()
      .from(generatedImages)
      .where(eq(generatedImages.id, id))
      .get();

    if (!image) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    const config = db.select().from(imageConfigs).where(eq(imageConfigs.id, image.imageConfigId)).get();
    if (!config) {
      return NextResponse.json({ error: "图片配置不存在" }, { status: 422 });
    }

    const direction = db.select().from(directions).where(eq(directions.id, config.directionId)).get();
    if (!direction) {
      return NextResponse.json({ error: "方向不存在" }, { status: 422 });
    }

    runId = startGenerationRun({
      projectId: direction.projectId,
      kind: "inpaint",
      resourceType: "inpaint-source-image",
      resourceId: image.id,
    }).id;

    const newImageId = `img_inp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    db.insert(generatedImages).values({
      id: newImageId,
      imageGroupId: image.imageGroupId,
      imageConfigId: image.imageConfigId,
      slotIndex: image.slotIndex,
      status: "generating",
      inpaintParentId: image.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }).run();

    const activeRunId = runId;
    const resolvedModel = image_model ?? config.imageModel ?? undefined;
    after(async () => {
      await processInpaintInBackground({
        runId: activeRunId,
        imageId: newImageId,
        projectId: direction.projectId,
        imageUrl: image.fileUrl!,
        maskDataUrl: mask_data_url ?? null,
        instruction: inpaint_instruction,
        model: resolvedModel,
      });
    });

    return NextResponse.json({
      imageId: newImageId,
      status: "generating",
    }, { status: 202 });
  } catch (error) {
    if (runId && !runFinished) {
      finishGenerationRun(runId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "局部重绘失败",
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
      { error: error instanceof Error ? error.message : "局部重绘失败" },
      { status: 500 },
    );
  }
}

async function processInpaintInBackground(input: {
  runId: string;
  imageId: string;
  projectId: string;
  imageUrl: string;
  maskDataUrl: string | null;
  instruction: string;
  model?: string;
}) {
  const db = getDb();
  const { runId, imageId, projectId, imageUrl, maskDataUrl, instruction, model } = input;

  try {
    const result = await callInpaintApi({
      imageUrl,
      maskDataUrl,
      instruction,
      model,
    });

    const pngBuffer = await sharp(result.buffer).png().toBuffer();
    const saved = await saveImageBuffer({
      projectId,
      imageId,
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
      .where(eq(generatedImages.id, imageId))
      .run();
    finishGenerationRun(runId, { status: "done" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "局部重绘失败";
    db.update(generatedImages)
      .set({ status: "failed", errorMessage: message, updatedAt: Date.now() })
      .where(eq(generatedImages.id, imageId))
      .run();
    finishGenerationRun(runId, { status: "failed", errorMessage: message });
  }
}

async function callInpaintApi(input: {
  imageUrl: string;
  maskDataUrl: string | null;
  instruction: string;
  model?: string;
}): Promise<{ buffer: Buffer }> {
  const result = await editImage({
    prompt: input.instruction,
    imageUrl: input.imageUrl,
    model: input.model,
    maskDataUrl: input.maskDataUrl ?? undefined,
  });
  return { buffer: result[0].buffer };
}
