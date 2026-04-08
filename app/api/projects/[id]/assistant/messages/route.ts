import { NextResponse } from "next/server";

import { getAssistantState, saveAssistantState } from "@/lib/assistant-state";
import { createId } from "@/lib/id";
import { runRequirementAssistant } from "@/lib/ai/agents/assistant-agent";
import { getRequirement } from "@/lib/project-data";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { message?: string };
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ error: "message 必填" }, { status: 400 });
    }

    const state = getAssistantState(id);
    const nextMessages = [
      ...state.messages,
      {
        id: createId("msg"),
        role: "user" as const,
        content: message,
        timestamp: Date.now(),
      },
    ];

    const result = await runRequirementAssistant({
      draft: state.draft,
      conversation: nextMessages
        .filter((item): item is typeof item & { role: "ai" | "user" } => item.role === "ai" || item.role === "user")
        .map((item) => ({ role: item.role, content: item.content })),
      hasRequirement: Boolean(getRequirement(id)),
    });

    const saved = saveAssistantState(id, {
      messages: [
        ...nextMessages,
        {
          id: createId("msg"),
          role: "ai",
          content: result.reply,
          timestamp: Date.now(),
        },
      ],
      draft: {
        targetAudience: result.fields.targetAudience ?? state.draft.targetAudience,
        feature: result.fields.feature ?? state.draft.feature,
        sellingPoints: result.fields.sellingPoints ?? state.draft.sellingPoints,
        timeNode: result.fields.timeNode ?? state.draft.timeNode,
        directionCount: result.fields.directionCount ?? state.draft.directionCount,
      },
      stage: result.stage,
    });

    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "发送消息失败" },
      { status: 500 },
    );
  }
}
