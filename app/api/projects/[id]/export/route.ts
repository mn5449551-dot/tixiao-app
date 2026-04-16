import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { getRouteErrorMessage, jsonError, readIdParam } from "@/lib/api-route";
import { getDb } from "@/lib/db";
import { getProjectExportContext } from "@/lib/project-data";
import {
  buildExportFileName,
  classifyExportAdaptation,
  isSpecialRatio,
  parseSlotSize,
  resolveExportSlotSpecs,
  sanitizeExportSegment,
} from "@/lib/export/utils";
import { zipAndCleanupDirectory } from "@/lib/export/zip";
import { exportRecords } from "@/lib/schema";
import { getLogoAssetPath } from "@/lib/logo-assets";
import { getStorageRoot, writeExportImage } from "@/lib/storage";

export async function POST(
  request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const id = await readIdParam(context);
    const body = (await request.json()) as {
      target_group_ids?: string[];
      target_channels?: string[];
      target_slots?: string[];
      logo?: "onion" | "onion_app" | "none";
      file_format?: "jpg" | "png" | "webp";
      naming_rule?: string;
    };

    const db = getDb();
    const exportContext = getProjectExportContext(id, {
      targetGroupIds: body.target_group_ids,
    });
    if (!exportContext) {
      return jsonError("项目不存在", 404);
    }
    const { project, configMap, groupMap, images } = exportContext;
    if (images.length === 0) {
      return jsonError("请先选定稿", 422);
    }

    const slotSpecs = resolveExportSlotSpecs({
      targetChannels: body.target_channels,
      targetSlots: body.target_slots,
    }).filter((spec) => !isSpecialRatio(spec.ratio));
    if (slotSpecs.length === 0) {
      return jsonError("请先选择导出版位", 422);
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
        const group = groupMap.get(image.imageGroupId);
        const imageRatio = group?.aspectRatio ?? config?.aspectRatio ?? "1:1";
        const adaptation = classifyExportAdaptation(imageRatio, slotSpec.ratio);

        // 只导出比例匹配的图片（direct），不匹配的跳过
        if (adaptation !== "direct") continue;

        const slotSize = parseSlotSize(slotSpec.size);
        const logoPath = body.logo && body.logo !== "none"
          ? getLogoAssetPath(body.logo)
          : null;
        const outputPath = path.join(exportDir, buildExportFileName({
          projectTitle: project.title,
          channel: slotSpec.channel,
          slotName: slotSpec.slotName,
          ratio: slotSpec.ratio,
          index,
          format,
          namingRule: body.naming_rule,
        }));

        await writeExportImage({
          sourcePath: image.filePath!,
          outputPath,
          format,
          targetWidth: slotSize?.width,
          targetHeight: slotSize?.height,
          adaptationMode: "direct",
          logoPath,
        });
        index += 1;
      }
    }

    const exportedFiles = await fs.readdir(exportDir);
    if (exportedFiles.length === 0) {
      await fs.rm(exportDir, { recursive: true, force: true });
      return jsonError("没有匹配的图片可导出，请检查图片比例与目标版位是否一致", 422);
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
    return jsonError(getRouteErrorMessage(error, "导出失败"));
  }
}
