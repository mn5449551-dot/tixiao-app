import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import * as projectsRouteModule from "../../app/api/projects/route";
import * as projectRouteModule from "../../app/api/projects/[id]/route";
import * as requirementRouteModule from "../../app/api/projects/[id]/requirement/route";
import * as treeRouteModule from "../../app/api/projects/[id]/tree/route";
import * as graphRouteModule from "../../app/api/projects/[id]/graph/route";
import * as generationStatusRouteModule from "../../app/api/projects/[id]/generation-status/route";
import * as directionGenerateRouteModule from "../../app/api/projects/[id]/directions/generate/route";
import * as copyGenerateRouteModule from "../../app/api/directions/[id]/copy-cards/generate/route";
import * as copyCardRouteModule from "../../app/api/copy-cards/[id]/route";
import {
  createProject,
  generateCopyCard,
  generateDirections,
  saveImageConfig,
  upsertRequirement,
} from "../project-data";

const { GET: GET_PROJECTS } = projectsRouteModule;
const { GET: GET_PROJECT } = projectRouteModule;
const { GET: GET_REQUIREMENT } = requirementRouteModule;
const { GET: GET_TREE } = treeRouteModule;
const { GET: GET_GRAPH } = graphRouteModule;
const { GET: GET_GENERATION_STATUS } = generationStatusRouteModule;
const { POST: POST_DIRECTION_GENERATE } = directionGenerateRouteModule;
const { POST: POST_COPY_GENERATE } = copyGenerateRouteModule;
const { DELETE: DELETE_COPY_CARD } = copyCardRouteModule;

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
  const project = createProject(`copy-card-delete-guard-${Date.now()}`);
  assert.ok(project);

  upsertRequirement(project!.id, {
    targetAudience: "parent",
    feature: "拍题精学",
    sellingPoints: ["10 秒出解析"],
    timeNode: "期中考试",
    directionCount: 1,
  });

  const [direction] = generateDirections(project!.id, "应用商店", "single", 1);
  assert.ok(direction);

  const card = generateCopyCard(direction.id, 1);
  assert.ok(card);

  const config = await saveImageConfig(card!.copies[0]!.id, {
    aspectRatio: "1:1",
    styleMode: "normal",
    logo: "none",
    imageStyle: "realistic",
    count: 1,
  });
  assert.ok(config);

  const response = await DELETE_COPY_CARD(new Request("http://localhost"), {
    params: Promise.resolve({ id: card!.id }),
  });

  assert.equal(response.status, 422);
});

test("direction generate route returns JSON instead of SSE", async () => {
  const project = createProject(`direction-json-${Date.now()}`);
  assert.ok(project);

  upsertRequirement(project!.id, {
    targetAudience: "parent",
    feature: "拍题精学",
    sellingPoints: ["10 秒出解析"],
    timeNode: "期中考试",
    directionCount: 2,
  });

  const response = await POST_DIRECTION_GENERATE(
    new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "应用商店",
        image_form: "double",
        copy_generation_count: 2,
        use_ai: false,
      }),
    }),
    { params: Promise.resolve({ id: project!.id }) },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
});

test("copy generate route returns JSON instead of SSE", async () => {
  const project = createProject(`copy-json-${Date.now()}`);
  assert.ok(project);

  upsertRequirement(project!.id, {
    targetAudience: "parent",
    feature: "拍题精学",
    sellingPoints: ["10 秒出解析"],
    timeNode: "期中考试",
    directionCount: 1,
  });

  const [direction] = generateDirections(project!.id, "应用商店", "double", 3);
  assert.ok(direction);

  const response = await POST_COPY_GENERATE(
    new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 2, use_ai: false }),
    }),
    { params: Promise.resolve({ id: direction.id }) },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
});
