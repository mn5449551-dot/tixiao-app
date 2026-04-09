import { NextResponse } from "next/server";
import { after } from "next/server";

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
import { appendImageConfigGroup } from "@/lib/project-data";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let runId: string | null = null;
  let runFinished = false;

  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { generate?: boolean };
    const appended = await appendImageConfigGroup(id);

    if (!appended?.group) {
      return NextResponse.json({ error: "追加候选组失败" }, { status: 500 });
    }

    if (body.generate) {
      try {
        const prepared = prepareImageConfigGeneration({
          imageConfigId: id,
          groupIds: [appended.group.id],
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

        return NextResponse.json({ image_groups: imageGroupsPayload }, { status: 202 });
      } catch (error) {
        cleanupImageGroups([appended.group.id]);

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

        throw error;
      }
    }

    return NextResponse.json({
      id: appended.id,
      image_config_id: appended.id,
      group: appended.group,
      groups: appended.groups,
    });
  } catch (error) {
    if (runId && !runFinished) {
      finishGenerationRun(runId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "追加候选组失败",
      });
      runFinished = true;
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "追加候选组失败" },
      { status: 500 },
    );
  }
}
