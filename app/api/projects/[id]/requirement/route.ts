import { NextResponse } from "next/server";

import { recommendRequirementFields } from "@/lib/ai/agents/requirement-agent";
import { createSseResponse } from "@/lib/sse";
import { getRequirement, upsertRequirement } from "@/lib/project-data";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const requirement = getRequirement(id);

  if (!requirement) {
    return NextResponse.json({ error: "需求卡不存在" }, { status: 404 });
  }

  return NextResponse.json(requirement);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      raw_input?: string;
      business_goal?: string;
      target_audience?: string;
      format_type?: string;
      feature?: string;
      selling_points?: string[];
      time_node?: string;
      direction_count?: number;
    };

    const recommendation = body.raw_input && !body.feature ? recommendRequirementFields(body.raw_input) : null;

    const requirement = upsertRequirement(id, {
      rawInput: body.raw_input,
      businessGoal: body.business_goal ?? recommendation?.businessGoal,
      targetAudience: body.target_audience ?? recommendation?.targetAudience,
      formatType: body.format_type ?? recommendation?.formatType,
      feature: body.feature ?? recommendation?.feature,
      sellingPoints: body.selling_points ?? recommendation?.sellingPoints,
      timeNode: body.time_node ?? recommendation?.timeNode,
      directionCount: body.direction_count ?? recommendation?.directionCount,
    });

    if (body.raw_input && !body.feature) {
      return createSseResponse([
        { event: "agent_start" },
        { event: "agent_done", result: requirement },
        { event: "done", requirement_card_id: requirement?.id },
      ]);
    }

    return NextResponse.json({
      id: requirement?.id,
      updated_at: requirement?.updatedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "需求卡保存失败" },
      { status: 500 },
    );
  }
}
