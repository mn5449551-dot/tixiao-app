export type CardStatus = "idle" | "loading" | "done" | "error" | "partial-success";

export const IMAGE_STYLE_DESCRIPTIONS: Record<string, string> = {
  realistic: "写实风格，光影自然，色调偏暖",
  "3d": "3D立体渲染，卡通感，色彩明快",
  animation: "日系二次元动画风格，线条柔和，色彩清新",
  felt: "毛毡手工质感，温暖可爱，适合教育场景",
  img2img: "参考图生图，保留整体构图",
};

export const TARGET_AUDIENCES = [
  { value: "parent", label: "家长" },
  { value: "student", label: "学生" },
] as const;

export const CHANNELS = ["信息流（广点通）", "应用商店", "学习机"] as const;
export const IMAGE_FORMS = ["single", "double", "triple"] as const;
export const STYLE_MODES = ["normal", "ip"] as const;
export const IMAGE_STYLES = ["realistic", "3d", "animation", "felt", "img2img"] as const;
export const LOGO_OPTIONS = ["onion", "onion_app", "none"] as const;

export const IMAGE_MODELS = [
  { value: "doubao-seedream-4-0", label: "即梦 4.0（推荐）", transport: "images_generations" as const, supportsReference: true, supportsEdits: true, aspectRatios: ["1:1", "3:2", "16:9", "9:16"] as const },
  { value: "doubao-seedream-4-5", label: "即梦 4.5", transport: "images_generations" as const, supportsReference: true, supportsEdits: true, aspectRatios: ["1:1", "3:2", "16:9", "9:16"] as const },
  { value: "doubao-seedream-5-0-lite", label: "即梦 5.0 Lite", transport: "images_generations" as const, supportsReference: true, supportsEdits: true, aspectRatios: ["1:1", "3:2", "16:9", "9:16"] as const },
  { value: "qwen-image-2.0", label: "通义千问 2.0", transport: "images_generations" as const, supportsReference: true, supportsEdits: true, aspectRatios: ["1:1", "3:2", "16:9", "9:16"] as const },
  { value: "gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash", transport: "chat_completions" as const, supportsReference: true, supportsEdits: false, aspectRatios: ["1:1", "3:2", "16:9", "9:16"] as const },
  { value: "gemini-3-pro-image-preview", label: "Gemini 3 Pro（不稳定）", transport: "chat_completions" as const, supportsReference: true, supportsEdits: false, aspectRatios: ["16:9", "9:16"] as const },
  { value: "gpt-image-1.5", label: "GPT Image 1.5", transport: "images_generations" as const, supportsReference: true, supportsEdits: false, aspectRatios: ["1:1"] as const },
] as const;
export const FINALIZED_ADAPTATION_MODEL_VALUES = [
  "doubao-seedream-4-0",
  "doubao-seedream-4-5",
  "doubao-seedream-5-0-lite",
] as const;
export const FINALIZED_ADAPTATION_MODELS = IMAGE_MODELS.filter((model) =>
  FINALIZED_ADAPTATION_MODEL_VALUES.includes(model.value as (typeof FINALIZED_ADAPTATION_MODEL_VALUES)[number]),
);
export const DEFAULT_IMAGE_MODEL_VALUE = IMAGE_MODELS[0].value;
export const DEFAULT_FINALIZED_ADAPTATION_MODEL_VALUE = FINALIZED_ADAPTATION_MODELS[0].value;

export function getAspectRatiosForModel(modelValue: string | null | undefined): readonly string[] {
  if (!modelValue) return [];
  const model = IMAGE_MODELS.find((m) => m.value === modelValue);
  return model ? model.aspectRatios : [];
}

export function getModelDefaultSize(modelValue: string, ratio: string): string {
  if (modelValue.includes("doubao")) {
    switch (ratio) {
      case "3:2": return "2352x1568";
      case "16:9": return "2560x1440";
      case "9:16": return "1440x2560";
      default: return "1920x1920";
    }
  }
  switch (ratio) {
    case "3:2": return "1536x1024";
    case "16:9": return "1792x1024";
    case "9:16": return "1024x1792";
    default: return "1024x1024";
  }
}

export const TIME_NODES = [
  "开学季",
  "期中考试",
  "期末冲刺",
  "寒假预习",
  "暑假提升",
] as const;

export const FEATURE_LIBRARY = [
  {
    id: "F001",
    name: "拍题精学",
    sellingPoints: [
      { id: "F001-S01", label: "10 秒出解析" },
      { id: "F001-S02", label: "像老师边写边讲" },
      { id: "F001-S03", label: "定位易错点" },
    ],
  },
  {
    id: "F002",
    name: "错题本",
    sellingPoints: [
      { id: "F002-S01", label: "自动收录错题" },
      { id: "F002-S02", label: "按知识点归类" },
      { id: "F002-S03", label: "考前快速复盘" },
    ],
  },
  {
    id: "F003",
    name: "动画讲解",
    sellingPoints: [
      { id: "F003-S01", label: "难题讲得更直观" },
      { id: "F003-S02", label: "抽象知识可视化" },
      { id: "F003-S03", label: "孩子更愿意看" },
    ],
  },
] as const;

export const IP_ROLES = ["豆包", "小锤", "豆花", "雷婷", "狗蛋", "上官"] as const;

export const DEFAULT_REQUIREMENT = {
  businessGoal: "app",
  targetAudience: "parent",
  formatType: "image_text",
  feature: FEATURE_LIBRARY[0].name,
  sellingPoints: [FEATURE_LIBRARY[0].sellingPoints[0].label],
  timeNode: "期中考试",
  directionCount: 3,
};

export function getAvailableChannels(targetAudience: string | null | undefined) {
  if (targetAudience === "parent") {
    return CHANNELS.filter((channel) => channel !== "学习机");
  }

  return [...CHANNELS];
}

export function getAvailableImageForms(channel: string | null | undefined) {
  if (channel === "信息流（广点通）") {
    return ["single"] as const;
  }

  return [...IMAGE_FORMS];
}

export function getCopyFormatDescription(channel: string | null | undefined, imageForm: string | null | undefined) {
  if (channel === "信息流（广点通）" || imageForm === "single") {
    return "主标题（6~22字）+ 副标题（7~31字）";
  }

  if (imageForm === "double") {
    return "双图：每图 4~10 字";
  }

  if (imageForm === "triple") {
    return "三图：每图 4~10 字";
  }

  return "按渠道格式生成";
}
