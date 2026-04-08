import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { copyCards } from "@/lib/schema";

export async function DELETE(
  _request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const { id } = (await context.params) as { id: string };
    const db = getDb();

    const card = db.select().from(copyCards).where(eq(copyCards.id, id)).get();
    if (!card) {
      return NextResponse.json({ error: "Copy card not found" }, { status: 404 });
    }

    db.delete(copyCards).where(eq(copyCards.id, id)).run();

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete copy card" },
      { status: 500 },
    );
  }
}
