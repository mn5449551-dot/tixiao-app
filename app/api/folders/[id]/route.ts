import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { deleteFolder } from "@/lib/project-data";

export async function DELETE(
  _request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const { id } = (await context.params) as { id: string };
    await deleteFolder(id);
    revalidatePath("/", "layout");
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除文件夹失败" },
      { status: 500 },
    );
  }
}
