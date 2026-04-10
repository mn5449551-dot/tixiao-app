import test from "node:test";
import assert from "node:assert/strict";

import { buildImagePrompt, buildImageSlotPrompt, mergeImagePromptWithSlot } from "../ai/services/prompt-template";
import type { SlotPromptPayload } from "../ai/agents/image-description-agent";

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
  assert.equal(parsed.direction_title, "方向1");
  assert.match(prompt, /篮球少年·阳光活力型/);
  assert.match(prompt, /dark spiky hair/);
  assert.match(prompt, /长相和整体风格必须与参考图一致/);
  assert.match(prompt, /无需复现参考图中的动作或姿势/);
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

  const parsed = JSON.parse(prompt) as {
    text_instruction: string;
    text_overlay?: {
      main_title: string | null;
      sub_title: string | null;
      extra_title: string | null;
    };
  };
  assert.match(prompt, /多图素材/);
  assert.match(prompt, /不要把整套文案同时放进同一张图/);
  assert.match(parsed.text_instruction, /不要把整套文案同时放进同一张图/);
  assert.equal(parsed.text_overlay, undefined);
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
    logo: "onion",
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
    logo: "onion",
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
    logo: "onion",
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
  const parsed = JSON.parse(prompt) as { cta?: unknown };
  assert.equal(parsed.cta, undefined);
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
    aspect_ratio: string;
    text_overlay?: { main_title: string; sub_title: string | null };
    cta?: { enabled: boolean; text: string | null };
  };

  assert.equal(parsed.prompt_version, "v1");
  assert.equal(parsed.aspect_ratio, "16:9");
  assert.equal(parsed.text_overlay?.main_title, "拍一下就会");
  assert.equal(parsed.text_overlay?.sub_title, "10秒出解析");
  assert.equal(parsed.cta?.enabled, true);
});

test("buildImagePrompt does not leak channel label into visible prompt fields when logo is disabled", () => {
  const prompt = buildImagePrompt({
    directionTitle: "方向1",
    scenarioProblem: "孩子做题卡住",
    copyTitleMain: "考前几何压轴题，盯着图干着急？",
    copyTitleSub: "让动画一步步长出来，告诉你辅助线该添哪里",
    aspectRatio: "16:9",
    styleMode: "normal",
    imageStyle: "realistic",
    logo: "none",
    imageForm: "single",
    referenceImageUrl: null,
    channel: "学习机",
    ctaEnabled: false,
    ctaText: null,
  });

  assert.doesNotMatch(prompt, /学习机/);
  assert.match(prompt, /不需要品牌 Logo/);
});

test("buildImagePrompt anchors default人物为中国教育场景人物", () => {
  const prompt = buildImagePrompt({
    directionTitle: "方向1",
    scenarioProblem: "孩子做题卡住",
    copyTitleMain: "拍一下就会",
    copyTitleSub: "10秒出解析",
    aspectRatio: "1:1",
    styleMode: "normal",
    imageStyle: "realistic",
    logo: "none",
    imageForm: "single",
    referenceImageUrl: null,
    channel: "应用商店",
    ctaEnabled: false,
    ctaText: null,
    descriptionPayload: {
      schemaVersion: "v1",
      channelPositioning: { channel: "应用商店", imageForm: "single", aspectRatio: "1:1" },
      adGoal: { primaryGoal: "解释功能" },
      userState: {
        audienceType: "student",
        audienceSegment: "初中生",
        scenarioSummary: "孩子做题卡住",
      },
      coreSellingPoint: { primaryPoint: "拍一下就能出解析" },
      visualConcept: { mainEvent: "学生拍题", creativeAxis: "学习突破", productAnchor: "拍题界面" },
      sceneAtmosphere: { location: "家庭书桌", lighting: "明亮", moodColor: "清新明亮的广告风格" },
      charactersAndProps: {
        characterMode: "single",
        characterSummary: "中国初中生代表",
        expression: "专注",
        action: "举起手机拍题",
        props: ["手机", "练习册"],
        ip: { enabled: false, role: "", placement: "", action: "", consistencyRule: "" },
      },
      composition: {
        layoutType: "square",
        subjectPlacement: "right",
        textSafeArea: "left",
        logoSafeArea: "top-left",
        multiImageConsistency: "单图完整表达",
      },
      textOverlay: { currentText: "拍一下就会", textRole: "main", ctaText: null },
      brandConstraints: {
        brandTone: "教育可信、积极、明亮、成长导向",
        logoPolicy: "不使用Logo",
      },
      variationHints: { noveltyFocus: "通过构图避免重复" },
      summaryText: "围绕中国家庭书桌场景构建学习广告图。",
    },
  });

  assert.match(prompt, /中国|东亚/);
});

