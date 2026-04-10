import { IMAGE_STYLE_DESCRIPTIONS } from "@/lib/constants";
import {
  createChatCompletion,
  createMultimodalChatCompletion,
  type MultimodalChatMessage,
} from "@/lib/ai/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const rulesPath = resolve(process.cwd(), "../开发文档/知识库/画面描述生成规则.md");
let rulesContent: string | null = null;
try {
  rulesContent = readFileSync(rulesPath, "utf-8");
} catch {
  // Rules file not available — proceed with inline defaults.
}

export type ImageDescriptionPayload = {
  schemaVersion: "v1";
  channelPositioning: {
    channel: string;
    imageForm: string;
    aspectRatio: string;
  };
  adGoal: {
    primaryGoal: string;
  };
  userState: {
    audienceType: "student" | "parent";
    audienceSegment: string;
    scenarioSummary: string;
  };
  coreSellingPoint: {
    primaryPoint: string;
  };
  visualConcept: {
    mainEvent: string;
    creativeAxis: string;
    productAnchor: string;
  };
  sceneAtmosphere: {
    location: string;
    lighting: string;
    moodColor: string;
  };
  charactersAndProps: {
    characterMode: "single" | "duo" | "group";
    characterSummary: string;
    expression: string;
    action: string;
    props: string[];
    ip: {
      enabled: boolean;
      role: string;
      placement: string;
      action: string;
      consistencyRule: string;
    };
  };
  composition: {
    layoutType: "wide" | "square" | "vertical";
    subjectPlacement: string;
    textSafeArea: string;
    logoSafeArea: "top-left";
    multiImageConsistency: string;
  };
  textOverlay: {
    currentText: string;
    textRole: string;
    ctaText: string | null;
  };
  brandConstraints: {
    brandTone: string;
    logoPolicy: string;
  };
  variationHints: {
    noveltyFocus: string;
  };
  summaryText: string;
};

export type SharedBaseContext = {
  direction: {
    title: string;
    targetAudience: string;
    scenarioProblem: string;
    differentiation: string;
    effect: string;
    channel: string;
  };
  copySet: {
    titleMain: string;
    titleSub: string | null;
    titleExtra: string | null;
    copyType: string | null;
  };
  config: {
    imageForm: "single" | "double" | "triple";
    aspectRatio: string;
    styleMode: "normal" | "ip";
    imageStyle: string;
    logo: "onion" | "onion_app" | "none";
    ctaEnabled: boolean;
    ctaText: string | null;
  };
  ip: {
    ipRole: string | null;
    ipDescription: string | null;
    ipPromptKeywords: string | null;
  };
  referenceImages: Array<{
    role: "ip" | "logo" | "style" | string;
    url: string;
    usage: string;
  }>;
  consistencyConstraints: {
    sameCharacterIdentity: boolean;
    sameOutfitAndHair: boolean;
    sameSceneFamily: boolean;
    sameBrandSystem: boolean;
    sameLightingTone: boolean;
    allowPoseChange: boolean;
    allowCameraVariation: boolean;
  };
};

export type SlotSpecificContext = {
  slotIndex: number;
  slotCount: number;
  currentSlotText: string;
  allSlotTexts: string[];
  slotRole: string;
  mustShowTextMode: string;
  mustNotRepeat: string;
  layoutExpectation: string;
};

export type SlotPromptPayload = {
  schemaVersion: "v2-slot-prompt";
  slotMeta: {
    slotIndex: number;
    slotCount: number;
    imageForm: string;
    copyType: string | null;
    currentSlotText: string;
    slotRole: string;
  };
  sharedConsistency: {
    characterConsistency: string;
    sceneConsistency: string;
    brandConsistency: string;
    styleConsistency: string;
  };
  referencePlan: {
    referenceImages: Array<{
      role: string;
      usage: string;
    }>;
  };
  finalPromptObject: {
    prompt_version: "v2-slot";
    aspect_ratio: string;
    prompt_core: string;
    subject: string;
    scene: string;
    composition: string;
    text_instruction: string;
    brand_constraints: string;
    slot_instruction: string;
    cta: null | {
      text: string;
      instruction: string;
    };
  };
  negativePrompt: string;
  summaryText: string;
};

