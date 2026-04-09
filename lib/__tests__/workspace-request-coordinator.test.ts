import test from "node:test";
import assert from "node:assert/strict";

import { createRequestCoordinator } from "../workspace-request-coordinator";

test("request coordinator only accepts the latest token", () => {
  const coordinator = createRequestCoordinator();

  const first = coordinator.next();
  const second = coordinator.next();

  assert.equal(coordinator.isLatest(first), false);
  assert.equal(coordinator.isLatest(second), true);
});

test("request coordinator invalidates aborted tokens after a newer request starts", () => {
  const coordinator = createRequestCoordinator();

  const first = coordinator.next();
  coordinator.next();

  assert.equal(coordinator.isLatest(first), false);
});
