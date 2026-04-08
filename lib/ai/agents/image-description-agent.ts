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
}) {
  const rules = rulesContent
    ? `以下是画面描述生成规则，请严格遵守：\n\n${rulesContent}`
    : "画面描述需包含场景氛围、画面构图、IP动作与位置（如有）、目标人群特征、文案融入方式，以及左上角Logo真实露出要求。";

  const systemPrompt = `你是广告画面描述专家。根据方向上下文、文案和图片配置，生成一段自然语言画面描述。
${rules}

输出要求：
1. 一段完整的自然语言描述（200-400字）
2. 描述必须包含：场景氛围、画面构图、目标人群特征、文案融入方式
3. 如涉及IP，必须包含IP形象的动作与位置描述
3.1 如涉及IP，必须保持角色长相、服装、发型、整体风格与参考图一致
4. 如启用 Logo，必须提及 Logo 真实出现在左上角，而不是只留白
5. 风格必须匹配用户选择的图片风格
6. 文案文字必须清晰可读，位置合理
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
- Logo：${input.logo === "onion" ? "洋葱学园（候选图阶段也要真实出现）" : input.logo === "onion_app" ? "洋葱学园+APP（候选图阶段也要真实出现）" : "不使用"}

额外约束：
${input.imageForm === "single" ? "单图时，文案可以整体进入同一张图。" : "多图时，此处只描述整套画面的统一风格、人物、场景和Logo要求，不要把整套文案同时塞进同一张图；具体每一张图承载哪句文案，由后续分图规则决定。"}

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
      return content.trim();
    }
  } catch (error) {
    // Fallback to rule-based description.
    void error;
  }

  // Fallback: rule-based description
  return buildFallbackDescription(input);
}

function buildFallbackDescription(input: {
  directionTitle: string;
  targetAudience: string;
  scenarioProblem: string;
  copyTitleMain: string;
  copyTitleSub: string | null;
  aspectRatio: string;
  styleMode: string;
  ipRole: string | null;
  ipDescription?: string | null;
  ipPromptKeywords?: string | null;
  imageStyle: string;
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
    ? `画面中央出现${input.ipRole}角色，姿态亲切自然，目光看向观众，角色设定为${input.ipDescription ?? input.ipRole}，关键词包含${input.ipPromptKeywords ?? ""}，长相和整体风格必须与参考图一致`
    : `画面主体为一名目标人群代表（${input.targetAudience}）`;

  return `${style}。${ipText}，站在明亮舒适的学习环境中。背景氛围体现"学习、成长、突破"的主题，色调温馨积极。画面构图采用${input.aspectRatio}竖版/横版布局，主体人物位于画面中右侧，左上角必须真实出现品牌Logo。文案"${input.copyTitleMain}"${input.copyTitleSub ? `和"${input.copyTitleSub}"` : ""}以清晰可读的字体排布在画面下方或侧边，不遮挡主体。整体传达"高效、陪伴、成长"的情绪。`;
}
