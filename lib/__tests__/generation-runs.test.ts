import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";

import { createProject } from "../project-data";
import {
  GenerationConflictError,
  GenerationLimitError,
  cleanupStaleGenerationRuns,
  finishGenerationRun,
  startGenerationRun,
} from "../generation-runs";
import { getDb } from "../db";
import { projectGenerationRuns } from "../schema";

test("generation runs allow up to three concurrent runs per project and reject the fourth", () => {
  const project = createProject(`generation-runs-${Date.now()}`);
  assert.ok(project);

  const run1 = startGenerationRun({
    projectId: project.id,
    kind: "direction",
    resourceType: "direction-batch",
    resourceId: `${project.id}:1`,
  });
  const run2 = startGenerationRun({
    projectId: project.id,
    kind: "copy",
    resourceType: "copy-batch",
    resourceId: `${project.id}:2`,
  });
  const run3 = startGenerationRun({
    projectId: project.id,
    kind: "image",
    resourceType: "image-batch",
    resourceId: `${project.id}:3`,
  });

  assert.ok(run1.id);
  assert.ok(run2.id);
  assert.ok(run3.id);

  assert.throws(
    () =>
      startGenerationRun({
        projectId: project.id,
        kind: "image",
        resourceType: "image-batch",
        resourceId: `${project.id}:4`,
      }),
    (error: unknown) => {
      assert.equal(error instanceof GenerationLimitError, true);
      assert.equal((error as GenerationLimitError).limit, 3);
      assert.equal((error as GenerationLimitError).activeCount, 3);
      return true;
    },
  );

  finishGenerationRun(run1.id, { status: "done" });
  finishGenerationRun(run2.id, { status: "failed", errorMessage: "boom" });
  finishGenerationRun(run3.id, { status: "done" });
});

test("generation runs reject duplicate active work on the same resource", () => {
  const project = createProject(`generation-resource-${Date.now()}`);
  assert.ok(project);

  const run = startGenerationRun({
    projectId: project.id,
    kind: "image",
    resourceType: "image-config",
    resourceId: "cfg_1",
  });

  assert.throws(
    () =>
      startGenerationRun({
        projectId: project.id,
        kind: "image",
        resourceType: "image-config",
        resourceId: "cfg_1",
      }),
    (error: unknown) => {
      assert.equal(error instanceof GenerationConflictError, true);
      assert.equal((error as GenerationConflictError).resourceType, "image-config");
      assert.equal((error as GenerationConflictError).resourceId, "cfg_1");
      return true;
    },
  );

  finishGenerationRun(run.id, { status: "done" });
});

test("stale running generation runs are cleaned up before new work starts", () => {
  const project = createProject(`generation-stale-${Date.now()}`);
  assert.ok(project);

  const db = getDb();
  const staleTimestamp = Date.now() - 31 * 60_000;
  db.insert(projectGenerationRuns)
    .values({
      id: `run_stale_${Date.now()}`,
      projectId: project.id,
      kind: "image",
      resourceType: "image-config",
      resourceId: "cfg_stale",
      status: "running",
      errorMessage: null,
      startedAt: staleTimestamp,
      finishedAt: null,
      createdAt: staleTimestamp,
      updatedAt: staleTimestamp,
    })
    .run();

  const cleaned = cleanupStaleGenerationRuns(Date.now());
  assert.equal(cleaned >= 1, true);

  const staleRun = db
    .select()
    .from(projectGenerationRuns)
    .where(eq(projectGenerationRuns.resourceId, "cfg_stale"))
    .get();

  assert.equal(staleRun?.status, "failed");
  assert.match(staleRun?.errorMessage ?? "", /超时|过期|stale/i);

  const run = startGenerationRun({
    projectId: project.id,
    kind: "image",
    resourceType: "image-config",
    resourceId: "cfg_new",
  });

  assert.ok(run.id);
  finishGenerationRun(run.id, { status: "done" });
});
