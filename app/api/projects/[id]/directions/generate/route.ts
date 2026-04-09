import { NextResponse } from "next/server";

import {
  finishGenerationRun,
  GenerationConflictError,
  GenerationLimitError,
  startGenerationRun,
} from "@/lib/generation-runs";
import { appendDirectionSmart, generateDirectionsSmart } from "@/lib/project-data";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let runId: string | null = null;
  let runFinished = false;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      channel?: string;
      image_form?: string;
      copy_generation_count?: number;
      use_ai?: boolean;
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
        body.use_ai ?? false,
      );

      if (!direction) {
        return NextResponse.json({ error: "方向追加失败" }, { status: 500 });
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
      body.use_ai ?? false,
    );

    return NextResponse.json({
      directions: created,
      direction_ids: created.map((item) => item.id),
    });
  } catch (error) {
    if (runId && !runFinished) {
      finishGenerationRun(runId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "方向生成失败",
      });
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
      { error: error instanceof Error ? error.message : "方向生成失败" },
      { status: 500 },
    );
  }
}
