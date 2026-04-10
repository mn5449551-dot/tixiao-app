import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFallbackImageDescriptionPayload,
  buildImageDescriptionMessages,
  buildSlotImageDescriptionMessages,
  generateSlotImagePrompt,
  normalizeSlotPromptPayload,
  type SharedBaseContext,
  type SlotSpecificContext,
} from "../ai/agents/image-description-agent";

const sharedBaseFixture: SharedBaseContext = {
  direction: {
    title: "作业卡壳秒解决",
    targetAudience: "初中生",
    scenarioProblem: "卡题",
    differentiation: "拍题拆解",
    effect: "继续写下去",
    channel: "应用商店",
  },
  copySet: {
    titleMain: "图一文案",
    titleSub: "图二文案",
    titleExtra: null,
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
    ipDescription: "篮球少年 · 阳光活力型",
    ipPromptKeywords: "dark spiky hair",
  },
  referenceImages: [
    { role: "ip", url: "data:image/png;base64,ip", usage: "保持角色长相一致" },
    { role: "logo", url: "data:image/png;base64,logo", usage: "左上角真实露出" },
  ],
  consistencyConstraints: {
    sameCharacterIdentity: true,
    sameOutfitAndHair: true,
    sameSceneFamily: true,
    sameBrandSystem: true,
    sameLightingTone: true,
    allowPoseChange: true,
    allowCameraVariation: true,
  },
};

const slotFixture: SlotSpecificContext = {
  slotIndex: 2,
  slotCount: 2,
  currentSlotText: "拍题拆解",
  allSlotTexts: ["图一文案", "图二文案"],
  slotRole: "solution_or_result",
  mustShowTextMode: "single_text",
  mustNotRepeat: "不要重复痛点图",
  layoutExpectation: "突出产品介入",
};

type SharedBaseFixtureOverrides = {
  direction?: Partial<SharedBaseContext["direction"]>;
  copySet?: Partial<SharedBaseContext["copySet"]>;
  config?: Partial<SharedBaseContext["config"]>;
  ip?: Partial<SharedBaseContext["ip"]>;
  referenceImages?: SharedBaseContext["referenceImages"];
  consistencyConstraints?: Partial<SharedBaseContext["consistencyConstraints"]>;
};

function buildSharedBaseFixture(overrides?: SharedBaseFixtureOverrides): SharedBaseContext {
  return {
    ...sharedBaseFixture,
    direction: {
      ...sharedBaseFixture.direction,
      ...overrides?.direction,
    },
    copySet: {
      ...sharedBaseFixture.copySet,
      ...overrides?.copySet,
    },
    config: {
      ...sharedBaseFixture.config,
      ...overrides?.config,
    },
    ip: {
      ...sharedBaseFixture.ip,
      ...overrides?.ip,
    },
    referenceImages: overrides?.referenceImages ?? sharedBaseFixture.referenceImages,
    consistencyConstraints: {
      ...sharedBaseFixture.consistencyConstraints,
      ...overrides?.consistencyConstraints,
    },
  };
}

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
  assert.match(messages[0]?.content ?? "", /输出契约|输出要求/);
  assert.match(messages[0]?.content ?? "", /只输出一个 JSON 对象/);
  assert.doesNotMatch(messages[0]?.content ?? "", /只输出纯文本描述/);
  assert.match(messages[1]?.content ?? "", /CTA：立即下载/);
});

test("buildSlotImageDescriptionMessages emits a system message and multimodal slot-specific user content", () => {
  const messages = buildSlotImageDescriptionMessages({
    sharedBase: sharedBaseFixture,
    slot: slotFixture,
  });
  const content = messages[1]?.content;

  assert.equal(messages[0]?.role, "system");
  assert.equal(messages[1]?.role, "user");
  assert.ok(Array.isArray(content));
  assert.equal(content?.[0]?.type, "text");
  assert.equal(content?.[1]?.type, "text");
  assert.equal(content?.[2]?.type, "image_url");
  assert.equal(content?.[3]?.type, "text");
  assert.equal(content?.[4]?.type, "image_url");
  assert.match(content?.[1]?.text ?? "", /参考图1：IP角色参考图/);
  assert.match(content?.[1]?.text ?? "", /保持角色长相一致/);
  assert.match(content?.[3]?.text ?? "", /参考图2：Logo参考图/);
  assert.match(content?.[3]?.text ?? "", /左上角真实露出/);
  assert.match(JSON.stringify(messages[1]), /参考图1：IP角色参考图/);
  assert.match(JSON.stringify(messages[1]), /参考图2：Logo参考图/);
  assert.match(JSON.stringify(messages[1]), /solution_or_result/);
});

