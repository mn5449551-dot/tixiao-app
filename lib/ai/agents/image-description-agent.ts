import { IMAGE_STYLE_DESCRIPTIONS } from "@/lib/constants";
import { createChatCompletion } from "@/lib/ai/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const rulesPath = resolve(process.cwd(), "../开发文档/知识库/画面描述生成规则.md");
let rulesContent: string | null = null;
try {
  rulesContent = readFileSync(rulesPath, "utf-8");
} catch {
  // Rules file not available — proceed with inline defaults.
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
  const rules = rulesContent
    ? `以下是画面描述生成规则，请严格遵守：\n\n${rulesContent}`
    : "画面描述需包含场景氛围、画面构图、IP动作与位置（如有）、目标人群特征、文案融入方式，以及左上角Logo真实露出要求，并强调 Logo 与参考完全一致，不得改字改形。";

  const systemPrompt = `你是广告画面描述专家。根据方向上下文、文案和图片配置，生成一段自然语言画面描述。
${rules}

输出要求：
1. 一段完整的自然语言描述（200-400字）
2. 描述必须包含：场景氛围、画面构图、目标人群特征、文案融入方式
3. 如涉及IP，必须包含IP形象的动作与位置描述
3.1 如涉及IP，必须保持角色长相、服装、发型、整体风格与参考图一致
4. 如启用 Logo，必须提及 Logo 真实出现在左上角，而不是只留白
4.1 Logo 必须与提供的参考 Logo 完全一致，不得改字，不得改变图形、颜色、比例、布局，不得重新设计
5. 风格必须匹配用户选择的图片风格
6. 文案文字必须清晰可读，位置合理
6.1 若启用 CTA，CTA 只允许以信息流单图中的行动按钮形式出现
7. 不要生成JSON或其他格式，只输出纯文本描述`;

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

请生成画面描述。`;

  try {
    const content = await createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
    });

    if (content && content.trim().length > 10) {
      return JSON.stringify(buildFallbackImageDescriptionPayload(input, content.trim()));
    }
  } catch (error) {
    // Fallback to rule-based description.
    void error;
  }

  // Fallback: rule-based description
  return JSON.stringify(buildFallbackImageDescriptionPayload(input));
}

type ImageDescriptionPayload = {
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
