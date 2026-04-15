import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";

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
      return NextResponse.json({ error: "图片文件不存在" }, { status: 404 });
    }

    const buffer = await fs.readFile(image.filePath);
    const extension = image.filePath.split(".").pop() ?? "png";
    const contentType =
      extension === "jpg" || extension === "jpeg"
        ? "image/jpeg"
        : extension === "webp"
          ? "image/webp"
          : "image/png";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "图片读取失败" }, { status: 500 });
  }
}