test("buildSlotImageDescriptionMessages includes CTA source-of-truth fields for information-flow single-image slots", () => {
  const messages = buildSlotImageDescriptionMessages({
    sharedBase: buildSharedBaseFixture({
      direction: {
        channel: "信息流（广点通）",
      },
      config: {
        imageForm: "single",
        ctaEnabled: true,
        ctaText: "立即下载",
      },
    }),
    slot: {
      ...slotFixture,
      slotIndex: 1,
      slotCount: 1,
      slotRole: "complete_message",
    },
  });

  assert.match(JSON.stringify(messages[1]), /ctaEnabled: true/);
  assert.match(JSON.stringify(messages[1]), /ctaText: 立即下载/);
});

test("normalizeSlotPromptPayload returns a v2 slot prompt object with non-empty finalPromptObject.prompt_core", () => {
  const payload = normalizeSlotPromptPayload(
    {
      sharedBase: sharedBaseFixture,
      slot: {
        ...slotFixture,
        slotIndex: 1,
      },
    },
    {
      slotMeta: {
        slotIndex: 99,
        slotCount: 99,
        imageForm: "double",
        copyType: "被模型篡改",
        currentSlotText: "模型改写文案",
        slotRole: "model_override",
      },
      finalPromptObject: {
        prompt_version: "v2-slot",
        aspect_ratio: "3:2",
        prompt_core: "",
        subject: "学生与IP角色",
        scene: "作业场景",
        composition: "中景构图",
        text_instruction: "图一文案清晰可读",
        brand_constraints: "Logo左上角",
        slot_instruction: "承担痛点角色",
        cta: null,
      },
      summaryText: "共享底座下的第一张图",
    },
  );

  assert.equal(payload.schemaVersion, "v2-slot-prompt");
  assert.equal(payload.slotMeta.slotIndex, 1);
  assert.equal(payload.slotMeta.slotCount, 2);
  assert.equal(payload.slotMeta.copyType, "因果");
  assert.equal(payload.slotMeta.currentSlotText, "拍题拆解");
  assert.equal(payload.slotMeta.slotRole, "solution_or_result");
  assert.ok(payload.finalPromptObject.prompt_core.length > 0);
  assert.match(payload.finalPromptObject.subject, /初中生/);
  assert.match(payload.finalPromptObject.subject, /年龄感明确|不要过成熟/);
  assert.match(payload.finalPromptObject.prompt_core, /拍题拆解/);
  assert.match(payload.finalPromptObject.prompt_core, /解决动作|结果状态/);
  assert.match(payload.finalPromptObject.prompt_core, /Logo左上角|Logo 必须真实出现在左上角/);
});

test("normalizeSlotPromptPayload only includes CTA for information-flow single-image slots", () => {
  const payload = normalizeSlotPromptPayload(
    {
      sharedBase: buildSharedBaseFixture({
        direction: {
          channel: "应用商店",
        },
        config: {
          imageForm: "single",
          ctaEnabled: true,
          ctaText: "立即下载",
        },
      }),
      slot: {
        ...slotFixture,
        slotIndex: 1,
        slotCount: 1,
        slotRole: "complete_message",
      },
    },
    {},
  );

  assert.equal(payload.finalPromptObject.cta, null);
});

