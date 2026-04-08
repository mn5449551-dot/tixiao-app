import type { Edge, Node } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";

import type { FrameNodeData } from "@/components/cards/frame-node";
import { arrangeNodesByHierarchy } from "@/lib/canvas-layout";
import type { getProjectWorkspace } from "@/lib/project-data";

type WorkspaceData = NonNullable<ReturnType<typeof getProjectWorkspace>>;

const DIRECTION_VERTICAL_GAP = 160;
const COPY_CARD_VERTICAL_GAP = 520;
const CONFIG_CARD_VERTICAL_GAP = 340;

type DirectionItem = {
  id: string;
  title: string;
  targetAudience: string;
  scenarioProblem: string;
  differentiation: string;
  effect: string;
  channel: string;
  imageForm: string;
  copyGenerationCount: number;
  sourceHandleId: string;
};

export type GraphNodeData =
  | FrameNodeData
  | { projectId?: string; initial?: Record<string, unknown> }
  | { projectId?: string; stageLabel?: string; directions: DirectionItem[]; initialChannel?: string; initialImageForm?: string; status?: string }
  | {
      copyCardId?: string;
      directionTitle: string;
      directionId?: string;
      channel: string;
      imageForm: string;
      version?: number;
      copyItems: Array<{
        id: string;
        variantIndex: number;
        copyType: string | null;
        titleMain: string;
        titleSub: string | null;
        titleExtra: string | null;
        isLocked: boolean;
        sourceHandleId: string;
      }>;
      status?: string;
    }
  | {
      copyId: string;
      copyText: string;
      imageConfigId?: string;
      initialAspectRatio?: string;
      initialStyleMode?: string;
      initialImageStyle?: string;
      initialCount?: number;
      initialLogo?: string;
      initialIpRole?: string | null;
      status?: string;
    }
  | {
      displayMode: "single" | "double" | "triple";
      groups: Array<{
        id: string;
        variantIndex: number;
        slotCount: number;
        isConfirmed: boolean;
        images: Array<{
          id: string;
          fileUrl: string | null;
          status: "pending" | "generating" | "done" | "failed";
          slotIndex: number;
          aspectRatio?: string;
        }>;
      }>;
      groupLabel?: string;
      status?: string;
      imageConfigId?: string;
    }
  | {
      displayMode: "single" | "double" | "triple";
      groups: Array<{
        id: string;
        variantIndex: number;
        slotCount: number;
        groupType?: string;
        images: Array<{
          id: string;
          fileUrl: string | null;
          aspectRatio: string;
          groupLabel?: string;
          isConfirmed: boolean;
        }>;
      }>;
      groupLabel?: string;
      projectId?: string;
    };

export type GraphNodeType =
  | "frame"
  | "requirementCard"
  | "directionCard"
  | "copyCard"
  | "imageConfigCard"
  | "candidatePool"
  | "finalizedPool";

function toStr(val: string | null | undefined): string {
  return val ?? "";
}

function createSourceHandleId(kind: "direction" | "copy", itemId: string) {
  return `${kind}-row-${itemId}`;
}

function getDisplayMode(slotCount: number): "single" | "double" | "triple" {
  if (slotCount === 3) return "triple";
  if (slotCount === 2) return "double";
  return "single";
}

function getGroupAspectRatio(groupType: string, fallback: string) {
  if (!groupType.startsWith("derived|")) return fallback;
  return groupType.split("|")[2] ?? fallback;
}

function getConfiguredCopyCount(card: WorkspaceData["directions"][number]["copyCards"][number]) {
  return Math.max(1, card.copies.filter((copy) => copy.imageConfig).length);
}

function getDirectionBranchHeight(direction: WorkspaceData["directions"][number]) {
  if (direction.copyCards.length === 0) {
    return 260;
  }

  return (
    direction.copyCards.reduce((height, card, cardIndex) => {
      const cardBottom =
        cardIndex * COPY_CARD_VERTICAL_GAP +
        Math.max(320, getConfiguredCopyCount(card) * CONFIG_CARD_VERTICAL_GAP);
      return Math.max(height, cardBottom);
    }, 0) + DIRECTION_VERTICAL_GAP
  );
}

export function getNodeTier(node: Node): number {
  switch (node.type) {
    case "requirementCard":
      return 0;
    case "directionCard":
    case "frame":
      return 1;
    case "copyCard":
      return 2;
    case "imageConfigCard":
      return 3;
    case "candidatePool":
      return 4;
    case "finalizedPool":
      return 5;
    default:
      return 0;
  }
}

