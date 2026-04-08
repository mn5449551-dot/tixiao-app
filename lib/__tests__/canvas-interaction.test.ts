import test from "node:test";
import assert from "node:assert/strict";

import { canvasInteractionProps } from "../canvas-interaction";

test("canvas interaction prefers trackpad two-finger panning over wheel zoom", () => {
  assert.equal(canvasInteractionProps.panOnDrag, false);
  assert.equal(canvasInteractionProps.panOnScroll, true);
  assert.equal(canvasInteractionProps.zoomOnScroll, false);
  assert.equal(canvasInteractionProps.zoomOnPinch, true);
  assert.equal(canvasInteractionProps.panOnScrollSpeed, 0.9);
  assert.equal(canvasInteractionProps.panOnScrollMode, "free");
});
