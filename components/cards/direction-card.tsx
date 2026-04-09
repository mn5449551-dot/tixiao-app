"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

import {
  appendDirectionGeneration,
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(directions.filter((direction) => !direction.hasDownstream).map((direction) => direction.id)),
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

      if (prev.size === 0) {
        return selectableIds;
      }

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
      style={{ width: 620 } satisfies CSSProperties}
    >
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

      <div className="workflow-drag-handle mb-3 flex cursor-grab items-center justify-between gap-2 border-b border-[#f5f0eb] pb-3 active:cursor-grabbing">
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

      {isError ? (
        <div className="mb-3 rounded-lg bg-[#fdf2f2] px-3 py-2 text-xs text-[#c0392b]">
          方向生成失败，请重试
        </div>
      ) : null}
      {actionError ? (
        <div className="mb-3 rounded-lg bg-[#fdf2f2] px-3 py-2 text-xs text-[#c0392b]">
          {actionError}
        </div>
      ) : null}

      <div className="mb-3 grid gap-3 rounded-[22px] bg-[var(--surface-1)] p-3 md:grid-cols-2">
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
                {form === "single" ? "单图" : form === "double" ? "双图" : "三图"}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="space-y-3">
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
                    stageLabel={data.stageLabel}
                  />
                )
              }
            />
          );
        })}

        {directions.length === 0 ? (
          <div className="rounded-[22px] bg-[var(--surface-1)] p-6 text-center text-sm text-[var(--ink-400)]">
            暂无方向，请先从需求卡生成方向
          </div>
        ) : null}
      </div>

      <div className="my-3 h-px bg-[var(--line-soft)]" />

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

      <div className="flex items-center gap-2">
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
          className="flex-1"
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
            <><span className="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> 生成中...</>
          ) : (
            <><span className="mr-1.5">{"\u26A1"}</span> 生成选中方向的文案</>
          )}
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
    <div className="grid gap-2 md:grid-cols-3">
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
    <div className="rounded-2xl bg-white/70 px-3 py-2.5">
      <div className="text-[10px] font-medium leading-4 text-[var(--ink-500)]">{label}</div>
      <div className="mt-1 whitespace-pre-wrap break-words text-[12px] leading-5 text-[var(--ink-900)]">{value}</div>
    </div>
  );
}
