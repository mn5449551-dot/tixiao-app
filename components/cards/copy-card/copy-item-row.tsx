"use client";

import { Handle, Position } from "@xyflow/react";

import { cn } from "@/lib/utils";

import type { CopyItem } from "@/components/cards/copy-card";

export function CopyItemRow({
  item,
  index,
  statusLabel,
  editing,
  selected,
  canDelete,
  deleteHint,
  expandedContent,
  onToggleSelect,
  onToggleEdit,
  onDelete,
}: {
  item: CopyItem;
  index: number;
  statusLabel?: string;
  editing: boolean;
  selected: boolean;
  canDelete: boolean;
  deleteHint?: string;
  expandedContent?: React.ReactNode;
  onToggleSelect: () => void;
  onToggleEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn(
      "relative overflow-visible rounded-[22px] border bg-[var(--surface-1)] transition-all duration-200",
      selected ? "border-[var(--brand-300)] ring-2 ring-[var(--brand-ring)]" : "border-[var(--line-soft)]",
      editing && "border-[var(--brand-400)]",
    )}>
      <div className="flex items-center gap-3 p-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          disabled={item.isLocked}
          className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--brand-500)] disabled:cursor-not-allowed disabled:opacity-40"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm font-medium whitespace-nowrap",
              selected ? "text-[var(--brand-700)]" : "text-[var(--ink-900)]",
            )}>
              文案 {item.variantIndex || index + 1}
            </span>
            {item.isLocked && (
              <span className="text-[10px] text-[var(--ink-400)]" title="已锁定">🔒</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {statusLabel && (
            <span className="rounded-full bg-[var(--surface-0)] px-3 py-1 text-[11px] font-medium text-[var(--ink-500)]">
              {statusLabel}
            </span>
          )}
          <button
            type="button"
            title={editing ? "保存" : "编辑"}
            aria-label="编辑"
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]",
              editing
                ? "bg-[var(--brand-50)] text-[var(--brand-600)]"
                : "text-[var(--ink-500)] hover:bg-[var(--surface-2)] hover:text-[var(--ink-700)]",
              item.isLocked && "cursor-not-allowed opacity-40",
            )}
            disabled={item.isLocked}
            onClick={onToggleEdit}
          >
            {"\u270E"}
          </button>
          <button
            type="button"
            title={deleteHint ?? "删除"}
            aria-label="删除"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs text-[var(--ink-500)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger-700)] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
            onClick={onDelete}
            disabled={!canDelete}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
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

      {expandedContent && (
        <div className="border-t border-[var(--line-soft)] px-3 pb-3 pt-2">
          {expandedContent}
        </div>
      )}
    </div>
  );
}
