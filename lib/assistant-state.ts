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

export type AssistantUiAction =
  | { type: "audience_buttons"; options: Array<{ value: "parent" | "student"; label: string }> }
  | { type: "feature_suggestions"; options: Array<{ value: string; label: string }> }
  | { type: "selling_point_suggestions"; options: Array<{ value: string; label: string }> }
  | { type: "time_node_suggestions"; options: Array<{ value: string; label: string }> }
  | { type: "reminder"; text: string };

export type AssistantConfirmation = {
  businessGoal: "app";
  formatType: "image_text";
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
  ui: AssistantUiAction[];
  missingFields: Array<keyof AssistantDraft>;
  confirmation: AssistantConfirmation | null;
  createdAt: number;
  updatedAt: number;
};

type PersistedAssistantDraft = AssistantDraft & {
  __ui?: AssistantUiAction[];
  __missingFields?: Array<keyof AssistantDraft>;
  __confirmation?: AssistantConfirmation | null;
};

const INITIAL_AI_MESSAGE =
  "这次想做什么素材？你可以直接把需求告诉我，不用想得特别正式。比如这次主要给谁看、想推什么功能、核心卖点是什么、适合什么时间节点、先出几个方向。像“这次想做给家长看的，主推拍题精学，重点是 10 秒出解析，适合期中考试，先来 3 个方向”这样说就可以，我会边聊边帮你整理，确认后再统一填进需求卡。";

function stripPersistedDraft(input: PersistedAssistantDraft | AssistantDraft): AssistantDraft {
  return {
    targetAudience: input.targetAudience ?? "",
    feature: input.feature ?? "",
    sellingPoints: input.sellingPoints ?? [],
    timeNode: input.timeNode ?? "",
    directionCount: input.directionCount ?? null,
  };
}

function getDraftMeta(input: PersistedAssistantDraft | AssistantDraft) {
  return {
    ui: "__ui" in input && Array.isArray(input.__ui) ? input.__ui : [],
    missingFields:
      "__missingFields" in input && Array.isArray(input.__missingFields) ? input.__missingFields : [],
    confirmation:
      "__confirmation" in input && input.__confirmation ? input.__confirmation : null,
  };
}

export function getAssistantState(projectId: string) {
  const db = getDb();
  const record = db.select().from(assistantStates).where(eq(assistantStates.projectId, projectId)).get();
  if (record) {
    const persistedDraft = fromJson<PersistedAssistantDraft>(record.draft, emptyDraft() as PersistedAssistantDraft);
    const meta = getDraftMeta(persistedDraft);
    return {
      id: record.id,
      projectId: record.projectId,
      messages: fromJson<AssistantMessage[]>(record.messages, []),
      draft: stripPersistedDraft(persistedDraft),
      stage: record.stage as AssistantStage,
      ui: meta.ui,
      missingFields: meta.missingFields,
      confirmation: meta.confirmation,
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
      ui: [{ type: "reminder", text: "当前仅支持 APP + 图文" }],
      missingFields: [],
      confirmation: {
        businessGoal: "app",
        formatType: "image_text",
        targetAudience: requirement.targetAudience ?? "",
        feature: requirement.feature ?? "",
        sellingPoints: requirement.sellingPoints ?? [],
        timeNode: requirement.timeNode ?? "",
        directionCount: requirement.directionCount ?? null,
      },
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
    ui: [{ type: "reminder", text: "当前仅支持 APP + 图文" }],
    missingFields: ["targetAudience", "feature", "sellingPoints", "timeNode", "directionCount"],
    confirmation: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies AssistantState;
}

export function saveAssistantState(
  projectId: string,
  input: Pick<AssistantState, "messages" | "draft" | "stage" | "ui" | "missingFields" | "confirmation">,
) {
  const db = getDb();
  const current = db.select().from(assistantStates).where(eq(assistantStates.projectId, projectId)).get();
  const timestamp = Date.now();
  const persistedDraft: PersistedAssistantDraft = {
    ...input.draft,
    __ui: input.ui,
    __missingFields: input.missingFields,
    __confirmation: input.confirmation,
  };

  if (!current) {
    const id = createId("asst");
    db.insert(assistantStates)
      .values({
        id,
        projectId,
        messages: toJson(input.messages),
        draft: toJson(persistedDraft),
        stage: input.stage,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
  } else {
    db.update(assistantStates)
      .set({
        messages: toJson(input.messages),
        draft: toJson(persistedDraft),
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
    ui: [{ type: "reminder", text: "当前仅支持 APP + 图文" }],
    missingFields: [],
    confirmation: null,
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
