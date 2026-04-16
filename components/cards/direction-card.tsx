"use client";

import type { CSSProperties, ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

import {
  appendDirectionGeneration,
  deleteDirectionCard,
  deleteDirectionItem,
  generateSelectedDirections,
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
  adaptationStage: string;
  scenarioProblem: string;
  differentiation: string;
  effect: string;
  channel: string;
  imageForm: string;
  copyGenerationCount: number;
  sourceHandleId: string;
  hasDownstream?: boolean;
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
  adaptationStage: "适配阶段",
  scenarioProblem: "1 能解决用户在具体哪个场景里的哪个问题",
  differentiation: "2 能带来什么不一样的一听很惊艳的解法？",
  effect: "3 因此带来了哪个场景下的什么奇效？",
} as const;

function getImageFormLabel(imageForm: string): string {
  if (imageForm === "single") {
    return "单图";
  }

  if (imageForm === "double") {
    return "双图";
  }

  return "三图";
}

export function DirectionCard({
  data,
  selected,
}: NodeProps<Node<DirectionCardData, "directionCard">>): ReactElement {
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
      (directions[0]?.imageForm && availableImageForms.some((form) => form === directions[0]?.imageForm)
        ? directions[0]?.imageForm
        : availableImageForms[0]) ??
      "single",
  );
  const [copyGenerationCount, setCopyGenerationCount] = useState(
    String(data.directions[0]?.copyGenerationCount ?? 3),
  );
  const [isAppending, setIsAppending] = useState(false);
  const [isGeneratingSelected, setIsGeneratingSelected] = useState(false);
  const [isDeletingCard, setIsDeletingCard] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [editBuffer, setEditBuffer] = useState<Record<string, string>>({});

  const handleChannelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const nextChannel = e.target.value;
      setChannel(nextChannel);
      const forms = getAvailableImageForms(nextChannel);
      if (!forms.some((form) => form === imageForm)) {
        setImageForm(forms[0]);
      }
    },
    [imageForm],
  );

  const startEdit = useCallback((id: string, item: DirectionItem) => {
    setEditingId(id);
    setEditBuffer({
      title: item.title,
      targetAudience: item.targetAudience,
      adaptationStage: item.adaptationStage,
      scenarioProblem: item.scenarioProblem,
      differentiation: item.differentiation,
      effect: item.effect,
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditBuffer({});
  }, []);

  useEffect(() => {
    setSelectedIds((prev) => {
      const selectableIds = new Set(
        directions.filter((direction) => !direction.hasDownstream).map((direction) => direction.id),
      );

      const next = new Set<string>();
      for (const id of prev) {
        if (selectableIds.has(id)) next.add(id);
      }

      return next;
    });
  }, [directions]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const selectableDirections = directions.filter((direction) => !direction.hasDownstream);
    setSelectedIds((prev) => {
      if (prev.size === selectableDirections.length) return new Set();
      return new Set(selectableDirections.map((direction) => direction.id));
    });
  }, [directions]);

  const selectableCount = directions.filter((direction) => !direction.hasDownstream).length;
  const isAllSelected = selectableCount > 0 && selectedIds.size === selectableCount;
  const selectedCount = selectedIds.size;
  const totalCount = directions.length;

  const borderColorClass = isError
    ? "border-[var(--danger-500)]"
    : selected
      ? "border-[var(--brand-300)] ring-4 ring-[var(--brand-ring)]"
      : "border-[var(--line-soft)]";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-white p-6 shadow-[var(--shadow-card)] transition-all duration-350 ease-out",
        borderColorClass,
        isLoading && "ring-2 ring-[var(--brand-ring)]",
      )}
      style={{ width: 620, maxWidth: '100%' } satisfies CSSProperties}
    >
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-[var(--brand-200)] border-t-[var(--brand-500)]" />
            <span className="text-xs font-medium text-[var(--brand-600)]">生成中...</span>
          </div>
        </div>
      )}

      <Handle
        className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand-500)] !shadow-sm"
        position={Position.Left}
        type="target"
      />

      {/* Top color bar */}
      <div className={cn(
        "absolute inset-x-0 top-0 h-2",
        isError ? "bg-[var(--danger-500)]" : "bg-gradient-to-r from-[var(--brand-300)] to-[var(--brand-500)]",
      )} />

      {/* Header */}
      <div className="workflow-drag-handle mb-5 flex cursor-grab items-center justify-between gap-3 border-b border-[var(--line-soft)] pb-4 active:cursor-grabbing">
        <div>
          <h3 className="text-lg font-semibold text-[var(--ink-950)]">方向卡</h3>
          <p className="mt-0.5 text-[11px] text-[var(--ink-500)]">
            {totalCount}条方向 {selectedCount > 0 && <span className="font-medium text-[var(--brand-600)]">· 已选{selectedCount}</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone="brand" size="sm">方向</Badge>
          {isDone && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--success-500)] text-[9px] text-white">
              ✓
            </span>
          )}
          {isError && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--danger-500)] text-[9px] text-white">
              ✕
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[var(--ink-500)] hover:text-[var(--danger-600)]"
            disabled={isDeletingCard || directions.length === 0}
            onClick={async () => {
              if (isDeletingCard || !data.projectId) return;
              if (!confirm(`确定删除整张方向卡（包含 ${totalCount} 条方向）？`)) return;
              setIsDeletingCard(true);
              setActionError(null);
              try {
                await deleteDirectionCard(data.projectId);
                dispatchWorkspaceInvalidated();
              } catch (error) {
                setActionError(error instanceof Error ? error.message : "删除方向卡失败");
              } finally {
                setIsDeletingCard(false);
              }
            }}
          >
            {isDeletingCard ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--ink-300)] border-t-[var(--ink-500)]" />
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </Button>
        </div>
      </div>

      {isError ? (
        <div className="mb-4 rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-700)]">
          方向生成失败，请重试
        </div>
      ) : null}
      {actionError ? (
        <div className="mb-4 rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-700)]">
          {actionError}
        </div>
      ) : null}

      <div className="mb-5 grid gap-3 rounded-2xl bg-[var(--surface-1)] p-4 md:grid-cols-2">
        <Field label="渠道">
          <Select value={channel} onChange={handleChannelChange}>
            {CHANNELS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="图片形式" hint={availableImageForms.length === 1 ? "渠道锁定" : undefined}>
          <Select
            value={imageForm}
            onChange={(e) => setImageForm(e.target.value)}
            disabled={availableImageForms.length === 1}
          >
            {availableImageForms.map((form) => (
              <option key={form} value={form}>
                {getImageFormLabel(form)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="space-y-4">
        {directions.map((direction, index) => {
          const isEditing = editingId === direction.id;
          const isChecked = selectedIds.has(direction.id);

          return (
            <DirectionItemRow
              key={direction.id}
              item={direction}
              index={index}
              editing={isEditing}
              selected={isChecked}
              onToggleSelect={() => toggleSelect(direction.id)}
              selectDisabled={Boolean(direction.hasDownstream)}
              selectHint={direction.hasDownstream ? "已生成文案，请在文案卡中追加" : "选择方向生成文案"}
              onEditToggle={() => {
                if (!isEditing) {
                  startEdit(direction.id, direction);
                } else {
                  cancelEdit();
                }
              }}
              onDelete={async () => {
                if (direction.hasDownstream) {
                  setActionError("已有下游内容，不能删除");
                  return;
                }
                if (!confirm(`确定删除方向 #${index + 1}？`)) return;
                try {
                  setActionError(null);
                  const ok = await deleteDirectionItem(direction.id);
                  if (!ok) {
                    throw new Error("删除方向失败");
                  }
                  dispatchWorkspaceInvalidated();
                } catch (error) {
                  setActionError(error instanceof Error ? error.message : "删除方向失败");
                }
              }}
              deleteDisabled={Boolean(direction.hasDownstream)}
              deleteHint={direction.hasDownstream ? "已有下游内容，不能删除" : "删除"}
              content={
                isEditing ? (
                  <DirectionItemEditor
                    labels={DIRECTION_FIELD_LABELS}
                    value={editBuffer}
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
                          adaptationStage: editBuffer.adaptationStage ?? "",
                          scenarioProblem: editBuffer.scenarioProblem ?? "",
                          differentiation: editBuffer.differentiation ?? "",
                          effect: editBuffer.effect ?? "",
                        });
                        if (!ok) {
                          throw new Error("保存方向失败");
                        }
                        cancelEdit();
                        dispatchWorkspaceInvalidated();
                      } catch (error) {
                        setActionError(error instanceof Error ? error.message : "保存方向失败");
                      }
                    }}
                  />
                ) : (
                  <ReadOnlyDirectionDetails
                    labels={DIRECTION_FIELD_LABELS}
                    direction={direction}
                  />
                )
              }
            />
          );
        })}

        {directions.length === 0 ? (
          <div className="rounded-2xl bg-[var(--surface-1)] p-6 text-center">
            <p className="text-sm font-medium text-[var(--ink-700)]">暂无方向</p>
            <p className="mt-2 text-xs text-[var(--ink-500)]">请先从需求卡生成方向</p>
          </div>
        ) : null}
      </div>

      <div className="my-5 h-px bg-[var(--line-soft)]" />

      {/* Copy generation settings */}
      <div className="mb-5">
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

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
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
              if (!ok) {
                throw new Error("追加生成方向失败");
              }
              dispatchWorkspaceInvalidated();
            } catch (error) {
              setActionError(error instanceof Error ? error.message : "追加生成方向失败");
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
          className="flex-1 shadow-[var(--shadow-brand)] hover:shadow-[var(--shadow-brand-hover)]"
          disabled={selectedCount === 0 || isGeneratingSelected}
          onClick={async () => {
            const selectedDirections = directions.filter(
              (direction) => selectedIds.has(direction.id) && !direction.hasDownstream,
            );
            if (selectedDirections.length === 0) return;

            setIsGeneratingSelected(true);
            setActionError(null);
            try {
              const ok = await generateSelectedDirections({
                directionIds: selectedDirections.map((direction) => direction.id),
                channel,
                imageForm,
                copyGenerationCount: Number(copyGenerationCount),
              });
              if (!ok) {
                throw new Error("批量生成文案失败");
              }
              dispatchWorkspaceInvalidated();
            } catch (error) {
              setActionError(error instanceof Error ? error.message : "批量生成文案失败");
            } finally {
              setIsGeneratingSelected(false);
            }
          }}
        >
          {isGeneratingSelected ? (
            <><span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> 生成中...</>
          ) : (
            <><span className="mr-2">⚡</span> 生成选中文案</>
          )}
        </Button>
      </div>
    </div>
  );
}

function ReadOnlyDirectionDetails({
  labels,
  direction,
}: {
  labels: typeof DIRECTION_FIELD_LABELS;
  direction: DirectionItem;
}) {
  return (
    <div className="grid gap-2.5 md:grid-cols-3">
      <DetailBlock label={labels.title} value={direction.title} />
      <DetailBlock label={labels.targetAudience} value={direction.targetAudience} />
      <DetailBlock label={labels.adaptationStage} value={direction.adaptationStage} />
      <DetailBlock label={labels.scenarioProblem} value={direction.scenarioProblem} />
      <DetailBlock label={labels.differentiation} value={direction.differentiation} />
      <DetailBlock label={labels.effect} value={direction.effect} />
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--surface-1)] px-4 py-3.5">
      <div className="text-[11px] font-medium leading-4 text-[var(--ink-500)]">{label}</div>
      <div className="mt-2.5 whitespace-pre-wrap break-words text-xs leading-7 text-[var(--ink-800)]">{value}</div>
    </div>
  );
}
