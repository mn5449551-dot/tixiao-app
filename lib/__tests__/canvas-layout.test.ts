import test from "node:test";
import assert from "node:assert/strict";

import { arrangeNodesByHierarchy, mergeGraphNodes } from "../canvas-layout";

test("arrangeNodesByHierarchy places nodes by tier from left to right", () => {
  const nodes = [
    { id: "copy-2", type: "copyCard", position: { x: 0, y: 400 }, data: { copyItems: [{}, {}] } },
    { id: "requirement", type: "requirementCard", position: { x: 0, y: 0 }, data: {} },
    { id: "direction", type: "directionCard", position: { x: 0, y: 0 }, data: { directions: [{}, {}] } },
    { id: "copy-1", type: "copyCard", position: { x: 0, y: 100 }, data: { copyItems: [{}, {}] } },
  ] as const;

  const layout = arrangeNodesByHierarchy(nodes);

  assert.equal(layout[0]?.position.x, 1180);
  assert.equal(layout[1]?.position.x, 40);
  assert.equal(layout[2]?.position.x, 500);
  assert.equal(layout[3]?.position.x, 1180);
  assert.ok((layout[0]?.position.y ?? 0) > (layout[3]?.position.y ?? 0));
});

test("arrangeNodesByHierarchy keeps sibling cards separated vertically", () => {
  const nodes = [
    { id: "copy-1", type: "copyCard", position: { x: 0, y: 0 }, data: { copyItems: [{}, {}, {}] } },
    { id: "copy-2", type: "copyCard", position: { x: 0, y: 100 }, data: { copyItems: [{}, {}] } },
  ] as const;

  const layout = arrangeNodesByHierarchy(nodes);
  const first = layout.find((node) => node.id === "copy-1");
  const second = layout.find((node) => node.id === "copy-2");

  assert.ok(first && second);
  assert.ok(second.position.y - first.position.y >= 420);
});

test("mergeGraphNodes preserves existing positions while updating node data", () => {
  const current = [
    { id: "copy-1", type: "copyCard", position: { x: 111, y: 222 }, data: { title: "old" } },
  ];
  const next = [
    { id: "copy-1", type: "copyCard", position: { x: 970, y: 80 }, data: { title: "new" } },
    { id: "copy-2", type: "copyCard", position: { x: 970, y: 500 }, data: { title: "fresh" } },
  ];

  const merged = mergeGraphNodes(current, next);

  assert.deepEqual(merged[0]?.position, { x: 111, y: 222 });
  assert.deepEqual(merged[0]?.data, { title: "new" });
  assert.deepEqual(merged[1]?.position, { x: 970, y: 500 });
});

test("arrangeNodesByHierarchy keeps image branches aligned with safe spacing for candidate and finalized pools", () => {
  const nodes = [
    {
      id: "image-config-cfg_1",
      type: "imageConfigCard",
      position: { x: 0, y: 100 },
      data: {},
    },
    {
      id: "candidate-cfg_1",
      type: "candidatePool",
      position: { x: 0, y: 100 },
      data: {
        displayMode: "single",
        groups: Array.from({ length: 4 }, (_, index) => ({
          id: `grp_${index + 1}`,
          variantIndex: index + 1,
          slotCount: 1,
          isConfirmed: false,
          images: [{ id: `img_${index + 1}`, status: "done", fileUrl: "/x.png", slotIndex: 1, aspectRatio: "1:1" }],
        })),
      },
    },
    {
      id: "finalized-cfg_1",
      type: "finalizedPool",
      position: { x: 0, y: 100 },
      data: {
        displayMode: "triple",
        groups: Array.from({ length: 4 }, (_, index) => ({
          id: `final_${index + 1}`,
          variantIndex: index + 1,
          slotCount: 3,
          images: Array.from({ length: 3 }, (__unused, imageIndex) => ({
            id: `fimg_${index + 1}_${imageIndex + 1}`,
            fileUrl: "/x.png",
            aspectRatio: "3:2",
            isConfirmed: true,
          })),
        })),
      },
    },
    {
      id: "image-config-cfg_2",
      type: "imageConfigCard",
      position: { x: 0, y: 400 },
      data: {},
    },
    {
      id: "candidate-cfg_2",
      type: "candidatePool",
      position: { x: 0, y: 400 },
      data: {
        displayMode: "single",
        groups: [{
          id: "grp_5",
          variantIndex: 1,
          slotCount: 1,
          isConfirmed: false,
          images: [{ id: "img_5", status: "done", fileUrl: "/x.png", slotIndex: 1, aspectRatio: "1:1" }],
        }],
      },
    },
    {
      id: "finalized-cfg_2",
      type: "finalizedPool",
      position: { x: 0, y: 400 },
      data: {
        displayMode: "single",
        groups: [{
          id: "final_5",
          variantIndex: 1,
          slotCount: 1,
          images: [{ id: "fimg_5", fileUrl: "/x.png", aspectRatio: "1:1", isConfirmed: true }],
        }],
      },
    },
  ] as const;

  const layout = arrangeNodesByHierarchy(nodes);
  const configOne = layout.find((node) => node.id === "image-config-cfg_1");
  const candidateOne = layout.find((node) => node.id === "candidate-cfg_1");
  const finalizedOne = layout.find((node) => node.id === "finalized-cfg_1");
  const configTwo = layout.find((node) => node.id === "image-config-cfg_2");
  const candidateTwo = layout.find((node) => node.id === "candidate-cfg_2");
  const finalizedTwo = layout.find((node) => node.id === "finalized-cfg_2");

  assert.ok(configOne && candidateOne && finalizedOne && configTwo && candidateTwo && finalizedTwo);
  assert.equal(configOne.position.y, candidateOne.position.y);
  assert.equal(candidateOne.position.y, finalizedOne.position.y);
  assert.ok(candidateTwo.position.y - candidateOne.position.y >= 1200);
  assert.ok(finalizedOne.position.x - candidateOne.position.x >= 450);
  assert.equal(configTwo.position.y, candidateTwo.position.y);
  assert.equal(candidateTwo.position.y, finalizedTwo.position.y);
});

