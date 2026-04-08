import type { Node } from "@xyflow/react";

import type {
  GraphNodeData,
  GraphNodeType,
  WorkspaceData,
} from "@/lib/workflow-graph-types";

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
  copy: WorkspaceData["directions"][number]["copyCards"][number]["copies"][number];
  configY: number;
}): Node<GraphNodeData, GraphNodeType> {
  const { copy, configY } = input;
  const config = copy.imageConfig!;

  return {
    id: `image-config-${config.id}`,
    type: "imageConfigCard",
    position: { x: 1390, y: configY },
    data: {
      copyId: copy.id,
      copyText: copy.titleSub ? `${copy.titleMain} / ${copy.titleSub}` : copy.titleMain,
      imageConfigId: config.id,
      initialAspectRatio: config.aspectRatio,
      initialStyleMode: config.styleMode,
      initialImageStyle: config.imageStyle,
      initialCount: config.count,
      initialLogo: config.logo ?? undefined,
      initialIpRole: config.ipRole,
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
      images: group.images.map((img) => ({
        id: img.id,
        fileUrl: img.fileUrl ?? null,
        status: (img.status as "pending" | "generating" | "done" | "failed") ?? "pending",
        slotIndex: img.slotIndex,
        aspectRatio: config.aspectRatio,
      })),
    }));

  const allImages = candidateGroups.flatMap((group) => group.images);
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

  const node = hasDisplayableImages
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
        },
      } satisfies Node<GraphNodeData, GraphNodeType>)
    : null;

  return {
    node,
    hasDisplayableImages,
    hasGenerating,
  };
}

export function buildFinalizedPoolNode(input: {
  copy: WorkspaceData["directions"][number]["copyCards"][number]["copies"][number];
  configY: number;
  projectId: string;
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
      images: group.images
        .filter((img) => img.status === "done")
        .map((img) => ({
          id: img.id,
          fileUrl: img.fileUrl ?? null,
          aspectRatio: getGroupAspectRatio(group.groupType, config.aspectRatio ?? "1:1"),
          groupLabel: group.groupType.startsWith("derived|")
            ? `适配 ${getGroupAspectRatio(group.groupType, config.aspectRatio ?? "1:1")}`
            : `组 #${group.variantIndex}`,
          isConfirmed: true,
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
        },
      } satisfies Node<GraphNodeData, GraphNodeType>)
    : null;

  return {
    node,
    hasConfirmedGroups: confirmedGroups.length > 0,
  };
}
