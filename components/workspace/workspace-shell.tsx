"use client";

import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

import { Spinner } from "@/components/ui/spinner";

function renderPanelLoading(
  spinnerSize: "md" | "lg",
  message: string,
  containerClassName: string,
): ReactElement {
  return (
    <div className={containerClassName}>
      <div className="flex flex-col items-center gap-3">
        <Spinner size={spinnerSize} />
        <span className={spinnerSize === "lg" ? "text-sm text-[var(--ink-500)]" : "text-xs text-[var(--ink-500)]"}>
          {message}
        </span>
      </div>
    </div>
  );
}

const AgentPanel = dynamic(
  () => import("@/components/workspace/agent-panel").then((mod) => mod.AgentPanel),
  {
    ssr: false,
    loading: () =>
      renderPanelLoading(
        "md",
        "助手加载中...",
        "flex h-full items-center justify-center border-l border-[var(--line-soft)] bg-[var(--panel-strong)] backdrop-blur-sm",
      ),
  },
);

const ProjectTreePanel = dynamic(
  () => import("@/components/workspace/project-tree-panel").then((mod) => mod.ProjectTreePanel),
  {
    ssr: false,
    loading: () =>
      renderPanelLoading(
        "md",
        "目录加载中...",
        "flex h-full items-center justify-center border-r border-[var(--line-soft)] bg-[var(--panel-strong)] backdrop-blur-sm",
      ),
  },
);

const WorkflowCanvasPanel = dynamic(
  () => import("@/components/workspace/workflow-canvas-panel").then((mod) => mod.WorkflowCanvasPanel),
  {
    ssr: false,
    loading: () =>
      renderPanelLoading(
        "lg",
        "画布加载中...",
        "flex h-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(250,247,244,0.98))]",
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

function getPanelWidth(collapsed: boolean, expandedWidth: number, collapsedWidth: number): number {
  return collapsed ? collapsedWidth : expandedWidth;
}

export function WorkspaceShell({ project }: WorkspaceShellProps): ReactElement {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = (): void => {
      setRightCollapsed((prev) => {
        const shouldCollapse = window.innerWidth < RIGHT_COLLAPSE_BREAKPOINT;
        return prev !== shouldCollapse ? shouldCollapse : prev;
      });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const leftWidth = getPanelWidth(leftCollapsed, EXPANDED_LEFT, COLLAPSED_LEFT);
  const rightWidth = getPanelWidth(rightCollapsed, EXPANDED_RIGHT, COLLAPSED_RIGHT);

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
