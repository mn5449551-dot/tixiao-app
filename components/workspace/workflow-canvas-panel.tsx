"use client";

import type { ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { getCanvasData, getGenerationStatusData } from "@/lib/project-data";

import { WorkflowCanvas } from "@/components/canvas/workflow-canvas";
import { useGenerationPolling } from "@/lib/hooks/use-generation-polling";
import { createRequestCoordinator } from "@/lib/workspace-request-coordinator";
import {
  mergeGenerationStatusesIntoGraph,
  shouldReloadGraphAfterStatusPoll,
} from "@/lib/workspace-graph-sync";

type CanvasData = NonNullable<ReturnType<typeof getCanvasData>>;
type GenerationStatusData = NonNullable<ReturnType<typeof getGenerationStatusData>>;
type CanvasResponse = CanvasData | { error?: string };
const CANVAS_LOAD_ERROR = "获取画布数据失败";

function isCanvasData(value: unknown): value is CanvasData {
  return typeof value === "object" && value !== null && "nodes" in value && "edges" in value;
}

function getCanvasErrorMessage(payload: CanvasResponse): string {
  if (isCanvasData(payload)) {
    return CANVAS_LOAD_ERROR;
  }

  return payload.error ?? CANVAS_LOAD_ERROR;
}

function isAbortError(controller: AbortController, error: unknown): boolean {
  return controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
}

export function WorkflowCanvasPanel({ projectId }: { projectId: string }): ReactElement {
  const [graph, setGraph] = useState<CanvasData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestCoordinatorRef = useRef(createRequestCoordinator());
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadGraph = useCallback(() => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestToken = requestCoordinatorRef.current.next();

    void fetch(`/api/projects/${projectId}/graph`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as CanvasResponse;
        if (!response.ok || !isCanvasData(payload)) {
          throw new Error(getCanvasErrorMessage(payload));
        }
        if (requestCoordinatorRef.current.isLatest(requestToken)) {
          setGraph(payload);
          setError(null);
        }
      })
      .catch((fetchError) => {
        if (isAbortError(controller, fetchError)) {
          return;
        }

        if (requestCoordinatorRef.current.isLatest(requestToken)) {
          setError(fetchError instanceof Error ? fetchError.message : CANVAS_LOAD_ERROR);
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
    return loadGraph();
  }, [loadGraph]);

  const handleStatuses = useCallback((payload: GenerationStatusData) => {
    setGraph((current) => {
      if (!current) return current;
      const mergedGraph = mergeGenerationStatusesIntoGraph(current, payload);
      if (shouldReloadGraphAfterStatusPoll(current, payload)) {
        queueMicrotask(loadGraph);
        return mergedGraph;
      }
      return mergedGraph;
    });
  }, [loadGraph]);

  useGenerationPolling({
    projectId,
    enabled: graph?.hasPendingImages ?? false,
    onStatuses: handleStatuses,
  });

  if (!graph) {
    return (
      <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(250,247,244,0.98))] px-4 text-sm text-[var(--ink-500)]">
        {error ?? "画布加载中..."}
      </div>
    );
  }

  return <WorkflowCanvas graph={graph} onInvalidate={loadGraph} />;
}
