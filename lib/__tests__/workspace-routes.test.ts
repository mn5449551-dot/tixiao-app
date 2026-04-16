import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";

import * as projectRouteModule from "../../app/api/projects/[id]/route";
import * as requirementRouteModule from "../../app/api/projects/[id]/requirement/route";
import * as treeRouteModule from "../../app/api/projects/[id]/tree/route";
import * as graphRouteModule from "../../app/api/projects/[id]/graph/route";
import * as generationStatusRouteModule from "../../app/api/projects/[id]/generation-status/route";
import * as directionGenerateRouteModule from "../../app/api/projects/[id]/directions/generate/route";
import * as copyGenerateRouteModule from "../../app/api/directions/[id]/copy-cards/generate/route";
import * as copyCardRouteModule from "../../app/api/copy-cards/[id]/route";
import * as copyRouteModule from "../../app/api/copies/[id]/route";
import {
  createProject,
  upsertRequirement,
} from "../project-data";
import { getDb } from "../db";
import { copies, copyCards, directions, requirementCards } from "../schema";

// NOTE: generateDirections and generateCopyCard have been removed.
// Tests that use them are skipped pending mock-based rewrites.

const { GET: GET_PROJECT } = projectRouteModule;
const { GET: GET_TREE } = treeRouteModule;
const { GET: GET_GRAPH } = graphRouteModule;
const { GET: GET_GENERATION_STATUS } = generationStatusRouteModule;
const { POST: POST_DIRECTION_GENERATE } = directionGenerateRouteModule;
const { POST: POST_COPY_GENERATE } = copyGenerateRouteModule;
const { DELETE: DELETE_COPY_CARD } = copyCardRouteModule;
const { DELETE: DELETE_COPY } = copyRouteModule;

