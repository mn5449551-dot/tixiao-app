import test from "node:test";
import assert from "node:assert/strict";

import {
  buildImageDescriptionMessages,
  generateImageDescription,
  type ImageDescriptionInput,
} from "../ai/agents/image-description-agent";
import type { ChatContentPart } from "../ai/client";

const baseInput: ImageDescriptionInput = {
  direction: {
    title: "作业卡壳秒解决",
    targetAudience: "初中生",
    adaptationStage: "晚间作业场景",
    scenarioProblem: "晚间作业时卡在数学题第一步",
    differentiation: "拍题拆解关键步骤",
    effect: "继续写下去",
    channel: "应用商店",
  },
  copySet: {
    titleMain: "图一文案",
    titleSub: "图二文案",
    titleExtra: "图三文案",
    copyType: "因果",
  },
  config: {
    imageForm: "double",
    aspectRatio: "3:2",
    styleMode: "ip",
    imageStyle: "animation",
    logo: "onion",
    ctaEnabled: false,
    ctaText: null,
  },
  ip: {
    ipRole: "豆包",
    ipDescription: "篮球少年·阳光活力型",
    ipPromptKeywords: "dark spiky hair",
  },
  referenceImages: [
    { role: "ip", url: "data:image/png;base64,ip", usage: "保持角色长相一致" },
    { role: "logo", url: "data:image/png;base64,logo", usage: "左上角真实露出" },
  ],
};

test("buildImageDescriptionMessages routes single to poster agent and multi-image to series agent", () => {
  const singleMessages = buildImageDescriptionMessages({
    ...baseInput,
    direction: { ...baseInput.direction, channel: "信息流（广点通）" },
    config: { ...baseInput.config, imageForm: "single", ctaEnabled: true, ctaText: "立即下载" },
    copySet: { ...baseInput.copySet, titleSub: "副标题", titleExtra: null },
  });
  const seriesMessages = buildImageDescriptionMessages({
    ...baseInput,
    config: { ...baseInput.config, imageForm: "double" },
    copySet: { ...baseInput.copySet, titleExtra: null },
  });

  const singleSystem = typeof singleMessages[0]?.content === "string" ? singleMessages[0].content : "";
  const seriesSystem = typeof seriesMessages[0]?.content === "string" ? seriesMessages[0].content : "";

  assert.match(singleSystem, /单图广告海报提示词生成 Agent/);
  assert.match(singleSystem, /single 必须同时处理/);
  assert.match(singleSystem, /titleMain/);
  assert.match(singleSystem, /titleSub/);
  assert.match(seriesSystem, /系列组图广告提示词生成 Agent/);
  assert.match(seriesSystem, /double \/ triple (永远没有|不需要) CTA/);
});

test("buildImageDescriptionMessages filters out logo references and keeps only the primary non-logo image", () => {
  const messages = buildImageDescriptionMessages({
    ...baseInput,
    config: { ...baseInput.config, imageForm: "single" },
    copySet: { ...baseInput.copySet, titleSub: "副标题", titleExtra: null },
  });
  const userContent = messages[1]?.content;

  assert.ok(Array.isArray(userContent));
  const contentArray = userContent as ChatContentPart[];
  const imageUrls = contentArray.filter((c) => c.type === "image_url");
  const allText = contentArray
    .filter((c) => c.type === "text")
    .map((part) => (part as { type: "text"; text: string }).text)
    .join(" ");

  assert.equal(imageUrls.length, 1);
  assert.match(allText, /参考图1（ip）/);
  assert.doesNotMatch(allText, /logo/);
});

test("buildImageDescriptionMessages includes CTA only for information-flow single images", () => {
  const singleMessages = buildImageDescriptionMessages({
    ...baseInput,
    direction: { ...baseInput.direction, channel: "信息流（广点通）" },
    config: { ...baseInput.config, imageForm: "single", ctaEnabled: true, ctaText: "立即下载" },
    copySet: { ...baseInput.copySet, titleSub: "副标题", titleExtra: null },
  });
  const seriesMessages = buildImageDescriptionMessages({
    ...baseInput,
    config: { ...baseInput.config, imageForm: "double", ctaEnabled: true, ctaText: "立即下载" },
    copySet: { ...baseInput.copySet, titleExtra: null },
  });

  const singleText = (singleMessages[1]?.content as ChatContentPart[])
    .filter((part) => part.type === "text")
    .map((part) => (part as { type: "text"; text: string }).text)
    .join(" ");
  const seriesText = (seriesMessages[1]?.content as ChatContentPart[])
    .filter((part) => part.type === "text")
    .map((part) => (part as { type: "text"; text: string }).text)
    .join(" ");

  assert.match(singleText, /CTA是否允许：是/);
  assert.match(singleText, /立即下载/);
  assert.match(seriesText, /CTA：系列图不允许 CTA/);
});

test("generateImageDescription returns prompt-only payloads with negative prompts", async () => {
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.NEW_API_KEY;
  process.env.NEW_API_KEY = "test-key";
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                prompts: [
                  { slotIndex: 1, prompt: "第一张 prompt", negativePrompt: "第一张 negative" },
                  { slotIndex: 2, prompt: "第二张 prompt", negativePrompt: "第二张 negative" },
                ],
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;

  try {
    const result = await generateImageDescription({
      ...baseInput,
      config: { ...baseInput.config, imageForm: "double" },
      copySet: { ...baseInput.copySet, titleExtra: null },
    });

    assert.equal(result.prompts.length, 2);
    assert.equal(result.prompts[0]?.slotIndex, 1);
    assert.equal(result.prompts[1]?.slotIndex, 2);
    assert.ok(result.prompts.every((item) => item.prompt.length > 0));
    assert.ok(result.prompts.every((item) => item.negativePrompt.length > 0));
  } finally {
    globalThis.fetch = previousFetch;
    process.env.NEW_API_KEY = previousApiKey;
  }
});

test("generateImageDescription falls back to prompt-only defaults when model call fails", async () => {
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.NEW_API_KEY;
  process.env.NEW_API_KEY = "test-key";
  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;

  try {
    const result = await generateImageDescription({
      ...baseInput,
      direction: { ...baseInput.direction, channel: "信息流（广点通）" },
      config: { ...baseInput.config, imageForm: "single", ctaEnabled: true, ctaText: "立即下载" },
      copySet: { ...baseInput.copySet, titleSub: "副标题", titleExtra: null },
    });

    assert.equal(result.prompts.length, 1);
    assert.equal(result.prompts[0]?.slotIndex, 1);
    assert.match(result.prompts[0]?.prompt ?? "", /立即下载|广告海报/);
    assert.match(result.prompts[0]?.negativePrompt ?? "", /extra arms/);
  } finally {
    globalThis.fetch = previousFetch;
    process.env.NEW_API_KEY = previousApiKey;
  }
});