function getReferenceRoleLabel(role: string) {
  if (role === "ip") return "IP角色参考图";
  if (role === "logo") return "Logo参考图";
  if (role === "style") return "风格参考图";
  return `${role}参考图`;
}

function buildSharedConsistency(sharedBase: SharedBaseContext) {
  return {
    characterConsistency: sharedBase.consistencyConstraints.sameCharacterIdentity
      ? sharedBase.consistencyConstraints.sameOutfitAndHair
        ? "保持同一角色身份，并延续服装、发型与整体角色识别特征。"
        : "保持同一角色身份，但服装与发型允许在统一人设内做轻微变化。"
      : "角色身份允许变化，但需维持整体创意方向稳定。",
    sceneConsistency: sharedBase.consistencyConstraints.sameSceneFamily
      ? sharedBase.consistencyConstraints.allowPoseChange
        ? "保持同一场景家族与世界观，避免每张图脱节，同时允许人物姿态变化。"
        : "保持同一场景家族与世界观，避免每张图脱节，人物姿态尽量稳定。"
      : sharedBase.consistencyConstraints.allowPoseChange
        ? "场景可变化，但需要保持同一广告叙事链路，并允许人物姿态变化。"
        : "场景可变化，但需要保持同一广告叙事链路，人物姿态尽量稳定。",
    brandConsistency: sharedBase.consistencyConstraints.sameBrandSystem
      ? "保持同一品牌系统，Logo规则与品牌露出方式一致。"
      : "品牌可灵活呈现，但不得破坏识别性。",
    styleConsistency: sharedBase.consistencyConstraints.sameLightingTone
      ? sharedBase.consistencyConstraints.allowCameraVariation
        ? "保持同一光感、色调与整体风格完成度，同时允许镜头与机位变化。"
        : "保持同一光感、色调与整体风格完成度，镜头与机位尽量稳定。"
      : sharedBase.consistencyConstraints.allowCameraVariation
        ? "风格可微调，但应保持组图统一审美，并允许镜头与机位变化。"
        : "风格可微调，但应保持组图统一审美，镜头与机位尽量稳定。",
  };
}

function normalizeNonEmptyString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizePositiveNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
}

function buildAudienceSubject(input: SharedBaseContext) {
  const audience = input.direction.targetAudience;
  if (audience.includes("家长")) {
    return input.ip.ipRole
      ? `中国家长形象，与${input.ip.ipRole}角色同框，家庭教育场景气质自然可信`
      : "中国家长形象，家庭教育场景气质自然可信";
  }

  if (audience.includes("初中") || audience.includes("学生")) {
    return input.ip.ipRole
      ? `中国初中生，与${input.ip.ipRole}角色同框，年龄感明确，不要过成熟`
      : "中国初中生，年龄感明确，不要过成熟";
  }

  return input.ip.ipRole
    ? `中国学生或家长代表，与${input.ip.ipRole}角色同框，人物身份需与学习场景匹配`
    : "中国学生或家长代表，人物身份需与学习场景匹配";
}

function describeSlotRole(slotRole: string) {
  switch (slotRole) {
    case "complete_message":
      return "完整表达主信息";
    case "pain_or_cause":
      return "重点表现人物遇到问题时的卡顿、困惑和阻碍感";
    case "solution_or_result":
      return "重点表现产品介入后的解决动作或结果状态";
    case "before_state":
      return "重点表现变化前的原始状态";
    case "after_state":
      return "重点表现变化后的改善状态";
    case "starting_point":
      return "重点表现起点状态和第一步认知";
    case "next_step":
      return "重点表现下一步动作和推进状态";
    case "problem_entry":
      return "重点表现问题引入和最初卡点";
    case "process_action":
      return "重点表现解决过程中的关键动作";
    case "result_upgrade":
      return "重点表现结果升级和最终收益";
    case "cause":
      return "重点表现原因或痛点来源";
    case "intervention":
      return "重点表现解决介入动作";
    case "effect":
      return "重点表现结果和收益状态";
    case "selling_point_1":
      return "重点表现第一卖点";
    case "selling_point_2":
      return "重点表现第二卖点";
    case "selling_point_3":
      return "重点表现第三卖点";
    case "main_problem":
      return "重点表现主问题";
    case "supporting_solution":
      return "重点表现补充解决方案";
    case "supporting_benefit":
      return "重点表现补充收益";
    default:
      return "重点表现当前图位职责";
  }
}

