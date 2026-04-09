import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { after } from "next/server";

import { getDb } from "@/lib/db";
import {
  finishGenerationRun,
  GenerationConflictError,
  GenerationLimitError,
  startGenerationRun,
} from "@/lib/generation-runs";
import {
  prepareImageConfigGeneration,
  processPreparedImageGeneration,
} from "@/lib/image-generation-service";
import { appendImageConfigGroup } from "@/lib/project-data";
import { generatedImages, imageGroups } from "@/lib/schema";

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
        const db = getDb();
        db.delete(generatedImages).where(eq(generatedImages.imageGroupId, appended.group.id)).run();
        db.delete(imageGroups).where(eq(imageGroups.id, appended.group.id)).run();

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
