import type { CandidatePoolCardData } from "@/components/cards/candidate-pool-card";
import type { FinalizedPoolCardData } from "@/components/cards/finalized-pool-card";
import type { getCanvasData, getGenerationStatusData } from "@/lib/project-data";
import { toVersionedFileUrl } from "@/lib/utils";

type CanvasData = NonNullable<ReturnType<typeof getCanvasData>>;
type GenerationStatusData = NonNullable<ReturnType<typeof getGenerationStatusData>>;
type GraphNode = CanvasData["nodes"][number];
type GenerationStatusImage = GenerationStatusData["images"][number];
type CandidateImageStatus = CandidatePoolCardData["groups"][number]["images"][number]["status"];
type CandidateGroup = CandidatePoolCardData["groups"][number];
type CandidateImage = CandidateGroup["images"][number];
type FinalizedGroup = FinalizedPoolCardData["groups"][number];
type FinalizedImage = FinalizedGroup["images"][number];

function hasPendingImages(images: GenerationStatusData["images"]): boolean {
  return images.some((image) => image.status === "pending" || image.status === "generating");
}

function createImageStatusMap(
  images: GenerationStatusData["images"],
): Map<GenerationStatusImage["id"], GenerationStatusImage> {
  return new Map(images.map((image) => [image.id, image]));
}

function getCandidateNodeIds(graph: CanvasData): Set<string> {
  return new Set(
    graph.nodes
      .filter((node) => node.type === "candidatePool")
      .map((node) => node.id),
  );
}

function mergeCandidateImage(
  image: CandidateImage,
  nextImage: GenerationStatusImage | undefined,
): CandidateImage {
  if (!nextImage) {
    return image;
  }

  return {
    ...image,
    fileUrl: toVersionedFileUrl(nextImage.fileUrl, nextImage.updatedAt),
    thumbnailUrl: toVersionedFileUrl(nextImage.thumbnailUrl, nextImage.updatedAt),
    status: nextImage.status as CandidateImageStatus,
    updatedAt: nextImage.updatedAt,
  };
}

function mergeFinalizedImage(
  image: FinalizedImage,
  nextImage: GenerationStatusImage | undefined,
): FinalizedImage {
  if (!nextImage) {
    return image;
  }

  return {
    ...image,
    fileUrl: toVersionedFileUrl(nextImage.fileUrl, nextImage.updatedAt),
    thumbnailUrl: toVersionedFileUrl(nextImage.thumbnailUrl, nextImage.updatedAt),
    updatedAt: nextImage.updatedAt,
  };
}

function mergeCandidateGroups(
  groups: CandidatePoolCardData["groups"],
  imageStatusMap: Map<GenerationStatusImage["id"], GenerationStatusImage>,
): CandidatePoolCardData["groups"] {
  return groups.map((group) => ({
    ...group,
    images: group.images.map((image) => mergeCandidateImage(image, imageStatusMap.get(image.id))),
  }));
}

function mergeFinalizedGroups(
  groups: FinalizedPoolCardData["groups"],
  imageStatusMap: Map<GenerationStatusImage["id"], GenerationStatusImage>,
): FinalizedPoolCardData["groups"] {
  return groups.map((group) => ({
    ...group,
    images: group.images.map((image) => mergeFinalizedImage(image, imageStatusMap.get(image.id))),
  }));
}

function mergeGraphNode(
  node: GraphNode,
  imageStatusMap: Map<GenerationStatusImage["id"], GenerationStatusImage>,
): GraphNode {
  if (node.type === "candidatePool") {
    const candidateData = node.data as CandidatePoolCardData;
    return {
      ...node,
      data: {
        ...candidateData,
        groups: mergeCandidateGroups(candidateData.groups, imageStatusMap),
      },
    };
  }

  if (node.type === "finalizedPool") {
    const finalizedData = node.data as FinalizedPoolCardData;
    return {
      ...node,
      data: {
        ...finalizedData,
        groups: mergeFinalizedGroups(finalizedData.groups, imageStatusMap),
      } as FinalizedPoolCardData,
    } as GraphNode;
  }

  return node;
}

export function shouldReloadGraphAfterStatusPoll(
  graph: CanvasData,
  payload: GenerationStatusData,
): boolean {
  const candidateNodeIds = getCandidateNodeIds(graph);

  return payload.images.some((image) => {
    if (!image.fileUrl) return false;
    return !candidateNodeIds.has(`candidate-${image.imageConfigId}`);
  });
}

export function mergeGenerationStatusesIntoGraph(
  graph: CanvasData,
  payload: GenerationStatusData,
): CanvasData {
  const imageStatusMap = createImageStatusMap(payload.images);

  return {
    ...graph,
    hasPendingImages: hasPendingImages(payload.images),
    nodes: graph.nodes.map((node) => mergeGraphNode(node, imageStatusMap)),
  };
}
