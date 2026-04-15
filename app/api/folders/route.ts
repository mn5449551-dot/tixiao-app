import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";

import { createFolder, listFolders } from "@/lib/project-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  noStore();

  return NextResponse.json(
    { folders: listFolders() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "文件夹名称不能为空" }, { status: 400 });
    }

    const folder = createFolder(name);
    return NextResponse.json(folder, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建文件夹失败" },
      { status: 500 },
    );
  }
}
