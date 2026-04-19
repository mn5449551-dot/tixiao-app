"use client";

import { Handle, Position } from "@xyflow/react";

import { cn } from "@/lib/utils";

export function DirectionItemRow({
  item,
  index,
  editing,
  selected,
  content,
  selectDisabled = false,
  selectHint,
  deleteDisabled = false,
  deleteHint,
  onToggleSelect,
  onEditToggle,
  onDelete,
}: {
  item: {
    id: string;
    title: string;
    sourceHandleId: string;
    hasDownstream?: boolean;
  };
  index: number;
  editing: boolean;
  selected: boolean;
  content?: React.ReactNode;
  selectDisabled?: boolean;
  selectHint?: string;
  deleteDisabled?: boolean;
  deleteHint?: string;
  onToggleSelect: () => void;
  onEditToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "relative overflow-visible rounded-[var(--radius-lg)] border bg-[var(--surface)] transition-all duration-200",
        selected ? "border-[var(--brand-light)] ring-2 ring-[var(--brand-ring)]" : "border-[var(--border)]",
        editing && "border-[var(--brand)]",
      )}
    >
      <div className="flex items-center gap-2 p-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          disabled={Boolean(item.hasDownstream) || selectDisabled}
          title={selectHint}
          className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--ink-strong)]">方向 {index + 1}</span>
            <span className="truncate text-xs text-[var(--ink-muted)]" title={item.title}>
              {item.title}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            title={editing ? "保存" : "编辑"}
            aria-label="编辑"
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]",
              editing
                ? "bg-[var(--brand-bg)] text-[var(--brand-hover)]"
                : "text-[var(--ink-muted)] hover:bg-[var(--surface-dim)] hover:text-[var(--ink-default)]",
            )}
            onClick={onEditToggle}
          >
            {"\u270E"}
          </button>
          <button
            type="button"
            title={deleteHint ?? "删除"}
            aria-label="删除"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs text-[var(--ink-muted)] transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
            onClick={onDelete}
            disabled={deleteDisabled}
          >
            {"\u2716"}
          </button>
        </div>
        <Handle
          id={item.sourceHandleId}
          className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand)]"
          position={Position.Right}
          type="source"
          style={{ top: 28, right: -7, transform: "translateY(-50%)" }}
        />
      </div>

      {content ? <div className="border-t border-[var(--border)] p-3 pt-2">{content}</div> : null}
    </div>
  );
}
