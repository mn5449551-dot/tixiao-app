"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
import { ApiError } from "@/lib/api-fetch";
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
  const [isGeneratingSelected, setIsGeneratingSelected] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  useEffect(() => {
    const nextIds = new Set(directions.map((direction) => direction.id));
    const nextChannel = data.initialChannel ?? directions[0]?.channel ?? CHANNELS[0];
    const nextForms = getAvailableImageForms(nextChannel);
    const nextImageForm =
      data.initialImageForm ??
      (directions[0]?.imageForm && nextForms.some((form) => form === directions[0]?.imageForm)
        ? directions[0]?.imageForm
        : nextForms[0]) ??
      "single";

    setChannel(nextChannel);
    setImageForm(nextImageForm);
    setCopyGenerationCount(String(directions[0]?.copyGenerationCount ?? 3));
    setExpandedIds((prev) => {
      const next = new Set([...prev].filter((id) => nextIds.has(id)));
      for (const direction of directions) {
        if (!prev.has(direction.id)) {
          next.add(direction.id);
        }
      }
      return next;
    });
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => nextIds.has(id)));
      if (prev.size === 0 && directions.length > 0) {
        return new Set(directions.map((direction) => direction.id));
      }
      return next;
    });
    setEditingId((current) => (current && nextIds.has(current) ? current : null));
  }, [data.initialChannel, data.initialImageForm, directions]);

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
      style={{ width: 400 } satisfies CSSProperties}
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
      {/* Header - 简洁布局 */}
      <div className="workflow-drag-handle mb-4 flex cursor-grab items-center justify-between gap-3 border-b border-[var(--line-soft)] pb-3 active:cursor-grabbing">
        <div>
          <h3 className="text-base font-semibold text-[var(--ink-950)]">方向卡</h3>
          <p className="mt-0.5 text-[10px] text-[var(--ink-500)]">
            {totalCount}条方向 {selectedCount > 0 && <span className="font-medium text-[var(--brand-600)]">· 已选{selectedCount}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDone && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--success-700)] text-[10px] text-white">
              ✓
            </span>
          )}
          {isError && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--danger-700)] text-[10px] text-white">
              ✕
            </span>
          )}
          <Badge tone="brand" size="sm">方向</Badge>
        </div>
      </div>

      {/* Error message */}
      {isError && (
        <div className="mb-3 rounded-lg bg-[#fdf2f2] px-3 py-2 text-xs text-[#c0392b]">
          方向生成失败，请重试
        </div>
      )}
      {actionError ? (
        <div className="mb-3 rounded-lg bg-[#fdf2f2] px-3 py-2 text-xs text-[#c0392b]">
          {actionError}
        </div>
      ) : null}

      {/* Channel + Image Form - 简洁表单 */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="投放渠道">
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
          hint={availableImageForms.length === 1 ? "渠道锁定" : undefined}
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

      {/* Directions list - 美化列表 */}
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
                  setActionError(null);
                  await deleteDirectionItem(direction.id);
                  dispatchWorkspaceInvalidated();
                } catch (error) {
                  setActionError(error instanceof ApiError ? error.message : "删除方向失败");
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
                        setActionError(null);
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
                        setActionError(error instanceof ApiError ? error.message : "保存方向失败");
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
          <div className="rounded-xl bg-[var(--surface-1)] p-6 text-center text-sm text-[var(--ink-400)]">
            暂无方向，请先从需求卡生成方向
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="my-2.5 h-px bg-[var(--line-soft)]" />

      {/* Copy generation settings */}
      <div className="mb-3">
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

      {/* Bottom actions - 优化操作按钮层级 */}
      <div className="flex flex-col gap-2">
        {/* 主操作区 */}
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            className="flex-1 text-sm"
            disabled={selectedCount === 0 || isGeneratingSelected}
            onClick={async () => {
              const selected = directions.filter((d) => selectedIds.has(d.id));
              if (selected.length === 0) return;
              const count = Number(copyGenerationCount);

              setIsGeneratingSelected(true);
              setActionError(null);
              try {
                const ok = await generateSelectedDirections({
                  directionIds: selected.map((direction) => direction.id),
                  channel,
                  imageForm,
                  copyGenerationCount: count,
                });
                if (ok) {
                  dispatchWorkspaceInvalidated();
                } else {
                  setActionError("批量生成文案失败");
                }
              } catch (error) {
                setActionError(error instanceof ApiError ? error.message : "批量生成文案失败");
              } finally {
                setIsGeneratingSelected(false);
              }
            }}
          >
            {isGeneratingSelected ? (
              <><span className="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> 生成中...</>
            ) : (
              <><span className="mr-1.5">⚡</span> 生成文案 {selectedCount > 0 && `(${selectedCount})`}</>
            )}
          </Button>
        </div>
        
        {/* 次要操作区 */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            className="h-8 px-2 text-xs text-[var(--ink-500)] hover:text-[var(--brand-600)]"
            onClick={async () => {
              if (isAppending) return;
              setIsAppending(true);
              setActionError(null);
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
                setActionError(error instanceof ApiError ? error.message : "追加生成方向失败");
              } finally {
                setIsAppending(false);
              }
            }}
          >
            {isAppending ? "生成中..." : "+ 追加生成方向"}
          </Button>
          <Button
            variant="ghost"
            className="h-8 px-2 text-xs text-[var(--ink-500)] hover:text-[var(--brand-600)]"
            onClick={toggleSelectAll}
          >
            {isAllSelected ? "全不选" : "全选"}
          </Button>
        </div>
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
