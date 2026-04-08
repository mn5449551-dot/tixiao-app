"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Select, Textarea } from "@/components/ui/field";
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

    fetch(`/api/projects/${projectId}/assistant`)
      .then(async (response) => {
        const payload = (await response.json()) as AssistantState | { error?: string };
        if (!response.ok || !isAssistantState(payload)) {
          throw new Error(!isAssistantState(payload) && "error" in (payload as { error?: string }) ? payload.error ?? "获取助手状态失败" : "获取助手状态失败");
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
      const response = await fetch(`/api/projects/${projectId}/assistant/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: conversationInput.trim() }),
      });
      const payload = (await response.json()) as AssistantState | { error?: string };
      if (!response.ok || !isAssistantState(payload)) {
        throw new Error(!isAssistantState(payload) && "error" in (payload as { error?: string }) ? payload.error ?? "发送消息失败" : "发送消息失败");
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
      const response = await fetch(`/api/projects/${projectId}/assistant/confirm`, {
        method: "POST",
      });
      const payload = (await response.json()) as AssistantState | { error?: string };
      if (!response.ok || !isAssistantState(payload)) {
        throw new Error(!isAssistantState(payload) && "error" in (payload as { error?: string }) ? payload.error ?? "确认填充需求卡失败" : "确认填充需求卡失败");
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
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex h-full w-[24px] cursor-pointer items-center justify-center bg-[var(--surface-1)] text-[var(--ink-500)] transition hover:bg-[var(--surface-2)] hover:text-[var(--ink-700)]"
        title="展开助手"
      >
        <span className="text-xs">&#9664;</span>
      </button>
    );
  }

  return (
    <div className="flex h-full w-[360px] flex-col overflow-hidden border-l border-[var(--line-soft)] bg-[var(--panel-strong)]">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--line-soft)] px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--ink-400)]">Assistant</p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--ink-900)]">对话助手</h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone="brand">AI已接入</Badge>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-full p-1 text-xs text-[var(--ink-400)] transition hover:bg-[var(--surface-1)] hover:text-[var(--ink-700)]"
            title="收起"
          >
            &#9654;
          </button>
        </div>
      </div>

      {/* Scrollable content — chat-first layout */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Chat messages */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {(assistantState?.messages ?? []).map((msg) => (
            <div key={msg.id} className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              {msg.role === "ai" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-50)] text-xs font-semibold text-[var(--brand-600)]">
                  AI
                </div>
              )}
              <div className={`max-w-[260px] rounded-[18px] px-4 py-3 text-sm leading-6 shadow-[var(--shadow-inset)] ${
                msg.role === "user"
                  ? "bg-[var(--brand-50)] text-[var(--brand-800)]"
                  : msg.role === "system"
                    ? "bg-[var(--surface-2)] text-[var(--ink-500)] text-xs"
                    : "bg-white text-[var(--ink-700)]"
              }`}>
                <pre className="whitespace-pre-wrap font-sans text-inherit">{msg.content}</pre>
              </div>
              {msg.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ink-100)] text-xs font-semibold text-[var(--ink-600)]">
                  我
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Confirm button when in confirming state */}
        {assistantState?.stage === "confirming" && (
          <div className="shrink-0 px-4 pb-3">
            <Button
              className="w-full"
              onClick={confirmAndFill}
              disabled={isPending || assistantLoading}
              variant="primary"
            >
              {assistantLoading ? "处理中..." : "确认并填充需求卡"}
            </Button>
          </div>
        )}

        {/* Chat input */}
        <div className="shrink-0 border-t border-[var(--line-soft)] px-4 py-3">
          <div className="flex gap-2">
            <Textarea
              minRows={1}
              className="flex-1 rounded-xl px-3 py-2 text-xs focus:ring-1"
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
            <Button
              variant="primary"
              className="shrink-0 text-xs"
              disabled={!conversationInput.trim() || assistantLoading}
              onClick={handleConversationSend}
            >
              {assistantLoading ? "处理中..." : "发送"}
            </Button>
          </div>
        </div>

        {/* Reference mode toggle button */}
        <div className="shrink-0 border-t border-[var(--line-soft)]">
          <button
            type="button"
            onClick={() => setReferenceModeOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-[var(--surface-1)]"
          >
            <div>
              <p className="text-sm font-medium text-[var(--ink-900)]">参考图模式（旁路）</p>
              <p className="mt-0.5 text-xs text-[var(--ink-500)]">上传参考图 URL 和新指令，结果不走主链路。</p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-500)] text-white">
              <span className="text-sm">✨</span>
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
                    const response = await fetch("/api/reference-mode", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        project_id: projectId,
                        reference_image_url: referenceForm.imageUrl,
                        instruction: `${referenceForm.instruction}\n目标比例：${referenceForm.aspectRatio}\nLogo：${referenceForm.logo}`,
                      }),
                    });
                    if (!response.ok) {
                      const payload = (await response.json()) as { error?: string };
                      throw new Error(payload.error ?? "参考图模式生成失败");
                    }
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
