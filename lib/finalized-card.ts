import { toVersionedFileUrl } from "@/lib/utils";
import type { WorkspaceData } from "@/lib/workflow-graph-types";

type WorkspaceGroup = WorkspaceData["directions"][number]["copyCards"][number]["copies"][number]["groups"][number];

export function getDerivedSourceGroupId(groupType: string | undefined) {
  if (!groupType?.startsWith("derived|")) return null;
  return groupType.split("|")[1] ?? null;
}

export function getDerivedRatio(groupType: string | undefined) {
  if (!groupType?.startsWith("derived|")) return null;
  return groupType.split("|")[2] ?? null;
}

export function buildFinalizedCardView(input: {
  sourceGroup: WorkspaceGroup;
  siblingGroups: WorkspaceGroup[];
  fallbackAspectRatio: string;
}) {
  const sourceAspectRatio = input.sourceGroup.aspectRatio ?? input.fallbackAspectRatio;
  const relatedGroups = input.siblingGroups
    .filter((group) =>
      group.id === input.sourceGroup.id || getDerivedSourceGroupId(group.groupType) === input.sourceGroup.id,
    )
    .map((group) => ({
      ...group,
      images: group.images.filter((img) => img.status === "done"),
    }))
    .filter((group) => group.images.length > 0);

  const groups = relatedGroups.map((group) => {
    const ratio = group.id === input.sourceGroup.id
      ? sourceAspectRatio
      : getDerivedRatio(group.groupType) ?? group.aspectRatio ?? sourceAspectRatio;

    return {
      id: group.id,
      variantIndex: group.variantIndex,
      slotCount: group.slotCount,
      groupType: group.groupType,
      aspectRatio: ratio,
      styleMode: group.styleMode,
      imageStyle: group.imageStyle,
      images: group.images.map((img) => ({
        id: img.id,
        fileUrl: toVersionedFileUrl(img.fileUrl, img.updatedAt),
        thumbnailUrl: toVersionedFileUrl(img.thumbnailUrl, img.updatedAt),
        aspectRatio: ratio,
        actualWidth: img.actualWidth ?? null,
        actualHeight: img.actualHeight ?? null,
        groupLabel: group.id === input.sourceGroup.id ? `组 #${group.variantIndex}` : `适配 ${ratio}`,
        isConfirmed: true,
        updatedAt: img.updatedAt,
      })),
    };
  });

  return {
    sourceGroupId: input.sourceGroup.id,
    sourceImageConfigId: input.sourceGroup.imageConfigId,
    sourceAspectRatio,
    sourceImages: groups.find((group) => group.id === input.sourceGroup.id)?.images ?? [],
    assets: groups.map((group) => ({
      ratio: group.aspectRatio,
      groupId: group.id,
      imageIds: group.images.map((img) => img.id),
      kind: group.id === input.sourceGroup.id ? "source" as const : "derived" as const,
      images: group.images.map((img) => ({
        id: img.id,
        fileUrl: img.fileUrl,
        thumbnailUrl: img.thumbnailUrl,
        aspectRatio: img.aspectRatio,
        actualWidth: img.actualWidth ?? null,
        actualHeight: img.actualHeight ?? null,
        updatedAt: img.updatedAt,
      })),
    })),
    groups,
  };
}
