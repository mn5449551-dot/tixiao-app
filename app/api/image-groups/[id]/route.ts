import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { generatedImages, imageGroups } from "@/lib/schema";
import { deleteFileIfExists } from "@/lib/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<unknown> },
) {
  const { id } = (await context.params) as { id: string };
  const db = getDb();
  const group = db.select().from(imageGroups).where(eq(imageGroups.id, id)).get();
  if (!group) {
    return NextResponse.json({ error: "图片组不存在" }, { status: 404 });
  }

  const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, id)).all();
  return NextResponse.json({ ...group, images });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<unknown> },
) {
  const { id } = (await context.params) as { id: string };
  const db = getDb();
  const group = db.select().from(imageGroups).where(eq(imageGroups.id, id)).get();
  if (!group) {
    return NextResponse.json({ error: "图片组不存在" }, { status: 404 });
  }

  if (!group.groupType.startsWith("derived|")) {
    return NextResponse.json({ error: "仅允许删除适配版本，原始定稿组不可删除" }, { status: 403 });
  }

  const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, id)).all();
  for (const image of images) {
    await deleteFileIfExists(image.filePath);
    await deleteFileIfExists(image.thumbnailPath);
  }
  db.delete(imageGroups).where(eq(imageGroups.id, id)).run();
  return NextResponse.json({ deleted: true });
}

export async function PUT(
  request: Request,
  context: { params: Promise<unknown> },
) {
  const { id } = (await context.params) as { id: string };
  const body = (await request.json()) as { confirmed?: boolean };
  const db = getDb();
  db.update(imageGroups)
    .set({
      isConfirmed: body.confirmed ? 1 : 0,
      groupType: body.confirmed ? "finalized" : "candidate",
      updatedAt: Date.now(),
    })
    .where(eq(imageGroups.id, id))
    .run();

  const group = db.select().from(imageGroups).where(eq(imageGroups.id, id)).get();
  return NextResponse.json(group);
}
