import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";

import { createProject, listProjects } from "@/lib/project-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  noStore();

  const url = new URL(request.url);
  const folderId = url.searchParams.get("folder_id") ?? undefined;

  return NextResponse.json(
    { projects: listProjects(folderId) },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { title?: string; folder_id?: string };
    const title = body.title?.trim();

    if (!title) {
      return NextResponse.json({ error: "项目标题不能为空" }, { status: 400 });
    }

    const project = createProject(title, body.folder_id);
    return NextResponse.json(project, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建项目失败" },
      { status: 500 },
    );
  }
}
