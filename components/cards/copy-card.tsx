"use client";

import type { CSSProperties } from "react";
import { useCallback, useState } from "react";

import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
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
import { cn } from "@/lib/utils";
import { dispatchWorkspaceInvalidated } from "@/lib/workspace-events";

export type CardStatus = "idle" | "loading" | "done" | "error" | "partial-success";

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
    () => new Set(getSelectableCopyIds(copyItems)),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAppending, setIsAppending] = useState(false);
  const [isDeletingCard, setIsDeletingCard] = useState(false);

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
      const response = await fetch(`/api/copies/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title_main: next.main,
          title_sub: next.sub || null,
          title_extra: next.extra || null,
        }),
      });
      if (!response.ok) throw new Error("保存失败");

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
    } catch {
      // Silently fail — user can retry
    }
    cancelEdit();
  };

  const generateCopyConfig = async (id: string, shouldRefresh = true) => {
    if (isGenerating) return;
    try {
      const response = await fetch(`/api/copies/${id}/image-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aspect_ratio: imageForm === "single" ? "1:1" : "3:2",
          style_mode: "normal",
          logo: "onion",
          image_style: "realistic",
          count: 1,
        }),
      });
      if (!response.ok) {
        throw new Error("生成失败");
      }
      if (shouldRefresh) {
        dispatchWorkspaceInvalidated();
      }
    } catch {
      // Silently fail
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
      const response = await fetch(`/api/copies/${id}`, { method: "DELETE" });
      if (!response.ok) {
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
    } catch {
      // Silently fail
    }
  };

  const deleteCopyCard = async () => {
    if (!copyCardId || isDeletingCard) return;
    setIsDeletingCard(true);
    try {
      const response = await fetch(`/api/copy-cards/${copyCardId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("删除失败");
      }
      dispatchWorkspaceInvalidated();
    } catch {
      // Silently fail
    } finally {
      setIsDeletingCard(false);
    }
  };

  const appendGenerate = useCallback(async () => {
    if (isAppending) return;
    setIsAppending(true);
    try {
      const directionId = data.directionId;
      if (!directionId) return;

      const response = await fetch(`/api/directions/${directionId}/copy-cards/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ append: true, use_ai: true }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "追加生成失败");
      }
      dispatchWorkspaceInvalidated();
    } catch {
      // Silently fail
    } finally {
      setIsAppending(false);
    }
  }, [data.directionId, isAppending]);

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
      {/* Top color bar */}
      <div className={cn(
        "absolute inset-x-0 top-0 h-[4px]",
        isError ? "bg-[#c0392b]" : "bg-[var(--brand-500)]",
      )} />

      {/* Header */}
      <div className="workflow-drag-handle mb-3 flex cursor-grab items-start justify-between gap-3 border-b border-[#f5f0eb] pb-3 pt-1 active:cursor-grabbing">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{"\u25C9"}</span>
            <h3 className="text-sm font-semibold text-[#4a3728]">文案</h3>
            {isDone && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#27ae60] text-white text-[10px]">{"\u2713"}</span>
            )}
          </div>
          <p className="text-[11px] text-[var(--ink-400)]">{directionTitle}{version ? ` · V${version}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="h-7 px-2 text-[11px]" onClick={deleteCopyCard} disabled={!copyCardId || isDeletingCard}>
            删除
          </Button>
          <Badge tone="brand">{localItems.length} 条</Badge>
        </div>
      </div>

      {/* Error message */}
      {isError && (
        <div className="mb-3 rounded-lg bg-[#fdf2f2] px-3 py-2 text-xs text-[#c0392b]">
          文案生成失败，请重试
        </div>
      )}

      {/* Copy items */}
      <div className="space-y-2">
        {localItems.map((item, index) => {
          const actions = getCopyActionState(item.isLocked);
          const rows = getCopyDisplayRows(imageForm, item);
          const compactSummary = getCopyCompactSummary(imageForm, item);
          const buffer = editBuffer[item.id];
          const isExpanded = expandedIds.has(item.id);
          const isEditing = editingId === item.id;
          const isChecked = selectedIds.has(item.id);

          return (
            <div
              key={item.id}
              className="relative overflow-visible rounded-[22px] border border-[var(--line-soft)] bg-[var(--surface-1)] transition"
            >
              <div className="flex items-center gap-2 p-3">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleSelect(item.id)}
                  disabled={item.isLocked}
                  className="h-4 w-4 shrink-0 accent-[var(--brand-500)] disabled:cursor-not-allowed disabled:opacity-40"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--ink-900)]">
                      文案 #{item.variantIndex || index + 1}
                    </span>
                    {item.isLocked ? <span className="text-[10px] text-[var(--ink-400)]">{"\u{1F512}"}</span> : null}
                  </div>
                </div>
                <span className="max-w-[150px] truncate text-xs text-[var(--ink-500)]">
                  {compactSummary}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {actions.statusLabel ? (
                    <span className="rounded-full bg-[var(--surface-0)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-500)]">
                      {actions.statusLabel}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    title={isEditing ? "保存" : "编辑"}
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs hover:bg-[var(--surface-2)]",
                      isEditing
                        ? "text-[var(--brand-500)]"
                        : "text-[var(--ink-500)] hover:text-[var(--ink-700)]",
                      item.isLocked && "cursor-not-allowed opacity-40",
                    )}
                    disabled={item.isLocked}
                    onClick={() => {
                      if (!isEditing) {
                        startEdit(item);
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
                    onClick={() => deleteCopy(item.id)}
                    disabled={!actions.canDelete}
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
                    onClick={() => toggleExpand(item.id)}
                  >
                    {"\u25BC"}
                  </button>
                </div>
                <Handle
                  id={item.sourceHandleId}
                  className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand-500)]"
                  position={Position.Right}
                  type="source"
                  style={{ top: 28, right: -7, transform: "translateY(-50%)" }}
                />
              </div>

              {isExpanded ? (
                <div className="border-t border-[var(--line-soft)] p-3 pt-2">
                  {isEditing ? (
                    item.isLocked ? (
                      <p className="text-[11px] text-[var(--ink-400)]">已锁定，需先删除对应图片配置卡才能修改</p>
                    ) : (
                      <div className="space-y-2">
                        {rows.map((row) => (
                          <label key={row.label} className="grid grid-cols-[64px_1fr] items-center gap-2 text-[11px] text-[var(--ink-600)]">
                            <span>{row.label}：</span>
                            <Textarea
                              minRows={1}
                              className="rounded-xl px-2.5 py-2 text-xs focus:ring-2"
                              value={
                                row.label === "主标题" || row.label === "图1文案"
                                  ? (buffer?.main ?? item.titleMain)
                                  : row.label === "副标题" || row.label === "图2文案"
                                    ? (buffer?.sub ?? item.titleSub ?? "")
                                    : row.label === "图3文案"
                                      ? (buffer?.extra ?? item.titleExtra ?? "")
                                      : row.value
                              }
                              disabled={row.label === "图间关系"}
                              onChange={(e) => {
                                const nextBase = {
                                  main: buffer?.main ?? item.titleMain,
                                  sub: buffer?.sub ?? item.titleSub ?? "",
                                  extra: buffer?.extra ?? item.titleExtra ?? "",
                                };
                                const nextValue =
                                  row.label === "主标题" || row.label === "图1文案"
                                    ? { ...nextBase, main: e.target.value }
                                    : row.label === "副标题" || row.label === "图2文案"
                                      ? { ...nextBase, sub: e.target.value }
                                      : row.label === "图3文案"
                                        ? { ...nextBase, extra: e.target.value }
                                        : nextBase;

                                setEditBuffer((prev) => ({
                                  ...prev,
                                  [item.id]: nextValue,
                                }));
                              }}
                            />
                          </label>
                        ))}
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button variant="ghost" onClick={cancelEdit}>
                            取消
                          </Button>
                          <Button variant="primary" onClick={() => saveEdit(item)}>
                            保存
                          </Button>
                        </div>
                      </div>
                    )
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
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="ghost"
          className="shrink-0 text-xs"
          disabled={isAppending}
          onClick={appendGenerate}
        >
          {isAppending ? "生成中..." : "+"} 追加生成文案
        </Button>
        <Button
          variant="secondary"
          className="shrink-0"
          onClick={toggleSelectAll}
        >
          {isAllSelected ? "全不选" : "全选"}
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          disabled={selectedCount === 0 || isGenerating}
          onClick={generateSelectedCopyConfigs}
        >
          {"\u26A1"} 生成选中文案
        </Button>
      </div>
    </div>
  );
}
