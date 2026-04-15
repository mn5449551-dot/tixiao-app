import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { generatedImages, imageConfigs, copies } from "@/lib/schema";

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

    if (!image) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    const config = db
      .select()
      .from(imageConfigs)
      .where(eq(imageConfigs.id, image.imageConfigId))
      .get();

    if (!config?.copyId) {
      return NextResponse.json({
        titleMain: null,
        titleSub: null,
        titleExtra: null,
      });
    }

    const copy = db
      .select()
      .from(copies)
      .where(eq(copies.id, config.copyId))
      .get();

    if (!copy) {
      return NextResponse.json({
        titleMain: null,
        titleSub: null,
        titleExtra: null,
      });
    }

    return NextResponse.json({
      titleMain: copy.titleMain,
      titleSub: copy.titleSub ?? null,
      titleExtra: copy.titleExtra ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取文案失败" },
      { status: 500 },
    );
  }
}
