import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { exportRecords } from "@/lib/schema";

export async function GET(
  _request: Request,
  context: { params: Promise<unknown> },
) {
  const { id } = (await context.params) as { id: string };
  const records = getDb().select().from(exportRecords).where(eq(exportRecords.projectId, id)).all();
  return NextResponse.json({ exports: records });
}
