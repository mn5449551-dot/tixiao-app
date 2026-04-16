import test from "node:test";
import assert from "node:assert/strict";

import * as exportUtils from "../export/utils";

const {
  buildExportFileName,
  classifyExportAdaptation,
  findUncoveredExportSlots,
  mergeSelectedGroupIds,
  parseAspectRatio,
  parseSlotSize,
  resolveExportSlotSpecs,
  sanitizeExportSegment,
  splitExportSlotSpecsByCoverage,
} = exportUtils;

test("sanitizeExportSegment removes path-like characters from user-controlled names", () => {
  assert.equal(
    sanitizeExportSegment("../Q2/期中:冲刺?"),
    "Q2_期中_冲刺",
  );
  assert.equal(sanitizeExportSegment("  "), "untitled");
});

test("resolveExportSlotSpecs expands selected channels and slots into concrete export targets", () => {
  const resolved = resolveExportSlotSpecs({
    targetChannels: ["OPPO", "VIVO"],
    targetSlots: ["富媒体-横版大图", "搜索-首位-三图"],
  });

  assert.deepEqual(
    resolved.map((item) => `${item.channel}:${item.slotName}`),
    ["OPPO:富媒体-横版大图", "VIVO:搜索-首位-三图"],
  );
});

test("resolveExportSlotSpecs includes the expanded channel slot matrix", () => {
  const resolved = resolveExportSlotSpecs({
    targetChannels: ["OPPO", "VIVO", "小米", "荣耀"],
  });

  assert.equal(resolved.length, 14);
  assert.ok(resolved.some((item) => item.channel === "VIVO" && item.slotName === "顶部 banner"));
  assert.ok(resolved.some((item) => item.channel === "荣耀" && item.slotName === "三图文"));
});

test("parseAspectRatio supports standard ratios and sqrt2", () => {
  assert.equal(parseAspectRatio("16:9"), 16 / 9);
  assert.equal(parseAspectRatio("√2:1"), Math.SQRT2);
  assert.equal(parseAspectRatio("oops"), null);
});

test("parseSlotSize parses slot dimensions", () => {
  assert.deepEqual(parseSlotSize("1280×720"), { width: 1280, height: 720 });
  assert.equal(parseSlotSize("bad"), null);
});

test("classifyExportAdaptation distinguishes direct, transform, and postprocess paths", () => {
  assert.equal(classifyExportAdaptation("16:9", "16:9"), "direct");
  assert.equal(classifyExportAdaptation("3:2", "16:9"), "transform");
  assert.equal(classifyExportAdaptation("16:9", "16:11"), "postprocess");
});

test("buildExportFileName accepts the frontend naming rule key and includes channel, slot and ratio", () => {
  const fileName = buildExportFileName({
    projectTitle: "../Q2/期中冲刺",
    channel: "OPPO",
    slotName: "富媒体-横版大图",
    ratio: "16:9",
    index: 3,
    format: "jpg",
    namingRule: "channel_slot_date_version",
  });

  assert.match(fileName, /^Q2_期中冲刺_OPPO_富媒体-横版大图_16x9_\d{8}_03\.jpg$/);
});

test("findUncoveredExportSlots allows mixed selected ratios to cover different export slots", () => {
  assert.equal(typeof findUncoveredExportSlots, "function");

  const uncovered = findUncoveredExportSlots({
    selectedImageRatios: ["3:2", "16:9"],
    slotSpecs: [
      { channel: "VIVO", slotName: "搜索富媒体-三图", ratio: "3:2", size: "320×211", maxSize: "<80 KB" },
      { channel: "OPPO", slotName: "富媒体-横版大图", ratio: "16:9", size: "1280×720", maxSize: "<150 KB" },
    ],
  });

  assert.deepEqual(uncovered, []);
});

test("findUncoveredExportSlots reports only slots still missing matching ratios", () => {
  assert.equal(typeof findUncoveredExportSlots, "function");

  const uncovered = findUncoveredExportSlots({
    selectedImageRatios: ["3:2"],
    slotSpecs: [
      { channel: "VIVO", slotName: "搜索富媒体-三图", ratio: "3:2", size: "320×211", maxSize: "<80 KB" },
      { channel: "OPPO", slotName: "富媒体-横版大图", ratio: "16:9", size: "1280×720", maxSize: "<150 KB" },
    ],
  });

  assert.deepEqual(uncovered.map((slot) => `${slot.slotName}(${slot.ratio})`), ["富媒体-横版大图(16:9)"]);
});

test("mergeSelectedGroupIds keeps current selections and adds generated variant groups", () => {
  assert.equal(typeof mergeSelectedGroupIds, "function");

  assert.deepEqual(
    mergeSelectedGroupIds(["grp_original"], ["grp_variant_16x9", "grp_variant_9x16"]),
    ["grp_original", "grp_variant_16x9", "grp_variant_9x16"],
  );
});

test("splitExportSlotSpecsByCoverage separates directly exportable and adaptation-required slots", () => {
  assert.equal(typeof splitExportSlotSpecsByCoverage, "function");

  const result = splitExportSlotSpecsByCoverage({
    selectedImageRatios: ["1:1", "16:9"],
    slotSpecs: [
      { channel: "OPPO", slotName: "富媒体-横版大图", ratio: "16:9", size: "1280×720", maxSize: "<150 KB" },
      { channel: "小米", slotName: "搜索-搜索三图", ratio: "1:1", size: "320×320", maxSize: "<300 KB" },
      { channel: "VIVO", slotName: "搜索富媒体-三图", ratio: "3:2", size: "320×211", maxSize: "<80 KB" },
      { channel: "VIVO", slotName: "顶部 banner", ratio: "16:11", size: "720×498", maxSize: "<150 KB" },
    ],
  });

  assert.deepEqual(
    result.directSlots.map((slot) => `${slot.channel}:${slot.slotName}`),
    ["OPPO:富媒体-横版大图", "小米:搜索-搜索三图"],
  );
  assert.deepEqual(
    result.adaptationRequiredSlots.map((slot) => `${slot.channel}:${slot.slotName}`),
    ["VIVO:搜索富媒体-三图"],
  );
  assert.deepEqual(
    result.specialSlots.map((slot) => `${slot.channel}:${slot.slotName}`),
    ["VIVO:顶部 banner"],
  );
});
