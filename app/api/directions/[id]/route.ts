import { NextResponse } from "next/server";

import { deleteDirection, regenerateDirection, updateDirection } from "@/lib/project-data";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    title?: string;
    target_audience?: string;
    scenario_problem?: string;
    differentiation?: string;
    effect?: string;
    channel?: string;
    image_form?: string;
    copy_generation_count?: number;
    regenerate?: boolean;
  };

  if (body.regenerate) {
    const regenerated = regenerateDirection(id);
    if (!regenerated) {
      return NextResponse.json({ error: "方向不存在" }, { status: 404 });
    }

    return NextResponse.json(regenerated);
  }

  const direction = updateDirection(id, {
    title: body.title,
    targetAudience: body.target_audience,
    scenarioProblem: body.scenario_problem,
    differentiation: body.differentiation,
    effect: body.effect,
    channel: body.channel,
    imageForm: body.image_form,
    copyGenerationCount: body.copy_generation_count,
  });

  if (!direction) {
    return NextResponse.json({ error: "方向不存在" }, { status: 404 });
  }

  return NextResponse.json(direction);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const deleted = await deleteDirection(id);

  return NextResponse.json({ deleted }, { status: deleted ? 200 : 404 });
}
