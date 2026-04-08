import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  buildExportFileName,
  classifyExportAdaptation,
  parseSlotSize,
  resolveExportSlotSpecs,
  sanitizeExportSegment,
} from "@/lib/export/utils";
import { zipAndCleanupDirectory } from "@/lib/export/zip";
import { copyCards, directions, exportRecords, generatedImages, imageConfigs, imageGroups, projects } from "@/lib/schema";
import { getStorageRoot, writeExportImage } from "@/lib/storage";

const LOGO_PATHS = {
  onion: "public/brand/onion-logo.png",
  onion_app: "public/brand/onion-app-logo.png",
} as const;

export async function POST(
  request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const { id } = (await context.params) as { id: string };
    const body = (await request.json()) as {
      target_channels?: string[];
      target_slots?: string[];
      file_format?: "jpg" | "png" | "webp";
      naming_rule?: string;
    };

    const db = getDb();
    const project = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const projectDirections = db.select().from(directions).where(eq(directions.projectId, id)).all();
    const directionIds = projectDirections.map((item) => item.id);
    const projectCopyCards = directionIds.flatMap((directionId) => db.select().from(copyCards).where(eq(copyCards.directionId, directionId)).all());
    const configMap = new Map(projectCopyCards.flatMap((card) => db.select().from(imageConfigs).where(eq(imageConfigs.directionId, card.directionId)).all()).map((cfg) => [cfg.id, cfg]));

    const groups = Array.from(configMap.keys()).flatMap((configId) => db.select().from(imageGroups).where(eq(imageGroups.imageConfigId, configId)).all());
    const confirmedGroups = groups.filter((group) => group.isConfirmed === 1);
    const chosenGroups = confirmedGroups;

    const images = chosenGroups.flatMap((group) => db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all().filter((image) => image.filePath));
    if (images.length === 0) {
      return NextResponse.json({ error: "请先选定稿" }, { status: 422 });
    }

    const slotSpecs = resolveExportSlotSpecs({
      targetChannels: body.target_channels,
      targetSlots: body.target_slots,
    });
    if (slotSpecs.length === 0) {
      return NextResponse.json({ error: "请先选择导出版位" }, { status: 422 });
    }

    const exportId = `exp_${randomUUID().slice(0, 8)}`;
    const format = body.file_format ?? "jpg";
    const exportDir = path.join(getStorageRoot(), "exports", id, exportId);
    await fs.mkdir(exportDir, { recursive: true });

    const safeProjectTitle = sanitizeExportSegment(project.title);
    let index = 1;
    for (const slotSpec of slotSpecs) {
      for (const image of images) {
        const config = configMap.get(image.imageConfigId);
        const logoKey = config?.logo;
        const logoPath =
          logoKey && logoKey in LOGO_PATHS
            ? path.resolve(process.cwd(), LOGO_PATHS[logoKey as keyof typeof LOGO_PATHS])
            : null;
        const slotSize = parseSlotSize(slotSpec.size);
        const outputPath = path.join(exportDir, buildExportFileName({
          projectTitle: project.title,
          channel: slotSpec.channel,
          slotName: slotSpec.slotName,
          index,
          format,
          namingRule: body.naming_rule,
        }));

        await writeExportImage({
          sourcePath: image.filePath!,
          logoPath,
          outputPath,
          format,
          targetWidth: slotSize?.width,
          targetHeight: slotSize?.height,
          adaptationMode: classifyExportAdaptation(config?.aspectRatio ?? "1:1", slotSpec.ratio),
        });
        index += 1;
      }
    }

    const zipPath = path.join(getStorageRoot(), "exports", id, `${safeProjectTitle}_${exportId}.zip`);
    await zipAndCleanupDirectory({ sourceDir: exportDir, outputZipPath: zipPath });

    db.insert(exportRecords)
      .values({
        id: exportId,
        projectId: id,
        targetChannels: JSON.stringify(body.target_channels ?? []),
        targetSlots: JSON.stringify(body.target_slots ?? []),
        fileFormat: format,
        namingRule: body.naming_rule ?? "channel_slot_date_version",
        zipFilePath: zipPath,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .run();

    const zipBuffer = await fs.readFile(zipPath);
    return new Response(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(safeProjectTitle)}_export.zip"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导出失败" },
      { status: 500 },
    );
  }
}
