import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { appendCopyToCardSmart, generateCopyCardSmart, listCopyCards } from "@/lib/project-data";

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

      return NextResponse.json({
        copy_card: {
          id: card.id,
          direction_id: card.directionId,
          channel: card.channel,
          image_form: card.imageForm,
          version: card.version,
        },
        copies: card.copies.map((copy) => ({
          id: copy.id,
          copy_card_id: copy.copyCardId,
          title_main: copy.titleMain,
          title_sub: copy.titleSub,
          title_extra: copy.titleExtra,
          variant_index: copy.variantIndex,
        })),
        copy_ids: card.copies.map((copy) => copy.id),
      });
    }

    const card = await generateCopyCardSmart(id, body.count ?? 3, body.use_ai ?? false);

    if (!card) {
      return NextResponse.json({ error: "文案卡生成失败" }, { status: 500 });
    }

    return NextResponse.json({
      copy_card: {
        id: card.id,
        direction_id: card.directionId,
        channel: card.channel,
        image_form: card.imageForm,
        version: card.version,
      },
      copies: card.copies.map((copy) => ({
        id: copy.id,
        copy_card_id: copy.copyCardId,
        title_main: copy.titleMain,
        title_sub: copy.titleSub,
        title_extra: copy.titleExtra,
        variant_index: copy.variantIndex,
      })),
      copy_ids: card.copies.map((copy) => copy.id),
    });
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
