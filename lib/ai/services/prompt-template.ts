import { IMAGE_STYLE_DESCRIPTIONS } from "@/lib/constants";
import type { ImageDescriptionPayload, SlotPromptPayload } from "@/lib/ai/agents/image-description-agent";

function isSlotPromptPayload(value: unknown): value is SlotPromptPayload {
  return typeof value === "object" && value !== null && (value as { schemaVersion?: unknown }).schemaVersion === "v2-slot-prompt";
}

export function buildImagePrompt(input: {
  directionTitle: string;
  scenarioProblem?: string | null;
  copyTitleMain: string;
  copyTitleSub?: string | null;
  copyTitleExtra?: string | null;
  aspectRatio: string;
  styleMode: string;
  imageStyle: string;
  ipRole?: string | null;
  ipDescription?: string | null;
  ipPromptKeywords?: string | null;
  logo?: string;
  imageForm?: string;
  referenceImageUrl?: string | null;
  channel?: string;
  ctaEnabled?: boolean;
  ctaText?: string | null;
  descriptionPayload?: string | ImageDescriptionPayload | SlotPromptPayload;
}): string {
  const parsedDescription = typeof input.descriptionPayload === "string"
    ? JSON.parse(input.descriptionPayload) as Record<string, unknown>
    : input.descriptionPayload ?? null;

  if (isSlotPromptPayload(parsedDescription)) {
    const isSingleImage = parsedDescription.slotMeta.imageForm === "single";
    const textOverlay = isSingleImage
      ? {
          main_title: input.copyTitleMain,
          sub_title: input.copyTitleSub ?? null,
          extra_title: input.copyTitleExtra ?? null,
        }
      : {
          main_title: parsedDescription.slotMeta.currentSlotText,
          sub_title: null,
          extra_title: null,
        };
    const referenceImages = parsedDescription.referencePlan.referenceImages.map((reference, index) => ({
      index: index + 1,
      role: reference.role,
      usage: reference.usage,
    }));

    return JSON.stringify({
      aspect_ratio: parsedDescription.finalPromptObject.aspect_ratio,
      prompt_core: parsedDescription.finalPromptObject.prompt_core,
      subject: parsedDescription.finalPromptObject.subject,
      scene: parsedDescription.finalPromptObject.scene,
      composition: parsedDescription.finalPromptObject.composition,
      text_instruction: parsedDescription.finalPromptObject.text_instruction,
      brand_constraints: parsedDescription.finalPromptObject.brand_constraints,
      slot_instruction: parsedDescription.finalPromptObject.slot_instruction,
      cta: parsedDescription.finalPromptObject.cta,
      text_overlay: textOverlay,
      typography_intent: parsedDescription.typographyIntent,
      negative_prompt: parsedDescription.negativePrompt,
      reference_images: referenceImages,
    });
  }

  const descriptionVisualConcept =
    parsedDescription && typeof parsedDescription.visualConcept === "object" && parsedDescription.visualConcept
      ? parsedDescription.visualConcept as Record<string, unknown>
      : null;
  const descriptionSceneAtmosphere =
    parsedDescription && typeof parsedDescription.sceneAtmosphere === "object" && parsedDescription.sceneAtmosphere
      ? parsedDescription.sceneAtmosphere as Record<string, unknown>
      : null;
  const descriptionComposition =
    parsedDescription && typeof parsedDescription.composition === "object" && parsedDescription.composition
      ? parsedDescription.composition as Record<string, unknown>
      : null;
  const descriptionTextOverlay =
    parsedDescription && typeof parsedDescription.textOverlay === "object" && parsedDescription.textOverlay
      ? parsedDescription.textOverlay as Record<string, unknown>
      : null;
  const descriptionBrandConstraints =
    parsedDescription && typeof parsedDescription.brandConstraints === "object" && parsedDescription.brandConstraints
      ? parsedDescription.brandConstraints as Record<string, unknown>
      : null;
  const descriptionUserState =
    parsedDescription && typeof parsedDescription.userState === "object" && parsedDescription.userState
      ? parsedDescription.userState as Record<string, unknown>
      : null;
  const descriptionCharacters =
    parsedDescription && typeof parsedDescription.charactersAndProps === "object" && parsedDescription.charactersAndProps
      ? parsedDescription.charactersAndProps as Record<string, unknown>
      : null;
  const style = IMAGE_STYLE_DESCRIPTIONS[input.imageStyle] ?? "清新明亮的广告风格";
  const audienceType = descriptionUserState?.audienceType === "parent" ? "parent" : "student";
  const defaultHumanSubject = audienceType === "parent"
    ? "中国家长代表，东亚面孔特征，家庭教育场景气质自然可信"
    : "中国学生代表，东亚面孔特征，符合中国校园与家庭学习场景";
  const ipText = input.ipRole
    ? `画面主体使用指定 IP 形象。角色设定：${input.ipDescription ?? input.ipRole}。人物关键词：${input.ipPromptKeywords ?? ""}。长相和整体风格必须与参考图一致，无需复现参考图中的动作或姿势，姿势可变化但角色身份设定不能漂移，整体气质贴近中国校园或家庭教育场景。`
    : `${String(descriptionCharacters?.characterSummary ?? defaultHumanSubject)}，默认使用中国/东亚人物特征。`;
  const logoText =
    input.logo && input.logo !== "none"
      ? "品牌 Logo 必须真实出现在画面左上角，尺寸清晰可见，不可缺失，不可只留空白。Logo 必须与提供的参考 Logo 完全一致，不得改字，不得改变图形，不得改变颜色，不得改变比例，不得改变布局，不得改变圆角或边框，不得增删任何元素，不得艺术化、卡通化、重绘，不得重新设计。"
      : "画面中不需要品牌 Logo。";
  const isMultiImage = input.imageForm === "double" || input.imageForm === "triple";
  const textInstruction = isMultiImage
    ? "这是多图素材，具体每张图只承载自己的分图文案；当前基础画面提示不要把整套文案同时放进同一张图。"
    : `文案"${input.copyTitleMain}"${input.copyTitleSub ? `和"${input.copyTitleSub}"` : ""}${input.copyTitleExtra ? `以及"${input.copyTitleExtra}"` : ""}以清晰可读的字体直接体现在画面中，不可缺字漏字。`;
  const ctaInstruction =
    input.channel === "信息流（广点通）" && input.imageForm === "single" && input.ctaEnabled
      ? `画面中需要在合适广告位加入一个清晰的 CTA 按钮，按钮文案为“${input.ctaText ?? "立即下载"}”，按钮样式应像广告行动号召按钮。`
      : "";
  const textOverlay = !isMultiImage
    ? {
        main_title: input.copyTitleMain,
        sub_title: input.copyTitleSub ?? null,
        extra_title: input.copyTitleExtra ?? null,
      }
    : undefined;
  const textInstructionWithStructuredContext =
    !isMultiImage && descriptionTextOverlay?.currentText
      ? `${textInstruction} 当前图重点文案：${String(descriptionTextOverlay.currentText)}。`
      : textInstruction;

  const promptObject: Record<string, unknown> = {
    prompt_version: "v1",
    direction_title: input.directionTitle,
    scenario_problem: input.scenarioProblem ?? "",
    aspect_ratio: input.aspectRatio,
    style_mode: input.styleMode,
    image_style: input.imageStyle,
    visual_concept: descriptionVisualConcept?.mainEvent ?? "",
    subject: ipText,
    scene: descriptionSceneAtmosphere?.location
      ? `${style}。场景设定为${String(descriptionSceneAtmosphere.location)}，光线${String(descriptionSceneAtmosphere.lighting ?? "明亮")}。`
      : `${style}。站在明亮舒适的学习环境中。背景氛围体现"学习、成长、突破"的主题，色调温馨积极。`,
    composition: descriptionComposition?.subjectPlacement
      ? `画面构图采用${input.aspectRatio}布局，主体位于画面${String(descriptionComposition.subjectPlacement)}侧。`
      : `画面构图采用${input.aspectRatio}布局，主体位于画面中右侧。`,
    brand_constraints: descriptionBrandConstraints?.brandTone
      ? `${String(descriptionBrandConstraints.brandTone)}。${logoText}`
      : logoText,
    text_instruction: textInstructionWithStructuredContext,
  };

  if (textOverlay) {
    promptObject.text_overlay = textOverlay;
  }

  if (ctaInstruction) {
    promptObject.cta = {
      enabled: true,
      text: input.ctaText ?? "立即下载",
      instruction: ctaInstruction,
    };
  }

  return JSON.stringify(promptObject);
}

