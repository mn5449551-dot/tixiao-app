"use client";

import "@xyflow/react/dist/style.css";

import type { Node } from "@xyflow/react";
import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CandidatePoolCard } from "@/components/cards/candidate-pool-card";
import { CopyCard } from "@/components/cards/copy-card";
import { DirectionCard } from "@/components/cards/direction-card";
import { FinalizedPoolCard } from "@/components/cards/finalized-pool-card";
import { FrameNode } from "@/components/cards/frame-node";
import { ImageConfigCard } from "@/components/cards/image-config-card";
import { RequirementCard } from "@/components/cards/requirement-card";
import { canvasInteractionProps } from "@/lib/canvas-interaction";
import { arrangeNodesByHierarchy, mergeGraphNodes } from "@/lib/canvas-layout";
import type { getCanvasData } from "@/lib/project-data";
import {
  WORKSPACE_CANVAS_INVALIDATED,
  WORKSPACE_FOCUS_NODE,
} from "@/lib/workspace-events";
import { getNodeTier } from "@/lib/workflow-graph";
import type { GraphNodeData, GraphNodeType } from "@/lib/workflow-graph-types";

type CanvasData = NonNullable<ReturnType<typeof getCanvasData>>;

const nodeTypes = {
  frame: FrameNode,
  requirementCard: RequirementCard,
  directionCard: DirectionCard,
  copyCard: CopyCard,
  imageConfigCard: ImageConfigCard,
  candidatePool: CandidatePoolCard,
  finalizedPool: FinalizedPoolCard,
};

// -- Component -------------------------------------------------------------

