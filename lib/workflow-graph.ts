import type { Edge, Node } from "@xyflow/react";

import { arrangeNodesByHierarchy } from "@/lib/canvas-layout";
import {
  buildCandidatePoolNode,
  buildFinalizedPoolNode,
  buildImageConfigNode,
} from "@/lib/workflow-graph-builders";
import type {
  GraphNodeData,
  GraphNodeType,
  WorkspaceData,
} from "@/lib/workflow-graph-types";

const DIRECTION_VERTICAL_GAP = 160;
const COPY_CARD_VERTICAL_GAP = 520;
const CONFIG_CARD_VERTICAL_GAP = 340;

function toStr(val: string | null | undefined): string {
  return val ?? "";
}

function createSourceHandleId(kind: "direction" | "copy", itemId: string) {
  return `${kind}-row-${itemId}`;
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
        hasDownstream: d.copyCards.length > 0,
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

        const configY = cardBaseY + copyIndex * CONFIG_CARD_VERTICAL_GAP;
        const imageConfigNode = buildImageConfigNode({ direction, copy, configY });
        nodes.push(imageConfigNode);

        edges.push(
          edgeOf(copyCardId, imageConfigNode.id, "出图", {
            sourceHandle: createSourceHandleId("copy", copy.id),
          }),
        );

        const candidatePool = buildCandidatePoolNode({ copy, configY });
        if (!candidatePool.hasCandidateGroups || !candidatePool.node) {
          return;
        }

        nodes.push(candidatePool.node);

        edges.push(
          edgeOf(imageConfigNode.id, candidatePool.node.id, "汇入", {
            animated: candidatePool.hasGenerating,
          }),
        );

        const finalizedPool = buildFinalizedPoolNode({
          copy,
          configY,
          projectId: workspace.project.id,
        });
        if (finalizedPool.hasConfirmedGroups && finalizedPool.node) {
          nodes.push(finalizedPool.node);
          edges.push(edgeOf(candidatePool.node.id, finalizedPool.node.id, "定稿"));
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
    markerEnd: { type: "arrowclosed", color: "#ff8a00" },
    style: { stroke: "#ff8a00", strokeWidth: 1.5 },
    labelStyle: { fill: "#8b7355", fontSize: 10 },
    labelBgStyle: { fill: "#fffdfb", fillOpacity: 1 },
  };
}
