import test from "node:test";
import assert from "node:assert/strict";

import { buildImagePrompt, buildImageSlotPrompt, mergeImagePromptWithSlot } from "../ai/services/prompt-template";

test("buildImagePrompt injects selected IP description and consistency guardrails", () => {
  const prompt = buildImagePrompt({
    directionTitle: "方向1",
    scenarioProblem: "孩子做题卡住",
    copyTitleMain: "拍一下就会",
    copyTitleSub: "10秒出解析",
    aspectRatio: "1:1",
    styleMode: "ip",
    imageStyle: "animation",
    ipRole: "豆包",
    ipDescription: "篮球少年·阳光活力型",
    ipPromptKeywords: "male middle school student, dark spiky hair, white basketball jersey",
    logo: "onion",
    imageForm: "single",
    referenceImageUrl: "data:image/png;base64,abc",
    channel: "信息流（广点通）",
    ctaEnabled: false,
    ctaText: null,
  });

  const parsed = JSON.parse(prompt) as Record<string, unknown>;
  assert.equal(parsed.channel, "信息流（广点通）");
  assert.match(prompt, /豆包/);
  assert.match(prompt, /篮球少年·阳光活力型/);
  assert.match(prompt, /dark spiky hair/);
  assert.match(prompt, /长相和整体风格必须与参考图一致/);
  assert.match(prompt, /品牌 Logo 必须真实出现在画面左上角/);
  assert.match(prompt, /不得改字/);
  assert.match(prompt, /不得改变图形/);
  assert.match(prompt, /不得改变颜色/);
  assert.match(prompt, /不得重新设计/);
  assert.match(prompt, /不可缺字漏字/);
});

test("buildImagePrompt avoids stuffing all copy text into a multi-image frame", () => {
  const prompt = buildImagePrompt({
    directionTitle: "方向1",
    scenarioProblem: "孩子做题卡住",
    copyTitleMain: "图一文案",
    copyTitleSub: "图二文案",
    copyTitleExtra: "图三文案",
    aspectRatio: "3:2",
    styleMode: "normal",
    imageStyle: "realistic",
    logo: "onion",
    imageForm: "double",
    referenceImageUrl: null,
  });

  const parsed = JSON.parse(prompt) as { text_instruction: string };
  assert.match(prompt, /多图素材/);
  assert.match(prompt, /不要把整套文案同时放进同一张图/);
  assert.match(parsed.text_instruction, /不要把整套文案同时放进同一张图/);
});

test("buildImageSlotPrompt for double-image only binds the current slot title", () => {
  const slotPrompt = buildImageSlotPrompt({
    imageForm: "double",
    slotIndex: 1,
    slotCount: 2,
    copyType: "因果",
    copyTitleMain: "难题卡壳",
    copyTitleSub: "拍题拆解",
    copyTitleExtra: null,
  });

  assert.match(slotPrompt, /难题卡壳/);
  assert.doesNotMatch(slotPrompt, /拍题拆解.*难题卡壳|难题卡壳.*拍题拆解/);
  assert.match(slotPrompt, /图间关系是“因果”/);
});

test("buildImageSlotPrompt encodes triple-image progression roles", () => {
  const slotPrompt = buildImageSlotPrompt({
    imageForm: "triple",
    slotIndex: 2,
    slotCount: 3,
    copyType: "递进",
    copyTitleMain: "看题发懵",
    copyTitleSub: "动画拆解",
    copyTitleExtra: "一步学会",
  });

  assert.match(slotPrompt, /三图关系是“递进”/);
  assert.match(slotPrompt, /动画拆解/);
  assert.match(slotPrompt, /第二层推进或行动/);
  assert.match(slotPrompt, /Logo 在左上角可见/);
  assert.match(slotPrompt, /不得改字/);
});

test("buildImageSlotPrompt encodes triple-image causal roles", () => {
  const slotPrompt = buildImageSlotPrompt({
    imageForm: "triple",
    slotIndex: 1,
    slotCount: 3,
    copyType: "因果",
    copyTitleMain: "难题卡壳",
    copyTitleSub: "拍题拆解",
    copyTitleExtra: "马上学会",
  });

  assert.match(slotPrompt, /三图关系是“因果”/);
  assert.match(slotPrompt, /难题卡壳/);
  assert.match(slotPrompt, /原因或痛点/);
});