test("normalizeSlotPromptPayload normalizes nested fields field-by-field instead of trusting raw model objects", () => {
  const payload = normalizeSlotPromptPayload(
    {
      sharedBase: buildSharedBaseFixture({
        direction: {
          channel: "信息流（广点通）",
        },
        config: {
          imageForm: "single",
          ctaEnabled: true,
          ctaText: "立即下载",
        },
      }),
      slot: {
        ...slotFixture,
        slotIndex: 1,
        slotCount: 1,
        slotRole: "complete_message",
      },
    },
    {
      sharedConsistency: {
        characterConsistency: { unsafe: true } as unknown as string,
        sceneConsistency: "保留这个场景约束",
        brandConsistency: "" as unknown as string,
        styleConsistency: 42 as unknown as string,
      },
      referencePlan: {
        referenceImages: [
          { role: "logo", usage: 123 as unknown as string },
          { role: 7 as unknown as string, usage: "bad" },
        ],
      },
      finalPromptObject: {
        prompt_version: "v2-slot",
        aspect_ratio: "3:2",
        prompt_core: "已有核心词",
        subject: "主体",
        scene: "场景",
        composition: "构图",
        text_instruction: "文案",
        brand_constraints: "品牌约束",
        slot_instruction: "图位职责",
        cta: {
          text: "立即下载",
          instruction: 123 as unknown as string,
        },
      },
    },
  );

  assert.equal(typeof payload.sharedConsistency.characterConsistency, "string");
  assert.match(payload.sharedConsistency.sceneConsistency, /同一场景家族/);
  assert.notEqual(payload.sharedConsistency.brandConsistency, "");
  assert.equal(typeof payload.sharedConsistency.styleConsistency, "string");
  assert.deepEqual(payload.referencePlan.referenceImages, [
    { role: "ip", usage: "保持角色长相一致" },
    { role: "logo", usage: "左上角真实露出" },
  ]);
  assert.deepEqual(payload.finalPromptObject.cta, {
    text: "立即下载",
    instruction: "仅在信息流单图中以按钮形式呈现“立即下载”。",
  });
});

test("normalizeSlotPromptPayload does not allow model CTA text to drift from allowed CTA constraints", () => {
  const payload = normalizeSlotPromptPayload(
    {
      sharedBase: buildSharedBaseFixture({
        direction: {
          channel: "信息流（广点通）",
        },
        config: {
          imageForm: "single",
          ctaEnabled: true,
          ctaText: "立即下载",
        },
      }),
      slot: {
        ...slotFixture,
        slotIndex: 1,
        slotCount: 1,
        slotRole: "complete_message",
      },
    },
    {
      finalPromptObject: {
        prompt_version: "v2-slot",
        aspect_ratio: "3:2",
        prompt_core: "已有核心词",
        subject: "主体",
        scene: "场景",
        composition: "构图",
        text_instruction: "文案",
        brand_constraints: "品牌约束",
        slot_instruction: "图位职责",
        cta: {
          text: "马上体验",
          instruction: "用马上体验按钮",
        },
      },
    },
  );

  assert.deepEqual(payload.finalPromptObject.cta, {
    text: "立即下载",
    instruction: "仅在信息流单图中以按钮形式呈现“立即下载”。",
  });
  assert.match(payload.finalPromptObject.prompt_core, /立即下载/);
});

test("normalizeSlotPromptPayload preserves the full shared-base reference set when model returns only a partial reference list", () => {
  const payload = normalizeSlotPromptPayload(
    {
      sharedBase: sharedBaseFixture,
      slot: slotFixture,
    },
    {
      referencePlan: {
        referenceImages: [{ role: "ip", usage: "保持角色长相一致" }],
      },
    },
  );

  assert.deepEqual(payload.referencePlan.referenceImages, [
    { role: "ip", usage: "保持角色长相一致" },
    { role: "logo", usage: "左上角真实露出" },
  ]);
});

test("normalizeSlotPromptPayload keeps trusted same-index reference usage even when model provides matching roles with conflicting usage", () => {
  const payload = normalizeSlotPromptPayload(
    {
      sharedBase: sharedBaseFixture,
      slot: slotFixture,
    },
    {
      referencePlan: {
        referenceImages: [
          { role: "ip", usage: "模型改写IP用途" },
          { role: "logo", usage: "模型改写Logo用途" },
        ],
      },
    },
  );

  assert.deepEqual(payload.referencePlan.referenceImages, [
    { role: "ip", usage: "保持角色长相一致" },
    { role: "logo", usage: "左上角真实露出" },
  ]);
});

