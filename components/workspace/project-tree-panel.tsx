"use client";

import type { ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { getProjectTreeData } from "@/lib/project-data";

import { ProjectTree } from "@/components/workspace/project-tree";
import { WORKSPACE_TREE_INVALIDATED } from "@/lib/workspace-events";
import { createRequestCoordinator } from "@/lib/workspace-request-coordinator";

type ProjectTreeData = NonNullable<ReturnType<typeof getProjectTreeData>>;
type ProjectTreeResponse = ProjectTreeData | { error?: string };
const TREE_LOAD_ERROR = "获取项目树失败";

type ProjectTreePanelProps = {
  projectId: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

function isProjectTreeData(value: unknown): value is ProjectTreeData {
  return typeof value === "object" && value !== null && "project" in value && "directions" in value;
}

function getProjectTreeErrorMessage(payload: ProjectTreeResponse): string {
  if (isProjectTreeData(payload)) {
    return TREE_LOAD_ERROR;
  }

  return payload.error ?? TREE_LOAD_ERROR;
}

function isAbortError(controller: AbortController, error: unknown): boolean {
  return controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
}

export function ProjectTreePanel({
  projectId,
  collapsed,
  onToggleCollapse,
}: ProjectTreePanelProps): ReactElement {
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
        const payload = (await response.json()) as ProjectTreeResponse;
        if (!response.ok || !isProjectTreeData(payload)) {
          throw new Error(getProjectTreeErrorMessage(payload));
        }
        if (requestCoordinatorRef.current.isLatest(requestToken)) {
          setTree(payload);
          setError(null);
        }
      })
      .catch((fetchError) => {
        if (isAbortError(controller, fetchError)) {
          return;
        }

        if (requestCoordinatorRef.current.isLatest(requestToken)) {
          setError(fetchError instanceof Error ? fetchError.message : TREE_LOAD_ERROR);
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
    const handleInvalidated = (): void => {
      loadTree();
    };

    window.addEventListener(WORKSPACE_TREE_INVALIDATED, handleInvalidated);
    return () => {
      window.removeEventListener(WORKSPACE_TREE_INVALIDATED, handleInvalidated);
    };
  }, [loadTree]);

  if (!tree) {
    return (
      <div className="flex h-full items-center justify-center border-r border-[var(--border)] bg-[var(--panel-strong)] px-4 text-sm text-[var(--ink-muted)]">
        {error ?? "项目树加载中..."}
      </div>
    );
  }

  return <ProjectTree tree={tree} collapsed={collapsed} onToggleCollapse={onToggleCollapse} />;
}
