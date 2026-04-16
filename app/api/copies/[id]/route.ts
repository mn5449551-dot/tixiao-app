import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getRouteErrorMessage, jsonError, readIdParam } from "@/lib/api-route";
import { getDb } from "@/lib/db";
import { deleteImageConfigCascade, regenerateCopy } from "@/lib/project-data";
import { copies, imageConfigs } from "@/lib/schema";

export async function PUT(
  request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const id = await readIdParam(context);
    const body = (await request.json()) as {
      title_main?: string;
      title_sub?: string;
      title_extra?: string;
      regenerate?: boolean;
    };

    if (body.regenerate) {
      const regenerated = await regenerateCopy(id);
      if (!regenerated) {
        return NextResponse.json({ error: "文案不存在" }, { status: 404 });
      }

      return NextResponse.json(regenerated);
    }

    const db = getDb();

    const existing = db.select().from(copies).where(eq(copies.id, id)).get();
    if (!existing) {
      return jsonError("Copy not found", 404);
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (body.title_main !== undefined) updates.titleMain = body.title_main;
    if (body.title_sub !== undefined) updates.titleSub = body.title_sub;
    if (body.title_extra !== undefined) updates.titleExtra = body.title_extra;

    db.update(copies).set(updates).where(eq(copies.id, id)).run();

    const updated = db.select().from(copies).where(eq(copies.id, id)).get();
    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(getRouteErrorMessage(error, "Failed to update copy"));
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const id = await readIdParam(context);

    const db = getDb();
    const copy = db.select().from(copies).where(eq(copies.id, id)).get();
    if (!copy) {
      return jsonError("文案不存在", 404);
    }

    // Check if locked — must delete image config first
    if (copy.isLocked) {
      return NextResponse.json(
        { error: "已有下游内容，不能删除" },
        { status: 422 },
      );
    }

    // Delete associated image config and all downstream data
    const config = db.select().from(imageConfigs).where(eq(imageConfigs.copyId, id)).get();
    if (config) {
      await deleteImageConfigCascade(config.id);
    }

    db.delete(copies).where(eq(copies.id, id)).run();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return jsonError(getRouteErrorMessage(error, "删除文案失败"));
  }
}
