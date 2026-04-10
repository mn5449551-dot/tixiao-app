"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

import { Spinner } from "@/components/ui/spinner";

const AgentPanel = dynamic(
  () => import("@/components/workspace/agent-panel").then((mod) => mod.AgentPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center border-l border-[var(--line-soft)] bg-[var(--panel-strong)] backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="md" />
          <span className="text-xs text-[var(--ink-500)]">助手加载中...</span>
        </div>
      </div>
    ),
  },
);

const ProjectTreePanel = dynamic(
  () => import("@/components/workspace/project-tree-panel").then((mod) => mod.ProjectTreePanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center border-r border-[var(--line-soft)] bg-[var(--panel-strong)] backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="md" />
          <span className="text-xs text-[var(--ink-500)]">目录加载中...</span>
        </div>
      </div>
    ),
  },
);

const WorkflowCanvasPanel = dynamic(
  () => import("@/components/workspace/workflow-canvas-panel").then((mod) => mod.WorkflowCanvasPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(250,247,244,0.98))]">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <span className="text-sm text-[var(--ink-500)]">画布加载中...</span>
        </div>
      </div>
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
    <div className="flex min-h-0 flex-1 overflow-hidden bg-[var(--background)]">
      {/* Left Panel */}
      <div
        className="transition-all duration-300 ease-in-out"
        style={{ width: leftWidth, flexShrink: 0 }}
      >
        <ProjectTreePanel
          projectId={project.id}
          collapsed={leftCollapsed}
          onToggleCollapse={() => setLeftCollapsed((v) => !v)}
        />
      </div>

      {/* Center Canvas */}
      <div className="flex-1" style={{ minWidth: 0 }}>
        <WorkflowCanvasPanel projectId={project.id} />
      </div>

      {/* Right Panel */}
      <div
        className="transition-all duration-300 ease-in-out"
        style={{ width: rightWidth, flexShrink: 0 }}
      >
        <AgentPanel
          projectId={project.id}
          collapsed={rightCollapsed}
          onToggleCollapse={() => setRightCollapsed((v) => !v)}
        />
      </div>
    </div>
  );
}
