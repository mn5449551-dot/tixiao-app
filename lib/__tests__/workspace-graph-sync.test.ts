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
        thumbnailUrl: null,
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
        thumbnailUrl: "/api/images/img_1/thumbnail",
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
    groups: Array<{ images: Array<{ fileUrl: string | null; thumbnailUrl?: string | null; status: string }> }>;
  };
  assert.equal(candidateData.groups[0]?.images[0]?.fileUrl, "/api/images/img_1/file?v=2");
  assert.equal(candidateData.groups[0]?.images[0]?.thumbnailUrl, "/api/images/img_1/thumbnail?v=2");
  assert.equal(candidateData.groups[0]?.images[0]?.status, "done");
  assert.equal(nextGraph.hasPendingImages, false);
});

test("reload decision ignores already-mounted candidate branches when another config starts producing images", () => {
  const graph = {
    projectId: "proj_1",
    nodes: [
      {
        id: "candidate-cfg_existing",
        type: "candidatePool" as const,
        position: { x: 0, y: 0 },
        data: {
          displayMode: "single" as const,
          groups: [
            {
              id: "grp_existing",
              variantIndex: 1,
              slotCount: 1,
              isConfirmed: false,
              images: [
                {
                  id: "img_existing",
                  fileUrl: "/api/images/img_existing/file?v=1",
                  status: "done" as const,
                  slotIndex: 1,
                },
              ],
            },
          ],
          status: "done" as const,
          imageConfigId: "cfg_existing",
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
        id: "img_existing",
        imageConfigId: "cfg_existing",
        fileUrl: "/api/images/img_existing/file",
        thumbnailUrl: null,
        status: "done" as const,
        errorMessage: null,
        updatedAt: 3,
      },
      {
        id: "img_new",
        imageConfigId: "cfg_new",
        fileUrl: "/api/images/img_new/file",
        thumbnailUrl: null,
        status: "done" as const,
        errorMessage: null,
        updatedAt: 4,
      },
    ],
  };

  assert.equal(shouldReloadGraphAfterStatusPoll(graph, payload), true);
});

test("status merge keeps unrelated existing candidate branches intact", () => {
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
                  fileUrl: "/api/images/img_1/file?v=1",
                  status: "done" as const,
                  slotIndex: 1,
                },
              ],
            },
          ],
          status: "done" as const,
          imageConfigId: "cfg_1",
        },
      },
      {
        id: "candidate-cfg_2",
        type: "candidatePool" as const,
        position: { x: 0, y: 1000 },
        data: {
          displayMode: "single" as const,
          groups: [
            {
              id: "grp_2",
              variantIndex: 1,
              slotCount: 1,
              isConfirmed: false,
              images: [
                {
                  id: "img_2",
                  fileUrl: null,
                  status: "generating" as const,
                  slotIndex: 1,
                },
              ],
            },
          ],
          status: "partial-success" as const,
          imageConfigId: "cfg_2",
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
        id: "img_2",
        imageConfigId: "cfg_2",
        fileUrl: "/api/images/img_2/file",
        thumbnailUrl: null,
        status: "done" as const,
        errorMessage: null,
        updatedAt: 5,
      },
    ],
  };

  const nextGraph = mergeGenerationStatusesIntoGraph(graph, payload);
  const candidateOne = nextGraph.nodes[0];
  const candidateTwo = nextGraph.nodes[1];

  assert.ok(candidateOne && candidateTwo);
  assert.equal((candidateOne.data as { groups: Array<{ images: Array<{ fileUrl: string | null }> }> }).groups[0]?.images[0]?.fileUrl, "/api/images/img_1/file?v=1");
  assert.equal((candidateTwo.data as { groups: Array<{ images: Array<{ fileUrl: string | null }> }> }).groups[0]?.images[0]?.fileUrl, "/api/images/img_2/file?v=5");
});

test("patches existing finalized node images in place when the node is already mounted", () => {
  const graph = {
    projectId: "proj_1",
    nodes: [
      {
        id: "finalized-cfg_1",
        type: "finalizedPool" as const,
        position: { x: 0, y: 0 },
        data: {
          displayMode: "single" as const,
          groups: [
            {
              id: "grp_1",
              variantIndex: 1,
              slotCount: 1,
              groupType: "finalized",
              images: [
                {
                  id: "img_1",
                  fileUrl: "/api/images/img_1/file?v=1",
                  thumbnailUrl: "/api/images/img_1/thumbnail?v=1",
                  aspectRatio: "1:1",
                  isConfirmed: true,
                  updatedAt: 1,
                },
              ],
            },
          ],
          groupLabel: "1 张已定稿",
          projectId: "proj_1",
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
        thumbnailUrl: "/api/images/img_1/thumbnail",
        status: "done" as const,
        errorMessage: null,
        updatedAt: 6,
      },
    ],
  };

  const nextGraph = mergeGenerationStatusesIntoGraph(graph, payload);
  const finalized = nextGraph.nodes[0];

  assert.ok(finalized && finalized.type === "finalizedPool");
  const finalizedData = finalized.data as {
    groups: Array<{ images: Array<{ fileUrl: string | null; thumbnailUrl?: string | null; updatedAt?: number }> }>;
  };
  assert.equal(finalizedData.groups[0]?.images[0]?.fileUrl, "/api/images/img_1/file?v=6");
  assert.equal(finalizedData.groups[0]?.images[0]?.thumbnailUrl, "/api/images/img_1/thumbnail?v=6");
  assert.equal(finalizedData.groups[0]?.images[0]?.updatedAt, 6);
});
