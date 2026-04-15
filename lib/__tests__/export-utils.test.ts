import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExportFileName,
  classifyExportAdaptation,
  parseAspectRatio,
  parseSlotSize,
  resolveExportSlotSpecs,
  sanitizeExportSegment,
} from "../export/utils";

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
