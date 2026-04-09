import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  finishGenerationRun,
  GenerationConflictError,
  GenerationLimitError,
  startGenerationRun,
} from "@/lib/generation-runs";
import { createSseResponse } from "@/lib/sse";
import { appendCopyToCardSmart, generateCopyCardSmart, listCopyCards } from "@/lib/project-data";
import { directions } from "@/lib/schema";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let runId: string | null = null;
  let runFinished = false;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      count?: number;
      use_ai?: boolean;
      append?: boolean;
      copy_card_id?: string;
    };
    const db = getDb();
    const direction = db.select().from(directions).where(eq(directions.id, id)).get();

    if (!direction) {
      return NextResponse.json({ error: "方向不存在" }, { status: 404 });
    }

    runId = startGenerationRun({
      projectId: direction.projectId,
      kind: "copy",
      resourceType: "direction-copy-cards",
      resourceId: id,
    }).id;

    if (body.append) {
      const existingCards = listCopyCards(id);
      const existingCount = existingCards.reduce((sum, card) => sum + card.copies.length, 0);
      if (existingCount >= 10) {
        return NextResponse.json(
          { error: "文案总数已达上限（10条），无法追加" },
          { status: 422 },
        );
      }

      const card = body.copy_card_id
        ? await appendCopyToCardSmart(body.copy_card_id, body.use_ai ?? false)
        : await generateCopyCardSmart(id, 1, body.use_ai ?? false);
      if (!card) {
        return NextResponse.json({ error: "文案追加失败" }, { status: 500 });
      }

      finishGenerationRun(runId, { status: "done" });
      runFinished = true;
      return createSseResponse([
        ...card.copies.map((copy) => ({
          event: "copy_created",
          copy: { id: copy.id, copy_card_id: copy.copyCardId, title_main: copy.titleMain, title_sub: copy.titleSub, title_extra: copy.titleExtra, variant_index: copy.variantIndex },
        })),
        { event: "done", copy_card_id: card.id, copy_ids: card.copies.map((c) => c.id) },
      ]);
    }

    const card = await generateCopyCardSmart(id, body.count ?? 3, body.use_ai ?? false);

    if (!card) {
      return NextResponse.json({ error: "文案卡生成失败" }, { status: 500 });
    }

    finishGenerationRun(runId, { status: "done" });
    runFinished = true;
    return createSseResponse([
      {
        event: "copy_card_created",
        copy_card: {
          id: card.id,
          direction_id: card.directionId,
          channel: card.channel,
          image_form: card.imageForm,
          version: card.version,
        },
      },
      ...card.copies.map((copy) => ({
        event: "copy_created",
        copy: {
          id: copy.id,
          copy_card_id: copy.copyCardId,
          title_main: copy.titleMain,
          title_sub: copy.titleSub,
          title_extra: copy.titleExtra,
          variant_index: copy.variantIndex,
        },
      })),
      {
        event: "done",
        copy_card_id: card.id,
        copy_ids: card.copies.map((copy) => copy.id),
      },
    ]);
  } catch (error) {
    if (runId && !runFinished) {
      finishGenerationRun(runId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "文案生成失败",
      });
    }

    if (error instanceof GenerationConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          resource_type: error.resourceType,
          resource_id: error.resourceId,
        },
        { status: 409 },
      );
    }

    if (error instanceof GenerationLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          limit: error.limit,
          active_count: error.activeCount,
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "文案生成失败" },
      { status: 500 },
    );
  }
}
