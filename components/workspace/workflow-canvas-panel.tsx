"use client";

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

function isCanvasData(value: unknown): value is CanvasData {
  return typeof value === "object" && value !== null && "nodes" in value && "edges" in value;
}

export function WorkflowCanvasPanel({ projectId }: { projectId: string }) {
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
        const payload = (await response.json()) as CanvasData | { error?: string };
        if (!response.ok || !isCanvasData(payload)) {
          throw new Error(!isCanvasData(payload) && "error" in payload ? payload.error ?? "获取画布数据失败" : "获取画布数据失败");
        }
        if (requestCoordinatorRef.current.isLatest(requestToken)) {
          setGraph(payload);
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
          setError(fetchError instanceof Error ? fetchError.message : "获取画布数据失败");
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
      if (shouldReloadGraphAfterStatusPoll(current, payload)) {
        queueMicrotask(loadGraph);
        return current;
      }
      return mergeGenerationStatusesIntoGraph(current, payload);
    });
  }, [loadGraph]);

  useGenerationPolling({
    projectId,
    enabled: graph?.hasPendingImages ?? false,
    onStatuses: handleStatuses,
  });

  if (!graph) {
    return (
      <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.94),rgba(247,243,239,0.98))] px-4 text-sm text-[var(--ink-500)]">
        {error ?? "画布加载中..."}
      </div>
    );
  }

  return <WorkflowCanvas graph={graph} onInvalidate={loadGraph} />;
}
