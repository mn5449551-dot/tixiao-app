import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const imagePreviewModalPath = new URL("../../components/ui/image-preview-modal.tsx", import.meta.url);

test("image preview modal behaves like an interactive viewer instead of a static fit-only lightbox", async () => {
  const source = await readFile(imagePreviewModalPath, "utf8");

  assert.match(source, /createPortal/);
  assert.match(source, /workflow-canvas-overlay-root/);
  assert.match(source, /useEffect/);
  assert.match(source, /useState/);
  assert.match(source, /PORTRAIT_TARGET_VIEWPORT_WIDTH_RATIO/);
  assert.match(source, /getInitialScale/);
  assert.match(source, /isPortrait/);
  assert.match(source, /zoom/);
  assert.match(source, /onWheel/);
  assert.match(source, /onMouseDown/);
  assert.match(source, /translate3d/);
  assert.match(source, /bg-black\//);
  assert.match(source, /重置/);
  assert.match(source, /className="absolute inset-0 z-50/);
  assert.doesNotMatch(source, /className="fixed inset-0 z-50/);
  assert.match(source, /window\.addEventListener\("keydown"/);
  assert.doesNotMatch(source, /max-w-\[min\(92vw,1400px\)\]/);
});
