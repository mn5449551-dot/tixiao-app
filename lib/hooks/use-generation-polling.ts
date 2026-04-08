import { useEffect, useRef } from "react";

import type { getGenerationStatusData } from "@/lib/project-data";

type GenerationStatusData = NonNullable<ReturnType<typeof getGenerationStatusData>>;

type UseGenerationPollingOptions = {
  projectId: string;
  enabled: boolean;
  onStatuses: (payload: GenerationStatusData) => void;
};

function isGenerationStatusData(value: unknown): value is GenerationStatusData {
  return typeof value === "object" && value !== null && "images" in value;
}

export function useGenerationPolling({
  projectId,
  enabled,
  onStatuses,
}: UseGenerationPollingOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const clearPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (!enabled) {
      clearPolling();
      return clearPolling;
    }

    let cancelled = false;

    const pollStatuses = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/generation-status`);
        const payload = (await response.json()) as GenerationStatusData | { error?: string };
        if (!response.ok || !isGenerationStatusData(payload)) {
          return;
        }
        if (!cancelled) {
          onStatuses(payload);
        }
      } catch {
        // Keep the last known graph state when polling fails.
      }
    };

    void pollStatuses();
    clearPolling();
    intervalRef.current = setInterval(() => {
      void pollStatuses();
    }, 3000);

    return () => {
      cancelled = true;
      clearPolling();
    };
  }, [enabled, onStatuses, projectId]);
}