export function WorkflowCanvas({
  graph,
  onInvalidate,
}: {
  graph: CanvasData;
  onInvalidate: () => void;
}) {
  const fullGraph = useMemo(
    () => ({
      nodes: graph.nodes,
      edges: graph.edges,
    }),
    [graph.edges, graph.nodes],
  );
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [canvasNodes, setCanvasNodes, onNodesChange] = useNodesState(fullGraph.nodes);
  const [canvasEdges, setCanvasEdges, onEdgesChange] = useEdgesState(fullGraph.edges);

  // Track the highest tier that has been revealed
  const [maxVisibleTier, setMaxVisibleTier] = useState(0);
  const revealedMaxTierRef = useRef(0);

  // Only reveal newly introduced tiers; don't replay the whole canvas animation on every refresh.
  const nodeIds = useMemo(() => fullGraph.nodes.map((n) => n.id).sort().join(","), [fullGraph.nodes]);
  useEffect(() => {
    const allTiers = fullGraph.nodes.map(getNodeTier);
    const maxTier = Math.max(...allTiers, 0);
    if (maxTier === 0) return;

    const previousMaxTier = revealedMaxTierRef.current;
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (previousMaxTier === 0 && maxVisibleTier === 0) {
      for (let t = 1; t <= maxTier; t++) {
        timers.push(setTimeout(() => setMaxVisibleTier(t), t * 300));
      }
    } else if (maxTier > previousMaxTier) {
      for (let t = previousMaxTier + 1; t <= maxTier; t++) {
        const delay = (t - previousMaxTier) * 300;
        timers.push(setTimeout(() => setMaxVisibleTier((current) => Math.max(current, t)), delay));
      }
    } else {
      setMaxVisibleTier((current) => Math.max(current, maxTier));
    }

    revealedMaxTierRef.current = maxTier;
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeIds]);

  useEffect(() => {
    setCanvasNodes((current) => mergeGraphNodes(current, fullGraph.nodes));
    setCanvasEdges(fullGraph.edges);
  }, [fullGraph.edges, fullGraph.nodes, setCanvasEdges, setCanvasNodes]);

  // Filter nodes/edges by visible tier
  const nodes = useMemo(
    () =>
      canvasNodes
        .filter((n) => getNodeTier(n) <= maxVisibleTier)
        .map((n) => ({
          ...n,
          selected: n.id === highlightedNodeId,
        })),
    [canvasNodes, maxVisibleTier, highlightedNodeId],
  );

  const nodeMap = useMemo(
    () => new Map(canvasNodes.map((node) => [node.id, node])),
    [canvasNodes],
  );

  const edges = useMemo(
    () =>
      canvasEdges.filter((e) => {
        const src = nodeMap.get(e.source);
        const tgt = nodeMap.get(e.target);
        return (
          src &&
          tgt &&
          getNodeTier(src) <= maxVisibleTier &&
          getNodeTier(tgt) <= maxVisibleTier
        );
      }),
    [canvasEdges, maxVisibleTier, nodeMap],
  );

  useEffect(() => {
    window.addEventListener(WORKSPACE_CANVAS_INVALIDATED, onInvalidate);
    return () => window.removeEventListener(WORKSPACE_CANVAS_INVALIDATED, onInvalidate);
  }, [onInvalidate]);

  return (
    <div className="relative h-full overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(253,252,252,0.98))]">
      <ReactFlow
        fitView
        edges={edges}
        nodes={nodes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        nodesDraggable
        panOnDrag={canvasInteractionProps.panOnDrag}
        panOnScroll={canvasInteractionProps.panOnScroll}
        panOnScrollMode={canvasInteractionProps.panOnScrollMode}
        panOnScrollSpeed={canvasInteractionProps.panOnScrollSpeed}
        zoomOnScroll={canvasInteractionProps.zoomOnScroll}
        zoomOnPinch={canvasInteractionProps.zoomOnPinch}
        minZoom={0.2}
        maxZoom={2.5}
      >
        <Background color="rgba(226, 213, 203, 0.35)" gap={20} size={1} />
        <Controls className="!rounded-2xl !border !border-[var(--border)] !bg-white !shadow-[var(--shadow-card)]" />
        <CanvasEventBridge
          allNodes={canvasNodes}
          onHighlight={setHighlightedNodeId}
        />
        <AutoLayoutToolbar nodes={canvasNodes} onLayout={setCanvasNodes} />
      </ReactFlow>
      <div
        id="workflow-canvas-overlay-root"
        className="pointer-events-none absolute inset-0 z-40"
      />
    </div>
  );
}

function CanvasEventBridge({
  allNodes,
  onHighlight,
}: {
  allNodes: Array<Node<GraphNodeData, GraphNodeType>>;
  onHighlight: (nodeId: string | null) => void;
}) {
  const { setCenter, getZoom } = useReactFlow();

  useEffect(() => {
    const handleFocus = (event: Event) => {
      const nodeId = (event as CustomEvent<{ nodeId?: string }>).detail?.nodeId;
      if (!nodeId) return;

      const node = allNodes.find((item) => item.id === nodeId);
      if (!node) return;

      onHighlight(nodeId);

      const width = typeof node.measured?.width === "number" ? node.measured.width : 360;
      const height = typeof node.measured?.height === "number" ? node.measured.height : 220;
      setCenter(node.position.x + width / 2, node.position.y + height / 2, {
        duration: 400,
        zoom: Math.max(getZoom(), 0.9),
      });
    };

    window.addEventListener(WORKSPACE_FOCUS_NODE, handleFocus);
    return () => window.removeEventListener(WORKSPACE_FOCUS_NODE, handleFocus);
  }, [allNodes, getZoom, onHighlight, setCenter]);

  return null;
}

/**
 * Renders inside React Flow provider to access useReactFlow() hook.
 * Uses rfSetNodes directly to update positions — no conflicting state setter.
 */
function AutoLayoutToolbar({
  nodes,
  onLayout,
}: {
  nodes: Array<Node<GraphNodeData, GraphNodeType>>;
  onLayout: (updater: Array<Node<GraphNodeData, GraphNodeType>>) => void;
}) {
  const handleAutoLayout = () => {
    onLayout(arrangeNodesByHierarchy(nodes));
  };

  return (
    <div className="absolute right-4 top-20 z-10">
      <button
        type="button"
        onClick={handleAutoLayout}
        className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--ink-default)] shadow-[var(--shadow-card)] transition-all duration-300 hover:bg-[var(--surface-dim)] hover:shadow-[var(--shadow-card-hover)]"
      >
        一键整理
      </button>
    </div>
  );
}
