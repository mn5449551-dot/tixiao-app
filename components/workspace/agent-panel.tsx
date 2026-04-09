"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Select, Textarea } from "@/components/ui/field";
import { apiFetch } from "@/lib/api-fetch";
import { LOGO_OPTIONS } from "@/lib/constants";
import type { AssistantState } from "@/lib/assistant-state";
import { dispatchWorkspaceInvalidated } from "@/lib/workspace-events";

interface AgentPanelProps {
  projectId: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function isAssistantState(value: unknown): value is AssistantState {
  return typeof value === "object" && value !== null && "messages" in value && "draft" in value && "stage" in value;
}

export function AgentPanel({ projectId, collapsed, onToggleCollapse }: AgentPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // --- Conversation state ---
  const [assistantState, setAssistantState] = useState<AssistantState | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [conversationInput, setConversationInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  const handleConversationSend = useCallback(async () => {
    if (!conversationInput.trim()) return;

    setAssistantLoading(true);
    setError(null);
    try {
      const payload = await apiFetch<AssistantState>(`/api/projects/${projectId}/assistant/messages`, {
        method: "POST",
        body: { message: conversationInput.trim() },
      });
      if (!isAssistantState(payload)) {
        throw new Error("发送消息失败");
      }
      setAssistantState(payload);
      setConversationInput("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "发送消息失败");
    } finally {
      setAssistantLoading(false);
    }
  }, [conversationInput, projectId]);

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

  // --- Reference mode state ---
  const [referenceModeOpen, setReferenceModeOpen] = useState(false);
  const [referenceForm, setReferenceForm] = useState({
    imageUrl: "",
    instruction: "",
    aspectRatio: "1:1",
    logo: "onion",
    useIp: "0",
  });

  const runAction = (callback: () => Promise<void>) => {
    startTransition(async () => {
      setError(null);
      try {
        await callback();
        dispatchWorkspaceInvalidated();
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "操作失败");
      }
    });
  };

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
    <div className="flex h-full w-[360px] flex-col overflow-hidden border-l border-[var(--line-soft)] bg-gradient-to-b from-[var(--panel-strong)] to-[var(--surface-1)]">
      {/* Header - 美化布局 */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--line-soft)] bg-white/60 px-4 py-3 backdrop-blur-sm">
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
          <Badge tone="brand" size="sm">在线</Badge>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-lg p-1.5 text-[var(--ink-400)] transition-all duration-150 hover:bg-[var(--surface-1)] hover:text-[var(--ink-700)]"
            title="收起"
          >
            <span className="text-xs">&#9654;</span>
          </button>
        </div>
      </div>

      {/* Scrollable content — chat-first layout */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Chat messages - 美化消息气泡 */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {(assistantState?.messages ?? []).map((msg) => (
            <div 
              key={msg.id} 
              className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {/* 头像 */}
              {msg.role === "ai" ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-500)] to-[var(--brand-600)] text-xs font-bold text-white shadow-sm">
                  AI
                </div>
              ) : msg.role === "user" ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--ink-400)] to-[var(--ink-500)] text-xs font-bold text-white shadow-sm">
                  我
                </div>
              ) : null}
              
              {/* 消息气泡 */}
              <div className={`max-w-[280px] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
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
          <div ref={chatEndRef} />
        </div>

        {/* Confirm button when in confirming state */}
        {assistantState?.stage === "confirming" && (
          <div className="shrink-0 px-4 pb-3">
            <Button
              className="w-full bg-gradient-to-r from-[var(--brand-500)] to-[var(--brand-600)] text-white shadow-md hover:shadow-lg"
              onClick={confirmAndFill}
              disabled={isPending || assistantLoading}
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
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  发送中...
                </span>
              ) : (
                "发送"
              )}
            </Button>
          </div>
        </div>

        {/* Reference mode toggle button - 美化 */}
        <div className="shrink-0 border-t border-[var(--line-soft)] bg-white/40">
          <button
            type="button"
            onClick={() => setReferenceModeOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition-all duration-150 hover:bg-white/80"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400 to-purple-500 text-white shadow-sm">
                <span className="text-lg">🎨</span>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--ink-900)]">参考图模式（旁路）</p>
                <p className="mt-0.5 text-xs text-[var(--ink-500)]">上传参考图 URL 和新指令，结果不走主链路。</p>
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-500)] transition-transform duration-200" style={{ transform: referenceModeOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <span className="text-sm">&#9660;</span>
            </div>
          </button>

          {/* Reference mode expanded form */}
          {referenceModeOpen && (
            <div className="space-y-3 px-4 pb-4">
              <Field label="参考图 URL">
                <Textarea
                  minRows={1}
                  placeholder="https://..."
                  value={referenceForm.imageUrl}
                  onChange={(event) =>
                    setReferenceForm((current) => ({ ...current, imageUrl: event.target.value }))
                  }
                />
              </Field>
              <Field label="新文案/指令">
                <Textarea
                  minRows={2}
                  placeholder="例如：保留整体结构，把图片改成更适合教培投放的中文海报风格。"
                  value={referenceForm.instruction}
                  onChange={(event) =>
                    setReferenceForm((current) => ({ ...current, instruction: event.target.value }))
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="生成比例">
                  <Select
                    value={referenceForm.aspectRatio}
                    onChange={(event) =>
                      setReferenceForm((current) => ({ ...current, aspectRatio: event.target.value }))
                    }
                  >
                    <option value="1:1">1:1</option>
                    <option value="3:2">3:2</option>
                    <option value="16:9">16:9</option>
                    <option value="9:16">9:16</option>
                  </Select>
                </Field>
                <Field label="品牌 Logo">
                  <Select
                    value={referenceForm.logo}
                    onChange={(event) =>
                      setReferenceForm((current) => ({ ...current, logo: event.target.value }))
                    }
                  >
                    {LOGO_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option === "onion" ? "洋葱学园" : option === "onion_app" ? "洋葱学园+APP" : "不使用"}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button
                className="w-full"
                disabled={isPending || !referenceForm.imageUrl.trim() || !referenceForm.instruction.trim()}
                variant="secondary"
                onClick={() =>
                  runAction(async () => {
                    await apiFetch("/api/reference-mode", {
                      method: "POST",
                      body: {
                        project_id: projectId,
                        reference_image_url: referenceForm.imageUrl,
                        aspect_ratio: referenceForm.aspectRatio,
                        instruction: `${referenceForm.instruction}\n目标比例：${referenceForm.aspectRatio}\nLogo：${referenceForm.logo}`,
                      },
                    });
                  })
                }
              >
                生成参考图结果
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[var(--line-soft)] px-4 py-3">
        {error ? (
          <p className="text-sm text-[var(--danger-700)]">{error}</p>
        ) : (
          <p className="text-xs text-[var(--ink-500)]">当前阶段：Phase 0 / Phase 1 已进入联调。</p>
        )}
      </div>
    </div>
  );
}
