import test from "node:test";
import assert from "node:assert/strict";

import { areAllSelectableCopiesSelected, toggleSelectableCopyIds } from "../copy-selection";

const items = [
  { id: "copy_1", isLocked: false },
  { id: "copy_2", isLocked: true },
  { id: "copy_3", isLocked: false },
];

test("areAllSelectableCopiesSelected ignores locked copies", () => {
  assert.equal(
    areAllSelectableCopiesSelected(items, new Set(["copy_1", "copy_3"])),
    true,
  );
  assert.equal(
    areAllSelectableCopiesSelected(items, new Set(["copy_1"])),
    false,
  );
});

test("toggleSelectableCopyIds toggles only unlocked copies", () => {
  const selected = toggleSelectableCopyIds(items, new Set(["copy_1", "copy_3"]));
  assert.deepEqual([...selected], []);

  const toggledBack = toggleSelectableCopyIds(items, selected);
  assert.deepEqual([...toggledBack].sort(), ["copy_1", "copy_3"]);
});
