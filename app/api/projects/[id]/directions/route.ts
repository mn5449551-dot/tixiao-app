import { NextResponse } from "next/server";

import { listDirections } from "@/lib/project-data";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return NextResponse.json({ directions: listDirections(id) });
}
