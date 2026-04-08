type Position = { x: number; y: number };

export type LayoutNode = {
  id: string;
  type?: string;
  position: Position;
  data?: Record<string, unknown>;
};

const COLUMN_X_BY_TYPE: Record<string, number> = {
  requirementCard: 40,
  frame: 500,
  directionCard: 500,
  copyCard: 970,
  imageConfigCard: 1390,
  candidatePool: 1840,
  finalizedPool: 2550,
};

const COLUMN_ORDER_BY_TYPE: Record<string, number> = {
  requirementCard: 0,
  frame: 1,
  directionCard: 1,
  copyCard: 2,
  imageConfigCard: 3,
  candidatePool: 4,
  finalizedPool: 5,
};

const COLUMN_START_Y = 80;
const VERTICAL_GAP = 80;

export function arrangeNodesByHierarchy<T extends LayoutNode>(nodes: readonly T[]): T[] {
  const buckets = new Map<number, T[]>();
  const imageBranches = new Map<string, T[]>();

  nodes.forEach((node) => {
    const imageBranchKey = getImageBranchKey(node);
    if (imageBranchKey) {
      const bucket = imageBranches.get(imageBranchKey) ?? [];
      bucket.push(node);
      imageBranches.set(imageBranchKey, bucket);
      return;
    }

    const tier = COLUMN_ORDER_BY_TYPE[node.type ?? ""] ?? 0;
    const bucket = buckets.get(tier) ?? [];
    bucket.push(node);
    buckets.set(tier, bucket);
  });

  const nextPositions = new Map<string, Position>();

  for (const [tier, tierNodes] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    const siblings = [...tierNodes].sort((a, b) => a.position.y - b.position.y);
    let y = COLUMN_START_Y;

    for (const sibling of siblings) {
      nextPositions.set(sibling.id, {
        x: COLUMN_X_BY_TYPE[sibling.type ?? ""] ?? 40,
        y,
      });
      y += estimateNodeHeight(sibling) + VERTICAL_GAP;
    }

    void tier;
  }

  const orderedBranches = [...imageBranches.entries()].sort(
    (a, b) => Math.min(...a[1].map((node) => node.position.y)) - Math.min(...b[1].map((node) => node.position.y)),
  );

  let branchY = COLUMN_START_Y;
  for (const [, branchNodes] of orderedBranches) {
    const branchHeight = Math.max(...branchNodes.map((node) => estimateNodeHeight(node)));
    for (const node of branchNodes) {
      nextPositions.set(node.id, {
        x: COLUMN_X_BY_TYPE[node.type ?? ""] ?? 40,
        y: branchY,
      });
    }
    branchY += branchHeight + VERTICAL_GAP;
  }

  return nodes.map((node) => {
    const position = nextPositions.get(node.id);
    return position ? { ...node, position } : node;
  });
}

export function mergeGraphNodes<T extends LayoutNode>(
  currentNodes: readonly T[],
  nextNodes: readonly T[],
): T[] {
  const currentById = new Map(currentNodes.map((node) => [node.id, node]));

  return nextNodes.map((node) => {
    const current = currentById.get(node.id);
    if (!current) return { ...node };

    return {
      ...node,
      position: current.position,
      selected: (current as T & { selected?: boolean }).selected,
      measured: (current as T & { measured?: unknown }).measured,
    };
  });
}

function estimateNodeHeight(node: LayoutNode) {
  switch (node.type) {
    case "requirementCard":
      return 760;
    case "directionCard": {
      const directionCount = Array.isArray(node.data?.directions) ? node.data.directions.length : 1;
      return 280 + directionCount * 180;
    }
    case "copyCard": {
      const count = Array.isArray(node.data?.copyItems) ? node.data.copyItems.length : 1;
      return 200 + count * 120;
    }
    case "imageConfigCard":
      return 620;
    case "candidatePool":
      return estimateCandidatePoolHeight(node);
    case "finalizedPool":
      return estimateFinalizedPoolHeight(node);
    case "frame":
      return 240;
    default:
      return 320;
  }
}

function getImageBranchKey(node: LayoutNode) {
  if (node.type === "imageConfigCard" && node.id.startsWith("image-config-")) {
    return node.id.slice("image-config-".length);
  }
  if (node.type === "candidatePool" && node.id.startsWith("candidate-")) {
    return node.id.slice("candidate-".length);
  }
  if (node.type === "finalizedPool" && node.id.startsWith("finalized-")) {
    return node.id.slice("finalized-".length);
  }
  return null;
}

function estimateCandidatePoolHeight(node: LayoutNode) {
  const data = node.data as {
    displayMode?: "single" | "double" | "triple";
    groups?: Array<{ images?: unknown[] }>;
  } | undefined;
  const displayMode = data?.displayMode ?? "single";
  const groups = data?.groups ?? [];

  if (displayMode === "single") {
    const imageCount = groups.reduce((sum, group) => sum + (group.images?.length ?? 0), 0);
    return 260 + Math.max(1, imageCount) * 300;
  }

  return 260 + Math.max(1, groups.length) * 280;
}

function estimateFinalizedPoolHeight(node: LayoutNode) {
  const data = node.data as {
    displayMode?: "single" | "double" | "triple";
    groups?: Array<{ images?: unknown[] }>;
  } | undefined;
  const displayMode = data?.displayMode ?? "single";
  const groups = data?.groups ?? [];

  if (displayMode === "single") {
    const imageCount = groups.reduce((sum, group) => sum + (group.images?.length ?? 0), 0);
    const rows = Math.max(1, Math.ceil(imageCount / 3));
    return 320 + rows * 220;
  }

  return 320 + Math.max(1, groups.length) * 240;
}
