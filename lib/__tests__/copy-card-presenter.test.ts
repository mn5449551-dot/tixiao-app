import test from "node:test";
import assert from "node:assert/strict";

import {
  getCopyActionState,
  getCopyCompactSummary,
  getCopyDisplayRows,
} from "../copy-card-presenter";

test("getCopyDisplayRows exposes main and sub title labels for single-image copies", () => {
  const rows = getCopyDisplayRows("single", {
    titleMain: "孩子一做题就卡壳？",
    titleSub: "拍一下 10 秒出解析",
    titleExtra: null,
    copyType: "单图主副标题",
  });

  assert.deepEqual(rows, [
    { label: "主标题", value: "孩子一做题就卡壳？" },
    { label: "副标题", value: "拍一下 10 秒出解析" },
  ]);
});

test("getCopyDisplayRows exposes per-image labels and relation for multi-image copies", () => {
  const rows = getCopyDisplayRows("double", {
    titleMain: "作业卡壳急",
    titleSub: "10秒出解析",
    titleExtra: null,
    copyType: "因果",
  });

  assert.deepEqual(rows, [
    { label: "图1文案", value: "作业卡壳急" },
    { label: "图2文案", value: "10秒出解析" },
    { label: "图间关系", value: "因果（AI自动分配）" },
  ]);
});

test("getCopyActionState matches PRD lock behavior", () => {
  assert.deepEqual(getCopyActionState(false), {
    statusLabel: null,
    canGenerate: true,
    canDelete: true,
  });

  assert.deepEqual(getCopyActionState(true), {
    statusLabel: "已生成",
    canGenerate: false,
    canDelete: false,
  });
});

test("getCopyCompactSummary keeps single-image copies as a single title", () => {
  assert.equal(
    getCopyCompactSummary("single", {
      titleMain: "孩子一做题就卡壳？",
      titleSub: "拍一下 10 秒出解析",
      titleExtra: null,
      copyType: "单图主副标题",
    }),
    "孩子一做题就卡壳？",
  );
});

test("getCopyCompactSummary includes both captions and relation for double-image copies", () => {
  assert.equal(
    getCopyCompactSummary("double", {
      titleMain: "作业卡壳急",
      titleSub: "10秒出解析",
      titleExtra: null,
      copyType: "因果",
    }),
    "图1：作业卡壳急｜图2：10秒出解析｜图间关系：因果",
  );
});

test("getCopyCompactSummary includes all captions and relation for triple-image copies", () => {
  assert.equal(
    getCopyCompactSummary("triple", {
      titleMain: "不会做",
      titleSub: "拍一下",
      titleExtra: "跟着学会",
      copyType: "递进",
    }),
    "图1：不会做｜图2：拍一下｜图3：跟着学会｜图间关系：递进",
  );
});
