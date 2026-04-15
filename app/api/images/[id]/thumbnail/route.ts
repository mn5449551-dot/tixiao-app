import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { getDb } from "@/lib/db";
import { generatedImages } from "@/lib/schema";

export async function GET(
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

    if (!image?.filePath) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    // Try serving existing thumbnail
    if (image.thumbnailPath) {
      try {
        const buffer = await fs.readFile(image.thumbnailPath);
        return new NextResponse(buffer, {
          headers: {
            "Content-Type": "image/webp",
            "Cache-Control": "public, max-age=86400",
          },
        });
      } catch {
        // Thumbnail file missing — fall through to generate
      }
    }

    // Lazy-generate thumbnail from original image
    const originalBuffer = await fs.readFile(image.filePath);
    const thumbnailBuffer = await sharp(originalBuffer)
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    // Save thumbnail to disk for future requests
    const dir = path.dirname(image.filePath);
    const thumbnailDiskPath = path.join(dir, `${id}_thumb.webp`);
    await fs.writeFile(thumbnailDiskPath, thumbnailBuffer).catch(() => undefined);

    // Update DB with thumbnail path
    try {
      db.update(generatedImages)
        .set({
          thumbnailPath: thumbnailDiskPath,
          thumbnailUrl: `/api/images/${id}/thumbnail`,
          updatedAt: Date.now(),
        })
        .where(eq(generatedImages.id, id))
        .run();
    } catch {
      // Non-critical — thumbnail is already saved to disk
    }

    return new NextResponse(new Uint8Array(thumbnailBuffer), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "缩略图读取失败" }, { status: 500 });
  }
}
