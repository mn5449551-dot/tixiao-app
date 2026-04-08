import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import type { getProjectWorkspace } from "@/lib/project-data";

type WorkspaceData = NonNullable<ReturnType<typeof getProjectWorkspace>>;

/**
 * Auto-polls every 3 seconds when any image is in "generating" or "pending" state.
 * Stops automatically when all images reach "done" or "failed".
 */
export function useGenerationPolling(workspace: WorkspaceData) {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const hasPendingImages = workspace.directions.some((direction) =>
      direction.copyCards.some((card) =>
        card.copies.some((copy) =>
          copy.groups.some((group) =>
            group.images.some(
              (img) => img.status === "generating" || img.status === "pending",
            ),
          ),
        ),
      ),
    );

    if (hasPendingImages && !intervalRef.current) {
      intervalRef.current = setInterval(() => {
        router.refresh();
      }, 3000);
    } else if (!hasPendingImages && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      // Don't clear interval on unmount if still polling — let next mount handle it.
    };
  }, [workspace, router]);
}
