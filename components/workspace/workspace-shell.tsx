"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const AgentPanel = dynamic(
  () => import("@/components/workspace/agent-panel").then((mod) => mod.AgentPanel),
  {
    ssr: false,
    loading: () => <div className="h-full border-l border-[var(--line-soft)] bg-[var(--panel-strong)]" />,
  },
);

const ProjectTreePanel = dynamic(
  () => import("@/components/workspace/project-tree-panel").then((mod) => mod.ProjectTreePanel),
  {
    ssr: false,
    loading: () => <div className="h-full border-r border-[var(--line-soft)] bg-[var(--panel-strong)]" />,
  },
);

const WorkflowCanvasPanel = dynamic(
  () => import("@/components/workspace/workflow-canvas-panel").then((mod) => mod.WorkflowCanvasPanel),
  {
    ssr: false,
    loading: () => (
      <div className="h-full bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.94),rgba(247,243,239,0.98))]" />
    ),
  },
);

const EXPANDED_LEFT = 240;
const COLLAPSED_LEFT = 24;
const EXPANDED_RIGHT = 360;
const COLLAPSED_RIGHT = 24;
const RIGHT_COLLAPSE_BREAKPOINT = 1280;

type WorkspaceShellProps = {
  project: {
    id: string;
    title: string;
    status: string;
  };
};

export function WorkspaceShell({ project }: WorkspaceShellProps) {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setRightCollapsed((prev) => {
        const shouldCollapse = window.innerWidth < RIGHT_COLLAPSE_BREAKPOINT;
        return prev !== shouldCollapse ? shouldCollapse : prev;
      });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const leftWidth = leftCollapsed ? COLLAPSED_LEFT : EXPANDED_LEFT;
  const rightWidth = rightCollapsed ? COLLAPSED_RIGHT : EXPANDED_RIGHT;
  return (
    <>
      <header className="flex shrink-0 items-end justify-between gap-6 border-b border-[var(--line-soft)] bg-white/85 px-6 py-4 shadow-[var(--shadow-card)] backdrop-blur">
        <div className="flex items-end gap-4">
          <Link
            href="/"
            className="rounded-lg p-1.5 text-[var(--ink-400)] transition hover:bg-[var(--surface-1)] hover:text-[var(--ink-700)]"
            title="返回首页"
          >
            <span className="text-sm">&#8592;</span>
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--ink-400)]">Onion Workflow</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--ink-950)]">
              {project.title}
            </h1>
          </div>
        </div>
        <div className="rounded-xl bg-[var(--surface-1)] px-4 py-2 text-right">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-400)]">Status</p>
          <p className="mt-0.5 text-base font-semibold text-[var(--ink-900)]">{project.status}</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div style={{ width: leftWidth, flexShrink: 0 }}>
          <ProjectTreePanel
            projectId={project.id}
            collapsed={leftCollapsed}
            onToggleCollapse={() => setLeftCollapsed((v) => !v)}
          />
        </div>
        <div className="flex-1" style={{ minWidth: 0 }}>
          <WorkflowCanvasPanel projectId={project.id} />
        </div>
        <div style={{ width: rightWidth, flexShrink: 0 }}>
          <AgentPanel
            projectId={project.id}
            collapsed={rightCollapsed}
            onToggleCollapse={() => setRightCollapsed((v) => !v)}
          />
        </div>
      </div>
    </>
  );
}
