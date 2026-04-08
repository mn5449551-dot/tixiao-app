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
}): string {
  const styleMap: Record<string, string> = {
    realistic: "写实风格，光影自然，色调偏暖",
    "3d": "3D立体渲染，卡通感，色彩明快",
    animation: "日系二次元动画风格，线条柔和，色彩清新",
    felt: "毛毡手工质感，温暖可爱，适合教育场景",
    img2img: "参考图生图，保留整体构图",
  };

  const style = styleMap[input.imageStyle] ?? "清新明亮的广告风格";
  const ipText = input.ipRole
    ? `画面中央出现${input.ipRole}角色，姿态亲切自然。角色设定：${input.ipDescription ?? input.ipRole}。人物关键词：${input.ipPromptKeywords ?? ""}。长相和整体风格必须与参考图一致，姿势可变化但身份设定不能漂移`
    : `画面主体为目标人群代表`;
  const logoText =
    input.logo && input.logo !== "none"
      ? "品牌 Logo 必须真实出现在画面左上角，尺寸清晰可见，不可缺失，不可只留空白。"
      : "画面中不需要品牌 Logo。";
  const isMultiImage = input.imageForm === "double" || input.imageForm === "triple";
  const textInstruction = isMultiImage
    ? "这是多图素材，具体每张图只承载自己的分图文案；当前基础画面提示不要把整套文案同时放进同一张图。"
    : `文案"${input.copyTitleMain}"${input.copyTitleSub ? `和"${input.copyTitleSub}"` : ""}${input.copyTitleExtra ? `以及"${input.copyTitleExtra}"` : ""}以清晰可读的字体直接体现在画面中，不可缺字漏字。`;

  return `${style}。${ipText}，站在明亮舒适的学习环境中。背景氛围体现"学习、成长、突破"的主题，色调温馨积极。画面构图采用${input.aspectRatio}布局，主体位于画面中右侧。${logoText} ${textInstruction}`;
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
}) {
  const titles = [
    input.copyTitleMain,
    input.copyTitleSub ?? "",
    input.copyTitleExtra ?? "",
  ];
  const currentTitle = titles[input.slotIndex - 1] ?? "";

  if (input.slotCount <= 1 || input.imageForm === "single") {
    return `当前输出第 ${input.slotIndex} 张图（共 ${input.slotCount} 张）。本张图必须重点服务文案“${currentTitle}”，文字必须真实出现在图中，且 Logo 在左上角可见。`;
  }

  if (input.slotCount === 2) {
    return `当前输出第 ${input.slotIndex} 张图（共 2 张）。图间关系是“${input.copyType ?? "自动分配"}”。本张图必须重点服务文案“${currentTitle}”，并和另一张图形成清晰对照或递进关系，不能重复同一画面。文字必须真实出现在图中，Logo 在左上角可见。`;
  }

  const relation = input.copyType ?? "递进";
  const roleText = getTripleSlotRole(relation, input.slotIndex);
  return `当前输出第 ${input.slotIndex} 张图（共 3 张）。三图关系是“${relation}”。本张图必须重点服务文案“${currentTitle}”。本张图承担的角色是：${roleText}。三张图的人物、风格、品牌元素必须一致，但画面内容不能重复，合起来要能读出完整逻辑链。文字必须真实出现在图中，Logo 在左上角可见。`;
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
