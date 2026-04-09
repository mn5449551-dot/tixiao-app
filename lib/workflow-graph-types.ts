import type { Edge, Node } from "@xyflow/react";

import type { FrameNodeData } from "@/components/cards/frame-node";
import type { getProjectWorkspace } from "@/lib/project-data";

export type WorkspaceData = NonNullable<ReturnType<typeof getProjectWorkspace>>;

export type DirectionItem = {
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
  | {
      projectId?: string;
      stageLabel?: string;
      directions: DirectionItem[];
      initialChannel?: string;
      initialImageForm?: string;
      status?: string;
    }
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
        aspectRatio?: string;
        styleMode?: string;
        imageStyle?: string;
        images: Array<{
          id: string;
          fileUrl: string | null;
          status: "pending" | "generating" | "done" | "failed";
          slotIndex: number;
          aspectRatio?: string;
          updatedAt?: number;
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
        aspectRatio?: string;
        styleMode?: string;
        imageStyle?: string;
        images: Array<{
          id: string;
          fileUrl: string | null;
          aspectRatio: string;
          groupLabel?: string;
          isConfirmed: boolean;
          updatedAt?: number;
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

export type WorkflowGraph = {
  nodes: Array<Node<GraphNodeData, GraphNodeType>>;
  edges: Edge[];
};
