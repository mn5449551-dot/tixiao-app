"use client";

import type { CSSProperties } from "react";
import { useCallback, useMemo, useState } from "react";

import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { CHANNELS, getAvailableImageForms } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { dispatchWorkspaceInvalidated } from "@/lib/workspace-events";

export type CardStatus = "idle" | "loading" | "done" | "error" | "partial-success";

type DirectionItem = {
  id: string;
  title: string;
  targetAudience: string;
  scenarioProblem: string;
  differentiation: string;
  effect: string;
  channel: string;
  imageForm: string;
  copyGenerationCount: number;
  sourceHandleId: string;
};

export type DirectionCardData = {
  projectId?: string;
  stageLabel?: string;
  directions: DirectionItem[];
  initialChannel?: string;
  initialImageForm?: string;
  status?: CardStatus;
};

const DIRECTION_FIELD_LABELS = {
  title: "素材方向",
  targetAudience: "目标人群",
  stage: "适配阶段",
  scenarioProblem: "1 能解决用户在“具体哪个场景里的哪个问题”",
  differentiation: "2 能带来什么不一样的“一听很惊艳”的解法？",
  effect: "3 因此带来了哪个场景下的什么“奇效”？",
} as const;

export function DirectionCard({
  data,
  selected,
}: NodeProps<Node<DirectionCardData, "directionCard">>) {
  const directions = useMemo(() => data.directions ?? [], [data.directions]);
  const status = data.status ?? "idle";

  const isLoading = status === "loading";
  const isError = status === "error";
  const isDone = status === "done";

  const [channel, setChannel] = useState(
    data.initialChannel ?? directions[0]?.channel ?? CHANNELS[0],
  );
  const availableImageForms = useMemo(
    () => getAvailableImageForms(channel),
    [channel],
  );
  const [imageForm, setImageForm] = useState(
    data.initialImageForm ??
      (directions[0]?.imageForm && availableImageForms.some((f) => f === directions[0]?.imageForm)
        ? directions[0]?.imageForm
        : availableImageForms[0]) ??
      "single",
  );
  const [copyGenerationCount, setCopyGenerationCount] = useState(
    String(data.directions[0]?.copyGenerationCount ?? 3),
  );
  const [isAppending, setIsAppending] = useState(false);

  // Sync imageForm when channel changes to a locked form
  const handleChannelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newChannel = e.target.value;
      setChannel(newChannel);
      const forms = getAvailableImageForms(newChannel);
      if (!forms.some((f) => f === imageForm)) {
        setImageForm(forms[0]);
      }
    },
    [imageForm],
  );

  // Expand / collapse state per direction
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(directions.map((direction) => direction.id)),
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  // Checkbox selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(directions.map((d) => d.id)),
  );

  // Edit buffer
  const [editBuffer, setEditBuffer] = useState<Record<string, string>>({});

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setEditingId((prev) => (prev === id ? null : prev));
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const startEdit = useCallback((id: string, item: DirectionItem) => {
    setEditingId(id);
    setEditBuffer({
      title: item.title,
      targetAudience: item.targetAudience,
      scenarioProblem: item.scenarioProblem,
      differentiation: item.differentiation,
      effect: item.effect,
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditBuffer({});
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === directions.length) return new Set();
      return new Set(directions.map((d) => d.id));
    });
  }, [directions]);

  const isAllSelected = directions.length > 0 && selectedIds.size === directions.length;
  const selectedCount = selectedIds.size;
  const totalCount = directions.length;

  const borderColorClass = isError
    ? "border-[#c0392b]"
    : selected
      ? "border-[var(--brand-300)] ring-4 ring-[var(--brand-ring)]"
      : "border-[var(--line-soft)]";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border bg-white p-4 shadow-[var(--shadow-card)] transition",
        borderColorClass,
        isLoading && "ring-2 ring-[var(--brand-ring)]",
      )}
      style={{ width: 380 } satisfies CSSProperties}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[28px] bg-white/60">
          <div className="flex flex-col items-center gap-2">
            <svg className="h-8 w-8 animate-spin text-[var(--brand-500)]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-30" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span className="text-xs font-medium text-[var(--brand-600)]">生成中...</span>
          </div>
        </div>
      )}

      <Handle
        className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand-500)]"
        position={Position.Left}
        type="target"
      />
      {/* Header */}
      <div className="workflow-drag-handle mb-3 flex cursor-grab items-center justify-between gap-2 border-b border-[#f5f0eb] pb-3 active:cursor-grabbing">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{"\u25C9"}</span>
            <h3 className="text-sm font-semibold text-[#4a3728]">方向卡</h3>
            {isDone && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#27ae60] text-white text-[10px]">{"\u2713"}</span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-[var(--ink-400)]">
            {totalCount}条 {selectedCount > 0 ? `· 已选${selectedCount}条` : ""}
          </p>
        </div>
        <Badge tone="brand">方向</Badge>
      </div>

      {/* Error message */}
      {isError && (
        <div className="mb-3 rounded-lg bg-[#fdf2f2] px-3 py-2 text-xs text-[#c0392b]">
          方向生成失败，请重试
        </div>
      )}

      {/* Channel + Image Form */}
      <div className="mb-3 space-y-2 rounded-[22px] bg-[var(--surface-1)] p-3">
        <Field label="渠道">
          <Select value={channel} onChange={handleChannelChange}>
            {CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="图片形式"
          hint={
            availableImageForms.length === 1 ? "渠道锁定" : undefined
          }
        >
          <Select
            value={imageForm}
            onChange={(e) => setImageForm(e.target.value)}
            disabled={availableImageForms.length === 1}
          >
            {availableImageForms.map((form) => (
              <option key={form} value={form}>
                {form === "single" ? "单图" : form === "double" ? "双图" : "三图"}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* Divider */}
      <div className="my-3 h-px bg-[var(--line-soft)]" />

      {/* Directions list */}
      <div className="space-y-2">
        {directions.map((direction, index) => {
          const isExpanded = expandedIds.has(direction.id);
          const isEditing = editingId === direction.id;
          const isChecked = selectedIds.has(direction.id);

          return (
            <div
              key={direction.id}
              className="relative overflow-visible rounded-[22px] border border-[var(--line-soft)] bg-[var(--surface-1)] transition"
            >
              {/* Compact row */}
              <div className="flex items-center gap-2 p-3">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleSelect(direction.id)}
                  className="h-4 w-4 shrink-0 accent-[var(--brand-500)]"
                />
                <span className="min-w-0 flex-1 text-sm font-medium text-[var(--ink-900)]">
                  方向 #{index + 1}
                </span>
                <span className="truncate text-xs text-[var(--ink-500)]">
                  {direction.title}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    title="重新生成"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs text-[var(--ink-500)] hover:bg-[var(--surface-2)] hover:text-[var(--ink-700)]"
                    onClick={async () => {
                      try {
                        await fetch(`/api/directions/${direction.id}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ regenerate: true }),
                        });
                        dispatchWorkspaceInvalidated();
                      } catch (error) {
                        console.error("Failed to regenerate direction:", error);
                      }
                    }}
                  >
                    {"\u21BB"}
                  </button>
                  <button
                    type="button"
                    title={isEditing ? "保存" : "编辑"}
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs hover:bg-[var(--surface-2)]",
                      isEditing
                        ? "text-[var(--brand-500)]"
                        : "text-[var(--ink-500)] hover:text-[var(--ink-700)]",
                    )}
                    onClick={() => {
                      if (!isEditing) {
                        startEdit(direction.id, direction);
                        if (!isExpanded) toggleExpand(direction.id);
                      } else {
                        cancelEdit();
                      }
                    }}
                  >
                    {"\u270E"}
                  </button>
                  <button
                    type="button"
                    title="删除"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs text-[var(--ink-500)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger-700)]"
                    onClick={async () => {
                      if (!confirm(`确定删除方向 #${index + 1} 及其所有下游产物？`)) return;
                      try {
                        await fetch(`/api/directions/${direction.id}`, { method: "DELETE" });
                        dispatchWorkspaceInvalidated();
                      } catch (error) {
                        console.error("Failed to delete direction:", error);
                      }
                    }}
                  >
                    {"\u2716"}
                  </button>
                  <button
                    type="button"
                    title={isExpanded ? "收起" : "展开"}
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs transition",
                      isExpanded
                        ? "rotate-180 text-[var(--brand-500)]"
                        : "text-[var(--ink-500)]",
                    )}
                    onClick={() => toggleExpand(direction.id)}
                  >
                    {"\u25BC"}
                  </button>
                </div>
                <Handle
                  id={direction.sourceHandleId}
                  className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand-500)]"
                  position={Position.Right}
                  type="source"
                  style={{ top: 28, right: -7, transform: "translateY(-50%)" }}
                />
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-[var(--line-soft)] p-3 pt-2">
                  {isEditing ? (
                    /* Edit mode */
                    <div className="space-y-2">
                      <Field label={DIRECTION_FIELD_LABELS.title}>
                        <Textarea
                          minRows={1}
                          value={editBuffer.title ?? ""}
                          onChange={(e) =>
                            setEditBuffer((b) => ({ ...b, title: e.target.value }))
                          }
                        />
                      </Field>
                      <Field label={DIRECTION_FIELD_LABELS.targetAudience}>
                        <Textarea
                          minRows={1}
                          value={editBuffer.targetAudience ?? ""}
                          onChange={(e) =>
                            setEditBuffer((b) => ({
                              ...b,
                              targetAudience: e.target.value,
                            }))
                          }
                        />
                      </Field>
                      {data.stageLabel ? (
                        <DetailBlock label={DIRECTION_FIELD_LABELS.stage} value={data.stageLabel} />
                      ) : null}
                      <Field label={DIRECTION_FIELD_LABELS.scenarioProblem}>
                        <Textarea
                          value={editBuffer.scenarioProblem ?? ""}
                          onChange={(e) =>
                            setEditBuffer((b) => ({
                              ...b,
                              scenarioProblem: e.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label={DIRECTION_FIELD_LABELS.differentiation}>
                        <Textarea
                          value={editBuffer.differentiation ?? ""}
                          onChange={(e) =>
                            setEditBuffer((b) => ({
                              ...b,
                              differentiation: e.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label={DIRECTION_FIELD_LABELS.effect}>
                        <Textarea
                          value={editBuffer.effect ?? ""}
                          onChange={(e) =>
                            setEditBuffer((b) => ({ ...b, effect: e.target.value }))
                          }
                        />
                      </Field>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button variant="ghost" onClick={cancelEdit}>
                          取消
                        </Button>
                        <Button
                          variant="primary"
                          onClick={async () => {
                            try {
                              await fetch(`/api/directions/${editingId}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  title: editBuffer.title ?? "",
                                  target_audience: editBuffer.targetAudience ?? "",
                                  scenario_problem: editBuffer.scenarioProblem ?? "",
                                  differentiation: editBuffer.differentiation ?? "",
                                  effect: editBuffer.effect ?? "",
                                }),
                              });
                              cancelEdit();
                              dispatchWorkspaceInvalidated();
                            } catch (error) {
                              console.error("Failed to save direction:", error);
                            }
                          }}
                        >
                          保存
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Read-only expanded view */
                    <div className="space-y-2 text-sm">
                      <DetailBlock label={DIRECTION_FIELD_LABELS.title} value={direction.title} />
                      <DetailBlock label={DIRECTION_FIELD_LABELS.targetAudience} value={direction.targetAudience} />
                      {data.stageLabel ? <DetailBlock label={DIRECTION_FIELD_LABELS.stage} value={data.stageLabel} /> : null}
                      <DetailBlock label={DIRECTION_FIELD_LABELS.scenarioProblem} value={direction.scenarioProblem} />
                      <DetailBlock label={DIRECTION_FIELD_LABELS.differentiation} value={direction.differentiation} />
                      <DetailBlock label={DIRECTION_FIELD_LABELS.effect} value={direction.effect} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {directions.length === 0 && (
          <div className="rounded-[22px] bg-[var(--surface-1)] p-6 text-center text-sm text-[var(--ink-400)]">
            暂无方向，请先从需求卡生成方向
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="my-3 h-px bg-[var(--line-soft)]" />

      <div className="mb-3 rounded-[22px] bg-[var(--surface-1)] p-3">
        <Field label="文案生成数量" hint="1-5">
          <Select
            value={copyGenerationCount}
            onChange={(e) => setCopyGenerationCount(e.target.value)}
          >
            {["1", "2", "3", "4", "5"].map((count) => (
              <option key={count} value={count}>
                {count} 条
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          onClick={async () => {
            if (isAppending) return;
            setIsAppending(true);
            try {
              if (!data.projectId) return;
              await fetch(`/api/projects/${data.projectId}/directions/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  append: true,
                  channel,
                  image_form: imageForm,
                  copy_generation_count: Number(copyGenerationCount),
                  use_ai: true,
                }),
              });
              dispatchWorkspaceInvalidated();
            } catch (error) {
              console.error("Error appending direction:", error);
            } finally {
              setIsAppending(false);
            }
          }}
          className="shrink-0"
        >
          {isAppending ? "生成中..." : "+ 追加生成方向"}
        </Button>
        <Button variant="secondary" onClick={toggleSelectAll} className="shrink-0">
          {isAllSelected ? "全不选" : "全选"}
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          disabled={selectedCount === 0}
          onClick={async () => {
            const selected = directions.filter((d) => selectedIds.has(d.id));
            if (selected.length === 0) return;
            const count = Number(copyGenerationCount);

            for (const direction of selected) {
              try {
                await fetch(`/api/directions/${direction.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    channel,
                    image_form: imageForm,
                    copy_generation_count: count,
                  }),
                });
                await fetch(`/api/directions/${direction.id}/copy-cards/generate`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ count, use_ai: true }),
                });
              } catch (error) {
                console.error(`Error generating copy for direction ${direction.id}:`, error);
              }
            }
            dispatchWorkspaceInvalidated();
          }}
        >
          {"\u26A1"} 生成选中方向的文案
        </Button>
      </div>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 px-3 py-2">
      <div className="text-[11px] font-medium leading-5 text-[var(--ink-500)]">{label}</div>
      <div className="mt-1 whitespace-pre-wrap break-words text-[var(--ink-900)]">{value}</div>
    </div>
  );
}
