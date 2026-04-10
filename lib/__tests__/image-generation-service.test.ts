import test from "node:test";
import assert from "node:assert/strict";

import { buildSlotSpecificContexts } from "../image-generation-service";

test("buildSlotSpecificContexts returns distinct double-image contexts for causal copy", () => {
  const slots = buildSlotSpecificContexts({
    imageForm: "double",
    copyType: "因果",
    titleMain: "孩子一做题就卡壳？",
    titleSub: "拍一下 10 秒出解析",
    titleExtra: null,
    ctaEnabled: false,
    ctaText: null,
  });

  assert.equal(slots.length, 2);
  assert.equal(slots[0]?.slotIndex, 1);
  assert.equal(slots[1]?.slotIndex, 2);
  assert.equal(slots[0]?.slotRole, "pain_or_cause");
  assert.equal(slots[1]?.slotRole, "solution_or_result");
  assert.equal(slots[0]?.currentSlotText, "孩子一做题就卡壳？");
  assert.equal(slots[1]?.currentSlotText, "拍一下 10 秒出解析");
  assert.notEqual(slots[0]?.layoutExpectation, slots[1]?.layoutExpectation);
});

test("buildSlotSpecificContexts uses complete-message single-image rules for information-flow style single slots", () => {
  const slots = buildSlotSpecificContexts({
    imageForm: "single",
    copyType: "单图主副标题",
    titleMain: "拍一下就会",
    titleSub: "10秒出解析",
    titleExtra: null,
    ctaEnabled: true,
    ctaText: "立即下载",
  });

  assert.equal(slots.length, 1);
  assert.equal(slots[0]?.slotRole, "complete_message");
  assert.equal(slots[0]?.mustShowTextMode, "main_and_sub_same_frame");
  assert.match(slots[0]?.currentSlotText ?? "", /拍一下就会/);
  assert.match(slots[0]?.currentSlotText ?? "", /10秒出解析/);
  assert.match(slots[0]?.layoutExpectation ?? "", /CTA/);
  assert.match(slots[0]?.layoutExpectation ?? "", /立即下载/);
});
