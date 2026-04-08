import { NextResponse } from "next/server";

import { createProject, listProjects } from "@/lib/project-data";

export async function GET() {
  return NextResponse.json({ projects: listProjects() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { title?: string };
    const title = body.title?.trim();

    if (!title) {
      return NextResponse.json({ error: "项目标题不能为空" }, { status: 400 });
    }

    const project = createProject(title);
    return NextResponse.json(project, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建项目失败" },
      { status: 500 },
    );
  }
}
