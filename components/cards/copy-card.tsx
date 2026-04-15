"use client";

import type { CSSProperties } from "react";
import { useCallback, useState } from "react";

import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
  getCopyDisplayRows,
} from "@/lib/copy-card-presenter";
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
      setActionError(error instanceof Error ? error.message : "保存文案失败");
    }
    cancelEdit();
  };

  const generateCopyConfig = useCallback(async (id: string, shouldRefresh = true) => {
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
      setActionError(error instanceof Error ? error.message : "生成图片配置失败");
    }
  }, [imageForm, isGenerating]);

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
  }, [generateCopyConfig, isGenerating, localItems, selectedIds]);

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
    if (!confirm(`确定删除文案项？此操作不可恢复。`)) return;
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
      setActionError(error instanceof Error ? error.message : "删除文案失败");
    }
  };

  const deleteCopyCard = async () => {
    if (!copyCardId || isDeletingCard) return;
    if (localItems.some((item) => item.isLocked)) {
      setActionError("已有下游内容，不能删除");
      return;
    }
    setIsDeletingCard(true);
    try {
      setActionError(null);
      const ok = await deleteCopyCardAction(copyCardId);
      if (!ok) {
        throw new Error("删除失败");
      }
      dispatchWorkspaceInvalidated();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "删除文案卡失败");
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
      setActionError(error instanceof Error ? error.message : "追加生成文案失败");
    } finally {
      setIsAppending(false);
    }
  }, [copyCardId, data.directionId, isAppending]);

  const borderColorClass = isError
    ? "border-[var(--danger-500)]"
    : selected
      ? "border-[var(--brand-300)] ring-4 ring-[var(--brand-ring)]"
      : "border-[var(--line-soft)]";
  const isAllSelected = areAllSelectableCopiesSelected(localItems, selectedIds);
  const selectedCount = getSelectableCopyIds(localItems).filter((id) => selectedIds.has(id)).length;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-white p-6 shadow-[var(--shadow-card)] transition-all duration-350 ease-out",
        borderColorClass,
        isLoading && "ring-2 ring-[var(--brand-ring)]",
      )}
      style={{ width: 420, maxWidth: '100%' } satisfies CSSProperties}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
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
        "absolute inset-x-0 top-0 h-1.5",
        isError ? "bg-[var(--danger-500)]" : "bg-gradient-to-r from-[var(--brand-300)] to-[var(--brand-500)]",
      )} />

      {/* Header */}
      <div className="workflow-drag-handle mb-4 flex cursor-grab items-start justify-between gap-3 border-b border-[var(--line-soft)] pb-4 active:cursor-grabbing">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-[var(--ink-950)]">文案</h3>
            {isDone && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--success-500)] text-[10px] text-white shadow-sm">
                ✓
              </span>
            )}
            {isError && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--danger-500)] text-[10px] text-white shadow-sm">
                ✕
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-[var(--ink-500)]" title={directionTitle}>
            {directionTitle}{version ? ` · V${version}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="h-8 px-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
            onClick={deleteCopyCard}
            disabled={!copyCardId || isDeletingCard || localItems.some((item) => item.isLocked)}
            title={localItems.some((item) => item.isLocked) ? "已有下游内容，不能删除" : "删除文案卡"}
          >
            删除
          </Button>
        </div>
      </div>

      {/* Error message */}
      {isError && (
        <div className="mb-4 rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-700)]">
          文案生成失败，请重试
        </div>
      )}
      {actionError ? (
        <div className="mb-4 rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-700)]">
          {actionError}
        </div>
      ) : null}

      {/* Copy items */}
      <div className="space-y-4">
        {localItems.map((item, index) => {
          const actions = getCopyActionState(item.isLocked);
          const rows = getCopyDisplayRows(imageForm, item);
          const buffer = editBuffer[item.id];
          const isExpanded = expandedIds.has(item.id);
          const isEditing = editingId === item.id;
          const isChecked = selectedIds.has(item.id);

          return (
            <CopyItemRow
              key={item.id}
              item={item}
              index={index}
              statusLabel={actions.statusLabel ?? undefined}
              deleteHint={actions.deleteHint ?? undefined}
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
                  <div className="space-y-2.5">
                    {rows.map((row) => (
                      <div key={row.label} className="grid grid-cols-[72px_1fr] gap-2 text-sm">
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

      <div className="mt-5 flex items-center gap-2.5">
        <Button
          variant="ghost"
          className="shrink-0 text-xs px-2"
          disabled={isAppending}
          onClick={appendGenerate}
        >
          {isAppending ? "生成中..." : "+ 追加"}
        </Button>
        <Button
          variant="secondary"
          className="shrink-0 text-xs px-3"
          onClick={toggleSelectAll}
        >
          {isAllSelected ? "全不选" : "全选"}
        </Button>
        <Button
          variant="primary"
          className="flex-1 text-sm shadow-[var(--shadow-brand)] hover:shadow-[var(--shadow-brand-hover)]"
          disabled={selectedCount === 0 || isGenerating}
          onClick={generateSelectedCopyConfigs}
        >
          ⚡ 生成图片配置
        </Button>
      </div>
      <p className="mt-2.5 text-[11px] text-[var(--ink-400)]">
        为选中文案创建图片配置卡
      </p>
    </div>
  );
}
