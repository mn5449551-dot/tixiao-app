import { NextResponse } from "next/server";

import { appendDirectionSmart, generateDirectionsSmart } from "@/lib/project-data";
import { createSseResponse } from "@/lib/sse";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      channel?: string;
      image_form?: string;
      copy_generation_count?: number;
      use_ai?: boolean;
      append?: boolean;
    };

    if (body.append) {
      const direction = await appendDirectionSmart(
        id,
        body.channel ?? "信息流（广点通）",
        body.image_form ?? "single",
        body.copy_generation_count ?? 3,
        body.use_ai ?? false,
      );

      if (!direction) {
        return NextResponse.json({ error: "方向追加失败" }, { status: 500 });
      }

      return createSseResponse([
        { event: "direction_created", direction },
        { event: "done", direction_ids: [direction.id] },
      ]);
    }

    const created = await generateDirectionsSmart(
      id,
      body.channel ?? "信息流（广点通）",
      body.image_form ?? "single",
      body.copy_generation_count ?? 3,
      body.use_ai ?? false,
    );

    return createSseResponse([
      ...created.map((direction) => ({ event: "direction_created", direction })),
      { event: "done", direction_ids: created.map((item) => item.id) },
    ]);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "方向生成失败" },
      { status: 500 },
    );
  }
}
