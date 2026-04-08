export const WORKSPACE_CANVAS_INVALIDATED = "workspace:canvas-invalidated";
export const WORKSPACE_TREE_INVALIDATED = "workspace:tree-invalidated";
export const WORKSPACE_FOCUS_NODE = "focus-canvas-node";

export function dispatchCanvasInvalidated() {
  window.dispatchEvent(new CustomEvent(WORKSPACE_CANVAS_INVALIDATED));
}

export function dispatchTreeInvalidated() {
  window.dispatchEvent(new CustomEvent(WORKSPACE_TREE_INVALIDATED));
}

export function dispatchWorkspaceInvalidated() {
  dispatchCanvasInvalidated();
  dispatchTreeInvalidated();
}

export function dispatchFocusCanvasNode(nodeId: string) {
  window.dispatchEvent(new CustomEvent(WORKSPACE_FOCUS_NODE, { detail: { nodeId } }));
}