test("buildImagePrompt omits text_overlay entirely for multi-image prompts", () => {
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

  const parsed = JSON.parse(prompt) as { text_overlay?: unknown };
  assert.equal(parsed.text_overlay, undefined);
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

test("buildImagePrompt ignores multi-image aggregated text from structured payload", () => {
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
    channel: "应用商店",
    ctaEnabled: false,
    ctaText: null,
    descriptionPayload: {
      schemaVersion: "v1",
      channelPositioning: { channel: "应用商店", imageForm: "double", aspectRatio: "3:2" },
      adGoal: { primaryGoal: "解释功能" },
      userState: {
        audienceType: "student",
        audienceSegment: "理科薄弱学生",
        scenarioSummary: "看答案还是看不懂关键步骤",
      },
      coreSellingPoint: { primaryPoint: "拆解步骤并逐步讲清" },
      visualConcept: { mainEvent: "学生在书桌前看题", creativeAxis: "学习突破", productAnchor: "学习产品界面" },
      sceneAtmosphere: { location: "家庭书桌", lighting: "明亮", moodColor: "清新明亮的广告风格" },
      charactersAndProps: {
        characterMode: "single",
        characterSummary: "学生代表",
        expression: "专注",
        action: "低头看题",
        props: ["练习册"],
        ip: { enabled: false, role: "", placement: "", action: "", consistencyRule: "" },
      },
      composition: {
        layoutType: "wide",
        subjectPlacement: "right",
        textSafeArea: "left",
        logoSafeArea: "top-left",
        multiImageConsistency: "多图时人物、风格、品牌元素保持一致，当前图承担自身角色",
      },
      textOverlay: {
        currentText: "图一文案 / 图二文案 / 图三文案",
        textRole: "slot",
        ctaText: null,
      },
      brandConstraints: {
        brandTone: "教育可信、积极、明亮、成长导向",
        logoPolicy: "Logo 保持左上角统一规则",
      },
      variationHints: { noveltyFocus: "通过构图避免重复" },
      summaryText: "多图场景摘要",
    },
  });

  const parsed = JSON.parse(prompt) as {
    text_instruction: string;
    text_overlay?: {
      main_title: string | null;
      sub_title: string | null;
      extra_title: string | null;
    };
  };

  assert.doesNotMatch(parsed.text_instruction, /图一文案 \/ 图二文案 \/ 图三文案/);
  assert.equal(parsed.text_overlay, undefined);
});

