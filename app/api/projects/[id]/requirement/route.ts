import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";

import { recommendRequirementFields } from "@/lib/ai/agents/requirement-agent";
import { getRequirement, upsertRequirement } from "@/lib/project-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  noStore();

  const { id } = await context.params;
  const requirement = getRequirement(id);

  if (!requirement) {
    return NextResponse.json(
      { error: "需求卡不存在" },
      { status: 404, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  return NextResponse.json(requirement, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
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
