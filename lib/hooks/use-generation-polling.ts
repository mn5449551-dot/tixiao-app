import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";

import type { getGenerationStatusData } from "@/lib/project-data";

type GenerationStatusData = NonNullable<ReturnType<typeof getGenerationStatusData>>;
type GenerationStatusResponse = GenerationStatusData | { error?: string };
const POLLING_INTERVAL_MS = 3000;

type UseGenerationPollingOptions = {
  projectId: string;
  enabled: boolean;
  onStatuses: (payload: GenerationStatusData) => void;
};

function isGenerationStatusData(value: unknown): value is GenerationStatusData {
  return typeof value === "object" && value !== null && "images" in value;
}

function clearPollingInterval(
  intervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>,
): void {
  if (intervalRef.current) {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }
}

async function fetchGenerationStatuses(projectId: string): Promise<GenerationStatusData | null> {
  const response = await fetch(`/api/projects/${projectId}/generation-status`);
  const payload = (await response.json()) as GenerationStatusResponse;

  if (!response.ok || !isGenerationStatusData(payload)) {
    return null;
  }

  return payload;
}

export function useGenerationPolling({
  projectId,
  enabled,
  onStatuses,
}: UseGenerationPollingOptions): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) {
      clearPollingInterval(intervalRef);
      return () => {
        clearPollingInterval(intervalRef);
      };
    }

    let cancelled = false;

    const pollStatuses = async (): Promise<void> => {
      try {
        const payload = await fetchGenerationStatuses(projectId);
        if (!payload) {
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
    clearPollingInterval(intervalRef);
    intervalRef.current = setInterval(() => {
      void pollStatuses();
    }, POLLING_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearPollingInterval(intervalRef);
    };
  }, [enabled, onStatuses, projectId]);
}