function isInformationFlowSingleImage(input: { sharedBase: SharedBaseContext }) {
  return input.sharedBase.config.imageForm === "single" && input.sharedBase.direction.channel.includes("信息流");
}

function normalizeSharedConsistency(
  raw: Partial<SlotPromptPayload>["sharedConsistency"] | undefined,
  fallback: SlotPromptPayload["sharedConsistency"],
) {
  void raw;
  return {
    characterConsistency: fallback.characterConsistency,
    sceneConsistency: fallback.sceneConsistency,
    brandConsistency: fallback.brandConsistency,
    styleConsistency: fallback.styleConsistency,
  };
}

function normalizeReferenceImages(
  sharedBase: SharedBaseContext,
  rawReferenceImages: SlotPromptPayload["referencePlan"]["referenceImages"] | undefined,
) {
  return sharedBase.referenceImages.map((sharedReference, index) => {
    const reference = rawReferenceImages?.[index];
    const fallbackReference = sharedReference ?? sharedBase.referenceImages[0];
    const role = fallbackReference?.role ?? "style";
    void reference;
    const usage = fallbackReference?.usage ?? "遵循参考图约束。";

    return { role, usage };
  });
}

function normalizeSlotCta(
  input: {
    sharedBase: SharedBaseContext;
  },
  rawCta: Partial<SlotPromptPayload["finalPromptObject"]>["cta"] | undefined,
) {
  if (!input.sharedBase.config.ctaEnabled || !isInformationFlowSingleImage(input)) {
    return null;
  }

  void rawCta;
  const text = normalizeNonEmptyString(input.sharedBase.config.ctaText, "立即下载");
  return {
    text,
    instruction: `仅在信息流单图中以按钮形式呈现“${text}”。`,
  };
}

export async function generateImageDescription(input: {
  directionTitle: string;
  targetAudience: string;
  scenarioProblem: string;
  differentiation: string;
  effect: string;
  channel: string;
  copyTitleMain: string;
  copyTitleSub: string | null;
  copyTitleExtra: string | null;
  aspectRatio: string;
  styleMode: string;
  ipRole: string | null;
  ipDescription?: string | null;
  ipPromptKeywords?: string | null;
  imageStyle: string;
  logo: string;
  imageForm: string;
  ctaEnabled?: boolean;
  ctaText?: string | null;
}) {
  const messages = buildImageDescriptionMessages(input);

  try {
    const content = await createChatCompletion({
      messages,
      temperature: 0.8,
      responseFormat: { type: "json_object" },
    });
    return normalizeImageDescriptionPayload(input, JSON.parse(content) as Partial<ImageDescriptionPayload>);
  } catch (error) {
    // Fallback to rule-based description.
    void error;
  }

  // Fallback: rule-based description
  return buildFallbackImageDescriptionPayload(input);
}