test("arrangeNodesByHierarchy uses measured node heights when available to avoid overlap", () => {
  const nodes = [
    {
      id: "image-config-cfg_a",
      type: "imageConfigCard",
      position: { x: 0, y: 80 },
      measured: { width: 340, height: 920 },
      data: {},
    },
    {
      id: "candidate-cfg_a",
      type: "candidatePool",
      position: { x: 0, y: 80 },
      measured: { width: 440, height: 520 },
      data: {
        displayMode: "single",
        groups: [{ id: "grp_a", variantIndex: 1, slotCount: 1, isConfirmed: false, images: [] }],
      },
    },
    {
      id: "finalized-cfg_a",
      type: "finalizedPool",
      position: { x: 0, y: 80 },
      measured: { width: 480, height: 420 },
      data: {
        displayMode: "single",
        groups: [{ id: "final_a", variantIndex: 1, slotCount: 1, images: [] }],
      },
    },
    {
      id: "image-config-cfg_b",
      type: "imageConfigCard",
      position: { x: 0, y: 120 },
      measured: { width: 340, height: 620 },
      data: {},
    },
    {
      id: "candidate-cfg_b",
      type: "candidatePool",
      position: { x: 0, y: 120 },
      measured: { width: 440, height: 300 },
      data: {
        displayMode: "single",
        groups: [{ id: "grp_b", variantIndex: 1, slotCount: 1, isConfirmed: false, images: [] }],
      },
    },
    {
      id: "finalized-cfg_b",
      type: "finalizedPool",
      position: { x: 0, y: 120 },
      measured: { width: 480, height: 300 },
      data: {
        displayMode: "single",
        groups: [{ id: "final_b", variantIndex: 1, slotCount: 1, images: [] }],
      },
    },
  ] as const;

  const layout = arrangeNodesByHierarchy(nodes);
  const configA = layout.find((node) => node.id === "image-config-cfg_a");
  const configB = layout.find((node) => node.id === "image-config-cfg_b");

  assert.ok(configA && configB);
  assert.ok(configB.position.y - configA.position.y >= 1000);
});

test("arrangeNodesByHierarchy keeps widened direction and copy columns from overlapping", () => {
  const nodes = [
    {
      id: "direction-board",
      type: "directionCard",
      position: { x: 0, y: 80 },
      measured: { width: 620, height: 520 },
      data: { directions: [{}, {}, {}, {}, {}, {}] },
    },
    {
      id: "copy-card-1",
      type: "copyCard",
      position: { x: 0, y: 80 },
      measured: { width: 400, height: 520 },
      data: { copyItems: [{}, {}, {}] },
    },
  ] as const;

  const layout = arrangeNodesByHierarchy(nodes);
  const direction = layout.find((node) => node.id === "direction-board");
  const copy = layout.find((node) => node.id === "copy-card-1");

  assert.ok(direction && copy);
  assert.ok(copy.position.x - direction.position.x >= 620);
});
