"use client";

import { useCallback, useEffect, useState } from "react";

import type { getCanvasData, getGenerationStatusData } from "@/lib/project-data";

import type { CandidatePoolCardData } from "@/components/cards/candidate-pool-card";
import { WorkflowCanvas } from "@/components/canvas/workflow-canvas";
import { useGenerationPolling } from "@/lib/hooks/use-generation-polling";

type CanvasData = NonNullable<ReturnType<typeof getCanvasData>>;
type GenerationStatusData = NonNullable<ReturnType<typeof getGenerationStatusData>>;
type CandidateImageStatus = CandidatePoolCardData["groups"][number]["images"][number]["status"];

function isCanvasData(value: unknown): value is CanvasData {
  return typeof value === "object" && value !== null && "nodes" in value && "edges" in value;
}

export function WorkflowCanvasPanel({ projectId }: { projectId: string }) {
  const [graph, setGraph] = useState<CanvasData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadGraph = useCallback(() => {
    let cancelled = false;

    void fetch(`/api/projects/${projectId}/graph`)
      .then(async (response) => {
        const payload = (await response.json()) as CanvasData | { error?: string };
        if (!response.ok || !isCanvasData(payload)) {
          throw new Error(!isCanvasData(payload) && "error" in payload ? payload.error ?? "获取画布数据失败" : "获取画布数据失败");
        }
        if (!cancelled) {
          setGraph(payload);
          setError(null);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "获取画布数据失败");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    return loadGraph();
  }, [loadGraph]);

  const handleStatuses = useCallback((payload: GenerationStatusData) => {
    setGraph((current) => {
      if (!current) return current;

      const imageStatusMap = new Map(payload.images.map((image) => [image.id, image]));

      return {
        ...current,
        hasPendingImages: payload.images.some(
          (image) => image.status === "pending" || image.status === "generating",
        ),
        nodes: current.nodes.map((node) => {
          if (node.type !== "candidatePool") {
            return node;
          }

          const candidateData = node.data as CandidatePoolCardData;

          return {
            ...node,
            data: {
              ...candidateData,
              groups: candidateData.groups.map((group) => ({
                ...group,
                images: group.images.map((image) => {
                  const nextImage = imageStatusMap.get(image.id);
                  if (!nextImage) {
                    return image;
                  }

                  return {
                    ...image,
                    fileUrl: nextImage.fileUrl,
                    status: nextImage.status as CandidateImageStatus,
                  };
                }),
              })),
            },
          };
        }),
      };
    });
  }, []);

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
