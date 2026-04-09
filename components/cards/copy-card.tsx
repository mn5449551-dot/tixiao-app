"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";

import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  appendCopyGenerationAction,
  deleteCopyCardAction,
  deleteCopyItemAction,
  generateCopyConfigAction,
  saveCopyItem,
} from "@/components/cards/copy-card/copy-card-actions";
import { CopyItemEditor } from "@/components/cards/copy-card/copy-item-editor";
import { CopyItemRow } from "@/components/cards/copy-card/copy-item-row";
import {
  areAllSelectableCopiesSelected,
  getSelectableCopyIds,
  toggleSelectableCopyIds,
} from "@/lib/copy-selection";
import {
  getCopyActionState,
  getCopyCompactSummary,
  getCopyDisplayRows,
} from "@/lib/copy-card-presenter";
import { ApiError } from "@/lib/api-fetch";
import type { CardStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { dispatchWorkspaceInvalidated } from "@/lib/workspace-events";

export type CopyItem = {
  id: string;
  variantIndex: number;
  copyType: string | null;
  titleMain: string;
  titleSub: string | null;
  titleExtra: string | null;
  isLocked: boolean;
  sourceHandleId: string;
};

export type CopyCardData = {
  copyCardId?: string;
  directionTitle: string;
  directionId?: string;
  channel: string;
  imageForm: string;
  version?: number;
  copyItems: CopyItem[];
  status?: CardStatus;
};

export function CopyCard({
  data,
  selected,
}: NodeProps<Node<CopyCardData, "copyCard">>) {
  const { copyCardId, directionTitle, imageForm, version, copyItems, status = "idle" } = data;

  const isLoading = status === "loading";
  const isError = status === "error";
  const isDone = status === "done";

  const [localItems, setLocalItems] = useState<CopyItem[]>(copyItems);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(copyItems.map((item) => item.id)),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<Record<string, { main: string; sub: string; extra: string }>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAppending, setIsAppending] = useState(false);
  const [isDeletingCard, setIsDeletingCard] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const nextIds = new Set(copyItems.map((item) => item.id));
    const selectableIds = new Set(copyItems.filter((item) => !item.isLocked).map((item) => item.id));

    setLocalItems(copyItems);
    setExpandedIds((prev) => {
      const next = new Set([...prev].filter((id) => nextIds.has(id)));
      for (const item of copyItems) {
        if (!prev.has(item.id)) {
          next.add(item.id);
        }
      }
      return next;
    });
    setSelectedIds((prev) => new Set([...prev].filter((id) => selectableIds.has(id))));
    setEditBuffer((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([id]) => nextIds.has(id))),
    );
    setEditingId((current) => (current && nextIds.has(current) ? current : null));
  }, [copyItems]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setEditingId((current) => (current === id ? null : current));
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const startEdit = useCallback((item: CopyItem) => {
    setEditBuffer((prev) => ({
      ...prev,
      [item.id]: {
        main: item.titleMain,
        sub: item.titleSub ?? "",
        extra: item.titleExtra ?? "",
      },
    }));
    setExpandedIds((prev) => new Set(prev).add(item.id));
    setEditingId(item.id);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const saveEdit = async (item: CopyItem) => {
    const next = editBuffer[item.id];
    if (!next || item.isLocked) {
      cancelEdit();
      return;
    }

    try {
      setActionError(null);
      const ok = await saveCopyItem({
        id: item.id,
        titleMain: next.main,
        titleSub: next.sub || null,
        titleExtra: next.extra || null,
      });
      if (!ok) throw new Error("保存失败");

      setLocalItems((prev) =>
        prev.map((current) =>
          current.id === item.id
            ? {
                ...current,
                titleMain: next.main,
                titleSub: next.sub || null,
                titleExtra: next.extra || null,
              }
            : current,
        ),
      );
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "保存文案失败");
    }
    cancelEdit();
  };

  const generateCopyConfig = async (id: string, shouldRefresh = true) => {
    if (isGenerating) return;
    try {
      setActionError(null);
      const ok = await generateCopyConfigAction({ copyId: id, imageForm });
      if (!ok) {
        throw new Error("生成失败");
      }
      if (shouldRefresh) {
        dispatchWorkspaceInvalidated();
      }
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "生成图片配置失败");
    }
  };

  const generateSelectedCopyConfigs = useCallback(async () => {
    if (isGenerating) return;

    const selectableIds = getSelectableCopyIds(localItems).filter((id) => selectedIds.has(id));
    if (selectableIds.length === 0) return;

    setIsGenerating(true);
    try {
      for (const id of selectableIds) {
        await generateCopyConfig(id, false);
      }
      dispatchWorkspaceInvalidated();
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, localItems, selectedIds]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => toggleSelectableCopyIds(localItems, prev));
  }, [localItems]);

  const deleteCopy = async (id: string) => {
    try {
      setActionError(null);
      const ok = await deleteCopyItemAction(id);
      if (!ok) {
        throw new Error("删除失败");
      }
      setLocalItems((prev) => prev.filter((item) => item.id !== id));
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setEditBuffer((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setEditingId((current) => (current === id ? null : current));
      dispatchWorkspaceInvalidated();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "删除文案失败");
    }
  };

  const deleteCopyCard = async () => {
    if (!copyCardId || isDeletingCard) return;
    setIsDeletingCard(true);
    try {
      setActionError(null);
      const ok = await deleteCopyCardAction(copyCardId);
      if (!ok) {
        throw new Error("删除失败");
      }
      dispatchWorkspaceInvalidated();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "删除文案卡失败");
    } finally {
      setIsDeletingCard(false);
    }
  };

  const appendGenerate = useCallback(async () => {
    if (isAppending) return;
    setIsAppending(true);
    try {
      setActionError(null);
      const directionId = data.directionId;
      if (!directionId || !copyCardId) return;

      const ok = await appendCopyGenerationAction({
        directionId,
        copyCardId,
      });
      if (!ok) {
        throw new Error("追加生成失败");
      }
      dispatchWorkspaceInvalidated();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "追加生成文案失败");
    } finally {
      setIsAppending(false);
    }
  }, [copyCardId, data.directionId, isAppending]);

  const borderColorClass = isError
    ? "border-[#c0392b]"
    : selected
      ? "border-[var(--brand-300)] ring-4 ring-[var(--brand-ring)]"
      : "border-[var(--line-soft)]";
  const isAllSelected = areAllSelectableCopiesSelected(localItems, selectedIds);
  const selectedCount = getSelectableCopyIds(localItems).filter((id) => selectedIds.has(id)).length;

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
      {/* Top color bar */}
      <div className={cn(
        "absolute inset-x-0 top-0 h-[4px]",
        isError ? "bg-[#c0392b]" : "bg-[var(--brand-500)]",
      )} />

      {/* Header - 简洁布局 */}
      <div className="workflow-drag-handle mb-4 flex cursor-grab items-start justify-between gap-3 border-b border-[var(--line-soft)] pb-3 active:cursor-grabbing">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--ink-950)]">文案</h3>
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
          </div>
          <p className="mt-1 line-clamp-1 text-[10px] text-[var(--ink-500)]" title={directionTitle}>
            {directionTitle}{version ? ` · V${version}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone="brand" size="sm" className="shrink-0">{localItems.length} 条</Badge>
          <Button 
            variant="ghost" 
            size="sm"
            className="shrink-0 text-[11px] text-[var(--ink-400)] hover:text-[var(--danger-700)] hover:bg-[var(--danger-soft)]" 
            onClick={deleteCopyCard} 
            disabled={!copyCardId || isDeletingCard}
            title="删除文案卡"
          >
            删除
          </Button>
        </div>
      </div>

      {/* Error message */}
      {isError && (
        <div className="mb-3 rounded-lg bg-[#fdf2f2] px-3 py-2 text-xs text-[#c0392b]">
          文案生成失败，请重试
        </div>
      )}
      {actionError ? (
        <div className="mb-3 rounded-lg bg-[#fdf2f2] px-3 py-2 text-xs text-[#c0392b]">
          {actionError}
        </div>
      ) : null}

      {/* Copy items - 优化列表布局 */}
      <div className="space-y-2.5">
        {localItems.map((item, index) => {
          const actions = getCopyActionState(item.isLocked);
          const rows = getCopyDisplayRows(imageForm, item);
          const compactSummary = getCopyCompactSummary(imageForm, item);
          const buffer = editBuffer[item.id];
          const isExpanded = expandedIds.has(item.id);
          const isEditing = editingId === item.id;
          const isChecked = selectedIds.has(item.id);

          return (
            <CopyItemRow
              key={item.id}
              item={item}
              index={index}
              compactSummary={compactSummary}
              statusLabel={actions.statusLabel ?? undefined}
              expanded={isExpanded}
              editing={isEditing}
              selected={isChecked}
              canDelete={actions.canDelete}
              onToggleSelect={() => toggleSelect(item.id)}
              onToggleExpand={() => toggleExpand(item.id)}
              onToggleEdit={() => {
                if (!isEditing) startEdit(item);
                else cancelEdit();
              }}
              onDelete={() => deleteCopy(item.id)}
              expandedContent={
                isEditing ? (
                  <CopyItemEditor
                    rows={rows}
                    value={buffer}
                    locked={item.isLocked}
                    onChange={(field, value) => {
                      const nextBase = {
                        main: buffer?.main ?? item.titleMain,
                        sub: buffer?.sub ?? item.titleSub ?? "",
                        extra: buffer?.extra ?? item.titleExtra ?? "",
                      };
                      setEditBuffer((prev) => ({
                        ...prev,
                        [item.id]: {
                          ...nextBase,
                          [field]: value,
                        },
                      }));
                    }}
                    onCancel={cancelEdit}
                    onSave={() => saveEdit(item)}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {rows.map((row) => (
                      <div key={row.label} className="grid grid-cols-[64px_1fr] gap-1.5 text-sm">
                        <span className="text-[var(--ink-500)]">{row.label}：</span>
                        <span className={cn("text-[var(--ink-900)]", row.label === "主标题" || row.label === "图1文案" ? "font-medium" : "")}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              }
            />
          );
        })}
      </div>

      {/* Bottom actions - 优化操作按钮层级 */}
      <div className="mt-3 flex flex-col gap-2">
        {/* 主操作区 */}
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            className="flex-1 text-sm"
            disabled={selectedCount === 0 || isGenerating}
            onClick={generateSelectedCopyConfigs}
          >
            {isGenerating ? (
              <><span className="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> 生成中...</>
            ) : (
              <><span className="mr-1.5">⚡</span> 生成选中文案 {selectedCount > 0 && `(${selectedCount})`}</>
            )}
          </Button>
        </div>
        
        {/* 次要操作区 */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            className="h-8 px-2 text-xs text-[var(--ink-500)] hover:text-[var(--brand-600)]"
            disabled={isAppending}
            onClick={appendGenerate}
          >
            {isAppending ? "生成中..." : "+ 追加生成文案"}
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
