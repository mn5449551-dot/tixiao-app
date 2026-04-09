import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFallbackImageDescriptionPayload,
  buildImageDescriptionMessages,
} from "../ai/agents/image-description-agent";

test("buildFallbackImageDescriptionPayload returns structured payload for information-flow single image with CTA", () => {
  const payload = buildFallbackImageDescriptionPayload({
    directionTitle: "作业卡壳秒解决",
    targetAudience: "初中生，晚间做作业经常卡题",
    scenarioProblem: "晚间做作业时被一道题卡住半小时",
    differentiation: "拍一下就能出解析",
    effect: "从不会写到能继续写下去",
    channel: "信息流（广点通）",
    copyTitleMain: "作业卡壳急",
    copyTitleSub: "拍一下就会",
    copyTitleExtra: null,
    aspectRatio: "16:9",
    styleMode: "normal",
    ipRole: null,
    imageStyle: "realistic",
    logo: "onion",
    imageForm: "single",
    ctaEnabled: true,
    ctaText: "立即下载",
  });

  assert.equal(payload.schemaVersion, "v1");
  assert.equal(payload.channelPositioning.channel, "信息流（广点通）");
  assert.equal(payload.channelPositioning.imageForm, "single");
  assert.equal(payload.textOverlay.ctaText, "立即下载");
  assert.equal(payload.composition.logoSafeArea, "top-left");
});

test("buildFallbackImageDescriptionPayload encodes multi-image shared-base strategy", () => {
  const payload = buildFallbackImageDescriptionPayload({
    directionTitle: "看不懂步骤也能学会",
    targetAudience: "理科薄弱学生",
    scenarioProblem: "看答案还是看不懂关键步骤",
    differentiation: "拆解步骤并逐步讲清",
    effect: "从看不懂到能独立讲出思路",
    channel: "应用商店",
    copyTitleMain: "答案看不懂？",
    copyTitleSub: "每步都拆透",
    copyTitleExtra: "一遍就懂",
    aspectRatio: "3:2",
    styleMode: "normal",
    ipRole: "豆包",
    imageStyle: "animation",
    logo: "onion",
    imageForm: "triple",
    ctaEnabled: false,
    ctaText: null,
  });

  assert.equal(payload.channelPositioning.imageForm, "triple");
  assert.equal(payload.charactersAndProps.ip.enabled, true);
  assert.match(payload.composition.multiImageConsistency, /一致/);
  assert.equal(payload.textOverlay.ctaText, null);
});

test("buildImageDescriptionMessages uses layered system prompt framework without changing output shape", () => {
  const messages = buildImageDescriptionMessages({
    directionTitle: "作业卡壳秒解决",
    targetAudience: "初中生，晚间做作业经常卡题",
    scenarioProblem: "晚间做作业时被一道题卡住半小时",
    differentiation: "拍一下就能出解析",
    effect: "从不会写到能继续写下去",
    channel: "信息流（广点通）",
    copyTitleMain: "作业卡壳急",
    copyTitleSub: "拍一下就会",
    copyTitleExtra: null,
    aspectRatio: "16:9",
    styleMode: "normal",
    ipRole: null,
    imageStyle: "realistic",
    logo: "onion",
    imageForm: "single",
    ctaEnabled: true,
    ctaText: "立即下载",
  });

  assert.equal(messages[0]?.role, "system");
  assert.match(messages[0]?.content ?? "", /角色定位/);
  assert.match(messages[0]?.content ?? "", /业务背景/);
  assert.match(messages[0]?.content ?? "", /核心任务/);
  assert.match(messages[0]?.content ?? "", /硬性边界/);
  assert.match(messages[0]?.content ?? "", /输出要求/);
  assert.match(messages[1]?.content ?? "", /CTA：立即下载/);
});
