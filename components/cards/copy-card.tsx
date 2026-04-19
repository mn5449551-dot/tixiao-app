"use client";

import type { CSSProperties, ReactElement } from "react";
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
  getSelectableCopyIds,
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

function getCopyCardBorderClass(isError: boolean, selected: boolean): string {
  if (isError) return "border-[var(--danger)]";
  if (selected) return "border-[var(--brand-light)] ring-2 ring-[var(--brand-ring)]";
  return "border-[var(--border)]";
}

function getCopyCardTopBarClass(isError: boolean): string {
  return isError ? "bg-[var(--danger)]" : "bg-[var(--brand)]";
}

function getCopyActionErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error ? error.message : fallbackMessage;
}

export function CopyCard({
  data,
  selected,
}: NodeProps<Node<CopyCardData, "copyCard">>): ReactElement {
  const { copyCardId, directionTitle, imageForm, version, copyItems, status = "idle" } = data;

  const isLoading = status === "loading";
  const isError = status === "error";
  const isDone = status === "done";

  const [localItems, setLocalItems] = useState<CopyItem[]>(copyItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<Record<string, { main: string; sub: string; extra: string }>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAppending, setIsAppending] = useState(false);
  const [isDeletingCard, setIsDeletingCard] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const hasLockedItems = localItems.some((item) => item.isLocked);

  const startEdit = useCallback((item: CopyItem) => {
    setEditBuffer((prev) => ({
      ...prev,
      [item.id]: {
        main: item.titleMain,
        sub: item.titleSub ?? "",
        extra: item.titleExtra ?? "",
      },
    }));
    setEditingId(item.id);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const removeCopyItemState = useCallback((id: string) => {
    setLocalItems((prev) => prev.filter((item) => item.id !== id));
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
      setActionError(getCopyActionErrorMessage(error, "保存文案失败"));
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
      setActionError(getCopyActionErrorMessage(error, "生成图片配置失败"));
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

  const deleteCopy = useCallback(async (id: string) => {
    if (!confirm(`确定删除文案项？此操作不可恢复。`)) return;
    try {
      setActionError(null);
      const ok = await deleteCopyItemAction(id);
      if (!ok) {
        throw new Error("删除失败");
      }
      removeCopyItemState(id);
      dispatchWorkspaceInvalidated();
    } catch (error) {
      setActionError(getCopyActionErrorMessage(error, "删除文案失败"));
    }
  }, [removeCopyItemState]);

  const deleteCopyCard = useCallback(async () => {
    if (!copyCardId || isDeletingCard) return;
    if (hasLockedItems) {
      setActionError("请先删除下游的图片配置卡");
      return;
    }
    if (!confirm("确定删除文案卡？")) return;
    setIsDeletingCard(true);
    try {
      setActionError(null);
      const ok = await deleteCopyCardAction(copyCardId);
      if (!ok) {
        throw new Error("删除失败");
      }
      dispatchWorkspaceInvalidated();
    } catch (error) {
      setActionError(getCopyActionErrorMessage(error, "删除文案卡失败"));
    } finally {
      setIsDeletingCard(false);
    }
  }, [copyCardId, hasLockedItems, isDeletingCard]);

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
      setActionError(getCopyActionErrorMessage(error, "追加生成文案失败"));
    } finally {
      setIsAppending(false);
    }
  }, [copyCardId, data.directionId, isAppending]);

  const borderColorClass = getCopyCardBorderClass(isError, selected);
  const selectedCount = getSelectableCopyIds(localItems).filter((id) => selectedIds.has(id)).length;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] transition-all duration-[var(--duration-normal)] ease-out",
        borderColorClass,
        isLoading && "ring-2 ring-[var(--brand-ring)]",
      )}
      style={{ width: 440, maxWidth: '100%' } satisfies CSSProperties}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[var(--radius-lg)] bg-white/70">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="md" />
            <span className="text-xs font-medium text-[var(--brand-hover)]">生成中...</span>
          </div>
        </div>
      )}

      <Handle
        className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand)]"
        position={Position.Left}
        type="target"
      />

      {/* Top color bar */}
      <div className={cn(
        "absolute inset-x-0 top-0 h-1",
        getCopyCardTopBarClass(isError),
      )} />

      {/* Header */}
      <div className="workflow-drag-handle mb-4 flex cursor-grab items-start justify-between gap-3 border-b border-[var(--border)] pb-3 active:cursor-grabbing">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-[var(--ink-strong)]">文案</h3>
            {isDone && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--success)] text-xs text-white shadow-sm">
                ✓
              </span>
            )}
            {isError && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--danger)] text-xs text-white shadow-sm">
                ✕
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-[var(--ink-muted)]" title={directionTitle}>
            {directionTitle}{version ? ` · V${version}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {isDone && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--success)] text-xs text-white">✓</span>
          )}
          {isError && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--danger)] text-xs text-white">✕</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[var(--ink-muted)] hover:text-[var(--danger-text)]"
            onClick={deleteCopyCard}
            disabled={!copyCardId || isDeletingCard || hasLockedItems}
            title={hasLockedItems ? "请先删除下游的图片配置卡" : "删除文案卡"}
          >
            {isDeletingCard ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--ink-subtle)] border-t-[var(--ink-muted)]" />
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </Button>
        </div>
      </div>

      {/* Error message */}
      {isError && (
        <div className="mb-3 rounded-lg bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-text)]">
          文案生成失败，请重试
        </div>
      )}
      {actionError ? (
        <div className="mb-3 rounded-lg bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-text)]">
          {actionError}
        </div>
      ) : null}

      {/* Copy items */}
      <div className="space-y-4">
        {localItems.map((item, index) => {
          const actions = getCopyActionState(item.isLocked);
          const rows = getCopyDisplayRows(imageForm, item);
          const buffer = editBuffer[item.id];
          const isEditing = editingId === item.id;
          const isChecked = selectedIds.has(item.id);

          return (
            <CopyItemRow
              key={item.id}
              item={item}
              index={index}
              statusLabel={actions.statusLabel ?? undefined}
              deleteHint={actions.deleteHint ?? undefined}
              editing={isEditing}
              selected={isChecked}
              canDelete={actions.canDelete}
              onToggleSelect={() => toggleSelect(item.id)}
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
                        <span className="text-[var(--ink-muted)]">{row.label}：</span>
                        <span className={cn("text-[var(--ink-strong)]", row.label === "主标题" || row.label === "图1文案" ? "font-medium" : "")}>
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
          variant="primary"
          className="flex-1 text-sm"
          disabled={selectedCount === 0 || isGenerating}
          onClick={generateSelectedCopyConfigs}
        >
          ⚡ 生成图片配置
        </Button>
      </div>
    </div>
  );
}