export function buildNegativePrompt(input: {
  imageStyle: string;
}): string {
  void input;
  return "ugly, deformed, extra limbs, bad anatomy, blurry, messy layout, distorted face, cropped, low quality, pixelated, unreadable text";
}

export function buildImageSlotPrompt(input: {
  imageForm?: string | null;
  slotIndex: number;
  slotCount: number;
  copyType?: string | null;
  copyTitleMain: string;
  copyTitleSub?: string | null;
  copyTitleExtra?: string | null;
  logo?: string | null;
}) {
  const titles = [
    input.copyTitleMain,
    input.copyTitleSub ?? "",
    input.copyTitleExtra ?? "",
  ];
  const currentTitle = titles[input.slotIndex - 1] ?? "";

  const logoInstruction =
    input.logo && input.logo !== "none"
      ? "Logo 在左上角可见。Logo 必须与参考 Logo 完全一致，不得改字，不得改变图形、颜色、比例、布局，不得重新设计。"
      : "";

  if (input.slotCount <= 1 || input.imageForm === "single") {
    return `当前输出第 ${input.slotIndex} 张图（共 ${input.slotCount} 张）。本张图必须重点服务文案“${currentTitle}”，文字必须真实出现在图中。${logoInstruction}`.trim();
  }

  if (input.slotCount === 2) {
    return `当前输出第 ${input.slotIndex} 张图（共 2 张）。图间关系是“${input.copyType ?? "自动分配"}”。本张图必须重点服务文案“${currentTitle}”，并和另一张图形成清晰对照或递进关系，不能重复同一画面。文字必须真实出现在图中。${logoInstruction}`.trim();
  }

  const relation = input.copyType ?? "递进";
  const roleText = getTripleSlotRole(relation, input.slotIndex);
  return `当前输出第 ${input.slotIndex} 张图（共 3 张）。三图关系是“${relation}”。本张图必须重点服务文案“${currentTitle}”。本张图承担的角色是：${roleText}。三张图的人物、风格、品牌元素必须一致，但画面内容不能重复，合起来要能读出完整逻辑链。文字必须真实出现在图中。${logoInstruction}`.trim();
}

