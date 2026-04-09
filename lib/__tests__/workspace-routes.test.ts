import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import * as projectsRouteModule from "../../app/api/projects/route";
import * as projectRouteModule from "../../app/api/projects/[id]/route";
import * as requirementRouteModule from "../../app/api/projects/[id]/requirement/route";
import * as treeRouteModule from "../../app/api/projects/[id]/tree/route";
import * as graphRouteModule from "../../app/api/projects/[id]/graph/route";
import * as generationStatusRouteModule from "../../app/api/projects/[id]/generation-status/route";
import { createProject } from "../project-data";

const { GET: GET_PROJECTS } = projectsRouteModule;
const { GET: GET_PROJECT } = projectRouteModule;
const { GET: GET_REQUIREMENT } = requirementRouteModule;
const { GET: GET_TREE } = treeRouteModule;
const { GET: GET_GRAPH } = graphRouteModule;
const { GET: GET_GENERATION_STATUS } = generationStatusRouteModule;
const projectsRoutePath = new URL("../../app/api/projects/route.ts", import.meta.url);
const requirementRoutePath = new URL("../../app/api/projects/[id]/requirement/route.ts", import.meta.url);
const treeRoutePath = new URL("../../app/api/projects/[id]/tree/route.ts", import.meta.url);
const graphRoutePath = new URL("../../app/api/projects/[id]/graph/route.ts", import.meta.url);
const generationStatusRoutePath = new URL("../../app/api/projects/[id]/generation-status/route.ts", import.meta.url);

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

test("workspace state routes opt out of caching so fresh mutations are immediately visible", () => {
  assert.equal(projectsRouteModule.dynamic, "force-dynamic");
  assert.equal(requirementRouteModule.dynamic, "force-dynamic");
  assert.equal(treeRouteModule.dynamic, "force-dynamic");
  assert.equal(graphRouteModule.dynamic, "force-dynamic");
  assert.equal(generationStatusRouteModule.dynamic, "force-dynamic");
  assert.equal(typeof GET_PROJECTS, "function");
  assert.equal(typeof GET_REQUIREMENT, "function");
});

test("workspace state route sources also disable route caching inside the GET handler body", async () => {
  const [projectsSource, requirementSource, treeSource, graphSource, statusSource] = await Promise.all([
    readFile(projectsRoutePath, "utf8"),
    readFile(requirementRoutePath, "utf8"),
    readFile(treeRoutePath, "utf8"),
    readFile(graphRoutePath, "utf8"),
    readFile(generationStatusRoutePath, "utf8"),
  ]);

  for (const source of [projectsSource, requirementSource, treeSource, graphSource, statusSource]) {
    assert.match(source, /export const revalidate = 0/);
    assert.match(source, /noStore\(\);/);
  }
});