test("normalizeSlotPromptPayload preserves shared-base reference identities when model returns malformed same-length roles", () => {
  const payload = normalizeSlotPromptPayload(
    {
      sharedBase: sharedBaseFixture,
      slot: slotFixture,
    },
    {
      referencePlan: {
        referenceImages: [
          { role: "style", usage: "错误替换IP" },
          { role: "style", usage: "错误替换Logo" },
        ],
      },
    },
  );

  assert.deepEqual(payload.referencePlan.referenceImages, [
    { role: "ip", usage: "保持角色长相一致" },
    { role: "logo", usage: "左上角真实露出" },
  ]);
});

test("normalizeSlotPromptPayload keeps slot identity caller-owned instead of accepting model slotMeta overrides", () => {
  const payload = normalizeSlotPromptPayload(
    {
      sharedBase: sharedBaseFixture,
      slot: slotFixture,
    },
    {
      slotMeta: {
        slotIndex: "3" as unknown as number,
        slotCount: "9" as unknown as number,
        imageForm: "double",
        copyType: "模型定义的新copyType",
        currentSlotText: "图三文案",
        slotRole: "result_upgrade",
      },
    },
  );

  assert.equal(payload.slotMeta.slotIndex, 2);
  assert.equal(payload.slotMeta.slotCount, 2);
  assert.equal(payload.slotMeta.currentSlotText, "拍题拆解");
  assert.equal(payload.slotMeta.slotRole, "solution_or_result");
  assert.equal(payload.slotMeta.copyType, "因果");
});

test("normalizeSlotPromptPayload carries all declared consistency controls through the v2 output", () => {
  const payload = normalizeSlotPromptPayload(
    {
      sharedBase: buildSharedBaseFixture({
        consistencyConstraints: {
          sameOutfitAndHair: true,
          allowPoseChange: true,
          allowCameraVariation: true,
        },
      }),
      slot: slotFixture,
    },
    {},
  );

  assert.match(payload.sharedConsistency.characterConsistency, /服装|发型/);
  assert.match(payload.sharedConsistency.sceneConsistency, /姿态|pose/);
  assert.match(payload.sharedConsistency.styleConsistency, /镜头|机位|camera/);
});

test("normalizeSlotPromptPayload keeps sharedConsistency anchored to caller-owned shared base even when model returns conflicting non-empty strings", () => {
  const payload = normalizeSlotPromptPayload(
    {
      sharedBase: sharedBaseFixture,
      slot: slotFixture,
    },
    {
      sharedConsistency: {
        characterConsistency: "模型说角色可以随便换",
        sceneConsistency: "模型说可以随便换场景",
        brandConsistency: "模型说Logo可以自由飘",
        styleConsistency: "模型说风格完全不用统一",
      },
    },
  );

  assert.match(payload.sharedConsistency.characterConsistency, /同一角色身份/);
  assert.doesNotMatch(payload.sharedConsistency.characterConsistency, /随便换/);
  assert.match(payload.sharedConsistency.sceneConsistency, /同一场景家族/);
  assert.doesNotMatch(payload.sharedConsistency.sceneConsistency, /随便换场景/);
  assert.match(payload.sharedConsistency.brandConsistency, /Logo规则与品牌露出方式一致/);
  assert.doesNotMatch(payload.sharedConsistency.brandConsistency, /自由飘/);
  assert.match(payload.sharedConsistency.styleConsistency, /统一审美|整体风格完成度/);
  assert.doesNotMatch(payload.sharedConsistency.styleConsistency, /完全不用统一/);
});

test("normalizeSlotPromptPayload fallback summaryText uses normalized slot metadata instead of raw input slot values", () => {
  const payload = normalizeSlotPromptPayload(
    {
      sharedBase: sharedBaseFixture,
      slot: slotFixture,
    },
    {
      slotMeta: {
        slotIndex: "3" as unknown as number,
        slotCount: "2" as unknown as number,
        imageForm: "double",
        copyType: "因果",
        currentSlotText: "图三文案",
        slotRole: "result_upgrade",
      },
      summaryText: "",
    },
  );

  assert.match(payload.summaryText, /第2张图/);
  assert.match(payload.summaryText, /解决动作|结果状态/);
  assert.match(payload.summaryText, /拍题拆解/);
});

