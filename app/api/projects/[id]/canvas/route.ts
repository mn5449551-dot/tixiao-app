import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { canvasStates } from "@/lib/schema";

export async function GET(
  _request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const { id } = (await context.params) as { id: string };
    const db = getDb();

    const state = db.select().from(canvasStates).where(eq(canvasStates.projectId, id)).get();
    if (!state) {
      return NextResponse.json(
        { nodes: null, edges: null, viewport: null },
        { status: 404 },
      );
    }

    return NextResponse.json({
      nodes: state.nodes ? JSON.parse(state.nodes) : null,
      edges: state.edges ? JSON.parse(state.edges) : null,
      viewport: state.viewport ? JSON.parse(state.viewport) : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get canvas state" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const { id } = (await context.params) as { id: string };
    const body = (await request.json()) as {
      nodes?: Record<string, unknown>;
      edges?: Record<string, unknown>;
      viewport?: Record<string, unknown>;
    };

    const db = getDb();

    const existing = db.select().from(canvasStates).where(eq(canvasStates.projectId, id)).get();
    const now = Date.now();

    if (existing) {
      db.update(canvasStates)
        .set({
          nodes: body.nodes !== undefined ? JSON.stringify(body.nodes) : existing.nodes,
          edges: body.edges !== undefined ? JSON.stringify(body.edges) : existing.edges,
          viewport: body.viewport !== undefined ? JSON.stringify(body.viewport) : existing.viewport,
          updatedAt: now,
        })
        .where(eq(canvasStates.projectId, id))
        .run();
    } else {
      const { createId } = await import("@/lib/id");
      db.insert(canvasStates).values({
        id: createId("canvas"),
        projectId: id,
        nodes: body.nodes ? JSON.stringify(body.nodes) : null,
        edges: body.edges ? JSON.stringify(body.edges) : null,
        viewport: body.viewport ? JSON.stringify(body.viewport) : null,
        createdAt: now,
        updatedAt: now,
      }).run();
    }

    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save canvas state" },
      { status: 500 },
    );
  }
}
