import { NextResponse } from "next/server";

import { deleteProject, getProjectWorkspace } from "@/lib/project-data";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const workspace = getProjectWorkspace(id);

  if (!workspace) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  return NextResponse.json({
    id: workspace.project.id,
    title: workspace.project.title,
    status: workspace.project.status,
    requirement_card: workspace.requirement,
    directions: workspace.directions,
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const deleted = deleteProject(id);

  return NextResponse.json({ deleted }, { status: deleted ? 200 : 404 });
}