test("normalizeSlotPromptPayload fallback prompt fields use normalized slot metadata instead of raw input slot values", () => {
  const payload = normalizeSlotPromptPayload(
    {
      sharedBase: sharedBaseFixture,
      slot: slotFixture,
    },
    {
      slotMeta: {
        slotIndex: "3" as unknown as number,
        slotCount: "2" as unknown as number,
        imageForm: "double",
        copyType: "因果",
        currentSlotText: "图三文案",
        slotRole: "result_upgrade",
      },
      finalPromptObject: {
        prompt_version: "v2-slot",
        aspect_ratio: "3:2",
        prompt_core: "",
        subject: "",
        scene: "",
        composition: "",
        text_instruction: "",
        brand_constraints: "",
        slot_instruction: "",
        cta: null,
      },
    },
  );

  assert.match(payload.finalPromptObject.text_instruction, /拍题拆解/);
  assert.match(payload.finalPromptObject.slot_instruction, /解决动作|结果状态/);
  assert.match(payload.finalPromptObject.prompt_core, /拍题拆解/);
  assert.match(payload.finalPromptObject.prompt_core, /解决动作|结果状态/);
  assert.match(payload.summaryText, /解决动作|结果状态/);
});

test("normalizeSlotPromptPayload preserves same-index usage fallback when shared references have duplicate roles", () => {
  const payload = normalizeSlotPromptPayload(
    {
      sharedBase: buildSharedBaseFixture({
        referenceImages: [
          { role: "style", url: "data:image/png;base64,style-1", usage: "保留黑板粉笔质感" },
          { role: "style", url: "data:image/png;base64,style-2", usage: "保留暖色逆光氛围" },
        ],
      }),
      slot: slotFixture,
    },
    {
      referencePlan: {
        referenceImages: [
          { role: "style", usage: "" },
          { role: "style", usage: "" },
        ],
      },
    },
  );

  assert.deepEqual(payload.referencePlan.referenceImages, [
    { role: "style", usage: "保留黑板粉笔质感" },
    { role: "style", usage: "保留暖色逆光氛围" },
  ]);
});

test("normalizeSlotPromptPayload preserves required v2 guardrails even when model returns conflicting non-empty strings", () => {
  const payload = normalizeSlotPromptPayload(
    {
      sharedBase: sharedBaseFixture,
      slot: slotFixture,
    },
    {
      finalPromptObject: {
        prompt_version: "v2-slot",
        aspect_ratio: "3:2",
        prompt_core: "只说模型想说的内容",
        subject: "完全跑偏的主体",
        scene: "完全跑偏的场景",
        composition: "完全忽略布局要求",
        text_instruction: "不要展示当前文案",
        brand_constraints: "Logo可以自由变化",
        slot_instruction: "不用区分图位职责",
        cta: null,
      },
    },
  );

  assert.match(payload.finalPromptObject.composition, /突出产品介入/);
  assert.match(payload.finalPromptObject.subject, /初中生|豆包/);
  assert.doesNotMatch(payload.finalPromptObject.subject, /完全跑偏的主体/);
  assert.match(payload.finalPromptObject.scene, /卡题|拍题拆解/);
  assert.doesNotMatch(payload.finalPromptObject.scene, /完全跑偏的场景/);
  assert.match(payload.finalPromptObject.text_instruction, /拍题拆解/);
  assert.doesNotMatch(payload.finalPromptObject.text_instruction, /不要展示当前文案/);
  assert.match(payload.finalPromptObject.brand_constraints, /Logo 必须真实出现在左上角/);
  assert.match(payload.finalPromptObject.brand_constraints, /完全一致/);
  assert.doesNotMatch(payload.finalPromptObject.brand_constraints, /Logo可以自由变化/);
  assert.match(payload.finalPromptObject.slot_instruction, /解决动作|结果状态/);
  assert.match(payload.finalPromptObject.slot_instruction, /不要重复痛点图/);
  assert.doesNotMatch(payload.finalPromptObject.slot_instruction, /不用区分图位职责/);
  assert.match(payload.finalPromptObject.prompt_core, /初中生|豆包/);
  assert.match(payload.finalPromptObject.prompt_core, /卡题|拍题拆解/);
  assert.match(payload.finalPromptObject.prompt_core, /突出产品介入/);
  assert.match(payload.finalPromptObject.prompt_core, /拍题拆解/);
  assert.match(payload.finalPromptObject.prompt_core, /不要重复痛点图/);
  assert.match(payload.finalPromptObject.prompt_core, /完全一致/);
  assert.match(payload.finalPromptObject.prompt_core, /解决动作|结果状态/);
  assert.doesNotMatch(payload.finalPromptObject.prompt_core, /不要展示当前文案|Logo可以自由变化|不用区分图位职责/);
});

