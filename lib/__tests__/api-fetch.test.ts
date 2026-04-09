import test from "node:test";
import assert from "node:assert/strict";

import { apiFetch, apiFetchOk, ApiError } from "../api-fetch";

test("apiFetch serializes plain object bodies as JSON and returns parsed payload", async () => {
  const previousFetch = globalThis.fetch;
  let request: { input: RequestInfo | URL; init?: RequestInit } | null = null;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    request = { input, init };
    return new Response(JSON.stringify({ id: "proj_123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const payload = await apiFetch<{ id: string }>("/api/projects", {
      method: "POST",
      body: { title: "Demo" },
    });
    const savedRequest = request as { input: RequestInfo | URL; init?: RequestInit } | null;

    assert.equal(payload.id, "proj_123");
    if (!savedRequest) {
      throw new Error("Expected fetch request to be captured");
    }
    assert.equal(savedRequest.input, "/api/projects");
    assert.equal(savedRequest.init?.method, "POST");
    assert.equal(savedRequest.init?.headers instanceof Headers, true);
    assert.equal((savedRequest.init?.headers as Headers).get("Content-Type"), "application/json");
    assert.equal(savedRequest.init?.body, JSON.stringify({ title: "Demo" }));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("apiFetch throws ApiError with the server error message on non-ok responses", async () => {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "项目标题不能为空" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  try {
    await assert.rejects(
      () => apiFetch("/api/projects", { method: "POST", body: { title: "" } }),
      (error: unknown) => {
        assert.equal(error instanceof ApiError, true);
        assert.equal((error as ApiError).status, 400);
        assert.equal((error as ApiError).message, "项目标题不能为空");
        return true;
      },
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("apiFetchOk returns false when the request fails", async () => {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "boom" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  try {
    assert.equal(await apiFetchOk("/api/projects/123", { method: "DELETE" }), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
