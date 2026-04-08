import { NextResponse } from "next/server";

import { getProjectTreeData } from "@/lib/project-data";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const payload = getProjectTreeData(id);

  if (!payload) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  return NextResponse.json(payload);
}
