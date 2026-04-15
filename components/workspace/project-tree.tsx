"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import type { getProjectTreeData } from "@/lib/project-data";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { WORKSPACE_FOCUS_NODE, dispatchFocusCanvasNode } from "@/lib/workspace-events";

type ProjectTreeData = NonNullable<ReturnType<typeof getProjectTreeData>>;

interface ProjectTreeProps {
  tree: ProjectTreeData;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function ProjectTree({ tree, collapsed, onToggleCollapse }: ProjectTreeProps) {
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  useEffect(() => {
    const handleFocus = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeId: string }>).detail;
      setFocusedNodeId(detail.nodeId);
    };
    window.addEventListener(WORKSPACE_FOCUS_NODE, handleFocus);
    return () => window.removeEventListener(WORKSPACE_FOCUS_NODE, handleFocus);
  }, []);

  if (collapsed) {
    return (
      <div className="flex h-full w-[28px] items-center justify-center bg-gradient-to-b from-[var(--surface-1)] to-[var(--surface-2)] border-r border-[var(--line-soft)]">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-16 w-6 items-center justify-center rounded-r-xl bg-white/80 text-[var(--ink-500)] shadow-sm transition-all duration-200 hover:bg-[var(--brand-50)] hover:text-[var(--brand-600)] hover:shadow-md"
          title="展开项目树"
        >
          <span className="text-xs font-medium">&#9654;</span>
        </button>
      </div>
    );
  }

  const totalCopyCards = tree.directions.reduce((sum, dir) => sum + dir.copyCards.length, 0);
  const totalImages = tree.directions.reduce((sum, dir) => {
    return sum + dir.copyCards.reduce((s, card) => s + card.copies.filter(c => c.imageConfigId).length, 0);
  }, 0);

  return (
    <div className="flex h-full w-[220px] flex-col overflow-hidden border-r border-[var(--line-soft)] bg-[var(--surface-0)]">
      {/* Header — 极简布局 */}
      <div className="border-b border-[var(--line-soft)] px-4 py-4">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[var(--ink-500)] transition-all duration-200 hover:bg-[var(--brand-50)] hover:text-[var(--brand-600)]"
            title="返回项目列表"
          >
            <span>&#8592;</span>
            <span>返回</span>
          </Link>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-lg p-1.5 text-[var(--ink-400)] transition-all duration-200 hover:bg-[var(--surface-1)] hover:text-[var(--ink-700)]"
            title="收起"
          >
            <span className="text-xs">&#9664;</span>
          </button>
        </div>

        {/* 项目标题 */}
        <p className="mt-3 truncate text-sm font-semibold text-[var(--ink-950)]" title={tree.project.title}>
          {tree.project.title}
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <Badge tone="brand" size="sm">{tree.directions.length} 方向</Badge>
          <span className="text-[10px] text-[var(--ink-400)]">{totalCopyCards} 文案 · {totalImages} 图</span>
        </div>
      </div>

      {/* Tree — 极简树状结构 */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {/* 需求卡节点 */}
        <TreeItem
          label="需求卡"
          status={tree.requirement ? "已填写" : "待填写"}
          onClick={() => dispatchFocusCanvasNode("requirement")}
          isFocused={focusedNodeId === "requirement"}
        />

        {/* 方向列表 */}
        {tree.directions.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-[var(--surface-1)] px-4 py-5 text-center">
            <p className="text-xs text-[var(--ink-400)]">暂无方向</p>
          </div>
        ) : (
          <div className="mt-4 space-y-1.5">
            {tree.directions.map((dir, index) => {
              const copyCount = dir.copyCards.reduce((s, c) => s + c.copies.length, 0);
              return (
                <TreeGroup
                  key={dir.id}
                  label={`${index + 1}. ${dir.title.length > 8 ? dir.title.substring(0, 8) + '…' : dir.title}`}
                  count={copyCount}
                  onClick={() => dispatchFocusCanvasNode("direction-board")}
                >
                  {dir.copyCards.map((card) => (
                    <div key={card.id} className="ml-2">
                      <TreeItem
                        compact
                        label={`文案 V${card.version}`}
                        onClick={() => dispatchFocusCanvasNode(`copy-card-${card.id}`)}
                        isFocused={focusedNodeId === `copy-card-${card.id}`}
                      />
                      {card.copies
                        .filter((copy) => copy.imageConfigId)
                        .map((copy) => (
                          <TreeItem
                            key={copy.id}
                            compact
                            smaller
                            label={`配图 ${copy.variantIndex}`}
                            onClick={() => dispatchFocusCanvasNode(`image-config-${copy.imageConfigId!}`)}
                            isFocused={focusedNodeId === `image-config-${copy.imageConfigId!}`}
                          />
                        ))}
                    </div>
                  ))}
                </TreeGroup>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TreeItem({
  label,
  status,
  onClick,
  compact = false,
  smaller = false,
  isFocused,
}: {
  label: string;
  status?: string;
  onClick?: () => void;
  compact?: boolean;
  smaller?: boolean;
  isFocused?: boolean;
}) {
  const content = (
    <div className="flex items-center justify-between gap-2">
      <span className={cn(
        "truncate text-[var(--ink-700)]",
        smaller ? "text-xs" : "text-sm font-medium",
      )}>{label}</span>
      {status && (
        <span className="shrink-0 text-[10px] font-medium text-[var(--ink-400)]">{status}</span>
      )}
    </div>
  );

  const baseClass = cn(
    "flex w-full items-center rounded-xl px-3 text-left transition-all duration-200",
    compact ? (smaller ? "py-2" : "py-2.5") : "py-2.5",
    isFocused
      ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
      : "hover:bg-[var(--brand-50)]",
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={baseClass}
        onClick={onClick}
        title={label}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClass}>{content}</div>;
}

function TreeGroup({
  label,
  count = 0,
  children,
  onClick,
}: {
  label: string;
  count?: number;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className="rounded-2xl">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="group mb-1.5 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-500)] transition-all duration-200 hover:bg-[var(--brand-50)] hover:text-[var(--brand-600)]"
        >
          <span className="flex h-1.5 w-1.5 shrink-0">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--brand-400)]" />
          </span>
          <span className="flex-1 truncate">{label}</span>
          {count > 0 && (
            <span className="shrink-0 text-[10px] font-normal normal-case text-[var(--ink-400)]">
              {count}
            </span>
          )}
        </button>
      ) : (
        <div className="mb-1.5 flex items-center gap-2 rounded-xl px-3 py-2.5">
          <span className="flex h-1.5 w-1.5 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ink-300)]" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-500)]">
            {label}
          </span>
        </div>
      )}
      <div className="ml-4 border-l border-[var(--line-soft)] pl-3 space-y-1">
        {children}
      </div>
    </div>
  );
}
