"use client";

import type { getProjectWorkspace } from "@/lib/project-data";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type WorkspaceData = NonNullable<ReturnType<typeof getProjectWorkspace>>;

interface ProjectTreeProps {
  workspace: WorkspaceData;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function focusCanvasNode(nodeId: string) {
  window.dispatchEvent(new CustomEvent("focus-canvas-node", { detail: { nodeId } }));
}

export function ProjectTree({ workspace, collapsed, onToggleCollapse }: ProjectTreeProps) {
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex h-full w-[24px] cursor-pointer items-center justify-center bg-[var(--surface-1)] text-[var(--ink-500)] transition hover:bg-[var(--surface-2)] hover:text-[var(--ink-700)]"
        title="展开项目树"
      >
        <span className="text-xs">&#9654;</span>
      </button>
    );
  }

  return (
    <div className="flex h-full w-[240px] flex-col overflow-hidden border-r border-[var(--line-soft)] bg-[var(--panel-strong)]">
      {/* Header */}
      <div className="border-b border-[var(--line-soft)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--ink-400)]">Project Tree</p>
            <h2 className="mt-1.5 text-lg font-semibold text-[var(--ink-900)]">{workspace.project.title}</h2>
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-full p-1 text-[var(--ink-400)] transition hover:bg-[var(--surface-1)] hover:text-[var(--ink-700)]"
            title="收起"
          >
            &#9664;
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Badge tone="brand">{workspace.project.status}</Badge>
          <Badge>{workspace.directions.length} 条方向</Badge>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <TreeItem
          label="需求卡"
          status={workspace.requirement ? "已填写" : "待填写"}
          onClick={() => focusCanvasNode("requirement")}
        />

        {workspace.directions.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--ink-500)]">暂无方向</p>
        ) : (
          workspace.directions.map((dir) => (
            <TreeGroup
              key={dir.id}
              label={dir.title}
              onClick={() => focusCanvasNode("direction-board")}
            >
              {dir.copyCards.length === 0 ? (
                <p className="text-[11px] text-[var(--ink-400)]">暂无文案卡</p>
              ) : (
                dir.copyCards.map((card) => (
                  <div key={card.id} className="space-y-1">
                    <TreeItem
                      label={`${dir.title} · V${card.version}`}
                      sublabel={`${card.copies.length} 条文案`}
                      onClick={() => focusCanvasNode(`copy-card-${card.id}`)}
                    />
                    {card.copies
                      .filter((copy) => copy.imageConfig)
                      .map((copy) => (
                        <TreeItem
                          key={copy.id}
                          compact
                          label={`配置 #${copy.variantIndex}`}
                          sublabel={copy.titleMain}
                          onClick={() => focusCanvasNode(`image-config-${copy.imageConfig!.id}`)}
                        />
                      ))}
                  </div>
                ))
              )}
            </TreeGroup>
          ))
        )}
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
}: {
  label: string;
  sublabel?: string;
  status?: string;
  onClick?: () => void;
  compact?: boolean;
}) {
  const content = (
    <>
      <p className="text-[13px] font-medium text-[var(--ink-800)]">{label}</p>
      {sublabel && <p className="mt-0.5 text-[11px] text-[var(--ink-400)]">{sublabel}</p>}
      {status && (
        <span className="mt-1 inline-block text-[11px] font-medium text-[var(--brand-600)]">{status}</span>
      )}
    </>
  );

  const className = cn(
    "mb-1.5 w-full rounded-xl bg-white/80 px-3 text-left shadow-[var(--shadow-inset)] transition hover:bg-white",
    compact ? "py-2" : "py-2.5",
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
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
          className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)] transition hover:text-[var(--ink-700)]"
        >
          {label}
        </button>
      ) : (
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">{label}</p>
      )}
      <div className="ml-2 space-y-1.5 border-l-2 border-[var(--line-soft)] pl-3">
        {children}
      </div>
    </div>
  );
}