export function buildImageDescriptionMessages(input: {
  directionTitle: string;
  targetAudience: string;
  scenarioProblem: string;
  differentiation: string;
  effect: string;
  channel: string;
  copyTitleMain: string;
  copyTitleSub: string | null;
  copyTitleExtra: string | null;
  aspectRatio: string;
  styleMode: string;
  ipRole: string | null;
  ipDescription?: string | null;
  ipPromptKeywords?: string | null;
  imageStyle: string;
  logo: string;
  imageForm: string;
  ctaEnabled?: boolean;
  ctaText?: string | null;
}) {
  const rules = rulesContent
    ? `以下是画面描述生成规则，请严格遵守：\n\n${rulesContent}`
    : "画面描述需包含场景氛围、画面构图、IP动作与位置（如有）、目标人群特征、文案融入方式，以及左上角Logo真实露出要求，并强调 Logo 与参考完全一致，不得改字改形。";

  const systemPrompt = `角色定位：
你是广告画面描述专家，也是图文生图链路里的视觉策略师。

业务背景：
你处在文案卡之后、Prompt 模板引擎之前，负责把方向上下文、文案和图片配置，整理成当前图片任务的自然语言画面描述，再交给后续结构化层继续组装。

核心任务：
根据方向上下文、文案和图片配置，生成一个结构化画面描述 JSON，对后续 Prompt 模板引擎提供稳定输入。
${rules}

可信输入：
- 方向上下文
- 当前图位文案
- 图片配置
- CTA / Logo / IP / 风格设定

决策规则：
1. 描述必须包含：场景氛围、画面构图、目标人群特征、文案融入方式。
2. 如涉及 IP，必须包含 IP 形象的动作与位置描述。
3. 如涉及 IP，必须保持角色长相、服装、发型、整体风格与参考图一致。
4. 如启用 Logo，必须提及 Logo 真实出现在左上角，而不是只留白。
5. 风格必须匹配用户选择的图片风格。
6. 文案文字必须清晰可读，位置合理。
7. 若启用 CTA，CTA 只允许以信息流单图中的行动按钮形式出现。

硬性边界：
- Logo 必须与提供的参考 Logo 完全一致，不得改字，不得改变图形、颜色、比例、布局，不得重新设计。
- 多图时，此处描述整套共享底座与当前图位职责，不要把整套文案同时塞进同一张图。
- 不要输出 Markdown、自然语言说明、额外注释。

输出契约：
- 只输出一个 JSON 对象
- 必须包含以下顶层字段：
  - schemaVersion
  - channelPositioning
  - adGoal
  - userState
  - coreSellingPoint
  - visualConcept
  - sceneAtmosphere
  - charactersAndProps
  - composition
  - textOverlay
  - brandConstraints
  - variationHints
  - summaryText
- schemaVersion 固定为 v1
- summaryText 是对整张图策略的简洁中文总结`;

  const userPrompt = `方向上下文：
- 方向名称：${input.directionTitle}
- 目标人群：${input.targetAudience}
- 场景问题：${input.scenarioProblem}
- 差异化解法：${input.differentiation}
- 奇效：${input.effect}
- 渠道：${input.channel}

文案内容：
- 主标题：${input.copyTitleMain}
${input.copyTitleSub ? `- 副标题：${input.copyTitleSub}` : ""}
${input.copyTitleExtra ? `- 第三图文案：${input.copyTitleExtra}` : ""}

图片配置：
- 图片形式：${input.imageForm === "single" ? "单图" : input.imageForm === "double" ? "双图" : "三图"}
- 比例：${input.aspectRatio}
- 风格模式：${input.styleMode}
- 图片风格：${input.imageStyle}
${input.ipRole ? `- IP角色：${input.ipRole}` : ""}
${input.ipDescription ? `- IP角色描述：${input.ipDescription}` : ""}
${input.ipPromptKeywords ? `- IP关键词：${input.ipPromptKeywords}` : ""}
- Logo：${input.logo === "onion" ? "洋葱学园（候选图阶段也要真实出现，且必须与参考 Logo 完全一致，不得改字改形）" : input.logo === "onion_app" ? "洋葱学园+APP（候选图阶段也要真实出现，且必须与参考 Logo 完全一致，不得改字改形）" : "不使用"}
${input.ctaEnabled ? `- CTA：${input.ctaText ?? "立即下载"}` : ""}

额外约束：
${input.imageForm === "single" ? "单图时，文案可以整体进入同一张图。" : "多图时，此处只描述整套画面的统一风格、人物、场景和Logo要求，不要把整套文案同时塞进同一张图；具体每一张图承载哪句文案，由后续分图规则决定。"}
${input.ctaEnabled ? "当前为信息流单图，需要在画面合适位置保留一个清晰的 CTA 按钮区域，按钮文案为“立即下载”。" : ""}

请严格输出结构化 JSON，不要输出自然语言段落。`;

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];
}

