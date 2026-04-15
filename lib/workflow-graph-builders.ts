import type { Node } from "@xyflow/react";

import type {
  GraphNodeData,
  GraphNodeType,
  WorkspaceData,
} from "@/lib/workflow-graph-types";
import { toVersionedFileUrl } from "@/lib/utils";

function getDisplayMode(slotCount: number): "single" | "double" | "triple" {
  if (slotCount === 3) return "triple";
  if (slotCount === 2) return "double";
  return "single";
}

function getGroupAspectRatio(groupType: string, fallback: string) {
  if (!groupType.startsWith("derived|")) return fallback;
  return groupType.split("|")[2] ?? fallback;
}

export function buildImageConfigNode(input: {
  direction: WorkspaceData["directions"][number];
  copy: WorkspaceData["directions"][number]["copyCards"][number]["copies"][number];
  configY: number;
}): Node<GraphNodeData, GraphNodeType> {
  const { direction, copy, configY } = input;
  const config = copy.imageConfig!;

  return {
    id: `image-config-${config.id}`,
    type: "imageConfigCard",
    position: { x: 1390, y: configY },
    data: {
      copyId: copy.id,
      copyText: copy.titleSub ? `${copy.titleMain} / ${copy.titleSub}` : copy.titleMain,
      channel: direction.channel,
      imageForm: direction.imageForm ?? "single",
      imageConfigId: config.id,
      initialAspectRatio: config.aspectRatio,
      initialStyleMode: config.styleMode,
      initialImageStyle: config.imageStyle,
      initialImageModel: config.imageModel ?? null,
      initialCount: config.count,
      initialLogo: config.logo ?? undefined,
      initialIpRole: config.ipRole,
      initialCtaEnabled: config.ctaEnabled === 1,
      initialCtaText: config.ctaText ?? null,
      status: "idle",
    },
  };
}

export function buildCandidatePoolNode(input: {
  copy: WorkspaceData["directions"][number]["copyCards"][number]["copies"][number];
  configY: number;
}) {
  const { copy, configY } = input;
  const config = copy.imageConfig!;

  const candidateGroups = copy.groups
    .filter((group) => !group.groupType.startsWith("derived|"))
    .map((group) => ({
      id: group.id,
      variantIndex: group.variantIndex,
      slotCount: group.slotCount,
      isConfirmed: group.isConfirmed === 1,
      aspectRatio: group.aspectRatio ?? config.aspectRatio,
      styleMode: group.styleMode ?? config.styleMode,
      imageStyle: group.imageStyle ?? config.imageStyle,
        images: group.images.map((img) => ({
          id: img.id,
          fileUrl: toVersionedFileUrl(img.fileUrl, img.updatedAt),
          status: (img.status as "pending" | "generating" | "done" | "failed") ?? "pending",
          slotIndex: img.slotIndex,
          aspectRatio: group.aspectRatio ?? config.aspectRatio,
          updatedAt: img.updatedAt,
          inpaintParentId: img.inpaintParentId ?? null,
        })),
    }));

  const allImages = candidateGroups.flatMap((group) => group.images);
  const hasCandidateGroups = candidateGroups.length > 0;
  const hasDisplayableImages = allImages.some((img) => Boolean(img.fileUrl));
  const hasGenerating = candidateGroups.some((group) =>
    group.images.some((img) => img.status === "generating" || img.status === "pending"),
  );
  const hasFailed = candidateGroups.some((group) =>
    group.images.some((img) => img.status === "failed"),
  );
  const allDone = allImages.length > 0 && allImages.every((img) => img.status === "done");
  const hasDone = allImages.some((img) => img.status === "done");
  const poolStatus = hasFailed && !hasDone
    ? "error"
    : hasGenerating || (hasFailed && hasDone)
      ? "partial-success"
      : allDone
        ? "done"
        : "idle";

  const node = hasCandidateGroups
    ? ({
        id: `candidate-${config.id}`,
        type: "candidatePool",
        position: { x: 1840, y: configY },
        data: {
          displayMode: getDisplayMode(candidateGroups[0]?.slotCount ?? 1),
          groups: candidateGroups,
          groupLabel: `${candidateGroups.length} 组`,
          status: poolStatus,
          imageConfigId: config.id,
          imageModel: config.imageModel ?? null,
        },
      } satisfies Node<GraphNodeData, GraphNodeType>)
    : null;

  return {
    node,
    hasCandidateGroups,
    hasDisplayableImages,
    hasGenerating,
  };
}

export function buildFinalizedPoolNode(input: {
  copy: WorkspaceData["directions"][number]["copyCards"][number]["copies"][number];
  configY: number;
  projectId: string;
  imageModel?: string | null;
}) {
  const { copy, configY, projectId } = input;
  const config = copy.imageConfig!;

  const confirmedGroups = copy.groups
    .filter((group) => group.isConfirmed)
    .map((group) => ({
      id: group.id,
      variantIndex: group.variantIndex,
      slotCount: group.slotCount,
      groupType: group.groupType,
      aspectRatio: group.aspectRatio ?? config.aspectRatio,
      styleMode: group.styleMode ?? config.styleMode,
      imageStyle: group.imageStyle ?? config.imageStyle,
      images: group.images
        .filter((img) => img.status === "done")
        .map((img) => ({
          id: img.id,
          fileUrl: toVersionedFileUrl(img.fileUrl, img.updatedAt),
          aspectRatio: getGroupAspectRatio(group.groupType, group.aspectRatio ?? config.aspectRatio ?? "1:1"),
          groupLabel: group.groupType.startsWith("derived|")
            ? `适配 ${getGroupAspectRatio(group.groupType, group.aspectRatio ?? config.aspectRatio ?? "1:1")}`
            : `组 #${group.variantIndex}`,
          isConfirmed: true,
          updatedAt: img.updatedAt,
        })),
    }))
    .filter((group) => group.images.length > 0);

  const node = confirmedGroups.length > 0
    ? ({
        id: `finalized-${config.id}`,
        type: "finalizedPool",
        position: { x: 2320, y: configY },
        data: {
          displayMode: getDisplayMode(confirmedGroups[0]?.slotCount ?? 1),
          groups: confirmedGroups,
          groupLabel:
            (confirmedGroups[0]?.slotCount ?? 1) === 1
              ? `${confirmedGroups.reduce((sum, group) => sum + group.images.length, 0)} 张已定稿`
              : `${confirmedGroups.length} 套已定稿`,
          projectId,
          defaultImageModel: input.imageModel ?? null,
        },
      } satisfies Node<GraphNodeData, GraphNodeType>)
    : null;

  return {
    node,
    hasConfirmedGroups: confirmedGroups.length > 0,
  };
}
