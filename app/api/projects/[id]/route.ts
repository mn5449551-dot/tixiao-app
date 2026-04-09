import { NextResponse } from "next/server";

import { deleteProject, getWorkspaceHeader } from "@/lib/project-data";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const header = getWorkspaceHeader(id);

  if (!header) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  return NextResponse.json(header);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const deleted = await deleteProject(id);

  return NextResponse.json({ deleted }, { status: deleted ? 200 : 404 });
}
