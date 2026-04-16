import { NextResponse } from "next/server";

import { getRouteErrorMessage, jsonError, readIdParam } from "@/lib/api-route";
import {
  finishGenerationRun,
  GenerationConflictError,
  GenerationLimitError,
  startGenerationRun,
} from "@/lib/generation-runs";
import { appendDirectionSmart, generateDirectionsSmart } from "@/lib/project-data";

function finishFailedDirectionRun(runId: string | null, errorMessage: string): void {
  if (runId) {
    finishGenerationRun(runId, {
      status: "failed",
      errorMessage,
    });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let runId: string | null = null;

  try {
    const id = await readIdParam(context);
    const body = (await request.json()) as {
      channel?: string;
      image_form?: string;
      copy_generation_count?: number;
      append?: boolean;
    };

    runId = startGenerationRun({
      projectId: id,
      kind: "direction",
      resourceType: "project-directions",
      resourceId: id,
    }).id;

    if (body.append) {
      const direction = await appendDirectionSmart(
        id,
        body.channel ?? "信息流（广点通）",
        body.image_form ?? "single",
        body.copy_generation_count ?? 3,
      );

      if (!direction) {
        finishFailedDirectionRun(runId, "方向追加失败");
        return jsonError("方向追加失败");
      }

      if (runId) {
        finishGenerationRun(runId, { status: "done" });
      }

      return NextResponse.json({
        directions: [direction],
        direction_ids: [direction.id],
      });
    }

    const created = await generateDirectionsSmart(
      id,
      body.channel ?? "信息流（广点通）",
      body.image_form ?? "single",
      body.copy_generation_count ?? 3,
    );

    if (runId) {
      finishGenerationRun(runId, { status: "done" });
    }

    return NextResponse.json({
      directions: created,
      direction_ids: created.map((item) => item.id),
    });
  } catch (error) {
    finishFailedDirectionRun(runId, getRouteErrorMessage(error, "方向生成失败"));

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

    return jsonError(getRouteErrorMessage(error, "方向生成失败"));
  }
}