function getTripleSlotRole(copyType: string, slotIndex: number) {
  const normalized = copyType.trim();
  const roleMap: Record<string, string[]> = {
    并列: [
      "第一个并列卖点，突出第一记忆点，画面重点偏核心功能或第一优势",
      "第二个并列卖点，突出补充优势，画面重点偏另一种使用价值",
      "第三个并列卖点，突出收束优势，画面重点偏结果或综合收益",
    ],
    因果: [
      "原因或痛点，画面重点偏困境、阻碍或问题场景",
      "解决动作，画面重点偏产品介入、使用动作或关键方法",
      "结果收益，画面重点偏改善后的结果、轻松状态或提效收益",
    ],
    递进: [
      "第一层认知或起点，画面重点偏最初卡点或第一步理解",
      "第二层推进或行动，画面重点偏学习过程、拆解步骤或突破动作",
      "第三层升级或收益，画面重点偏学会之后的结果、进步或成就感",
    ],
    互补: [
      "主问题，画面重点偏核心痛点或主要场景",
      "第一补充解法，画面重点偏关键突破口或第一解决维度",
      "第二补充收益，画面重点偏延伸价值、补充优势或最终结果",
    ],
  };

  return roleMap[normalized]?.[slotIndex - 1] ?? roleMap.递进[slotIndex - 1];
}

export function mergeImagePromptWithSlot(promptJson: string, slotPrompt: string) {
  const parsed = JSON.parse(promptJson) as Record<string, unknown>;
  return JSON.stringify({
    ...parsed,
    slot_prompt: slotPrompt,
  });
}

export function buildImagePromptJson(input: {
  promptZh: string;
  promptEn: string;
  negativePrompt: string;
  aspectRatio: string;
  style: string;
  referenceImages: Array<{ url: string; role?: string; description?: string }>;
  textOverlay: {
    mainTitle: string;
    subTitle?: string | null;
    extraTitle?: string | null;
  };
  logo: string;
}): string {
  return JSON.stringify({
    prompt: input.promptEn,
    negative_prompt: input.negativePrompt,
    aspect_ratio: input.aspectRatio,
    style: input.style,
    reference_images: input.referenceImages,
    text_overlay: {
      main_title: input.textOverlay.mainTitle,
      sub_title: input.textOverlay.subTitle ?? null,
      extra_title: input.textOverlay.extraTitle ?? null,
    },
    logo_config: input.logo,
  }, null, 2);
}
