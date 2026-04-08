import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { copies } from "@/lib/schema";

export async function PUT(
  request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const { id } = (await context.params) as { id: string };
    const body = (await request.json()) as { is_locked: boolean };

    const db = getDb();

    const existing = db.select().from(copies).where(eq(copies.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "Copy not found" }, { status: 404 });
    }

    db.update(copies)
      .set({
        isLocked: body.is_locked ? 1 : 0,
        updatedAt: Date.now(),
      })
      .where(eq(copies.id, id))
      .run();

    const updated = db.select().from(copies).where(eq(copies.id, id)).get();
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update copy lock" },
      { status: 500 },
    );
  }
}
