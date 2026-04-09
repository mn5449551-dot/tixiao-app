import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { projectGenerationRuns } from "@/lib/schema";

const PROJECT_GENERATION_LIMIT = 3;
const STALE_RUNNING_MS = 30 * 60_000;

type GenerationKind = "direction" | "copy" | "image" | "inpaint";
type GenerationRunStatus = "running" | "done" | "failed";

export class GenerationLimitError extends Error {
  code = "PROJECT_GENERATION_LIMIT";
  limit: number;
  activeCount: number;

  constructor(activeCount: number, limit = PROJECT_GENERATION_LIMIT) {
    super(`当前项目已有 ${activeCount} 个生成任务在进行中，请稍后再试`);
    this.name = "GenerationLimitError";
    this.limit = limit;
    this.activeCount = activeCount;
  }
}

export class GenerationConflictError extends Error {
  code = "GENERATION_ALREADY_RUNNING";
  resourceType: string;
  resourceId: string;

  constructor(resourceType: string, resourceId: string) {
    super("同一资源已有生成任务在进行中，请稍后再试");
    this.name = "GenerationConflictError";
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

function now() {
  return Date.now();
}

function createRunId() {
  return `run_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function startGenerationRun(input: {
  projectId: string;
  kind: GenerationKind;
  resourceType: string;
  resourceId: string;
}) {
  const db = getDb();
  const timestamp = now();
  cleanupStaleGenerationRuns(timestamp);

  return db.transaction((tx) => {
    const duplicate = tx
      .select({ id: projectGenerationRuns.id })
      .from(projectGenerationRuns)
      .where(
        and(
          eq(projectGenerationRuns.projectId, input.projectId),
          eq(projectGenerationRuns.resourceType, input.resourceType),
          eq(projectGenerationRuns.resourceId, input.resourceId),
          eq(projectGenerationRuns.status, "running"),
        ),
      )
      .get();

    if (duplicate) {
      throw new GenerationConflictError(input.resourceType, input.resourceId);
    }

    const activeCount =
      tx
        .select({ count: sql<number>`count(*)` })
        .from(projectGenerationRuns)
        .where(
          and(
            eq(projectGenerationRuns.projectId, input.projectId),
            eq(projectGenerationRuns.status, "running"),
          ),
        )
        .get()?.count ?? 0;

    if (activeCount >= PROJECT_GENERATION_LIMIT) {
      throw new GenerationLimitError(activeCount);
    }

    const id = createRunId();

    tx.insert(projectGenerationRuns)
      .values({
        id,
        projectId: input.projectId,
        kind: input.kind,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        status: "running",
        errorMessage: null,
        startedAt: timestamp,
        finishedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();

    return {
      id,
      projectId: input.projectId,
      kind: input.kind,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      status: "running" as const,
      startedAt: timestamp,
    };
  });
}

export function cleanupStaleGenerationRuns(currentTime = now()) {
  const db = getDb();
  const staleBefore = currentTime - STALE_RUNNING_MS;
  const result = db
    .update(projectGenerationRuns)
    .set({
      status: "failed",
      errorMessage: "生成任务超时，已自动回收",
      finishedAt: currentTime,
      updatedAt: currentTime,
    })
    .where(
      and(
        eq(projectGenerationRuns.status, "running"),
        sql`${projectGenerationRuns.updatedAt} < ${staleBefore}`,
      ),
    )
    .run();

  return result.changes;
}

export function finishGenerationRun(
  runId: string,
  input: { status: Exclude<GenerationRunStatus, "running">; errorMessage?: string | null },
) {
  const db = getDb();
  const timestamp = now();

  db.update(projectGenerationRuns)
    .set({
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      finishedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(projectGenerationRuns.id, runId))
    .run();
}

export function isGenerationRunError(error: unknown): error is GenerationLimitError | GenerationConflictError {
  return error instanceof GenerationLimitError || error instanceof GenerationConflictError;
}
