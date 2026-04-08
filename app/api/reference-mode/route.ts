import sharp from "sharp";

import { NextResponse } from "next/server";

import { generateImageFromReference } from "@/lib/ai/image-chat";
import { createId } from "@/lib/id";
import { saveImageBuffer } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      project_id?: string;
      reference_image_url?: string;
      instruction?: string;
    };

    if (!body.reference_image_url || !body.instruction) {
      return NextResponse.json({ error: "reference_image_url 和 instruction 必填" }, { status: 400 });
    }

    const binaries = await generateImageFromReference({
      instruction: body.instruction,
      imageUrl: body.reference_image_url,
    });

    const projectId = body.project_id ?? "reference-mode";
    const images = [] as Array<{ id: string; file_url: string; mime_type: string }>;

    for (const binary of binaries) {
      const imageId = createId("refimg");
      const pngBuffer = await sharp(binary.buffer).png().toBuffer();
      const saved = await saveImageBuffer({
        projectId,
        imageId,
        buffer: pngBuffer,
        extension: "png",
      });
      images.push({ id: imageId, file_url: saved.fileUrl, mime_type: binary.mimeType });
    }

    return NextResponse.json({ images });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "参考图模式生成失败" },
      { status: 500 },
    );
  }
}
