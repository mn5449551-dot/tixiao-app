"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { getProjectTreeData } from "@/lib/project-data";

import { ProjectTree } from "@/components/workspace/project-tree";
import { WORKSPACE_TREE_INVALIDATED } from "@/lib/workspace-events";
import { createRequestCoordinator } from "@/lib/workspace-request-coordinator";

type ProjectTreeData = NonNullable<ReturnType<typeof getProjectTreeData>>;

type ProjectTreePanelProps = {
  projectId: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

function isProjectTreeData(value: unknown): value is ProjectTreeData {
  return typeof value === "object" && value !== null && "project" in value && "directions" in value;
}

export function ProjectTreePanel({
  projectId,
  collapsed,
  onToggleCollapse,
}: ProjectTreePanelProps) {
  const [tree, setTree] = useState<ProjectTreeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestCoordinatorRef = useRef(createRequestCoordinator());
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadTree = useCallback(() => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestToken = requestCoordinatorRef.current.next();

    void fetch(`/api/projects/${projectId}/tree`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as ProjectTreeData | { error?: string };
        if (!response.ok || !isProjectTreeData(payload)) {
          throw new Error(!isProjectTreeData(payload) && "error" in payload ? payload.error ?? "获取项目树失败" : "获取项目树失败");
        }
        if (requestCoordinatorRef.current.isLatest(requestToken)) {
          setTree(payload);
          setError(null);
        }
      })
      .catch((fetchError) => {
        if (
          controller.signal.aborted ||
          (fetchError instanceof Error && fetchError.name === "AbortError")
        ) {
          return;
        }

        if (requestCoordinatorRef.current.isLatest(requestToken)) {
          setError(fetchError instanceof Error ? fetchError.message : "获取项目树失败");
        }
      });

    return () => {
      controller.abort();
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    };
  }, [projectId]);

  useEffect(() => {
    return loadTree();
  }, [loadTree]);

  useEffect(() => {
    const handleInvalidated = () => {
      loadTree();
    };

    window.addEventListener(WORKSPACE_TREE_INVALIDATED, handleInvalidated);
    return () => {
      window.removeEventListener(WORKSPACE_TREE_INVALIDATED, handleInvalidated);
    };
  }, [loadTree]);

  if (!tree) {
    return (
      <div className="flex h-full items-center justify-center border-r border-[var(--line-soft)] bg-[var(--panel-strong)] px-4 text-sm text-[var(--ink-500)]">
        {error ?? "项目树加载中..."}
      </div>
    );
  }

  return <ProjectTree tree={tree} collapsed={collapsed} onToggleCollapse={onToggleCollapse} />;
}