test("buildImagePrompt can consume structured description payload as an object", () => {
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
    descriptionPayload: {
      schemaVersion: "v1",
      channelPositioning: { channel: "信息流（广点通）", imageForm: "single", aspectRatio: "16:9" },
      adGoal: { primaryGoal: "抢停留" },
      userState: {
        audienceType: "student",
        audienceSegment: "初中生",
        scenarioSummary: "孩子做题卡住",
      },
      coreSellingPoint: { primaryPoint: "拍一下就能出解析" },
      visualConcept: { mainEvent: "学生举起手机拍题", creativeAxis: "家庭书桌夜读", productAnchor: "手机拍题界面" },
      sceneAtmosphere: { location: "家庭书桌", lighting: "明亮", moodColor: "蓝色品牌感" },
      charactersAndProps: {
        characterMode: "single",
        characterSummary: "初中生",
        expression: "专注",
        action: "举起手机拍题",
        props: ["手机", "练习册"],
        ip: {
          enabled: false,
          role: "",
          placement: "",
          action: "",
          consistencyRule: "",
        },
      },
      composition: {
        layoutType: "wide",
        subjectPlacement: "right",
        logoSafeArea: "top-left",
        textSafeArea: "left",
        multiImageConsistency: "单图完整表达",
      },
      textOverlay: { currentText: "拍一下就会", textRole: "hook", ctaText: "立即下载" },
      brandConstraints: {
        brandTone: "教育可信、积极、明亮、成长导向",
        logoPolicy: "Logo 保持左上角统一规则",
      },
      variationHints: { noveltyFocus: "通过构图避免重复" },
      summaryText: "围绕学生书桌拍题场景构建信息流广告图。",
    },
  });

  const parsed = JSON.parse(prompt) as { visual_concept?: string; scene?: string };
  assert.match(parsed.visual_concept ?? "", /学生举起手机拍题/);
  assert.match(parsed.scene ?? "", /家庭书桌/);
});

test("buildImageSlotPrompt omits logo instructions when logo is disabled", () => {
  const slotPrompt = buildImageSlotPrompt({
    imageForm: "single",
    slotIndex: 1,
    slotCount: 1,
    copyType: null,
    copyTitleMain: "拍一下就会",
    copyTitleSub: "10秒出解析",
    copyTitleExtra: null,
    logo: "none",
  });

  assert.doesNotMatch(slotPrompt, /Logo 在左上角可见/);
  assert.doesNotMatch(slotPrompt, /参考 Logo/);
});

test("buildImagePrompt consumes v2 per-slot prompt payload directly", () => {
  const payload: SlotPromptPayload = {
    schemaVersion: "v2-slot-prompt",
    slotMeta: {
      slotIndex: 1,
      slotCount: 2,
      imageForm: "double",
      copyType: "因果",
      currentSlotText: "图一文案",
      slotRole: "pain_or_cause",
    },
    sharedConsistency: {
      characterConsistency: "人物一致",
      sceneConsistency: "场景一致",
      brandConsistency: "品牌一致",
      styleConsistency: "风格一致",
    },
    referencePlan: {
      referenceImages: [{ role: "logo", usage: "左上角真实露出" }],
    },
    typographyPlan: {
      layoutPattern: "title_plus_badges",
      mainTitleStyle: {
        tone: "bold_clean",
        weight: "heavy",
        outline: "thick_dark",
        shadow: "medium",
        tilt: "none",
        maxLines: 2,
      },
      subTitleStyle: {
        tone: "supportive",
        weight: "semibold",
        outline: "none",
        shadow: "none",
        container: "none",
        maxLines: 2,
      },
      emphasisWords: [{ text: "图一", style: "contrast_outline" }],
      badges: [],
      ctaStyle: null,
      backgroundSupport: {
        textAreaSupport: "blurred_panel",
        complexityBehindText: "medium",
      },
    },
    finalPromptObject: {
      prompt_version: "v2-slot",
      aspect_ratio: "3:2",
      prompt_core: "核心提示词",
      subject: "主体描述",
      scene: "场景描述",
      composition: "构图描述",
      text_instruction: "图一文案必须出现",
      brand_constraints: "Logo 左上角",
      slot_instruction: "本图承担痛点角色",
      cta: null,
    },
    negativePrompt: "bad anatomy",
    summaryText: "摘要",
  };

  const prompt = buildImagePrompt({
    directionTitle: "方向1",
    scenarioProblem: "孩子做题卡住",
    copyTitleMain: "图一文案",
    aspectRatio: "3:2",
    styleMode: "normal",
    imageStyle: "realistic",
    logo: "onion",
    imageForm: "double",
    referenceImageUrl: null,
    channel: "应用商店",
    ctaEnabled: false,
    ctaText: null,
    descriptionPayload: payload,
  });

  const parsed = JSON.parse(prompt) as Record<string, unknown>;
  assert.equal(parsed.prompt_version, undefined);
  assert.equal(parsed.slot_prompt, undefined);
  assert.equal(parsed.aspect_ratio, "3:2");
  assert.equal(parsed.prompt_core, "核心提示词");
  assert.equal(parsed.negative_prompt, "bad anatomy");
  assert.deepEqual(parsed.reference_images, [
    { index: 1, role: "logo", usage: "左上角真实露出" },
  ]);
  assert.deepEqual(parsed.typography_plan, payload.typographyPlan);
  assert.deepEqual(parsed.text_overlay, {
    main_title: "图一文案",
    sub_title: null,
    extra_title: null,
  });
  assert.equal(parsed.slot_meta, undefined);
  assert.equal(parsed.summary_text, undefined);
  assert.equal(parsed.reference_plan, undefined);
  assert.match(String(parsed.brand_constraints), /Logo 左上角/);
});