export function buildSlotImageDescriptionMessages(input: {
  sharedBase: SharedBaseContext;
  slot: SlotSpecificContext;
}): MultimodalChatMessage[] {
  const systemPrompt = `角色定位：
你是广告图片描述 Agent，负责基于共享底座与当前 slot 职责，输出当前图位的最终 Prompt JSON。

核心任务：
1. 继承整组图共享的人物、场景、品牌、风格一致性。
2. 只为当前 slot 生成一份可直接用于后续生图组装的 JSON。
3. 明确 referencePlan、slot_instruction、text_instruction 和 brand_constraints。

输出要求：
- 只输出合法 JSON
- schemaVersion 固定为 v2-slot-prompt
- finalPromptObject.prompt_core 必须非空
- slotRole、mustNotRepeat、layoutExpectation 必须体现在结果中`;

  const userText = `sharedBase:
- direction.title: ${input.sharedBase.direction.title}
- targetAudience: ${input.sharedBase.direction.targetAudience}
- scenarioProblem: ${input.sharedBase.direction.scenarioProblem}
- differentiation: ${input.sharedBase.direction.differentiation}
- effect: ${input.sharedBase.direction.effect}
- channel: ${input.sharedBase.direction.channel}
- imageForm: ${input.sharedBase.config.imageForm}
- aspectRatio: ${input.sharedBase.config.aspectRatio}
- styleMode: ${input.sharedBase.config.styleMode}
- imageStyle: ${input.sharedBase.config.imageStyle}
- logo: ${input.sharedBase.config.logo}
- ctaEnabled: ${input.sharedBase.config.ctaEnabled}
- ctaText: ${input.sharedBase.config.ctaText ?? "none"}
- copyType: ${input.sharedBase.copySet.copyType ?? "unknown"}
- allCopyTexts: ${input.slot.allSlotTexts.join(" | ")}
- ipRole: ${input.sharedBase.ip.ipRole ?? "none"}
- ipDescription: ${input.sharedBase.ip.ipDescription ?? "none"}
- ipPromptKeywords: ${input.sharedBase.ip.ipPromptKeywords ?? "none"}

slot:
- slotIndex: ${input.slot.slotIndex}
- slotCount: ${input.slot.slotCount}
- currentSlotText: ${input.slot.currentSlotText}
- slotRole: ${input.slot.slotRole}
- mustShowTextMode: ${input.slot.mustShowTextMode}
- mustNotRepeat: ${input.slot.mustNotRepeat}
- layoutExpectation: ${input.slot.layoutExpectation}

请为当前 slot 输出 v2-slot-prompt JSON，确保 solution chain 明确、品牌约束明确、文字承载清晰。`;

  return [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: [
        { type: "text", text: userText },
        ...input.sharedBase.referenceImages.flatMap((reference, index) => [
          {
            type: "text" as const,
            text: `参考图${index + 1}：${getReferenceRoleLabel(reference.role)}；role=${reference.role}；用途=${reference.usage}`,
          },
          {
            type: "image_url" as const,
            image_url: { url: reference.url },
          },
        ]),
      ],
    },
  ];
}

