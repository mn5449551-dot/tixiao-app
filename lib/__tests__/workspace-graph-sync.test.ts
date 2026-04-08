import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeGenerationStatusesIntoGraph,
  shouldReloadGraphAfterStatusPoll,
} from "../workspace-graph-sync";

test("reloads graph when a status poll reveals a displayable image for a missing candidate node", () => {
  const graph = {
    projectId: "proj_1",
    nodes: [],
    edges: [],
    hasPendingImages: true,
  };

  const payload = {
    projectId: "proj_1",
    images: [
      {
        id: "img_1",
        imageConfigId: "cfg_1",
        fileUrl: "/api/images/img_1/file",
        status: "done" as const,
        errorMessage: null,
        updatedAt: 1,
      },
    ],
  };

  assert.equal(shouldReloadGraphAfterStatusPoll(graph, payload), true);
});

test("patches existing candidate node images in place when the node already exists", () => {
  const graph = {
    projectId: "proj_1",
    nodes: [
      {
        id: "candidate-cfg_1",
        type: "candidatePool" as const,
        position: { x: 0, y: 0 },
        data: {
          displayMode: "single" as const,
          groups: [
            {
              id: "grp_1",
              variantIndex: 1,
              slotCount: 1,
              isConfirmed: false,
              images: [
                {
                  id: "img_1",
                  fileUrl: null,
                  status: "generating" as const,
                  slotIndex: 1,
                },
              ],
            },
          ],
          status: "partial-success" as const,
          imageConfigId: "cfg_1",
        },
      },
    ],
    edges: [],
    hasPendingImages: true,
  };

  const payload = {
    projectId: "proj_1",
    images: [
      {
        id: "img_1",
        imageConfigId: "cfg_1",
        fileUrl: "/api/images/img_1/file",
        status: "done" as const,
        errorMessage: null,
        updatedAt: 2,
      },
    ],
  };

  const nextGraph = mergeGenerationStatusesIntoGraph(graph, payload);
  const candidate = nextGraph.nodes[0];

  assert.ok(candidate && candidate.type === "candidatePool");
  const candidateData = candidate.data as {
    groups: Array<{ images: Array<{ fileUrl: string | null; status: string }> }>;
  };
  assert.equal(candidateData.groups[0]?.images[0]?.fileUrl, "/api/images/img_1/file");
  assert.equal(candidateData.groups[0]?.images[0]?.status, "done");
  assert.equal(nextGraph.hasPendingImages, false);
});
