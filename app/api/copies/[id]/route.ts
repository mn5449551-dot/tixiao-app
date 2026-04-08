import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { deleteFileIfExists } from "@/lib/storage";
import { getDb } from "@/lib/db";
import { regenerateCopy } from "@/lib/project-data";
import { copies, generatedImages, imageConfigs, imageGroups } from "@/lib/schema";

export async function PUT(
  request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const { id } = (await context.params) as { id: string };
    const body = (await request.json()) as {
      title_main?: string;
      title_sub?: string;
      title_extra?: string;
      regenerate?: boolean;
      use_ai?: boolean;
    };

    if (body.regenerate) {
      const regenerated = await regenerateCopy(id, body.use_ai ?? false);
      if (!regenerated) {
        return NextResponse.json({ error: "文案不存在" }, { status: 404 });
      }

      return NextResponse.json(regenerated);
    }

    const db = getDb();

    const existing = db.select().from(copies).where(eq(copies.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "Copy not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (body.title_main !== undefined) updates.titleMain = body.title_main;
    if (body.title_sub !== undefined) updates.titleSub = body.title_sub;
    if (body.title_extra !== undefined) updates.titleExtra = body.title_extra;

    db.update(copies).set(updates).where(eq(copies.id, id)).run();

    const updated = db.select().from(copies).where(eq(copies.id, id)).get();
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update copy" },
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
    const copy = db.select().from(copies).where(eq(copies.id, id)).get();
    if (!copy) {
      return NextResponse.json({ error: "文案不存在" }, { status: 404 });
    }

    // Check if locked — must delete image config first
    if (copy.isLocked) {
      return NextResponse.json(
        { error: "该文案已锁定，需先删除对应图片配置才能删除" },
        { status: 422 },
      );
    }

    // Delete associated image config and all downstream data
    const config = db.select().from(imageConfigs).where(eq(imageConfigs.copyId, id)).get();
    if (config) {
      const groups = db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, config.id)).all();
      for (const group of groups) {
        const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
        for (const image of images) {
          await deleteFileIfExists(image.filePath);
        }
      }
      db.delete(generatedImages).where(eq(generatedImages.imageConfigId, config.id)).run();
      db.delete(imageGroups).where(eq(imageGroups.imageConfigId, config.id)).run();
      db.delete(imageConfigs).where(eq(imageConfigs.copyId, id)).run();
    }

    db.delete(copies).where(eq(copies.id, id)).run();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除文案失败" },
      { status: 500 },
    );
  }
}