export function normalizeSlotPromptPayload(
  input: {
    sharedBase: SharedBaseContext;
    slot: SlotSpecificContext;
  },
  raw: Partial<SlotPromptPayload> = {},
): SlotPromptPayload {
  const sharedConsistencyFallback = buildSharedConsistency(input.sharedBase);
  const fallbackSubject = buildAudienceSubject(input.sharedBase);
  const fallbackScene =
    [input.sharedBase.direction.scenarioProblem, input.sharedBase.direction.differentiation].filter(Boolean).join("，")
      || "贴合广告表达的场景";
  const normalizedSlotMeta = {
    slotIndex: input.slot.slotIndex,
    slotCount: input.slot.slotCount,
    imageForm: input.sharedBase.config.imageForm,
    copyType: input.sharedBase.copySet.copyType,
    currentSlotText: input.slot.currentSlotText,
    slotRole: input.slot.slotRole,
  };
  const subject = fallbackSubject;
  const scene = fallbackScene;
  const composition = input.slot.layoutExpectation || "构图聚焦当前图位职责";
  const textInstruction = `${normalizedSlotMeta.currentSlotText}必须清晰可读，采用${input.slot.mustShowTextMode}承载。`;
  const brandConstraints = input.sharedBase.config.logo === "none"
    ? "无 Logo 强制露出。"
    : "Logo 必须真实出现在左上角，且与参考图完全一致。";
  const slotRoleDescription = describeSlotRole(normalizedSlotMeta.slotRole);
  const slotInstruction = `当前图${slotRoleDescription}，${input.slot.mustNotRepeat}。`;
  const normalizedCta = normalizeSlotCta(input, raw.finalPromptObject?.cta);
  const promptCore = [
    subject,
    scene,
    composition,
    textInstruction,
    brandConstraints,
    slotInstruction,
    normalizedCta ? `${normalizedCta.text}；${normalizedCta.instruction}` : null,
  ]
    .filter(Boolean)
    .join("；");

  return {
    schemaVersion: "v2-slot-prompt",
    slotMeta: normalizedSlotMeta,
    sharedConsistency: normalizeSharedConsistency(raw.sharedConsistency, sharedConsistencyFallback),
    referencePlan: {
      referenceImages: normalizeReferenceImages(input.sharedBase, raw.referencePlan?.referenceImages),
    },
    finalPromptObject: {
      prompt_version: "v2-slot",
      aspect_ratio: input.sharedBase.config.aspectRatio,
      prompt_core: promptCore,
      subject,
      scene,
      composition,
      text_instruction: textInstruction,
      brand_constraints: brandConstraints,
      slot_instruction: slotInstruction,
      cta: normalizedCta,
    },
    negativePrompt: normalizeNonEmptyString(
      raw.negativePrompt,
      "避免低清晰度、文字不可读、Logo变形、人物崩坏、与其他图位职责重复。",
    ),
    summaryText: normalizeNonEmptyString(
      raw.summaryText,
      `第${normalizedSlotMeta.slotIndex}张图${slotRoleDescription}，围绕“${normalizedSlotMeta.currentSlotText}”完成表达。`,
    ),
  };
}

export async function generateSlotImagePrompt(input: {
  sharedBase: SharedBaseContext;
  slot: SlotSpecificContext;
}) {
  try {
    const content = await createMultimodalChatCompletion({
      model: "gemini-3.1-pro-preview",
      messages: buildSlotImageDescriptionMessages(input),
      responseFormat: { type: "json_object" },
    });
    return normalizeSlotPromptPayload(input, JSON.parse(content) as Partial<SlotPromptPayload>);
  } catch {
    return normalizeSlotPromptPayload(input);
  }
}

