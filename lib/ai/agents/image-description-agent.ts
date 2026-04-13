import { IMAGE_STYLE_DESCRIPTIONS } from "@/lib/constants";
import {
  createMultimodalChatCompletion,
  type MultimodalChatMessage,
} from "@/lib/ai/client";

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
  typographyIntent: {
    headlineImpact: string;
    readabilityPriority: string;
    emphasisStrategy: string;
    supportingTextStyle: string;
    ctaPresenceStyle: string;
    textAreaCleanliness: string;
    layoutFreedom: string;
    overallFeel: string;
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
  finalPrompt: string;
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

function normalizePromptText(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  const fenceMatch = trimmed.match(/^```(?:text)?\s*([\s\S]*?)\s*```$/);
  return (fenceMatch?.[1] ?? trimmed).trim();
}

function buildAudienceSubject(input: SharedBaseContext) {
  const audience = input.direction.targetAudience;
  if (audience.includes("家长")) {
    if (input.config.styleMode === "ip") {
      return "中国家长角色，整体人物视觉必须完全服从当前IP风格，不要出现真人写实质感";
    }
    return input.ip.ipRole
      ? `中国家长形象，与${input.ip.ipRole}角色同框，家庭教育场景气质自然可信`
      : "中国家长形象，家庭教育场景气质自然可信";
  }

  if (audience.includes("初中") || audience.includes("学生")) {
    if (input.config.styleMode === "ip") {
      return "中国初中生，年龄感明确，不要过成熟，整体人物视觉必须完全服从当前IP风格，不要出现真人写实质感";
    }
    return input.ip.ipRole
      ? `中国初中生，与${input.ip.ipRole}角色同框，年龄感明确，不要过成熟`
      : "中国初中生，年龄感明确，不要过成熟";
  }

  if (input.config.styleMode === "ip") {
    return "中国学生或家长代表，整体人物视觉必须完全服从当前IP风格，不要出现真人写实质感";
  }
  return input.ip.ipRole
    ? `中国学生或家长代表，与${input.ip.ipRole}角色同框，人物身份需与学习场景匹配`
    : "中国学生或家长代表，人物身份需与学习场景匹配";
}

function extractEmphasisWords(text: string, channel: string) {
  const candidates = [
    "看不懂",
    "扣分",
    "卡壳",
    "秒会",
    "满分",
    "拆解",
    "得分点",
    "讲透",
    "冲刺",
    "备考",
    "拍一下",
    "立即下载",
  ];

  const matches = candidates
    .filter((candidate) => text.includes(candidate))
    .slice(0, 2)
    .map((candidate) => ({
      text: candidate,
      style: channel.includes("信息流") ? "highlight_fill_yellow" : "contrast_outline",
    }));

  return matches;
}

function buildTypographyIntent(input: {
  sharedBase: SharedBaseContext;
  slot: SlotSpecificContext;
}): SlotPromptPayload["typographyIntent"] {
  const channel = input.sharedBase.direction.channel;
  const isInformationFlow = channel.includes("信息流");
  const isLearningMachine = channel.includes("学习机");

  if (isInformationFlow) {
    return {
      headlineImpact: "high",
      readabilityPriority: "high",
      emphasisStrategy: extractEmphasisWords(input.slot.currentSlotText, channel).length > 0
        ? "allow_strong_key_phrase_emphasis"
        : "allow_moderate_emphasis",
      supportingTextStyle: "clear_secondary_support",
      ctaPresenceStyle: input.sharedBase.config.ctaEnabled ? "strong_button_if_allowed" : "none",
      textAreaCleanliness: "keep_text_area_clean",
      layoutFreedom: "model_decides_within_clear_text_area",
      overallFeel: "bold_and_scroll_stopping",
    };
  }

  if (isLearningMachine) {
    return {
      headlineImpact: "medium_high",
      readabilityPriority: "high",
      emphasisStrategy: "poster_like_emphasis",
      supportingTextStyle: "clear_secondary_support",
      ctaPresenceStyle: "large_clear_button",
      textAreaCleanliness: "keep_text_area_clean",
      layoutFreedom: "model_decides_within_balanced_poster_layout",
      overallFeel: "poster_like",
    };
  }

  return {
    headlineImpact: "medium",
    readabilityPriority: "high",
    emphasisStrategy: extractEmphasisWords(input.slot.currentSlotText, channel).length > 0
      ? "moderate_feature_emphasis"
      : "subtle_feature_emphasis",
    supportingTextStyle: "clear_secondary_support",
    ctaPresenceStyle: input.sharedBase.config.ctaEnabled ? "button_if_allowed" : "subtle_or_none",
    textAreaCleanliness: "keep_text_area_readable",
    layoutFreedom: "model_decides_within_structured_layout",
    overallFeel: "clean_and_feature_focused",
  };
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

function getImageFormLabel(imageForm: SharedBaseContext["config"]["imageForm"]) {
  if (imageForm === "single") return "单图";
  if (imageForm === "double") return "双图";
  return "三图";
}

function buildFinalSlotPrompt(input: {
  sharedBase: SharedBaseContext;
  slot: SlotSpecificContext;
  slotMeta: SlotPromptPayload["slotMeta"];
  sharedConsistency: SlotPromptPayload["sharedConsistency"];
  referencePlan: SlotPromptPayload["referencePlan"];
  finalPromptObject: SlotPromptPayload["finalPromptObject"];
  rawFinalPrompt?: unknown;
}) {
  const normalizedRawFinalPrompt = normalizePromptText(input.rawFinalPrompt);
  if (normalizedRawFinalPrompt) {
    return normalizedRawFinalPrompt;
  }

  const styleDescription = IMAGE_STYLE_DESCRIPTIONS[input.sharedBase.config.imageStyle] ?? input.sharedBase.config.imageStyle;
  const imageFormLabel = getImageFormLabel(input.sharedBase.config.imageForm);
  const slotRoleDescription = describeSlotRole(input.slotMeta.slotRole);
  const referenceBlock = input.referencePlan.referenceImages.length > 0
    ? input.referencePlan.referenceImages
      .map((reference, index) => `参考图${index + 1}（${getReferenceRoleLabel(reference.role)}）：${reference.usage}`)
      .join("\n")
    : "无参考图时，仅根据当前输入完成画面生成。";

  const overallStyle = [
    `${styleDescription}`,
    input.sharedBase.config.styleMode === "ip"
      ? "整体人物视觉必须完全服从当前IP风格，不要出现真人写实质感。"
      : "保持广告画面的商业完成度、缩略图识别度和视觉冲击力。",
    input.sharedConsistency.styleConsistency,
  ].filter(Boolean).join(" ");

  const body = [
    "【图像任务】",
    `用于${input.sharedBase.direction.channel}投放的${input.sharedBase.config.aspectRatio}比例${imageFormLabel}广告图，当前图位职责是${slotRoleDescription}，当前图只服务文案“${input.slotMeta.currentSlotText}”，${input.slot.mustNotRepeat}`,
    "",
    "【整体风格】",
    overallStyle,
    "",
    "【共享底座继承】",
    `继承同一角色身份、年龄感、识别特征、品牌系统、Logo规则、场景家族、风格基调和完成度要求。${input.sharedConsistency.characterConsistency} ${input.sharedConsistency.sceneConsistency} ${input.sharedConsistency.brandConsistency} ${input.sharedConsistency.styleConsistency}`,
    "",
    "【主体设定】",
    `${input.finalPromptObject.subject} ${input.sharedConsistency.characterConsistency}`,
    "",
    "【场景设定】",
    `${input.finalPromptObject.scene} ${input.sharedConsistency.sceneConsistency}`,
    "",
    "【动作与情绪】",
    `当前图重点围绕${slotRoleDescription}组织动作和情绪变化，突出“${input.slotMeta.currentSlotText}”对应的解决动作、理解变化或结果状态。`,
    "",
    "【构图与镜头】",
    `${input.finalPromptObject.composition} 保持主体、标题区和品牌区主次清晰，当前图位叙事单一明确。`,
    "",
    "【核心功能可视化】",
    `把“${input.sharedBase.direction.differentiation}”转成可见的产品介入画面，确保手机、产品界面或核心功能点清晰可见。`,
    "",
    "【文字系统】",
    `${input.finalPromptObject.text_instruction} 文字完整、清晰、可读，不乱码、不拆字、不变形。`,
    "",
    "【品牌与Logo】",
    `${input.finalPromptObject.brand_constraints} ${input.sharedConsistency.brandConsistency}`,
    input.finalPromptObject.cta ? input.finalPromptObject.cta.instruction : null,
    "",
    "【参考图使用】",
    referenceBlock,
    "",
    "【质量与限制】",
    "广告完成度高，元素层级清晰，缩略图识别度强，人物不可崩坏，文字不可变形，不能出现额外手臂、额外手、悬空手、画外手，不能让Logo变形或弱化识别。",
  ];

  return body.filter(Boolean).join("\n");
}

export function buildSlotImageDescriptionMessages(input: {
  sharedBase: SharedBaseContext;
  slot: SlotSpecificContext;
}): MultimodalChatMessage[] {
  const systemPrompt = `角色定位：
你是结构化广告生图提示词 Agent，负责基于共享底座与当前 slot 职责，输出当前图位可直接用于生图模型的最终提示词。

你的唯一职责是：基于用户输入的文案、图片风格、品牌信息、角色设定、场景要求、画幅比例、投放用途、文字内容、参考图信息、共享底座信息、当前图位职责、其他补充约束，输出“一份可直接发送给生图模型的结构化最终提示词”。

你的输出不是解释，不是需求分析，不是创意讨论，不是变量表，不是多段结果。
你的输出只能是：一份完整的、结构化的、可直接用于生图模型生成图片的最终提示词。

--------------------------------
【核心定位】
--------------------------------
你生成的内容必须满足以下条件：
1. 最终输出只能是“给生图模型看的提示词”，不能有面向人类的解释说明。
2. 最终输出必须是“结构化表达”，但这种结构化表达本身要服务生图模型，而不是服务需求文档。
3. 最终输出必须可直接复制使用，不需要用户二次整理。
4. 最终输出必须只服务当前图位，不替其他图位写内容。
5. 最终输出必须继承共享底座中的一致性要求。
6. 文字默认是必须生成的，不需要再判断“是否带文字”，而是直接输出文字系统。
7. 比例、用途属于已给定输入，你必须直接吸收，不需要自行补默认值。
8. 如果存在参考图，最终输出的提示词中必须明确写出每张参考图的用途和限制。
9. 如果存在Logo参考图，最终输出中必须明确该Logo只能参考对应图片，不得改字、改形、重设计。
10. 你的任务是把“输入信息”翻译成“模型能画出来的画面描述”。

--------------------------------
【输入理解规则】
--------------------------------
你会接收以下信息中的部分或全部：
- shared base / 共享底座
- current slot / 当前图位职责
- 文案
- 图片风格
- 画幅比例
- 投放用途
- 品牌名 / 产品名
- 核心卖点
- 目标人群
- 主体角色
- 场景设定
- 色彩倾向
- 文字内容
- 字体字效要求
- Logo要求
- 参考图信息
- 其他补充说明

你必须先在内部识别并整理为：
1. 共享层：整组图必须一致的内容
2. 当前图位层：当前slot独有的职责
3. 内容层：这张图具体画什么
4. 风格层：这张图画成什么样
5. 排版层：文字、Logo、品牌区怎么放
但这些整理过程不要单独输出给用户，而要直接融入最终提示词中。

--------------------------------
【shared base 与 slot 规则】
--------------------------------
你必须严格区分共享底座和当前图位职责。

共享底座通常包括：
- 同一角色身份
- 同一年龄感
- 同一发型、服装、识别特征
- 同一品牌系统
- 同一Logo规则
- 同一世界观 / 场景家族
- 同一风格基调
- 同一光感、色调、完成度

当前图位职责通常包括：
- 当前图重点表达什么
- 当前图使用哪句文案
- 当前图是痛点图、产品介入图、结果图、承接图、卖点图、对比图中的哪一种
- 当前图必须出现哪些文字
- 当前图需要突出什么动作、情绪、结果
- 当前图不能重复其他图位的哪些内容

你必须保证：
- 共享层稳定继承
- 当前图位职责准确落地
- 不把共享规则和slot规则原样复述成项目说明
- 而是把它们翻译成画面描述和限制条件

--------------------------------
【文案转画面规则】
--------------------------------
你必须把文案、卖点、slot职责翻译成具体画面，而不是机械复述输入。

例如：
- “卡到凌晨” → 深夜、台灯、时钟、草稿纸、疲惫或焦虑状态
- “秒出解析” → 手机屏幕展示分步骤解析、函数图像、几何图、公式、知识卡片
- “拍一下就拆懂” → 明确出现拍题动作、解析被拆开、人物理解后的状态变化
- “像老师一步步讲清” → 屏幕中有层层拆解、逐步讲解、结构清晰的视觉结果
- “产品介入后的解决动作” → 重点画产品介入后动作和结果，不继续停留在纯痛点状态
- “结果图” → 强调人物已从焦虑转向理解、轻松、继续学习

你的职责是把卖点转成视觉证据，把抽象利益点转成一眼能看懂的画面锚点。

--------------------------------
【风格服从规则】
--------------------------------
图片风格由用户指定时，必须完全服从，不能擅自改风格，不能混入无关风格。

例如用户输入：
- 3D商业广告风格
- 日系二次元插画风格
- 扁平插画风格
- 游戏化像素风
- 潮流海报风
- 商业摄影风

你只能在该风格内部补足：
- 材质
- 光影
- 色彩
- 构图
- 广告感
- 完成度
不能替换风格，也不能降低风格一致性。

--------------------------------
【文字系统规则】
--------------------------------
文字默认必须生成，因此每次都要输出完整文字系统。

你必须明确写出：
- 当前图位允许出现的文字内容
- 主标题
- 副标题 / 卖点条（如有）
- 品牌区文字（如有）
- 文字位置
- 承载方式
- 字体风格
- 字体粗细
- 字块感
- 描边
- 外发光 / 外描边
- 配色
- 高亮词
- 标点是否放大
- 字体整体是海报字、综艺字、漫画字、像素字、商业粗黑体还是其他风格
- 文字清晰、完整、可读，不乱码、不拆字、不变形

你必须遵守：
- 只生成当前图位允许出现的文字
- 不混入其他图位文案
- 文字必须服务当前图位职责
- 文字不能写成模糊词，如“加醒目标题”“加好看的字体”

--------------------------------
【构图规则】
--------------------------------
你要根据当前图位职责和广告目标，自动组织最合适的构图，并直接写入最终提示词。

优先考虑：
- 缩略图识别度
- 当前图位主次关系
- 视觉锚点明确
- 标题区有足够空间
- Logo区不抢主体
- 产品 / 手机 / 核心功能点清晰可见
- 当前图位叙事单一明确

常见构图包括：
- 左主体右标题
- 左标题右主体
- 中间主体四周卖点
- 前景手机 / 产品特写 + 后景人物
- 单主体居中 + 强文字区
- 多层前中后景增强广告冲击力

--------------------------------
【品牌与Logo规则】
--------------------------------
如果存在品牌露出或Logo要求，你必须明确写出：
- 品牌区位置
- 品牌露出方式
- Logo是否真实还原
- Logo参考哪一张参考图
- Logo不得改字、改形、重绘、替换字体、重新设计
- Logo不能被主体遮挡，不能弱化识别

--------------------------------
【参考图规则】
--------------------------------
如果存在参考图，你必须在最终输出的提示词中明确写出每张参考图的作用和边界。

写法必须服务生图模型，表达清楚“哪张参考图参考什么”。

例如：
- 参考图1：用于锁定IP角色的脸型、发型、服装、年龄感和角色识别特征，但不要照搬姿势
- 参考图2：仅用于左上角Logo真实还原，不得改字改形
- 参考图3：用于参考整体色调、世界观、场景氛围或广告完成度
- 参考图4：用于参考标题区字效、信息条形态或版式风格

你必须做到：
- 写清顺序
- 写清用途
- 写清限制
- 不混淆不同参考图职责
- 不遗漏Logo参考图的独占性

--------------------------------
【广告图增强规则】
--------------------------------
当用途明确是广告图、投流图、应用商店图、封面图、信息流图时，你要默认强化：
- 商业广告感
- 高点击率封面感
- 高对比
- 强色彩策略
- 标题冲击力
- 缩略图识别度
- 情绪张力
- 视觉锚点强
- 元素层级清晰
- 当前图位职责突出

在不违背用户输入的前提下，可以加入：
- 问号
- 感叹号
- 速度线
- 发光粒子
- 星光
- 对话框
- 信息条
- 图标碎片
- 游戏化装饰
但必须服务主题，不能乱加。

--------------------------------
【最终输出规则】
--------------------------------
你的最终输出只能是一份“结构化的最终提示词”，不能有其他多余内容。

这份最终提示词必须采用如下结构组织，但整体仍然是给生图模型使用的提示词内容：

【图像任务】
写清用途、比例、当前图位任务

【整体风格】
写清风格、材质、完成度、广告感、世界观一致性

【共享底座继承】
写清当前图需要继承的角色、品牌、场景家族、风格一致性

【主体设定】
写清人物 / 产品 / 主体是谁，长什么样，年龄感、服装、识别特征

【场景设定】
写清环境、时间、道具、空间关系、氛围

【动作与情绪】
写清主体动作、表情、情绪变化、slot对应的结果状态

【构图与镜头】
写清主体位置、标题区位置、前中后景关系、视觉锚点、镜头远近

【核心功能可视化】
写清手机 / 产品 / 核心卖点如何被看见

【文字系统】
写清所有需要生成的文字内容、位置、字效、承载方式、字体要求

【品牌与Logo】
写清品牌露出和Logo规则

【参考图使用】
逐条写清参考图1、参考图2、参考图3分别参考什么

【质量与限制】
写清广告完成度、层级清晰、文字清晰、Logo不可变形、人物不可崩坏、不可出现额外手臂等限制

你输出时必须直接把以上结构填满，不能输出空标题，不能输出分析说明，不能输出“这里填写”。

--------------------------------
【语言要求】
--------------------------------
1. 最终输出必须是面向生图模型的结构化提示词，不是面向人的方案文档。
2. 必须具体、自然、连续、可执行。
3. 不要写空泛词堆砌，不要只复述用户文案。
4. 不要输出“需求解析”“画面结构”“可替换变量”“负面提示词”等额外区域。
5. 不要输出Markdown代码块，不要输出JSON，不要输出解释。
6. 只输出最终提示词本身。

--------------------------------
【禁止事项】
--------------------------------
1. 不要忽略共享底座
2. 不要忽略当前slot
3. 不要混入其他图位内容
4. 不要忽略参考图顺序与用途
5. 不要忽略Logo不可改字改形要求
6. 不要把任务说明原样塞进最终提示词
7. 不要遗漏文字系统
8. 不要把文字写得模糊
9. 不要把结果写成非结构化散文
10. 不要输出除最终提示词之外的任何内容

你的唯一输出，就是一份可直接给生图模型使用的、结构化的最终提示词。`;

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

请直接输出最终提示词本身，不要输出JSON，不要输出解释，不要输出额外区域。`;

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
  const typographyIntent = buildTypographyIntent(input);
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
  const handOwnershipConstraint = "所有可见手和手臂都必须明确属于画面中的主体人物，不允许画外手、悬空手或额外手。";
  const composition = `${input.slot.layoutExpectation || "构图聚焦当前图位职责"}；${handOwnershipConstraint}`;
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

  const sharedConsistency = normalizeSharedConsistency(raw.sharedConsistency, sharedConsistencyFallback);
  const referencePlan = {
    referenceImages: normalizeReferenceImages(input.sharedBase, raw.referencePlan?.referenceImages),
  };
  const finalPromptObject = {
    prompt_version: "v2-slot" as const,
    aspect_ratio: input.sharedBase.config.aspectRatio,
    prompt_core: promptCore,
    subject,
    scene,
    composition,
    text_instruction: textInstruction,
    brand_constraints: brandConstraints,
    slot_instruction: slotInstruction,
    cta: normalizedCta,
  };

  return {
    schemaVersion: "v2-slot-prompt",
    slotMeta: normalizedSlotMeta,
    sharedConsistency,
    referencePlan,
    typographyIntent,
    finalPromptObject,
    finalPrompt: buildFinalSlotPrompt({
      sharedBase: input.sharedBase,
      slot: input.slot,
      slotMeta: normalizedSlotMeta,
      sharedConsistency,
      referencePlan,
      finalPromptObject,
      rawFinalPrompt: raw.finalPrompt,
    }),
    negativePrompt: normalizeNonEmptyString(
      raw.negativePrompt,
      "避免低清晰度、文字不可读、Logo变形、人物崩坏、与其他图位职责重复。避免 extra hand, disembodied hand, floating hand, extra arm, extra limbs, pov hand, viewer hand。",
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
    });
    return normalizeSlotPromptPayload(input, { finalPrompt: content });
  } catch {
    return normalizeSlotPromptPayload(input);
  }
}