test("normalizeSlotPromptPayload keeps aspect ratio caller-owned instead of accepting model drift", () => {
  const payload = normalizeSlotPromptPayload(
    {
      sharedBase: sharedBaseFixture,
      slot: slotFixture,
    },
    {
      finalPromptObject: {
        prompt_version: "v2-slot",
        aspect_ratio: "16:9",
        prompt_core: "模型核心词",
        subject: "主体",
        scene: "场景",
        composition: "构图",
        text_instruction: "文案指令",
        brand_constraints: "品牌约束",
        slot_instruction: "图位职责",
        cta: null,
      },
    },
  );

  assert.equal(payload.finalPromptObject.aspect_ratio, "3:2");
});

test("normalizeSlotPromptPayload adds typography plan for information-flow single-image slots", () => {
  const payload = normalizeSlotPromptPayload(
    {
      sharedBase: buildSharedBaseFixture({
        direction: {
          channel: "信息流（广点通）",
        },
        config: {
          imageForm: "single",
          ctaEnabled: true,
          ctaText: "立即下载",
        },
      }),
      slot: {
        ...slotFixture,
        slotIndex: 1,
        slotCount: 1,
        currentSlotText: "拍题解析看不懂？",
        slotRole: "complete_message",
        mustShowTextMode: "main_and_sub_same_frame",
        layoutExpectation: "单图完整承载主副标题，并为 CTA「立即下载」预留清晰区域。",
      },
    },
    {},
  );

  assert.equal(payload.typographyPlan.layoutPattern, "left_hero_title");
  assert.equal(payload.typographyPlan.mainTitleStyle.tone, "explosive");
  assert.equal(payload.typographyPlan.mainTitleStyle.outline, "thick_white");
  assert.equal(payload.typographyPlan.ctaStyle?.shape, "pill");
  assert.equal(payload.typographyPlan.ctaStyle?.fill, "warm_orange");
  assert.equal(payload.typographyPlan.backgroundSupport.textAreaSupport, "clean_space");
  assert.ok(payload.typographyPlan.emphasisWords.some((item) => item.text.includes("看不懂")));
});

test("normalizeSlotPromptPayload forces no-logo brand constraints when logo is disabled even if model hallucinates logo rules", () => {
  const payload = normalizeSlotPromptPayload(
    {
      sharedBase: buildSharedBaseFixture({
        config: {
          logo: "none",
        },
      }),
      slot: slotFixture,
    },
    {
      finalPromptObject: {
        prompt_version: "v2-slot",
        aspect_ratio: "3:2",
        prompt_core: "模型核心词",
        subject: "主体",
        scene: "场景",
        composition: "构图",
        text_instruction: "文案",
        brand_constraints: "Logo必须放在右下角",
        slot_instruction: "图位职责",
        cta: null,
      },
    },
  );

  assert.equal(payload.finalPromptObject.brand_constraints, "无 Logo 强制露出。");
  assert.doesNotMatch(payload.finalPromptObject.prompt_core, /右下角/);
});

test("normalizeSlotPromptPayload falls back to default CTA text when ctaText is an empty string", () => {
  const payload = normalizeSlotPromptPayload(
    {
      sharedBase: buildSharedBaseFixture({
        direction: {
          channel: "信息流（广点通）",
        },
        config: {
          imageForm: "single",
          ctaEnabled: true,
          ctaText: "",
        },
      }),
      slot: {
        ...slotFixture,
        slotIndex: 1,
        slotCount: 1,
        slotRole: "complete_message",
      },
    },
    {},
  );

  assert.deepEqual(payload.finalPromptObject.cta, {
    text: "立即下载",
    instruction: "仅在信息流单图中以按钮形式呈现“立即下载”。",
  });
});