function seedCopyRouteFixture(): { projectId: string; directionId: string; copyCardId: string; copyId: string } {
  const db = getDb();
  const timestamp = Date.now();
  const suffix = `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;

  const project = createProject(`copy-route-${suffix}`);
  assert.ok(project);

  db.insert(requirementCards).values({
    id: `req_${suffix}`,
    projectId: project!.id,
    rawInput: null,
    businessGoal: "app",
    targetAudience: "parent",
    formatType: "image_text",
    feature: "拍题精学",
    sellingPoints: '["10秒出解析"]',
    timeNode: "期中考试",
    directionCount: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  db.insert(directions).values({
    id: `dir_${suffix}`,
    projectId: project!.id,
    requirementCardId: `req_${suffix}`,
    title: "方向测试",
    targetAudience: "家长",
    channel: "应用商店",
    imageForm: "single",
    copyGenerationCount: 1,
    imageTextRelation: "单图直给",
    sortOrder: 0,
    isSelected: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  db.insert(copyCards).values({
    id: `cc_${suffix}`,
    directionId: `dir_${suffix}`,
    channel: "应用商店",
    imageForm: "single",
    version: 1,
    sourceReason: "initial",
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  db.insert(copies).values({
    id: `copy_${suffix}`,
    copyCardId: `cc_${suffix}`,
    directionId: `dir_${suffix}`,
    titleMain: "主标题",
    titleSub: "副标题",
    titleExtra: null,
    copyType: "单图主副标题",
    variantIndex: 1,
    isLocked: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  return {
    projectId: project!.id,
    directionId: `dir_${suffix}`,
    copyCardId: `cc_${suffix}`,
    copyId: `copy_${suffix}`,
  };
}

function createMockChatCompletionResponse(content: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: typeof content === "string" ? content : JSON.stringify(content),
          },
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

test("project tree route returns 404 for a missing project", async () => {
  const response = await GET_TREE(new Request("http://localhost"), {
    params: Promise.resolve({ id: "missing-project" }),
  });

  assert.equal(response.status, 404);
});

test("project graph route returns 404 for a missing project", async () => {
  const response = await GET_GRAPH(new Request("http://localhost"), {
    params: Promise.resolve({ id: "missing-project" }),
  });

  assert.equal(response.status, 404);
});

test("project generation status route returns 404 for a missing project", async () => {
  const response = await GET_GENERATION_STATUS(new Request("http://localhost"), {
    params: Promise.resolve({ id: "missing-project" }),
  });

  assert.equal(response.status, 404);
});

test("project route returns only header-level project data", async () => {
  const project = createProject(`workspace-route-${Date.now()}`);
  assert.ok(project);

  const response = await GET_PROJECT(new Request("http://localhost"), {
    params: Promise.resolve({ id: project!.id }),
  });

  assert.equal(response.status, 200);

  const payload = (await response.json()) as Record<string, unknown>;
  assert.deepEqual(payload, {
    project: {
      id: project!.id,
      title: project!.title,
      status: project!.status,
    },
  });
});

test("copy card delete route rejects cards with downstream locked copies", async () => {
  const fixture = seedCopyRouteFixture();

  const response = await DELETE_COPY_CARD(new Request("http://localhost"), {
    params: Promise.resolve({ id: fixture.copyCardId }),
  });

  assert.equal(response.status, 422);
  const payload = (await response.json()) as { error?: string };
  assert.equal(payload.error, "已有下游内容，不能删除");
});

test("direction generate route returns JSON instead of SSE", async () => {
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.NEW_API_KEY;
  process.env.NEW_API_KEY = "test-key";

  const project = createProject(`direction-json-${Date.now()}`);
  assert.ok(project);
  upsertRequirement(project!.id, {
    targetAudience: "parent",
    feature: "拍题精学",
    sellingPoints: ["10 秒出解析"],
    timeNode: "期中考试",
    directionCount: 1,
  });

  globalThis.fetch = (async () =>
    createMockChatCompletionResponse({
      ideas: [
        {
          title: "方向一",
          targetAudience: "家长",
          adaptationStage: "期中考试",
          scenarioProblem: "作业卡壳",
          differentiation: "快速拆题",
          effect: "继续写下去",
        },
      ],
    })) as typeof fetch;

  try {
    const response = await POST_DIRECTION_GENERATE(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "应用商店", image_form: "single", copy_generation_count: 1 }),
      }),
      { params: Promise.resolve({ id: project!.id }) },
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.doesNotMatch(response.headers.get("content-type") ?? "", /text\/event-stream/);
  } finally {
    globalThis.fetch = previousFetch;
    process.env.NEW_API_KEY = previousApiKey;
  }
});

test("direction append route returns exactly one appended direction", async () => {
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.NEW_API_KEY;
  process.env.NEW_API_KEY = "test-key";

  const project = createProject(`direction-append-${Date.now()}`);
  assert.ok(project);
  upsertRequirement(project!.id, {
    targetAudience: "parent",
    feature: "拍题精学",
    sellingPoints: ["10 秒出解析"],
    timeNode: "期中考试",
    directionCount: 1,
  });

  globalThis.fetch = (async () =>
    createMockChatCompletionResponse({
      ideas: [
        {
          title: "新增方向",
          targetAudience: "家长",
          adaptationStage: "期中考试",
          scenarioProblem: "孩子卡题",
          differentiation: "快速拆解",
          effect: "继续写题",
        },
      ],
    })) as typeof fetch;

  try {
    const response = await POST_DIRECTION_GENERATE(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ append: true, channel: "应用商店", image_form: "single", copy_generation_count: 1 }),
      }),
      { params: Promise.resolve({ id: project!.id }) },
    );

    assert.equal(response.status, 200);
    const payload = (await response.json()) as { directions: Array<{ id: string }> };
    assert.equal(payload.directions.length, 1);
  } finally {
    globalThis.fetch = previousFetch;
    process.env.NEW_API_KEY = previousApiKey;
  }
});

test("copy generate route returns JSON instead of SSE", async () => {
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.NEW_API_KEY;
  process.env.NEW_API_KEY = "test-key";

  const fixture = seedCopyRouteFixture();

  getDb().update(copies).set({ isLocked: 0 }).where(eq(copies.id, fixture.copyId)).run();

  globalThis.fetch = (async () =>
    createMockChatCompletionResponse({
      copies: [
        {
          titleMain: "作业卡题别慌",
          titleSub: "拍一下就能看懂解题步骤",
          titleExtra: null,
          copyType: "单图主副标题",
        },
      ],
    })) as typeof fetch;

  try {
    const response = await POST_COPY_GENERATE(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 1 }),
      }),
      { params: Promise.resolve({ id: fixture.directionId }) },
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.doesNotMatch(response.headers.get("content-type") ?? "", /text\/event-stream/);
  } finally {
    globalThis.fetch = previousFetch;
    process.env.NEW_API_KEY = previousApiKey;
  }
});

test("requirement route returns JSON even when saving raw input recommendations", async () => {
  const project = createProject(`requirement-json-${Date.now()}`);
  assert.ok(project);

  const response = await requirementRouteModule.POST(
    new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_input: "家长，拍题精学，卖点是10秒出解析，期中考试，生成3个方向" }),
    }),
    { params: Promise.resolve({ id: project!.id }) },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.doesNotMatch(response.headers.get("content-type") ?? "", /text\/event-stream/);
});

test("copy delete route uses the unified downstream-delete guard message", async () => {
  const fixture = seedCopyRouteFixture();

  const response = await DELETE_COPY(new Request("http://localhost"), {
    params: Promise.resolve({ id: fixture.copyId }),
  });

  assert.equal(response.status, 422);
  const payload = (await response.json()) as { error?: string };
  assert.equal(payload.error, "已有下游内容，不能删除");
});
