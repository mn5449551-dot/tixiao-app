import { NextResponse } from "next/server";

import { getAssistantState } from "@/lib/assistant-state";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const state = getAssistantState(id);
    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取助手状态失败" },
      { status: 500 },
    );
  }
}
