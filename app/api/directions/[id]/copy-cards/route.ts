import { NextResponse } from "next/server";

import { listCopyCards } from "@/lib/project-data";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return NextResponse.json({ copy_cards: listCopyCards(id) });
}