test("buildImagePrompt includes CTA button guidance only for information-flow single images", () => {
  const prompt = buildImagePrompt({
    directionTitle: "方向1",
    scenarioProblem: "孩子做题卡住",
    copyTitleMain: "拍一下就会",
    copyTitleSub: "10秒出解析",
    aspectRatio: "16:9",
    styleMode: "normal",
    imageStyle: "realistic",
    logo: "onion",
    imageForm: "single",
    referenceImageUrl: null,
    channel: "信息流（广点通）",
    ctaEnabled: true,
    ctaText: "立即下载",
  });

  assert.match(prompt, /立即下载/);
  assert.match(prompt, /CTA/);
  const parsed = JSON.parse(prompt) as { cta: { enabled: boolean; text: string | null } };
  assert.equal(parsed.cta.enabled, true);
  assert.equal(parsed.cta.text, "立即下载");
});

test("buildImagePrompt excludes CTA guidance for non-information-flow or multi-image cases", () => {
  const prompt = buildImagePrompt({
    directionTitle: "方向1",
    scenarioProblem: "孩子做题卡住",
    copyTitleMain: "图一文案",
    copyTitleSub: "图二文案",
    aspectRatio: "3:2",
    styleMode: "normal",
    imageStyle: "realistic",
    logo: "onion",
    imageForm: "double",
    referenceImageUrl: null,
    channel: "应用商店",
    ctaEnabled: true,
    ctaText: "立即下载",
  });

  assert.doesNotMatch(prompt, /CTA/);
  assert.doesNotMatch(prompt, /立即下载/);
});

test("buildImagePrompt returns JSON-formatted prompt content", () => {
  const prompt = buildImagePrompt({
    directionTitle: "方向1",
    scenarioProblem: "孩子做题卡住",
    copyTitleMain: "拍一下就会",
    copyTitleSub: "10秒出解析",
    aspectRatio: "16:9",
    styleMode: "normal",
    imageStyle: "realistic",
    logo: "onion",
    imageForm: "single",
    referenceImageUrl: null,
    channel: "信息流（广点通）",
    ctaEnabled: true,
    ctaText: "立即下载",
  });

  const parsed = JSON.parse(prompt) as {
    prompt_version: string;
    channel: string;
    aspect_ratio: string;
    text_overlay: { main_title: string; sub_title: string | null };
  };

  assert.equal(parsed.prompt_version, "v1");
  assert.equal(parsed.channel, "信息流（广点通）");
  assert.equal(parsed.aspect_ratio, "16:9");
  assert.equal(parsed.text_overlay.main_title, "拍一下就会");
  assert.equal(parsed.text_overlay.sub_title, "10秒出解析");
});

test("mergeImagePromptWithSlot appends slot information while keeping JSON format", () => {
  const prompt = buildImagePrompt({
    directionTitle: "方向1",
    scenarioProblem: "孩子做题卡住",
    copyTitleMain: "图一文案",
    copyTitleSub: "图二文案",
    aspectRatio: "3:2",
    styleMode: "normal",
    imageStyle: "realistic",
    logo: "onion",
    imageForm: "double",
    referenceImageUrl: null,
    channel: "应用商店",
    ctaEnabled: false,
    ctaText: null,
  });

  const merged = mergeImagePromptWithSlot(prompt, "当前输出第1张图，承担问题角色。");
  const parsed = JSON.parse(merged) as { slot_prompt: string };

  assert.equal(parsed.slot_prompt, "当前输出第1张图，承担问题角色。");
});

test("buildImagePrompt can consume structured description payload", () => {
  const prompt = buildImagePrompt({
    directionTitle: "方向1",
    scenarioProblem: "孩子做题卡住",
    copyTitleMain: "拍一下就会",
    copyTitleSub: "10秒出解析",
    aspectRatio: "16:9",
    styleMode: "normal",
    imageStyle: "realistic",
    logo: "onion",
    imageForm: "single",
    referenceImageUrl: null,
    channel: "信息流（广点通）",
    ctaEnabled: true,
    ctaText: "立即下载",
    descriptionPayload: JSON.stringify({
      schemaVersion: "v1",
      channelPositioning: { channel: "信息流（广点通）", imageForm: "single", aspectRatio: "16:9" },
      visualConcept: { mainEvent: "学生举起手机拍题", creativeAxis: "家庭书桌夜读", productAnchor: "手机拍题界面" },
      sceneAtmosphere: { location: "家庭书桌", lighting: "明亮", moodColor: "蓝色品牌感" },
      composition: { layoutType: "wide", subjectPlacement: "right", logoSafeArea: "top-left", textSafeArea: "left" },
      textOverlay: { currentText: "拍一下就会", textRole: "hook", ctaText: "立即下载" },
      brandConstraints: { brandTone: "教育可信、积极、明亮、成长导向" },
    }),
  });

  const parsed = JSON.parse(prompt) as { visual_concept?: string; scene?: string };
  assert.match(parsed.visual_concept ?? "", /学生举起手机拍题/);
  assert.match(parsed.scene ?? "", /家庭书桌/);
});
