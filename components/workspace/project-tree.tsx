"use client";

import Link from "next/link";

import type { getProjectTreeData } from "@/lib/project-data";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { dispatchFocusCanvasNode } from "@/lib/workspace-events";

type ProjectTreeData = NonNullable<ReturnType<typeof getProjectTreeData>>;

interface ProjectTreeProps {
  tree: ProjectTreeData;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function ProjectTree({ tree, collapsed, onToggleCollapse }: ProjectTreeProps) {
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

  return (
    <div className="flex h-full w-[260px] flex-col overflow-hidden border-r border-[var(--line-soft)] bg-gradient-to-b from-[var(--panel-strong)] to-[var(--surface-1)]">
      {/* Header - 美化布局 */}
      <div className="border-b border-[var(--line-soft)] bg-white/60 px-4 py-3 backdrop-blur-sm">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[var(--ink-500)] transition-all duration-150 hover:bg-[var(--brand-50)] hover:text-[var(--brand-600)]"
            title="返回项目列表"
          >
            <span className="text-sm">&#8592;</span>
            <span>项目列表</span>
          </Link>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-lg p-1.5 text-[var(--ink-400)] transition-all duration-150 hover:bg-[var(--surface-1)] hover:text-[var(--ink-700)]"
            title="收起"
          >
            <span className="text-xs">&#9664;</span>
          </button>
        </div>
        
        {/* 项目信息卡片 */}
        <div className="rounded-xl bg-white/80 p-3 shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--ink-400)]">
            {tree.project.title.length > 12 ? tree.project.title.substring(0, 12) + '...' : tree.project.title}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone="brand" size="sm">{tree.project.status}</Badge>
            <span className="text-[10px] text-[var(--ink-500)]">
              {tree.directions.length} 方向
            </span>
          </div>
        </div>
      </div>

      {/* Tree - 美化树状结构 */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* 需求卡节点 */}
        <div className="mb-3">
          <TreeItem
            label="需求卡"
            status={tree.requirement ? "已填写" : "待填写"}
            onClick={() => dispatchFocusCanvasNode("requirement")}
            icon="📋"
          />
        </div>

        {/* 方向列表 */}
        {tree.directions.length === 0 ? (
          <div className="rounded-xl bg-[var(--surface-1)] px-4 py-3 text-center">
            <p className="text-sm text-[var(--ink-400)]">暂无方向</p>
            <p className="mt-1 text-[10px] text-[var(--ink-400)]">请从需求卡生成方向</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tree.directions.map((dir, index) => (
              <TreeGroup
                key={dir.id}
                label={`${index + 1}. ${dir.title.length > 10 ? dir.title.substring(0, 10) + '...' : dir.title}`}
                onClick={() => dispatchFocusCanvasNode("direction-board")}
              >
                {dir.copyCards.length === 0 ? (
                  <p className="text-[11px] text-[var(--ink-400)]">暂无文案卡</p>
                ) : (
                  dir.copyCards.map((card) => (
                    <div key={card.id} className="space-y-1.5">
                      <TreeItem
                        label={`文案 V${card.version}`}
                        sublabel={`${card.copies.length} 条文案`}
                        onClick={() => dispatchFocusCanvasNode(`copy-card-${card.id}`)}
                        icon="✍️"
                      />
                      {card.copies
                        .filter((copy) => copy.imageConfigId)
                        .map((copy) => (
                          <TreeItem
                            key={copy.id}
                            compact
                            label={`配图 ${copy.variantIndex}`}
                            sublabel={copy.titleMain?.substring(0, 15) || ''}
                            onClick={() => dispatchFocusCanvasNode(`image-config-${copy.imageConfigId!}`)}
                            icon="🖼️"
                          />
                        ))}
                    </div>
                  ))
                )}
              </TreeGroup>
            ))}
          </div>
        )}
      </div>
      
      {/* 底部装饰 */}
      <div className="border-t border-[var(--line-soft)] px-3 py-2">
        <div className="flex items-center justify-between text-[10px] text-[var(--ink-400)]">
          <span>图文提效工作流</span>
          <span>v1.0</span>
        </div>
      </div>
    </div>
  );
}

function TreeItem({
  label,
  sublabel,
  status,
  onClick,
  compact = false,
  icon,
}: {
  label: string;
  sublabel?: string;
  status?: string;
  onClick?: () => void;
  compact?: boolean;
  icon?: string;
}) {
  const content = (
    <div className="flex items-start gap-2">
      {icon && <span className="mt-0.5 text-sm">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[var(--ink-800)]">{label}</p>
        {sublabel && <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--ink-400)]">{sublabel}</p>}
        {status && (
          <span className="mt-1 inline-block text-[11px] font-medium text-[var(--brand-600)]">{status}</span>
        )}
      </div>
    </div>
  );

  const className = cn(
    "mb-1.5 w-full rounded-xl bg-white/70 px-3 text-left shadow-sm transition-all duration-150 hover:bg-white hover:shadow-md hover:scale-[1.01]",
    compact ? "py-2" : "py-2.5",
  );

  if (onClick) {
    return (
      <button 
        type="button" 
        className={className} 
        onClick={onClick}
        title={sublabel || label}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className}>{content}</div>
  );
}

function TreeGroup({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className="mb-3">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="group mb-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--ink-500)] transition-all duration-150 hover:bg-[var(--brand-50)] hover:text-[var(--brand-600)]"
        >
          <span className="flex h-2 w-2 items-center justify-center">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--brand-500)]" />
          </span>
          <span className="flex-1 truncate">{label}</span>
          <span className="text-[10px] opacity-0 transition-opacity group-hover:opacity-100">→</span>
        </button>
      ) : (
        <div className="mb-2 flex items-center gap-2 px-2 py-1.5">
          <span className="flex h-2 w-2 items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-[var(--ink-400)]" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--ink-500)]">
            {label}
          </span>
        </div>
      )}
      <div className="ml-4 space-y-1.5 border-l border-[var(--line-soft)] pl-3">
        {children}
      </div>
    </div>
  );
}
