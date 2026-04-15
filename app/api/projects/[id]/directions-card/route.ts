import { NextResponse } from "next/server";

import { deleteDirectionCard } from "@/lib/project-data";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const ok = await deleteDirectionCard(id);
    if (!ok) {
      return NextResponse.json({ error: "方向卡不存在" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除失败";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}