import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { createId } from "@/lib/id";
import { getRequirement, upsertRequirement } from "@/lib/project-data";
import { assistantStates } from "@/lib/schema";
import { fromJson, toJson } from "@/lib/utils";

export type AssistantStage = "collecting" | "confirming" | "done";

export type AssistantMessage = {
  id: string;
  role: "ai" | "user" | "system";
  content: string;
  timestamp: number;
};

export type AssistantDraft = {
  targetAudience: string;
  feature: string;
  sellingPoints: string[];
  timeNode: string;
  directionCount: number | null;
};

export type AssistantState = {
  id: string;
  projectId: string;
  messages: AssistantMessage[];
  draft: AssistantDraft;
  stage: AssistantStage;
  createdAt: number;
  updatedAt: number;
};

const INITIAL_AI_MESSAGE = "今天想做什么素材？你可以直接描述需求，我会逐项帮你整理，确认后再一次性填充到需求卡。";

export function getAssistantState(projectId: string) {
  const db = getDb();
  const record = db.select().from(assistantStates).where(eq(assistantStates.projectId, projectId)).get();
  if (record) {
    return {
      id: record.id,
      projectId: record.projectId,
      messages: fromJson<AssistantMessage[]>(record.messages, []),
      draft: fromJson<AssistantDraft>(record.draft, emptyDraft()),
      stage: record.stage as AssistantStage,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    } satisfies AssistantState;
  }

  const requirement = getRequirement(projectId);
  const timestamp = Date.now();

  if (requirement) {
    return {
      id: createId("asst"),
      projectId,
      messages: [
        {
          id: createId("msg"),
          role: "ai",
          content: "需求卡已经存在。你可以继续补充或修改需求，我会重新整理，确认后再一次性回填。",
          timestamp,
        },
      ],
      draft: {
        targetAudience: requirement.targetAudience ?? "",
        feature: requirement.feature ?? "",
        sellingPoints: requirement.sellingPoints ?? [],
        timeNode: requirement.timeNode ?? "",
        directionCount: requirement.directionCount ?? null,
      },
      stage: "done",
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies AssistantState;
  }

  return {
    id: createId("asst"),
    projectId,
    messages: [
      {
        id: createId("msg"),
        role: "ai",
        content: INITIAL_AI_MESSAGE,
        timestamp,
      },
    ],
    draft: emptyDraft(),
    stage: "collecting",
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies AssistantState;
}

export function saveAssistantState(projectId: string, input: Pick<AssistantState, "messages" | "draft" | "stage">) {
  const db = getDb();
  const current = db.select().from(assistantStates).where(eq(assistantStates.projectId, projectId)).get();
  const timestamp = Date.now();

  if (!current) {
    const id = createId("asst");
    db.insert(assistantStates)
      .values({
        id,
        projectId,
        messages: toJson(input.messages),
        draft: toJson(input.draft),
        stage: input.stage,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
  } else {
    db.update(assistantStates)
      .set({
        messages: toJson(input.messages),
        draft: toJson(input.draft),
        stage: input.stage,
        updatedAt: timestamp,
      })
      .where(eq(assistantStates.projectId, projectId))
      .run();
  }

  return getAssistantState(projectId);
}

export function confirmAssistantDraft(projectId: string, state: AssistantState) {
  const draft = state.draft;
  if (!draft.targetAudience || !draft.feature || draft.sellingPoints.length === 0 || !draft.timeNode || !draft.directionCount) {
    throw new Error("需求信息还不完整，无法填充需求卡");
  }

  upsertRequirement(projectId, {
    businessGoal: "app",
    targetAudience: draft.targetAudience,
    formatType: "image_text",
    feature: draft.feature,
    sellingPoints: draft.sellingPoints,
    timeNode: draft.timeNode,
    directionCount: draft.directionCount,
  });

  const nextMessages = [
    ...state.messages,
    {
      id: createId("msg"),
      role: "ai" as const,
      content: "需求卡已填充完成。你可以先检查表单，再点击“生成”创建方向卡。",
      timestamp: Date.now(),
    },
  ];

  return saveAssistantState(projectId, {
    messages: nextMessages,
    draft,
    stage: "done",
  });
}

export function emptyDraft(): AssistantDraft {
  return {
    targetAudience: "",
    feature: "",
    sellingPoints: [],
    timeNode: "",
    directionCount: null,
  };
}
