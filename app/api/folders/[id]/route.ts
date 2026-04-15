import { NextResponse } from "next/server";

import { deleteFolder } from "@/lib/project-data";

export async function DELETE(
  _request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const { id } = (await context.params) as { id: string };
    deleteFolder(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除文件夹失败" },
      { status: 500 },
    );
  }
}
