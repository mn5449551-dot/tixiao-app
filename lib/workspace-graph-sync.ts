import type { CandidatePoolCardData } from "@/components/cards/candidate-pool-card";
import type { FinalizedPoolCardData } from "@/components/cards/finalized-pool-card";
import type { getCanvasData, getGenerationStatusData } from "@/lib/project-data";
import { toVersionedFileUrl } from "@/lib/utils";

type CanvasData = NonNullable<ReturnType<typeof getCanvasData>>;
type GenerationStatusData = NonNullable<ReturnType<typeof getGenerationStatusData>>;
type CandidateImageStatus = CandidatePoolCardData["groups"][number]["images"][number]["status"];

export function shouldReloadGraphAfterStatusPoll(
  graph: CanvasData,
  payload: GenerationStatusData,
) {
  const candidateNodeIds = new Set(
    graph.nodes
      .filter((node) => node.type === "candidatePool")
      .map((node) => node.id),
  );

  return payload.images.some((image) => {
    if (!image.fileUrl) return false;
    return !candidateNodeIds.has(`candidate-${image.imageConfigId}`);
  });
}

export function mergeGenerationStatusesIntoGraph(
  graph: CanvasData,
  payload: GenerationStatusData,
): CanvasData {
  const imageStatusMap = new Map(payload.images.map((image) => [image.id, image]));

  return {
    ...graph,
    hasPendingImages: payload.images.some(
      (image) => image.status === "pending" || image.status === "generating",
    ),
    nodes: graph.nodes.map((node) => {
      if (node.type === "candidatePool") {
        const candidateData = node.data as CandidatePoolCardData;
        return {
          ...node,
          data: {
            ...candidateData,
            groups: candidateData.groups.map((group) => ({
              ...group,
              images: group.images.map((image) => {
                const nextImage = imageStatusMap.get(image.id);
                if (!nextImage) return image;
                return {
                  ...image,
                  fileUrl: toVersionedFileUrl(nextImage.fileUrl, nextImage.updatedAt),
                  thumbnailUrl: toVersionedFileUrl(nextImage.thumbnailUrl, nextImage.updatedAt),
                  status: nextImage.status as CandidateImageStatus,
                  updatedAt: nextImage.updatedAt,
                };
              }),
            })),
          },
        };
      }

      if (node.type === "finalizedPool") {
        const finalizedData = node.data as FinalizedPoolCardData;
        return {
          ...node,
          data: {
            ...finalizedData,
            groups: finalizedData.groups.map((group) => ({
              ...group,
              images: group.images.map((image) => {
                const nextImage = imageStatusMap.get(image.id);
                if (!nextImage) return image;
                return {
                  ...image,
                  fileUrl: toVersionedFileUrl(nextImage.fileUrl, nextImage.updatedAt),
                  thumbnailUrl: toVersionedFileUrl(nextImage.thumbnailUrl, nextImage.updatedAt),
                  updatedAt: nextImage.updatedAt,
                };
              }),
            })),
          },
        };
      }

      return node;
    }),
  };
}
