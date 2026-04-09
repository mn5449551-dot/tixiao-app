import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";

import { getGenerationStatusData } from "@/lib/project-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  noStore();

  const { id } = await context.params;
  const payload = getGenerationStatusData(id);

  if (!payload) {
    return NextResponse.json(
      { error: "项目不存在" },
      { status: 404, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
