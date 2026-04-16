import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import type { EdgeMarkerType } from "@xyflow/react";

import {
  CHANNELS,
  FEATURE_LIBRARY,
  IMAGE_MODELS,
  IMAGE_STYLES,
  IP_ROLES,
  LOGO_OPTIONS,
} from "../constants";
import { buildGraph } from "../workflow-graph";

test("workflow graph delegates pool node construction to dedicated builders", async () => {
  const source = await readFile(new URL("../workflow-graph.ts", import.meta.url), "utf8");

  assert.match(source, /buildCandidatePoolNode/);
  assert.match(source, /buildFinalizedPoolNode/);
  assert.match(source, /buildImageConfigNode/);
  assert.match(source, /markerEnd:\s*\{\s*type:\s*"arrowclosed"/);
  assert.doesNotMatch(source, /MarkerType\.ArrowClosed/);
});

test("buildGraph keeps the canvas free of direction nodes before directions are generated", () => {
  const graph = buildGraph({
    project: {
      id: "proj_empty",
      title: "P-empty",
      status: "draft",
      folderId: null,
      createdAt: 0,
      updatedAt: 0,
    },
    requirement: {
      id: "req_empty",
      projectId: "proj_empty",
      rawInput: null,
      businessGoal: "app",
      targetAudience: "parent",
      formatType: "image_text",
      feature: "拍题精学",
      sellingPoints: ["10 秒出解析"],
      timeNode: "期中考试",
      directionCount: 3,
      createdAt: 0,
      updatedAt: 0,
    },
    directions: [],
    meta: {
      availableChannels: CHANNELS,
      availableFeatures: FEATURE_LIBRARY,
      availableAspectRatios: IMAGE_MODELS[0].aspectRatios,
      availableImageStyles: IMAGE_STYLES,
      availableLogoOptions: LOGO_OPTIONS,
      availableIpRoles: IP_ROLES,
    },
  });

  const directionCardNode = graph.nodes.find((node) => node.id === "direction-board");
  const placeholderNode = graph.nodes.find((node) => node.id === "directions-empty");

  assert.equal(directionCardNode, undefined);
  assert.equal(placeholderNode, undefined);
  assert.equal(graph.nodes.length, 1);
});

test("buildGraph creates row-level source handles and shows candidate pool when candidate groups exist", () => {
  const graph = buildGraph({
    project: {
      id: "proj_1",
      title: "P1",
      status: "active",
      folderId: null,
      createdAt: 0,
      updatedAt: 0,
    },
    requirement: {
      id: "req_1",
      projectId: "proj_1",
      rawInput: null,
      businessGoal: "app",
      targetAudience: "parent",
      formatType: "image_text",
      feature: "F001",
      sellingPoints: ["F001-S01"],
      timeNode: "期中考试",
      directionCount: 2,
      createdAt: 0,
      updatedAt: 0,
    },
    directions: [
      {
        id: "dir_1",
        projectId: "proj_1",
        requirementCardId: "req_1",
        title: "方向1",
        targetAudience: "家长",
        adaptationStage: "期中考试",
        scenarioProblem: "场景1",
        differentiation: "解法1",
        effect: "效果1",
        channel: "信息流（广点通）",
        imageForm: "single",
        copyGenerationCount: 3,
        imageTextRelation: "单图直给",
        sortOrder: 0,
        isSelected: 1,
        createdAt: 0,
        updatedAt: 0,
        copyCards: [
          {
            id: "card_1",
            directionId: "dir_1",
            channel: "信息流（广点通）",
            imageForm: "single",
            version: 1,
            sourceReason: "initial",
            createdAt: 0,
            updatedAt: 0,
            copies: [
              {
                id: "copy_1",
                copyCardId: "card_1",
                directionId: "dir_1",
                titleMain: "主标题1",
                titleSub: "副标题1",
                titleExtra: null,
                copyType: "单图主副标题",
                variantIndex: 1,
                isLocked: 1,
                createdAt: 0,
                updatedAt: 0,
                imageConfig: {
                  id: "cfg_1",
                  copyId: "copy_1",
                  directionId: "dir_1",
                  aspectRatio: "1:1",
                  styleMode: "normal",
                  ipRole: null,
                  logo: "onion",
                  imageStyle: "realistic",
                  referenceImageUrl: null,
                  ctaEnabled: 0,
                  ctaText: null,
                  promptBundleJson: null,
                  count: 1,
                  imageModel: null,
                  createdAt: 0,
                  updatedAt: 0,
                },
                groups: [
                  {
                    id: "grp_1",
                    imageConfigId: "cfg_1",
                    groupType: "candidate",
                    variantIndex: 1,
                    slotCount: 1,
                    aspectRatio: "1:1",
                    styleMode: "normal",
                    imageStyle: "realistic",
                    promptBundleJson: null,
                    referenceImageUrl: null,
                    logo: "onion",
                    isConfirmed: 0,
                    createdAt: 0,
                    updatedAt: 0,
                    imageModel: null,
                    images: [
                      {
                        id: "img_1",
                        imageGroupId: "grp_1",
                        imageConfigId: "cfg_1",
                        slotIndex: 1,
                        filePath: "/tmp/img_1.png",
                        fileUrl: "/api/images/img_1/file",
                        status: "done",
                        inpaintParentId: null,
                        errorMessage: null,
                        finalPromptText: "真实正向提示词",
                        finalNegativePrompt: "真实负向提示词",
                        generationRequestJson: JSON.stringify({
                          promptText: "真实正向提示词",
                          negativePrompt: "真实负向提示词",
                          model: "doubao-seedream-4-0",
                          aspectRatio: "1:1",
                          referenceImages: [{ url: "/api/reference/demo.png" }],
                        }),
                        seed: 1,
                        thumbnailPath: null,
                        thumbnailUrl: null,
                        promptType: null,
                        createdAt: 0,
                        updatedAt: 0,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    meta: {
      availableChannels: CHANNELS,
      availableFeatures: FEATURE_LIBRARY,
      availableAspectRatios: IMAGE_MODELS[0].aspectRatios,
      availableImageStyles: IMAGE_STYLES,
      availableLogoOptions: LOGO_OPTIONS,
      availableIpRoles: IP_ROLES,
    },
  });

  const directionToCopy = graph.edges.find((edge) => edge.target === "copy-card-card_1");
  const copyToConfig = graph.edges.find((edge) => edge.target === "image-config-cfg_1");
  const requirementToDirection = graph.edges.find((edge) => edge.target === "direction-board");

  assert.equal(directionToCopy?.sourceHandle, "direction-row-dir_1");
  assert.equal(copyToConfig?.sourceHandle, "copy-row-copy_1");
  assert.equal(
    (requirementToDirection?.markerEnd as Extract<EdgeMarkerType, { type: string }> | undefined)?.type,
    "arrowclosed",
  );

  const candidateNode = graph.nodes.find((node) => node.id === "candidate-cfg_1");
  const finalizedNode = graph.nodes.find((node) => node.id === "finalized-cfg_1");

  assert.ok(candidateNode && "displayMode" in candidateNode.data);
  assert.ok(candidateNode && "imageModel" in candidateNode.data);
  const candidateImage = candidateNode.data.groups[0]?.images[0];
  assert.ok(candidateImage && "promptDetails" in candidateImage);
  assert.equal(candidateImage.promptDetails?.promptText, "真实正向提示词");
  assert.equal(candidateImage.promptDetails?.negativePrompt, "真实负向提示词");
  assert.equal(candidateImage.promptDetails?.model, "doubao-seedream-4-0");
  assert.equal(candidateImage.promptDetails?.aspectRatio, "1:1");
  assert.equal(candidateImage.promptDetails?.hasSnapshot, true);
  assert.equal(candidateImage.promptDetails?.referenceImages[0]?.url, "/api/reference/demo.png");
  assert.equal(candidateNode.data.displayMode, "single");
  assert.ok("groups" in candidateNode.data);
  assert.equal(candidateNode.data.groups[0]?.id, "grp_1");
  assert.equal(candidateNode.data.groups[0]?.images[0]?.fileUrl, "/api/images/img_1/file?v=0");
  assert.equal(candidateNode.data.groups[0]?.images[0]?.aspectRatio, "1:1");
  assert.equal(finalizedNode, undefined);
});

test("buildGraph keeps image config card interactive while candidate images are still generating", () => {
  const graph = buildGraph({
    project: {
      id: "proj_cfg",
      title: "P-cfg",
      status: "active",
      folderId: null,
      createdAt: 0,
      updatedAt: 0,
    },
    requirement: {
      id: "req_cfg",
      projectId: "proj_cfg",
      rawInput: null,
      businessGoal: "app",
      targetAudience: "parent",
      formatType: "image_text",
      feature: "拍题精学",
      sellingPoints: ["10 秒出解析"],
      timeNode: "期中考试",
      directionCount: 1,
      createdAt: 0,
      updatedAt: 0,
    },
    directions: [
      {
        id: "dir_cfg",
        projectId: "proj_cfg",
        requirementCardId: "req_cfg",
        title: "方向cfg",
        targetAudience: "家长",
        adaptationStage: "期中考试",
        scenarioProblem: "场景cfg",
        differentiation: "解法cfg",
        effect: "效果cfg",
        channel: "应用商店",
        imageForm: "single",
        copyGenerationCount: 1,
        imageTextRelation: "单图直给",
        sortOrder: 0,
        isSelected: 1,
        createdAt: 0,
        updatedAt: 0,
        copyCards: [
          {
            id: "card_cfg",
            directionId: "dir_cfg",
            channel: "应用商店",
            imageForm: "single",
            version: 1,
            sourceReason: "initial",
            createdAt: 0,
            updatedAt: 0,
            copies: [
              {
                id: "copy_cfg",
                copyCardId: "card_cfg",
                directionId: "dir_cfg",
                titleMain: "主标题cfg",
                titleSub: "副标题cfg",
                titleExtra: null,
                copyType: "单图主副标题",
                variantIndex: 1,
                isLocked: 1,
                createdAt: 0,
                updatedAt: 0,
                imageConfig: {
                  id: "cfg_pending",
                  copyId: "copy_cfg",
                  directionId: "dir_cfg",
                  aspectRatio: "1:1",
                  styleMode: "normal",
                  ipRole: null,
                  logo: "onion",
                  imageStyle: "realistic",
                  referenceImageUrl: null,
                  ctaEnabled: 0,
                  ctaText: null,
                  promptBundleJson: null,
                  count: 1,
                  imageModel: null,
                  createdAt: 0,
                  updatedAt: 0,
                },
                groups: [
                  {
                    id: "grp_pending",
                    imageConfigId: "cfg_pending",
                    groupType: "candidate",
                    variantIndex: 1,
                    slotCount: 1,
                    aspectRatio: "1:1",
                    styleMode: "normal",
                    imageStyle: "realistic",
                    promptBundleJson: null,
                    referenceImageUrl: null,
                    logo: "onion",
                    isConfirmed: 0,
                    createdAt: 0,
                    updatedAt: 0,
                    imageModel: null,
                    images: [
                      {
                        id: "img_pending",
                        imageGroupId: "grp_pending",
                        imageConfigId: "cfg_pending",
                        slotIndex: 1,
                        filePath: null,
                        fileUrl: null,
                        status: "pending",
                        inpaintParentId: null,
                        errorMessage: null,
                        finalPromptText: null,
                        finalNegativePrompt: null,
                        generationRequestJson: null,
                        seed: 1,
                        thumbnailPath: null,
                        thumbnailUrl: null,
                        promptType: null,
                        createdAt: 0,
                        updatedAt: 0,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    meta: {
      availableChannels: CHANNELS,
      availableFeatures: FEATURE_LIBRARY,
      availableAspectRatios: IMAGE_MODELS[0].aspectRatios,
      availableImageStyles: IMAGE_STYLES,
      availableLogoOptions: LOGO_OPTIONS,
      availableIpRoles: IP_ROLES,
    },
  });

  const configNode = graph.nodes.find((node) => node.id === "image-config-cfg_pending");
  const candidateNode = graph.nodes.find((node) => node.id === "candidate-cfg_pending");

  assert.ok(configNode && "status" in configNode.data);
  assert.equal(configNode.data.status, "idle");
  assert.ok(candidateNode && "status" in candidateNode.data);
  assert.equal(candidateNode.data.status, "partial-success");
  assert.ok(candidateNode && "groups" in candidateNode.data);
  const candidateImage = candidateNode.data.groups[0]?.images[0];
  assert.ok(candidateImage && "promptDetails" in candidateImage);
  assert.equal(candidateImage.promptDetails?.hasSnapshot, false);
});

test("buildGraph keeps candidate pool visible while images are still pending", () => {
  const graph = buildGraph({
    project: {
      id: "proj_1",
      title: "P1",
      status: "active",
      folderId: null,
      createdAt: 0,
      updatedAt: 0,
    },
    requirement: {
      id: "req_1",
      projectId: "proj_1",
      rawInput: null,
      businessGoal: "app",
      targetAudience: "parent",
      formatType: "image_text",
      feature: "F001",
      sellingPoints: ["F001-S01"],
      timeNode: "期中考试",
      directionCount: 1,
      createdAt: 0,
      updatedAt: 0,
    },
    directions: [
      {
        id: "dir_1",
        projectId: "proj_1",
        requirementCardId: "req_1",
        title: "方向1",
        targetAudience: "家长",
        adaptationStage: "期中考试",
        scenarioProblem: "场景1",
        differentiation: "解法1",
        effect: "效果1",
        channel: "信息流（广点通）",
        imageForm: "single",
        copyGenerationCount: 3,
        imageTextRelation: "单图直给",
        sortOrder: 0,
        isSelected: 1,
        createdAt: 0,
        updatedAt: 0,
        copyCards: [
          {
            id: "card_1",
            directionId: "dir_1",
            channel: "信息流（广点通）",
            imageForm: "single",
            version: 1,
            sourceReason: "initial",
            createdAt: 0,
            updatedAt: 0,
            copies: [
              {
                id: "copy_1",
                copyCardId: "card_1",
                directionId: "dir_1",
                titleMain: "主标题1",
                titleSub: "副标题1",
                titleExtra: null,
                copyType: "单图主副标题",
                variantIndex: 1,
                isLocked: 1,
                createdAt: 0,
                updatedAt: 0,
                imageConfig: {
                  id: "cfg_1",
                  copyId: "copy_1",
                  directionId: "dir_1",
                  aspectRatio: "1:1",
                  styleMode: "normal",
                  ipRole: null,
                  logo: "onion",
                  imageStyle: "realistic",
                  referenceImageUrl: null,
                  ctaEnabled: 0,
                  ctaText: null,
                  promptBundleJson: null,
                  count: 1,
                  imageModel: null,
                  createdAt: 0,
                  updatedAt: 0,
                },
                groups: [
                  {
                    id: "grp_1",
                    imageConfigId: "cfg_1",
                    groupType: "candidate",
                    variantIndex: 1,
                    slotCount: 1,
                    aspectRatio: "1:1",
                    styleMode: "normal",
                    imageStyle: "realistic",
                    promptBundleJson: null,
                    referenceImageUrl: null,
                    logo: "onion",
                    isConfirmed: 0,
                    createdAt: 0,
                    updatedAt: 0,
                    imageModel: null,
                    images: [
                      {
                        id: "img_1",
                        imageGroupId: "grp_1",
                        imageConfigId: "cfg_1",
                        slotIndex: 1,
                        filePath: null,
                        fileUrl: null,
                        status: "pending",
                        inpaintParentId: null,
                        errorMessage: null,
                        finalPromptText: null,
                        finalNegativePrompt: null,
                        generationRequestJson: null,
                        seed: 1,
                        thumbnailPath: null,
                        thumbnailUrl: null,
                        promptType: null,
                        createdAt: 0,
                        updatedAt: 0,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    meta: {
      availableChannels: CHANNELS,
      availableFeatures: FEATURE_LIBRARY,
      availableAspectRatios: IMAGE_MODELS[0].aspectRatios,
      availableImageStyles: IMAGE_STYLES,
      availableLogoOptions: LOGO_OPTIONS,
      availableIpRoles: IP_ROLES,
    },
  });

  const candidateNode = graph.nodes.find((node) => node.id === "candidate-cfg_1");
  assert.ok(candidateNode && "status" in candidateNode.data);
  assert.equal(candidateNode.data.status, "partial-success");
  assert.equal(graph.nodes.find((node) => node.id === "finalized-cfg_1"), undefined);
});

test("buildGraph keeps derived finalized groups out of candidate pool but shows them in finalized pool", () => {
  const graph = buildGraph({
    project: {
      id: "proj_2",
      title: "P2",
      status: "active",
      folderId: null,
      createdAt: 0,
      updatedAt: 0,
    },
    requirement: {
      id: "req_2",
      projectId: "proj_2",
      rawInput: null,
      businessGoal: "app",
      targetAudience: "parent",
      formatType: "image_text",
      feature: "拍题精学",
      sellingPoints: ["10 秒出解析"],
      timeNode: "期中考试",
      directionCount: 1,
      createdAt: 0,
      updatedAt: 0,
    },
    directions: [
      {
        id: "dir_2",
        projectId: "proj_2",
        requirementCardId: "req_2",
        title: "方向2",
        targetAudience: "家长",
        adaptationStage: "期中考试",
        scenarioProblem: "场景2",
        differentiation: "解法2",
        effect: "效果2",
        channel: "应用商店",
        imageForm: "single",
        copyGenerationCount: 1,
        imageTextRelation: "单图直给",
        sortOrder: 0,
        isSelected: 1,
        createdAt: 0,
        updatedAt: 0,
        copyCards: [
          {
            id: "card_2",
            directionId: "dir_2",
            channel: "应用商店",
            imageForm: "single",
            version: 1,
            sourceReason: "initial",
            createdAt: 0,
            updatedAt: 0,
            copies: [
              {
                id: "copy_2",
                copyCardId: "card_2",
                directionId: "dir_2",
                titleMain: "主标题2",
                titleSub: "副标题2",
                titleExtra: null,
                copyType: "单图主副标题",
                variantIndex: 1,
                isLocked: 1,
                createdAt: 0,
                updatedAt: 0,
                imageConfig: {
                  id: "cfg_2",
                  copyId: "copy_2",
                  directionId: "dir_2",
                  aspectRatio: "1:1",
                  styleMode: "normal",
                  ipRole: null,
                  logo: "onion",
                  imageStyle: "realistic",
                  referenceImageUrl: null,
                  ctaEnabled: 0,
                  ctaText: null,
                  promptBundleJson: null,
                  count: 1,
                  imageModel: null,
                  createdAt: 0,
                  updatedAt: 0,
                },
                groups: [
                  {
                    id: "grp_2",
                    imageConfigId: "cfg_2",
                    groupType: "finalized",
                    variantIndex: 1,
                    slotCount: 1,
                    aspectRatio: "1:1",
                    styleMode: "normal",
                    imageStyle: "realistic",
                    promptBundleJson: null,
                    referenceImageUrl: null,
                    logo: "onion",
                    isConfirmed: 1,
                    createdAt: 0,
                    updatedAt: 0,
                    imageModel: null,
                    images: [
                      {
                        id: "img_2",
                        imageGroupId: "grp_2",
                        imageConfigId: "cfg_2",
                        slotIndex: 1,
                        filePath: "/tmp/img_2.png",
                        fileUrl: "/api/images/img_2/file",
                        status: "done",
                        inpaintParentId: null,
                        errorMessage: null,
                        finalPromptText: null,
                        finalNegativePrompt: null,
                        generationRequestJson: null,
                        seed: 2,
                        thumbnailPath: null,
                        thumbnailUrl: null,
                        promptType: null,
                        createdAt: 0,
                        updatedAt: 0,
                      },
                    ],
                  },
                  {
                    id: "grp_2_derived",
                    imageConfigId: "cfg_2",
                    groupType: "derived|grp_2|16:9",
                    variantIndex: 2,
                    slotCount: 1,
                    aspectRatio: "16:9",
                    styleMode: "normal",
                    imageStyle: "realistic",
                    promptBundleJson: null,
                    referenceImageUrl: null,
                    logo: "onion",
                    isConfirmed: 1,
                    createdAt: 0,
                    updatedAt: 0,
                    imageModel: null,
                    images: [
                      {
                        id: "img_2_derived",
                        imageGroupId: "grp_2_derived",
                        imageConfigId: "cfg_2",
                        slotIndex: 1,
                        filePath: "/tmp/img_2_derived.png",
                        fileUrl: "/api/images/img_2_derived/file",
                        status: "done",
                        inpaintParentId: "img_2",
                        errorMessage: null,
                        finalPromptText: null,
                        finalNegativePrompt: null,
                        generationRequestJson: null,
                        seed: 3,
                        thumbnailPath: null,
                        thumbnailUrl: null,
                        promptType: null,
                        createdAt: 0,
                        updatedAt: 0,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    meta: {
      availableChannels: CHANNELS,
      availableFeatures: FEATURE_LIBRARY,
      availableAspectRatios: IMAGE_MODELS[0].aspectRatios,
      availableImageStyles: IMAGE_STYLES,
      availableLogoOptions: LOGO_OPTIONS,
      availableIpRoles: IP_ROLES,
    },
  });

  const candidateNode = graph.nodes.find((node) => node.id === "candidate-cfg_2");
  const finalizedNode = graph.nodes.find((node) => node.id === "finalized-cfg_2");

  assert.ok(candidateNode && "groups" in candidateNode.data);
  assert.equal(candidateNode.data.groups.length, 1);
  assert.equal(candidateNode.data.groups[0]?.images[0]?.fileUrl, "/api/images/img_2/file?v=0");
  assert.ok(finalizedNode && "groups" in finalizedNode.data);
  assert.equal(finalizedNode.data.groups.length, 2);
  assert.equal(finalizedNode.data.groups[0]?.images[0]?.fileUrl, "/api/images/img_2/file?v=0");
  assert.equal(finalizedNode.data.groups[1]?.images[0]?.fileUrl, "/api/images/img_2_derived/file?v=0");
});
