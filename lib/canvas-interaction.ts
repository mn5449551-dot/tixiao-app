import type { ReactFlowProps } from "@xyflow/react";
import { PanOnScrollMode } from "@xyflow/react";

type CanvasInteractionProps = Pick<
  ReactFlowProps,
  "panOnDrag" | "panOnScroll" | "panOnScrollMode" | "panOnScrollSpeed" | "zoomOnScroll" | "zoomOnPinch"
>;

export const canvasInteractionProps: CanvasInteractionProps = {
  panOnDrag: false,
  panOnScroll: true,
  panOnScrollMode: PanOnScrollMode.Free,
  panOnScrollSpeed: 0.9,
  zoomOnScroll: false,
  zoomOnPinch: true,
};
