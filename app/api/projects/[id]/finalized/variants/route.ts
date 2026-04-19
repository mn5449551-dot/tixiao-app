import { NextResponse } from "next/server";

import { generateFinalizedVariants } from "@/lib/project-data";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      source_group_id?: string;
      target_channel?: string;
      slot_names?: string[];
      target_group_ids?: string[];
      target_channels?: string[];
      target_slots?: string[];
      image_model?: string;
    };

    const result = await generateFinalizedVariants(id, {
      sourceGroupId: body.source_group_id,
      targetChannel: body.target_channel,
      slotNames: body.slot_names,
      targetGroupIds: body.target_group_ids,
      targetChannels: body.target_channels,
      targetSlots: body.target_slots,
      imageModel: body.image_model,
    });

    return NextResponse.json({
      groups: result.groups.map((g) => ({ id: g.id })),
      skipped_slots: result.skippedSlots,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成适配版本失败" },
      { status: 500 },
    );
  }
}
