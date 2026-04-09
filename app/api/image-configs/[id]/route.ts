import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { resolveReferenceImageUrl } from "@/lib/ip-assets";
import { copies, imageConfigs } from "@/lib/schema";
import { deleteImageConfigCascade } from "@/lib/project-data";
import { resolveImageStyleForMode } from "@/lib/workflow-defaults";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const db = getDb();
    const config = db.select().from(imageConfigs).where(eq(imageConfigs.id, id)).get();
    if (!config) {
      return NextResponse.json({ error: "图片配置不存在" }, { status: 404 });
    }

    return NextResponse.json({ image_config: config });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取图片配置失败" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      aspect_ratio?: string;
      style_mode?: string;
      ip_role?: string | null;
      logo?: string;
      image_style?: string;
      count?: number;
      reference_image_url?: string | null;
    };

    const db = getDb();
    const current = db.select().from(imageConfigs).where(eq(imageConfigs.id, id)).get();
    if (!current) {
      return NextResponse.json({ error: "图片配置不存在" }, { status: 404 });
    }

    const nextStyleMode = body.style_mode ?? current.styleMode;
    const nextIpRole = body.ip_role ?? current.ipRole;
    const nextImageStyle = resolveImageStyleForMode(
      nextStyleMode,
      body.image_style ?? current.imageStyle,
    );
    const nextReferenceImageUrl = await resolveReferenceImageUrl({
      styleMode: nextStyleMode,
      ipRole: nextIpRole,
      referenceImageUrl: body.reference_image_url ?? current.referenceImageUrl,
    });

    db.update(imageConfigs)
      .set({
        aspectRatio: body.aspect_ratio ?? current.aspectRatio,
        styleMode: nextStyleMode,
        ipRole: nextIpRole,
        logo: body.logo ?? current.logo,
        imageStyle: nextImageStyle,
        referenceImageUrl: nextReferenceImageUrl,
        count: body.count ?? current.count,
        updatedAt: Date.now(),
      })
      .where(eq(imageConfigs.id, id))
      .run();

    const updated = db.select().from(imageConfigs).where(eq(imageConfigs.id, id)).get();
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新图片配置失败" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const db = getDb();
    const config = db.select().from(imageConfigs).where(eq(imageConfigs.id, id)).get();
    if (!config) {
      return NextResponse.json({ error: "图片配置不存在" }, { status: 404 });
    }

    await deleteImageConfigCascade(config.id);

    // Unlock the copy
    db.update(copies)
      .set({ isLocked: 0, updatedAt: Date.now() })
      .where(eq(copies.id, config.copyId))
      .run();

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除图片配置失败" },
      { status: 500 },
    );
  }
}
