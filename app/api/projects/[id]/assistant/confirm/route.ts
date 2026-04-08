import { NextResponse } from "next/server";

import { confirmAssistantDraft, getAssistantState } from "@/lib/assistant-state";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const state = getAssistantState(id);
    const saved = confirmAssistantDraft(id, state);
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "确认填充需求卡失败" },
      { status: 500 },
    );
  }
}
