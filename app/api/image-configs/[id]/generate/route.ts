import { NextResponse, after } from "next/server";
import {
  finishGenerationRun,
  GenerationConflictError,
  GenerationLimitError,
  startGenerationRun,
} from "@/lib/generation-runs";
import { prepareImageConfigGeneration, processPreparedImageGeneration } from "@/lib/image-generation-service";

export async function POST(
  request: Request,
  context: { params: Promise<unknown> },
) {
  let runId: string | null = null;
  let runFinished = false;

  try {
    if (!process.env.NEW_API_KEY) {
      return NextResponse.json(
        { error: "缺少 NEW_API_KEY，无法生成图片" },
        { status: 500 },
      );
    }

    const { id } = (await context.params) as { id: string };
    const body = (await request.json().catch(() => ({}))) as { group_ids?: string[] };
    const prepared = prepareImageConfigGeneration({
      imageConfigId: id,
      groupIds: body.group_ids,
    });

    runId = startGenerationRun({
      projectId: prepared.projectId,
      kind: "image",
      resourceType: "image-config",
      resourceId: prepared.config.id,
    }).id;

    const activeRunId = runId;

    after(async () => {
      await processPreparedImageGeneration({
        runId: activeRunId,
        prepared,
      });
    });

    return NextResponse.json({ image_groups: prepared.imageGroupsPayload }, { status: 202 });
  } catch (error) {
    if (runId && !runFinished) {
      finishGenerationRun(runId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "候选图生成失败",
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
      { error: error instanceof Error ? error.message : "候选图生成失败" },
      { status: 500 },
    );
  }
}