export function buildFallbackImageDescriptionPayload(input: {
  directionTitle: string;
  targetAudience: string;
  scenarioProblem: string;
  differentiation: string;
  effect: string;
  channel: string;
  copyTitleMain: string;
  copyTitleSub: string | null;
  copyTitleExtra: string | null;
  aspectRatio: string;
  styleMode: string;
  ipRole: string | null;
  ipDescription?: string | null;
  ipPromptKeywords?: string | null;
  imageStyle: string;
  logo?: string;
  imageForm: string;
  ctaEnabled?: boolean;
  ctaText?: string | null;
}, summaryText?: string): ImageDescriptionPayload {
  const style = IMAGE_STYLE_DESCRIPTIONS[input.imageStyle] ?? "清新明亮的广告风格";
  const audienceType = input.targetAudience.includes("家长") ? "parent" : "student";
  const isMultiImage = input.imageForm === "double" || input.imageForm === "triple";
  const currentText = [input.copyTitleMain, input.copyTitleSub, input.copyTitleExtra].filter(Boolean).join(" / ");

  return {
    schemaVersion: "v1",
    channelPositioning: {
      channel: input.channel,
      imageForm: input.imageForm,
      aspectRatio: input.aspectRatio,
    },
    adGoal: {
      primaryGoal: input.channel === "信息流（广点通）" ? "抢停留" : "解释功能",
    },
    userState: {
      audienceType,
      audienceSegment: input.targetAudience,
      scenarioSummary: input.scenarioProblem,
    },
    coreSellingPoint: {
      primaryPoint: input.differentiation,
    },
    visualConcept: {
      mainEvent: audienceType === "student" ? "学生正在处理学习问题并获得解决" : "家长在陪伴或观察孩子学习变化",
      creativeAxis: audienceType === "student" ? "学习突破" : "陪伴成长",
      productAnchor: input.ipRole ? "IP角色与学习产品共同露出" : "学习产品界面或学习道具露出",
    },
    sceneAtmosphere: {
      location: audienceType === "student" ? "学习场景" : "家庭学习陪伴场景",
      lighting: "明亮",
      moodColor: style,
    },
    charactersAndProps: {
      characterMode: isMultiImage ? "single" : "single",
      characterSummary: input.ipRole ? `${input.ipRole}角色或目标人群代表` : `目标人群代表（${input.targetAudience}）`,
      expression: "积极专注",
      action: input.copyTitleMain,
      props: ["学习道具", "产品锚点"],
      ip: {
        enabled: Boolean(input.ipRole),
        role: input.ipRole ?? "",
        placement: input.ipRole ? "画面主体区域" : "",
        action: input.ipRole ? "与学习任务互动" : "",
        consistencyRule: input.ipRole ? "长相、服装、发型、整体风格与参考图一致" : "",
      },
    },
    composition: {
      layoutType: input.aspectRatio === "16:9" ? "wide" : input.aspectRatio === "9:16" ? "vertical" : "square",
      subjectPlacement: "right",
      textSafeArea: input.aspectRatio === "16:9" ? "left" : "bottom",
      logoSafeArea: "top-left",
      multiImageConsistency: isMultiImage ? "多图时人物、风格、品牌元素保持一致，当前图承担自身角色" : "单图完整表达",
    },
    textOverlay: {
      currentText,
      textRole: isMultiImage ? "slot" : "main",
      ctaText: input.ctaEnabled ? (input.ctaText ?? "立即下载") : null,
    },
    brandConstraints: {
      brandTone: "教育可信、积极、明亮、成长导向",
      logoPolicy: input.logo && input.logo !== "none" ? "Logo 保持左上角统一规则" : "不使用Logo",
    },
    variationHints: {
      noveltyFocus: "通过构图、动作和场景细节避免与已有素材重复",
    },
    summaryText:
      summaryText ??
      `${style}。围绕“${input.directionTitle}”构建学习广告场景，文案“${currentText}”服务当前图位，保持品牌统一与学习语境。`,
  };
}

function normalizeImageDescriptionPayload(
  input: Parameters<typeof buildFallbackImageDescriptionPayload>[0],
  candidate: Partial<ImageDescriptionPayload>,
): ImageDescriptionPayload {
  const base = buildFallbackImageDescriptionPayload(input);

  return {
    ...base,
    ...candidate,
    channelPositioning: {
      ...base.channelPositioning,
      ...(candidate.channelPositioning ?? {}),
    },
    adGoal: {
      ...base.adGoal,
      ...(candidate.adGoal ?? {}),
    },
    userState: {
      ...base.userState,
      ...(candidate.userState ?? {}),
    },
    coreSellingPoint: {
      ...base.coreSellingPoint,
      ...(candidate.coreSellingPoint ?? {}),
    },
    visualConcept: {
      ...base.visualConcept,
      ...(candidate.visualConcept ?? {}),
    },
    sceneAtmosphere: {
      ...base.sceneAtmosphere,
      ...(candidate.sceneAtmosphere ?? {}),
    },
    charactersAndProps: {
      ...base.charactersAndProps,
      ...(candidate.charactersAndProps ?? {}),
      ip: {
        ...base.charactersAndProps.ip,
        ...(candidate.charactersAndProps?.ip ?? {}),
      },
      props: Array.isArray(candidate.charactersAndProps?.props)
        ? candidate.charactersAndProps.props
        : base.charactersAndProps.props,
    },
    composition: {
      ...base.composition,
      ...(candidate.composition ?? {}),
    },
    textOverlay: {
      ...base.textOverlay,
      ...(candidate.textOverlay ?? {}),
    },
    brandConstraints: {
      ...base.brandConstraints,
      ...(candidate.brandConstraints ?? {}),
    },
    variationHints: {
      ...base.variationHints,
      ...(candidate.variationHints ?? {}),
    },
    summaryText:
      typeof candidate.summaryText === "string" && candidate.summaryText.trim().length > 0
        ? candidate.summaryText
        : base.summaryText,
    schemaVersion: "v1",
  };
}
