"use client";

import { Handle, Position } from "@xyflow/react";

import { cn } from "@/lib/utils";

export function DirectionItemRow({
  item,
  index,
  editing,
  selected,
  content,
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
  };
  index: number;
  editing: boolean;
  selected: boolean;
  content?: React.ReactNode;
  deleteDisabled?: boolean;
  deleteHint?: string;
  onToggleSelect: () => void;
  onEditToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "relative overflow-visible rounded-[22px] border bg-[var(--surface-1)] transition-all duration-200",
        selected ? "border-[var(--brand-300)] ring-2 ring-[var(--brand-ring)]" : "border-[var(--line-soft)]",
        editing && "border-[var(--brand-400)]",
      )}
    >
      <div className="flex items-center gap-2 p-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--brand-500)]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--ink-900)]">方向 #{index + 1}</span>
            <span className="truncate text-xs text-[var(--ink-500)]" title={item.title}>
              {item.title}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            title={editing ? "保存" : "编辑"}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors",
              editing
                ? "bg-[var(--brand-50)] text-[var(--brand-600)]"
                : "text-[var(--ink-500)] hover:bg-[var(--surface-2)] hover:text-[var(--ink-700)]",
            )}
            onClick={onEditToggle}
          >
            {"\u270E"}
          </button>
          <button
            type="button"
            title={deleteHint ?? "删除"}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs text-[var(--ink-500)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger-700)] disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onDelete}
            disabled={deleteDisabled}
          >
            {"\u2716"}
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

      {content ? <div className="border-t border-[var(--line-soft)] p-3 pt-2">{content}</div> : null}
    </div>
  );
}