test("buildImagePrompt preserves single-image main/sub title fields in v2 payload mapping", () => {
  const payload: SlotPromptPayload = {
    schemaVersion: "v2-slot-prompt",
    slotMeta: {
      slotIndex: 1,
      slotCount: 1,
      imageForm: "single",
      copyType: "单图主副标题",
      currentSlotText: "拍一下就会 / 10秒出解析",
      slotRole: "complete_message",
    },
    sharedConsistency: {
      characterConsistency: "人物一致",
      sceneConsistency: "场景一致",
      brandConsistency: "品牌一致",
      styleConsistency: "风格一致",
    },
    referencePlan: {
      referenceImages: [
        { role: "ip", usage: "保持角色长相一致" },
        { role: "logo", usage: "左上角真实露出" },
      ],
    },
    typographyPlan: {
      layoutPattern: "left_hero_title",
      mainTitleStyle: {
        tone: "explosive",
        weight: "heavy",
        outline: "thick_white",
        shadow: "strong",
        tilt: "slight",
        maxLines: 2,
      },
      subTitleStyle: {
        tone: "supportive",
        weight: "semibold",
        outline: "none",
        shadow: "medium",
        container: "rounded_bar",
        maxLines: 2,
      },
      emphasisWords: [{ text: "拍一下", style: "highlight_fill_yellow" }],
      badges: [{ text: "试试洋葱！", style: "sticker", placement: "near_title" }],
      ctaStyle: {
        shape: "pill",
        fill: "warm_orange",
        outline: "none",
        depth: "raised",
      },
      backgroundSupport: {
        textAreaSupport: "clean_space",
        complexityBehindText: "low",
      },
    },
    finalPromptObject: {
      prompt_version: "v2-slot",
      aspect_ratio: "16:9",
      prompt_core: "核心提示词",
      subject: "中国初中生，与豆包角色同框，年龄感明确，不要过成熟",
      scene: "卡题场景",
      composition: "单图完整承载主副标题，并预留 CTA 区域",
      text_instruction: "主标题和副标题都要出现",
      brand_constraints: "Logo 左上角",
      slot_instruction: "当前图承担 complete_message 角色",
      cta: {
        text: "立即下载",
        instruction: "在信息流单图中加入 CTA 按钮",
      },
    },
    negativePrompt: "bad anatomy",
    summaryText: "摘要",
  };

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
    descriptionPayload: payload,
  });

  const parsed = JSON.parse(prompt) as {
    text_overlay?: {
      main_title: string;
      sub_title: string | null;
      extra_title: string | null;
    };
    reference_images?: Array<{ index: number; role: string; usage: string }>;
  };

  assert.deepEqual(parsed.text_overlay, {
    main_title: "拍一下就会",
    sub_title: "10秒出解析",
    extra_title: null,
  });
  assert.deepEqual(parsed.reference_images, [
    { index: 1, role: "ip", usage: "保持角色长相一致" },
    { index: 2, role: "logo", usage: "左上角真实露出" },
  ]);
  assert.deepEqual((parsed as { typography_plan?: unknown }).typography_plan, payload.typographyPlan);
});
