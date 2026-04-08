"use client";

import { Handle, Position } from "@xyflow/react";

import { cn } from "@/lib/utils";

export function DirectionItemRow({
  item,
  index,
  expanded,
  editing,
  selected,
  expandedContent,
  onToggleExpand,
  onToggleSelect,
  onRegenerate,
  onEditToggle,
  onDelete,
}: {
  item: {
    id: string;
    title: string;
    sourceHandleId: string;
  };
  index: number;
  expanded: boolean;
  editing: boolean;
  selected: boolean;
  expandedContent?: React.ReactNode;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onRegenerate: () => void;
  onEditToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative overflow-visible rounded-[22px] border border-[var(--line-soft)] bg-[var(--surface-1)] transition">
      <div className="flex items-center gap-2 p-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="h-4 w-4 shrink-0 accent-[var(--brand-500)]"
        />
        <span className="min-w-0 flex-1 text-sm font-medium text-[var(--ink-900)]">方向 #{index + 1}</span>
        <span className="truncate text-xs text-[var(--ink-500)]">{item.title}</span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            title="重新生成"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs text-[var(--ink-500)] hover:bg-[var(--surface-2)] hover:text-[var(--ink-700)]"
            onClick={onRegenerate}
          >
            {"\u21BB"}
          </button>
          <button
            type="button"
            title={editing ? "保存" : "编辑"}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs hover:bg-[var(--surface-2)]",
              editing ? "text-[var(--brand-500)]" : "text-[var(--ink-500)] hover:text-[var(--ink-700)]",
            )}
            onClick={onEditToggle}
          >
            {"\u270E"}
          </button>
          <button
            type="button"
            title="删除"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs text-[var(--ink-500)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger-700)]"
            onClick={onDelete}
          >
            {"\u2716"}
          </button>
          <button
            type="button"
            title={expanded ? "收起" : "展开"}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs transition",
              expanded ? "rotate-180 text-[var(--brand-500)]" : "text-[var(--ink-500)]",
            )}
            onClick={onToggleExpand}
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

      {expanded ? <div className="border-t border-[var(--line-soft)] p-3 pt-2">{expandedContent}</div> : null}
    </div>
  );
}
