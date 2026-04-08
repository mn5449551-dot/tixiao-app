"use client";

import type { CSSProperties } from "react";
import { useCallback, useMemo, useState } from "react";

import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

import {
  appendDirectionGeneration,
  deleteDirectionItem,
  generateSelectedDirections,
  regenerateDirectionItem,
  saveDirectionItem,
} from "@/components/cards/direction-card/direction-card-actions";
import { DirectionItemEditor } from "@/components/cards/direction-card/direction-item-editor";
import { DirectionItemRow } from "@/components/cards/direction-card/direction-item-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import type { CardStatus } from "@/lib/constants";
import { CHANNELS, getAvailableImageForms } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { dispatchWorkspaceInvalidated } from "@/lib/workspace-events";

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
            <DirectionItemRow
              key={direction.id}
              item={direction}
              index={index}
              expanded={isExpanded}
              editing={isEditing}
              selected={isChecked}
              onToggleExpand={() => toggleExpand(direction.id)}
              onToggleSelect={() => toggleSelect(direction.id)}
              onRegenerate={() => {
                void regenerateDirectionItem(direction.id).then((ok) => {
                  if (ok) dispatchWorkspaceInvalidated();
                });
              }}
              onEditToggle={() => {
                if (!isEditing) {
                  startEdit(direction.id, direction);
                  if (!isExpanded) toggleExpand(direction.id);
                } else {
                  cancelEdit();
                }
              }}
              onDelete={async () => {
                if (!confirm(`确定删除方向 #${index + 1} 及其所有下游产物？`)) return;
                try {
                  const ok = await deleteDirectionItem(direction.id);
                  if (ok) {
                    dispatchWorkspaceInvalidated();
                  }
                } catch (error) {
                  console.error("Failed to delete direction:", error);
                }
              }}
              expandedContent={
                isEditing ? (
                  <DirectionItemEditor
                    labels={DIRECTION_FIELD_LABELS}
                    value={editBuffer}
                    stageLabel={data.stageLabel}
                    onChange={(field, value) => setEditBuffer((current) => ({ ...current, [field]: value }))}
                    onCancel={cancelEdit}
                    onSave={async () => {
                      if (!editingId) return;
                      try {
                        const ok = await saveDirectionItem({
                          directionId: editingId,
                          title: editBuffer.title ?? "",
                          targetAudience: editBuffer.targetAudience ?? "",
                          scenarioProblem: editBuffer.scenarioProblem ?? "",
                          differentiation: editBuffer.differentiation ?? "",
                          effect: editBuffer.effect ?? "",
                        });
                        if (ok) {
                          cancelEdit();
                          dispatchWorkspaceInvalidated();
                        }
                      } catch (error) {
                        console.error("Failed to save direction:", error);
                      }
                    }}
                  />
                ) : (
                  <ReadOnlyDirectionDetails
                    labels={DIRECTION_FIELD_LABELS}
                    direction={direction}
                    stageLabel={data.stageLabel}
                  />
                )
              }
            />
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
              const ok = await appendDirectionGeneration({
                projectId: data.projectId,
                channel,
                imageForm,
                copyGenerationCount: Number(copyGenerationCount),
              });
              if (ok) {
                dispatchWorkspaceInvalidated();
              }
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

            try {
              const ok = await generateSelectedDirections({
                directionIds: selected.map((direction) => direction.id),
                channel,
                imageForm,
                copyGenerationCount: count,
              });
              if (ok) {
                dispatchWorkspaceInvalidated();
              }
            } catch (error) {
              console.error("Error generating selected directions:", error);
            }
          }}
        >
          {"\u26A1"} 生成选中方向的文案
        </Button>
      </div>
    </div>
  );
}

function ReadOnlyDirectionDetails({
  labels,
  direction,
  stageLabel,
}: {
  labels: typeof DIRECTION_FIELD_LABELS;
  direction: DirectionItem;
  stageLabel?: string;
}) {
  return (
    <div className="space-y-2 text-sm">
      <DetailBlock label={labels.title} value={direction.title} />
      <DetailBlock label={labels.targetAudience} value={direction.targetAudience} />
      {stageLabel ? <DetailBlock label={labels.stage} value={stageLabel} /> : null}
      <DetailBlock label={labels.scenarioProblem} value={direction.scenarioProblem} />
      <DetailBlock label={labels.differentiation} value={direction.differentiation} />
      <DetailBlock label={labels.effect} value={direction.effect} />
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
