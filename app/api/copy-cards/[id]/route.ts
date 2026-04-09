import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { copies, copyCards } from "@/lib/schema";

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

    const cardCopies = db.select().from(copies).where(eq(copies.copyCardId, card.id)).all();
    if (cardCopies.some((copy) => copy.isLocked)) {
      return NextResponse.json(
        { error: "已有下游内容，不能删除" },
        { status: 422 },
      );
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
