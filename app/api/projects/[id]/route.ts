import { NextResponse } from "next/server";

import { jsonError, readIdParam } from "@/lib/api-route";
import { deleteProject, getWorkspaceHeader } from "@/lib/project-data";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const id = await readIdParam(context);
  const header = getWorkspaceHeader(id);

  if (!header) {
    return jsonError("项目不存在", 404);
  }

  return NextResponse.json(header);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const id = await readIdParam(context);
  const deleted = await deleteProject(id);

  return NextResponse.json({ deleted }, { status: deleted ? 200 : 404 });
}
