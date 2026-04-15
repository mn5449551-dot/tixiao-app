import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { getDb } from "@/lib/db";
import { generatedImages } from "@/lib/schema";

const THUMBNAIL_HEADERS = {
  "Content-Type": "image/webp",
  "Cache-Control": "public, max-age=86400",
} as const;

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

    // Try serving existing thumbnail from disk
    if (image.thumbnailPath) {
      try {
        const buffer = await fs.readFile(image.thumbnailPath);
        return new NextResponse(buffer, { headers: THUMBNAIL_HEADERS });
      } catch {
        // File missing — fall through to generate
      }
    }

    // Lazy-generate thumbnail from original image (use file path for streaming)
    const thumbnailBuffer = await sharp(image.filePath)
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    // Persist thumbnail to disk and DB
    const dir = path.dirname(image.filePath);
    const thumbnailDiskPath = path.join(dir, `${id}_thumb.webp`);

    try {
      await fs.writeFile(thumbnailDiskPath, thumbnailBuffer);
      db.update(generatedImages)
        .set({
          thumbnailPath: thumbnailDiskPath,
          thumbnailUrl: `/api/images/${id}/thumbnail`,
        })
        .where(eq(generatedImages.id, id))
        .run();
    } catch {
      // Non-critical — thumbnail is still returned in this response
    }

    return new NextResponse(new Uint8Array(thumbnailBuffer), {
      headers: THUMBNAIL_HEADERS,
    });
  } catch {
    return NextResponse.json({ error: "缩略图读取失败" }, { status: 500 });
  }
}
