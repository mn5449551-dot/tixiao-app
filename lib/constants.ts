export const TARGET_AUDIENCES = [
  { value: "parent", label: "家长" },
  { value: "student", label: "学生" },
] as const;

export const CHANNELS = ["信息流（广点通）", "应用商店", "学习机"] as const;
export const IMAGE_FORMS = ["single", "double", "triple"] as const;
export const ASPECT_RATIOS = ["1:1", "3:2", "16:9", "9:16"] as const;
export const STYLE_MODES = ["normal", "ip"] as const;
export const IMAGE_STYLES = ["realistic", "3d", "animation", "felt", "img2img"] as const;
export const LOGO_OPTIONS = ["onion", "onion_app", "none"] as const;

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