export function buildGraph(workspace: WorkspaceData) {
  const nodes: Array<Node<GraphNodeData, GraphNodeType>> = [];
  const edges: Edge[] = [];

  const requirement = workspace.requirement;
  nodes.push({
    id: "requirement",
    type: "requirementCard",
    position: { x: 40, y: 80 },
    data: requirement
      ? {
          projectId: workspace.project.id,
          initial: {
            businessGoal: "app",
            targetAudience: requirement.targetAudience,
            formatType: "image_text",
            feature: requirement.feature ?? "",
            sellingPoints: requirement.sellingPoints ?? [],
            timeNode: requirement.timeNode ?? "",
            directionCount: requirement.directionCount ?? 3,
          },
        }
      : { projectId: workspace.project.id },
  });

  if (workspace.directions.length === 0) {
    return { nodes: arrangeNodesByHierarchy(nodes), edges };
  }

  const firstDirection = workspace.directions[0];

  nodes.push({
    id: "direction-board",
    type: "directionCard",
    position: { x: 500, y: 60 },
    data: {
      projectId: workspace.project.id,
      stageLabel: workspace.requirement?.timeNode ?? undefined,
      directions: workspace.directions.map((d) => ({
        id: d.id,
        title: d.title,
        targetAudience: toStr(d.targetAudience),
        scenarioProblem: toStr(d.scenarioProblem),
        differentiation: toStr(d.differentiation),
        effect: toStr(d.effect),
        channel: d.channel,
        imageForm: toStr(d.imageForm),
        copyGenerationCount: d.copyGenerationCount ?? 3,
        sourceHandleId: createSourceHandleId("direction", d.id),
      })),
      initialChannel: firstDirection.channel,
      initialImageForm: firstDirection.imageForm ?? undefined,
      status: "done",
    },
  });

  edges.push(edgeOf("requirement", "direction-board", "生成"));

  let nextDirectionY = 40;
  workspace.directions.forEach((direction) => {
    const baseY = nextDirectionY;

    direction.copyCards.forEach((card, cardIndex) => {
      const cardBaseY = baseY + cardIndex * COPY_CARD_VERTICAL_GAP;
      const copyCardId = `copy-card-${card.id}`;

      nodes.push({
        id: copyCardId,
        type: "copyCard",
        position: { x: 970, y: cardBaseY },
        data: {
          copyCardId: card.id,
          directionTitle: direction.title,
          directionId: direction.id,
          channel: card.channel,
          imageForm: card.imageForm,
          version: card.version,
          copyItems: card.copies.map((copy) => ({
            id: copy.id,
            variantIndex: copy.variantIndex,
            copyType: copy.copyType,
            titleMain: copy.titleMain,
            titleSub: copy.titleSub ?? null,
            titleExtra: copy.titleExtra ?? null,
            isLocked: Boolean(copy.isLocked),
            sourceHandleId: createSourceHandleId("copy", copy.id),
          })),
          status: "done",
        },
      });

      edges.push(
        edgeOf("direction-board", copyCardId, "分支", {
          sourceHandle: createSourceHandleId("direction", direction.id),
        }),
      );

      card.copies.forEach((copy, copyIndex) => {
        if (!copy.imageConfig) return;

        const config = copy.imageConfig;
        const configY = cardBaseY + copyIndex * CONFIG_CARD_VERTICAL_GAP;
        const configNodeId = `image-config-${config.id}`;

        nodes.push({
          id: configNodeId,
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
        });

        edges.push(
          edgeOf(copyCardId, configNodeId, "出图", {
            sourceHandle: createSourceHandleId("copy", copy.id),
          }),
        );

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
                groupLabel: group.groupType.startsWith("derived|") ? `适配 ${getGroupAspectRatio(group.groupType, config.aspectRatio ?? "1:1")}` : `组 #${group.variantIndex}`,
                isConfirmed: true,
              })),
          }))
          .filter((group) => group.images.length > 0);

        if (!hasDisplayableImages) {
          return;
        }

        const candidateNodeId = `candidate-${config.id}`;
        nodes.push({
          id: candidateNodeId,
          type: "candidatePool",
            position: { x: 1840, y: configY },
            data: {
            displayMode: getDisplayMode(candidateGroups[0]?.slotCount ?? 1),
            groups: candidateGroups,
            groupLabel: `${candidateGroups.length} 组`,
            status: poolStatus,
            imageConfigId: config.id,
          },
        });

        edges.push(edgeOf(configNodeId, candidateNodeId, "汇入", { animated: hasGenerating }));

        if (confirmedGroups.length > 0) {
          const finalizedNodeId = `finalized-${config.id}`;
          nodes.push({
            id: finalizedNodeId,
            type: "finalizedPool",
            position: { x: 2320, y: configY },
            data: {
              displayMode: getDisplayMode(confirmedGroups[0]?.slotCount ?? 1),
              groups: confirmedGroups,
              groupLabel:
                (confirmedGroups[0]?.slotCount ?? 1) === 1
                  ? `${confirmedGroups.reduce((sum, group) => sum + group.images.length, 0)} 张已定稿`
                  : `${confirmedGroups.length} 套已定稿`,
              projectId: workspace.project.id,
            },
          });

          edges.push(edgeOf(candidateNodeId, finalizedNodeId, "定稿"));
        }
      });
    });

    nextDirectionY += getDirectionBranchHeight(direction);
  });

  return { nodes: arrangeNodesByHierarchy(nodes), edges };
}

function edgeOf(
  source: string,
  target: string,
  label: string,
  options?: { animated?: boolean; sourceHandle?: string; targetHandle?: string },
): Edge {
  return {
    id: `${source}-${options?.sourceHandle ?? "default"}-${target}-${options?.targetHandle ?? "default"}`,
    source,
    target,
    sourceHandle: options?.sourceHandle,
    targetHandle: options?.targetHandle,
    label,
    animated: options?.animated ?? false,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#ff8a00" },
    style: { stroke: "#ff8a00", strokeWidth: 1.5 },
    labelStyle: { fill: "#8b7355", fontSize: 10 },
    labelBgStyle: { fill: "#fffdfb", fillOpacity: 1 },
  };
}