test("generateSlotImagePrompt falls back to normalized defaults when multimodal model call fails", async () => {
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.NEW_API_KEY;
  process.env.NEW_API_KEY = "test-key";
  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;

  try {
    const payload = await generateSlotImagePrompt({
      sharedBase: buildSharedBaseFixture({
        direction: {
          channel: "信息流（广点通）",
        },
        config: {
          imageForm: "single",
          ctaEnabled: true,
          ctaText: "立即下载",
        },
      }),
      slot: {
        ...slotFixture,
        slotIndex: 1,
        slotCount: 1,
        slotRole: "complete_message",
      },
    });

    assert.equal(payload.schemaVersion, "v2-slot-prompt");
    assert.ok(payload.finalPromptObject.prompt_core.length > 0);
    assert.deepEqual(payload.finalPromptObject.cta, {
      text: "立即下载",
      instruction: "仅在信息流单图中以按钮形式呈现“立即下载”。",
    });
  } finally {
    globalThis.fetch = previousFetch;
    process.env.NEW_API_KEY = previousApiKey;
  }
});

test("generateSlotImagePrompt parses successful multimodal responses and normalizes them through the v2 path", async () => {
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
                slotMeta: {
                  slotIndex: 99,
                  slotCount: 99,
                  imageForm: "double",
                  copyType: "模型copyType",
                  currentSlotText: "模型文案",
                  slotRole: "model_role",
                },
                finalPromptObject: {
                  prompt_version: "v2-slot",
                  aspect_ratio: "16:9",
                  prompt_core: "模型核心词里没有任何必需约束",
                  subject: "模型主体",
                  scene: "模型场景",
                  composition: "模型构图",
                  text_instruction: "模型文案指令",
                  brand_constraints: "模型品牌约束",
                  slot_instruction: "模型图位职责",
                  cta: {
                    text: "马上体验",
                    instruction: "模型CTA",
                  },
                },
                referencePlan: {
                  referenceImages: [{ role: "ip", usage: "模型IP用途" }],
                },
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )) as typeof fetch;

  try {
    const payload = await generateSlotImagePrompt({
      sharedBase: buildSharedBaseFixture({
        direction: {
          channel: "信息流（广点通）",
        },
        config: {
          imageForm: "single",
          ctaEnabled: true,
          ctaText: "立即下载",
        },
      }),
      slot: {
        ...slotFixture,
        slotIndex: 1,
        slotCount: 1,
        currentSlotText: "真正图位文案",
        slotRole: "complete_message",
      },
    });

    assert.equal(payload.slotMeta.slotIndex, 1);
    assert.equal(payload.slotMeta.slotCount, 1);
    assert.equal(payload.slotMeta.currentSlotText, "真正图位文案");
    assert.equal(payload.slotMeta.slotRole, "complete_message");
    assert.equal(payload.slotMeta.copyType, "因果");
    assert.equal(payload.finalPromptObject.aspect_ratio, "3:2");
    assert.match(payload.finalPromptObject.text_instruction, /真正图位文案/);
    assert.match(payload.finalPromptObject.slot_instruction, /完整表达主信息/);
    assert.match(payload.finalPromptObject.prompt_core, /真正图位文案/);
    assert.match(payload.finalPromptObject.prompt_core, /完整表达主信息/);
    assert.match(payload.finalPromptObject.prompt_core, /立即下载/);
    assert.deepEqual(payload.finalPromptObject.cta, {
      text: "立即下载",
      instruction: "仅在信息流单图中以按钮形式呈现“立即下载”。",
    });
    assert.deepEqual(payload.referencePlan.referenceImages, [
      { role: "ip", usage: "保持角色长相一致" },
      { role: "logo", usage: "左上角真实露出" },
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    process.env.NEW_API_KEY = previousApiKey;
  }
});
