import { NextResponse } from "next/server";

import { generateFinalizedVariants } from "@/lib/project-data";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      target_channels?: string[];
      target_slots?: string[];
    };

    const groups = await generateFinalizedVariants(id, {
      targetChannels: body.target_channels,
      targetSlots: body.target_slots,
    });

    return NextResponse.json({ groups });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成适配版本失败" },
      { status: 500 },
    );
  }
}
