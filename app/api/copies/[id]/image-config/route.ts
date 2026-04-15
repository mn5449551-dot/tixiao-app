import { NextResponse, after } from "next/server";

import { saveImageConfig } from "@/lib/project-data";
import {
  buildImageGroupBatchResourceId,
  finishGenerationRun,
  GenerationConflictError,
  GenerationLimitError,
  startGenerationRun,
} from "@/lib/generation-runs";
import {
  cleanupImageGroups,
  markPreparedImageGenerationRunning,
  prepareImageConfigGeneration,
  processPreparedImageGeneration,
} from "@/lib/image-generation-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let runId: string | null = null;
  let runFinished = false;
  let createdGroupIds: string[] = [];

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      aspect_ratio?: string;
      style_mode?: string;
      ip_role?: string | null;
      logo?: string;
      image_style?: string;
      image_model?: string | null;
      count?: number;
      reference_image_url?: string | null;
      cta_enabled?: boolean;
      cta_text?: string | null;
      append?: boolean;
      create_groups?: boolean;
      generate?: boolean;
    };

    const config = await saveImageConfig(id, {
      aspectRatio: body.aspect_ratio,
      styleMode: body.style_mode,
      ipRole: body.ip_role,
      logo: body.logo,
      imageStyle: body.image_style,
      imageModel: body.image_model,
      count: body.count,
      referenceImageUrl: body.reference_image_url,
      ctaEnabled: body.cta_enabled,
      ctaText: body.cta_text,
      append: body.append,
      createGroups: body.create_groups,
    });

    if (!config) {
      return NextResponse.json({ error: "图片配置保存失败" }, { status: 500 });
    }

    if (body.generate) {
      if (!process.env.NEW_API_KEY) {
        cleanupImageGroups(config.createdGroups?.map((group) => group.id) ?? []);
        return NextResponse.json(
          { error: "缺少 NEW_API_KEY，无法生成图片" },
          { status: 500 },
        );
      }

      createdGroupIds = config.createdGroups?.map((group) => group.id) ?? [];
      if (createdGroupIds.length === 0) {
        return NextResponse.json({ error: "未创建新的候选组，无法启动生成" }, { status: 500 });
      }

      const prepared = prepareImageConfigGeneration({
        imageConfigId: config.id,
        groupIds: createdGroupIds,
      });

      runId = startGenerationRun({
        projectId: prepared.projectId,
        kind: "image",
        resourceType: "image-group-batch",
        resourceId: buildImageGroupBatchResourceId(prepared.groups.map((group) => group.id)),
      }).id;

      const activeRunId = runId;
      const imageGroupsPayload = markPreparedImageGenerationRunning(prepared);

      after(async () => {
        await processPreparedImageGeneration({
          runId: activeRunId,
          prepared,
        });
      });

      return NextResponse.json({
        id: config.id,
        image_config_id: config.id,
        prompt_bundle_json: config.promptBundleJson,
        count: config.count,
        created_group_ids: createdGroupIds,
        groups: config.groups,
        image_groups: imageGroupsPayload,
      }, { status: 202 });
    }

    return NextResponse.json({
      id: config.id,
      image_config_id: config.id,
      prompt_bundle_json: config.promptBundleJson,
      count: config.count,
      created_group_ids: config.createdGroups?.map((group) => group.id) ?? [],
      groups: config.groups,
    });
  } catch (error) {
    if (createdGroupIds.length > 0) {
      cleanupImageGroups(createdGroupIds);
    }

    if (runId && !runFinished) {
      finishGenerationRun(runId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "图片配置保存失败",
      });
      runFinished = true;
    }

    if (error instanceof GenerationConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          resource_type: error.resourceType,
          resource_id: error.resourceId,
        },
        { status: 409 },
      );
    }

    if (error instanceof GenerationLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          limit: error.limit,
          active_count: error.activeCount,
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "图片配置保存失败" },
      { status: 500 },
    );
  }
}
