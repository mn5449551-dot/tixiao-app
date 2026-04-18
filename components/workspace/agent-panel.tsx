"use client";

import type { ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/field";
import { apiFetch } from "@/lib/api-fetch";
import type { AssistantState } from "@/lib/assistant-state";
import { dispatchWorkspaceInvalidated } from "@/lib/workspace-events";

interface AgentPanelProps {
  projectId: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

type TargetAudience = NonNullable<AssistantState["confirmation"]>["targetAudience"];
type SuggestionType = Extract<
  NonNullable<AssistantState["ui"]>[number],
  { type: "feature_suggestions" | "selling_point_suggestions" | "time_node_suggestions" }
>["type"];

function isAssistantState(value: unknown): value is AssistantState {
  return typeof value === "object" && value !== null && "messages" in value && "draft" in value && "stage" in value && "ui" in value;
}

function getTargetAudienceLabel(targetAudience: TargetAudience): string {
  if (targetAudience === "parent") {
    return "家长";
  }

  if (targetAudience === "student") {
    return "学生";
  }

  return targetAudience;
}

function getSuggestionTitle(type: SuggestionType): string {
  if (type === "feature_suggestions") {
    return "推荐功能";
  }

  if (type === "selling_point_suggestions") {
    return "推荐卖点";
  }

  return "推荐时间节点";
}

export function AgentPanel({ projectId, collapsed, onToggleCollapse }: AgentPanelProps): ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  // --- Conversation state ---
  const [assistantState, setAssistantState] = useState<AssistantState | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [conversationInput, setConversationInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevStageRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (assistantState?.stage === "done" && prevStageRef.current && prevStageRef.current !== "done" && !collapsed) {
      onToggleCollapse();
    }
    prevStageRef.current = assistantState?.stage;
  }, [assistantState?.stage, collapsed, onToggleCollapse]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [assistantState?.messages]);

  useEffect(() => {
    let cancelled = false;
    setAssistantLoading(true);
    setError(null);

    apiFetch<AssistantState>(`/api/projects/${projectId}/assistant`)
      .then((payload) => {
        if (!isAssistantState(payload)) {
          throw new Error("获取助手状态失败");
        }
        if (!cancelled) {
          setAssistantState(payload);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "获取助手状态失败");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAssistantLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const sendAssistantMessage = useCallback(async (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    const optimisticUserMessage = {
      id: `local-${Date.now()}`,
      role: "user" as const,
      content: trimmedMessage,
      timestamp: Date.now(),
    };

    setConversationInput("");
    setFailedMessage(null);
    setAssistantState((current) => {
      if (!current) return current;
      return {
        ...current,
        messages: [...current.messages, optimisticUserMessage],
      };
    });
    setAssistantLoading(true);
    setError(null);
    try {
      const payload = await apiFetch<AssistantState>(`/api/projects/${projectId}/assistant/messages`, {
        method: "POST",
        body: { message: trimmedMessage },
      });
      if (!isAssistantState(payload)) {
        throw new Error("发送消息失败");
      }
      setAssistantState(payload);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "发送消息失败");
      setFailedMessage(trimmedMessage);
      setAssistantState((current) => {
        if (!current) return current;
        return {
          ...current,
          messages: current.messages.filter((m) => m.id !== optimisticUserMessage.id),
        };
      });
    } finally {
      setAssistantLoading(false);
    }
  }, [projectId]);

  const handleConversationSend = useCallback(async () => {
    if (!conversationInput.trim()) return;
    await sendAssistantMessage(conversationInput);
  }, [conversationInput, sendAssistantMessage]);

  const confirmAndFill = useCallback(async () => {
    setAssistantLoading(true);
    setError(null);
    try {
      const payload = await apiFetch<AssistantState>(`/api/projects/${projectId}/assistant/confirm`, {
        method: "POST",
      });
      if (!isAssistantState(payload)) {
        throw new Error("确认填充需求卡失败");
      }
      setAssistantState(payload);
      dispatchWorkspaceInvalidated();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "确认填充需求卡失败");
    } finally {
      setAssistantLoading(false);
    }
  }, [projectId]);

  // --- Computed ---

  if (collapsed) {
    return (
      <div className="flex h-full w-[28px] items-center justify-center bg-gradient-to-b from-[var(--surface-1)] to-[var(--surface-2)] border-l border-[var(--line-soft)]">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-16 w-6 items-center justify-center rounded-l-xl bg-white/80 text-[var(--ink-500)] shadow-sm transition-all duration-200 hover:bg-[var(--brand-50)] hover:text-[var(--brand-600)] hover:shadow-md"
          title="展开助手"
        >
          <span className="text-xs font-medium">&#9664;</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-[360px] flex-col overflow-hidden border-l border-[var(--line-soft)] bg-gradient-to-b from-[var(--panel-strong)] to-[var(--surface-0)]">
      {/* Header - 美化布局 */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--line-soft)] bg-white/70 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-500)] to-[var(--brand-600)] text-white shadow-sm">
            <span className="text-sm font-bold">AI</span>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--ink-400)]">Assistant</p>
            <h2 className="text-sm font-semibold text-[var(--ink-900)]">对话助手</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={assistantState?.stage === "done" ? "neutral" : "brand"} size="sm">
            {assistantState?.stage === "collecting" ? "收集中" : assistantState?.stage === "confirming" ? "待确认" : assistantState?.stage === "done" ? "已完成" : "加载中"}
          </Badge>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-lg p-1.5 text-[var(--ink-400)] transition-all duration-200 hover:bg-[var(--surface-1)] hover:text-[var(--ink-700)]"
            title="收起"
          >
            <span className="text-xs">&#9654;</span>
          </button>
        </div>
      </div>

      {/* Scrollable content — chat-first layout */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-[var(--line-soft)] bg-[var(--surface-1)] px-4 py-3">
          <p className="text-[11px] font-medium text-[var(--ink-600)]">当前仅支持 APP + 图文</p>
          {(() => {
            const audienceActions = (assistantState?.ui ?? []).filter(
              (item): item is Extract<NonNullable<AssistantState["ui"]>[number], { type: "audience_buttons" }> =>
                item.type === "audience_buttons",
            );
            const audienceOptions = audienceActions.flatMap((item) => item.options);
            return (
          <div className="mt-2 flex flex-wrap gap-2">
            {audienceOptions.map((option) => {
                const isSelected = assistantState?.draft?.targetAudience === option.value
                  || assistantState?.confirmation?.targetAudience === option.value;
                return (
                <button
                  key={option.value}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    isSelected
                      ? "border-[var(--brand-500)] bg-gradient-to-r from-[var(--brand-400)] to-[var(--brand-500)] text-white"
                      : "border-[var(--line-strong)] bg-white text-[var(--ink-700)] hover:border-[var(--brand-400)] hover:text-[var(--brand-700)]"
                  }`}
                  onClick={() => void sendAssistantMessage(`目标人群选为${option.label}`)}
                >
                  {option.label}
                </button>
                );
              })}
          </div>
            );
          })()}
        </div>

        {/* Chat messages - 美化消息气泡 */}
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {assistantState?.stage === "done" && assistantState.confirmation ? (
            <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-1)] px-4 py-3 shadow-sm">
              <p className="mb-2 text-xs font-medium text-[var(--ink-500)]">当前需求摘要</p>
              <div className="space-y-1 text-xs text-[var(--ink-700)]">
                <p>目标人群：{getTargetAudienceLabel(assistantState.confirmation.targetAudience)}</p>
                <p>功能：{assistantState.confirmation.feature || "待补充"}</p>
                <p>卖点：{assistantState.confirmation.sellingPoints.join("、") || "待补充"}</p>
                <p>时间节点：{assistantState.confirmation.timeNode || "待补充"}</p>
                <p>方向数量：{assistantState.confirmation.directionCount ?? "待补充"}</p>
              </div>
              <p className="mt-2 text-[11px] text-[var(--ink-500)]">你可以继续补充或修改，我会重新整理，确认后再一次性回填。</p>
            </div>
          ) : null}

          {(assistantState?.messages ?? []).map((msg) => (
            <div 
              key={msg.id} 
              className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {/* 头像 */}
              {msg.role === "ai" ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-400)] to-[var(--brand-500)] text-xs font-bold text-white shadow-sm">
                  AI
                </div>
              ) : msg.role === "user" ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--ink-300)] to-[var(--ink-400)] text-xs font-bold text-white shadow-sm">
                  我
                </div>
              ) : null}
              
              {/* 消息气泡 */}
              <div className={`max-w-sm rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] text-[var(--brand-800)]"
                  : msg.role === "system"
                    ? "bg-[var(--surface-2)] text-[var(--ink-500)] text-xs"
                    : "bg-white text-[var(--ink-700)]"
              }`}>
                <pre className="whitespace-pre-wrap font-sans text-inherit">{msg.content}</pre>
              </div>
            </div>
          ))}
          {(["feature_suggestions", "selling_point_suggestions", "time_node_suggestions"] as const).map((type) => {
            const title = getSuggestionTitle(type);
            const suggestionActions = (assistantState?.ui ?? []).filter(
              (
                item,
              ): item is Extract<
                NonNullable<AssistantState["ui"]>[number],
                { type: "feature_suggestions" | "selling_point_suggestions" | "time_node_suggestions" }
              > => item.type === type,
            );
            const options = suggestionActions.flatMap((item) => item.options);
            if (options.length === 0) return null;
            return (
              <div key={type} className="rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-3 shadow-sm">
                <p className="mb-2 text-xs font-medium text-[var(--ink-500)]">{title}</p>
                <div className="flex flex-wrap gap-2">
                  {options.map((option) => (
                    <button
                      key={`${type}-${option.value}-${option.label}`}
                      type="button"
                      className="rounded-full bg-[var(--brand-50)] px-3 py-1 text-xs text-[var(--brand-700)] transition hover:bg-[var(--brand-100)]"
                      onClick={() => void sendAssistantMessage(option.label)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {assistantState?.confirmation ? (
            <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-1)] px-4 py-3 shadow-sm">
              <p className="mb-2 text-xs font-medium text-[var(--ink-500)]">结构化确认</p>
              <div className="space-y-1 text-xs text-[var(--ink-700)]">
                <p>业务目标：APP</p>
                <p>形式：图文</p>
                <p>目标人群：{getTargetAudienceLabel(assistantState.confirmation.targetAudience)}</p>
                <p>功能：{assistantState.confirmation.feature || "待补充"}</p>
                <p>卖点：{assistantState.confirmation.sellingPoints.join("、") || "待补充"}</p>
                <p>时间节点：{assistantState.confirmation.timeNode || "待补充"}</p>
                <p>方向数量：{assistantState.confirmation.directionCount ?? "待补充"}</p>
              </div>
            </div>
          ) : null}
          {failedMessage ? (
            <div className="rounded-2xl border border-[#f1b5b5] bg-[#fff5f5] px-4 py-3 shadow-sm">
              <p className="text-xs font-medium text-[#b42318]">发送失败</p>
              <p className="mt-1 text-xs text-[#7a271a]">刚刚这条消息没有成功送达：{failedMessage}</p>
              <button
                type="button"
                className="mt-2 rounded-full bg-[#b42318] px-3 py-1 text-xs text-white transition hover:bg-[#912018]"
                onClick={() => void sendAssistantMessage(failedMessage)}
              >
                重试
              </button>
            </div>
          ) : null}
          {assistantLoading && (
            <div className="flex items-center gap-2 text-xs text-[var(--ink-500)]">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--brand-400)] border-t-transparent" />
              AI 正在思考...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Confirm button when in confirming state */}
        {assistantState?.stage === "confirming" && (
          <div className="shrink-0 px-4 pb-3">
            <Button
              className="w-full bg-gradient-to-r from-[var(--brand-500)] to-[var(--brand-600)] text-white shadow-md hover:shadow-lg"
              onClick={confirmAndFill}
              disabled={assistantLoading}
              variant="primary"
            >
              {assistantLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  处理中...
                </span>
              ) : (
                "确认并填充需求卡"
              )}
            </Button>
          </div>
        )}

        {/* Chat input - 美化输入框 */}
        <div className="shrink-0 border-t border-[var(--line-soft)] bg-white/60 px-4 py-3 backdrop-blur-sm">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Textarea
                minRows={1}
                className="w-full rounded-xl border border-[var(--line-strong)] bg-white px-4 py-3 text-sm shadow-sm focus:border-[var(--brand-400)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                placeholder={
                  assistantState?.stage === "done"
                    ? "继续补充需求、修改字段，或直接输入新想法..."
                    : "输入你的回答..."
                }
                value={conversationInput}
                onChange={(e) => setConversationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleConversationSend();
                  }
                }}
              />
            </div>
            <Button
              variant="primary"
              className="shrink-0 bg-gradient-to-r from-[var(--brand-500)] to-[var(--brand-600)] px-6 text-sm font-medium shadow-md hover:shadow-lg"
              disabled={!conversationInput.trim() || assistantLoading}
              onClick={handleConversationSend}
            >
              {assistantLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  发送中...
                </span>
              ) : (
                "发送"
              )}
            </Button>
          </div>
        </div>

      </div>

    </div>
  );
}
