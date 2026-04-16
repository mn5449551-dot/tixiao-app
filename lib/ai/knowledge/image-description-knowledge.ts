/**
 * Image Description Agent 知识库模块
 * 根据渠道和图片形式动态生成知识补充上下文
 */

type Channel = "信息流（广点通）" | "应用商店" | "学习机";
type ImageForm = "single" | "double" | "triple";

type ImageDescriptionKnowledgeInput = {
  channel: Channel;
  imageForm: ImageForm;
  styleMode: "normal" | "ip";
};

/**
 * 渠道规则
 */
const channelRules: Record<Channel, string> = {
  "信息流（广点通）": `
【信息流渠道规则】
- 强调冲击力、钩子感、缩略图识别度
- 标题醒目、高对比、强色彩策略
- 第一眼要能让人停下来
- 人物表情要有情绪张力（开心、惊喜、焦虑、困惑等）
- 构图要有广告感，主体和标题区主次清晰
- 可以加入问号、感叹号、速度线、发光粒子、星光等增强视觉冲击
- 文字要清晰可读，不乱码、不拆字、不变形
- 缩略图状态下标题也要能看清`,
  "应用商店": `
【应用商店渠道规则】
- 强调功能展示、信任感、产品价值
- 画面要干净、专业、有获得感
- 人物表情要自然可信，不要太夸张
- 构图要平衡，产品/手机界面要清晰可见
- 文字要简洁明确，像说明书精华版
- 避免过度广告感，保持专业气质`,
  "学习机": `
【学习机渠道规则】
- 强调陪伴感、沉浸感、成长感
- 画面要有温馨、友好的氛围
- 人物表情要有成就感、满足感
- 构图要有陪伴感，像老师/伙伴在身边
- 文字要有鼓励感，不要太商业化
- 避免过强的成人广告感，增强学生视角`,
};

/**
 * 图片形式规则
 */
const imageFormRules: Record<ImageForm, string> = {
  single: `
【单图规则】
- 一张图内完成完整表达
- 标题格式：主标题内容是【XXX】副标题内容是【YYY】
- 构图要紧凑，所有信息在一张图内呈现
- 人物、标题、产品/手机要合理安排位置`,
  double: `
【双图规则】
- 两张图形成图间关系（问题/解法、旧状态/新状态、痛点/结果）
- 每张图一个文案，格式：标题内容是【XXX】
- 图1使用文案1（titleMain），图2使用文案2（titleSub）
- 两张图的人物、场景、风格要保持一致
- 参考图编号统一（如都写"参考图1"）`,
  triple: `
【三图规则】
- 三张图形成清晰逻辑链（问题→解法→结果 或 场景→亮点→收益）
- 每张图一个文案，格式：标题内容是【XXX】
- 图1使用文案1（titleMain），图2使用文案2（titleSub），图3使用文案3（titleExtra）
- 三张图的人物、场景、风格要保持一致
- 参考图编号统一（如都写"参考图1"）`,
};

/**
 * 风格模式规则
 */
const styleModeRules: Record<"normal" | "ip", string> = {
  normal: `
【普通模式规则】
- 保持广告画面的商业完成度
- 人物可以是写实或插画风格，根据imageStyle决定
- 缩略图识别度和视觉冲击力`,
  ip: `
【IP模式规则】
- 提示词必须以"高质量动漫风格海报"开头
- 整体人物视觉必须完全服从当前IP风格
- 不要出现真人写实质感
- 人物特征参考IP参考图，保持角色识别特征`,
};

/**
 * 构图规则（根据比例）
 */
const aspectRatioRules: Record<string, string> = {
  "9:16": "竖版构图，人物居中或偏下，标题在上方，产品/手机在前景",
  "16:9": "横版构图，人物在左侧或右侧，标题在另一侧，产品/手机在前景",
  "1:1": "方形构图，人物居中，标题在上方或下方，产品/手机在前景",
  "4:3": "接近方形构图，人物居中偏左，标题在右侧",
  "3:4": "竖版构图，人物居中，标题在上方",
};

/**
 * 镜头技巧推荐（根据渠道）
 */
const cameraTechniqueRecommendations: Record<Channel, string> = {
  "信息流（广点通）": `
【镜头技巧推荐】
- 景别：推荐特写或近景，突出人物情绪和表情张力
- 视角：推荐俯拍、大透视，增强冲击力
- 镜头类型：推荐鱼眼镜头（夸张变形效果）、广角镜头（大场景）
- 焦点：镜头聚焦到人物面部表情，背景可以微微虚化`,
  "应用商店": `
【镜头技巧推荐】
- 景别：推荐中景或全景，展示产品功能和整体场景
- 视角：推荐平视视角，构图平衡专业
- 镜头类型：推荐标准镜头或长焦镜头（背景虚化突出产品）
- 焦点：镜头聚焦到产品界面或人物与产品的互动`,
  "学习机": `
【镜头技巧推荐】
- 景别：推荐中景或近景，营造陪伴感和温馨氛围
- 视角：推荐平视或微仰视，亲切自然
- 镜头类型：推荐标准镜头，画面干净舒适
- 焦点：镜头聚焦到人物表情或学习场景`,
};

/**
 * 光线技巧推荐（根据渠道）
 */
const lightingRecommendations: Record<Channel, string> = {
  "信息流（广点通）": `
【光线技巧推荐】
- 推荐逆光（人物轮廓有金色光环，增强艺术感）
- 推荐霓虹灯光效（多彩光线，增强视觉冲击）
- 推荐氛围光（强对比度，突出人物）
- 高对比度策略，画面要有冲击力`,
  "应用商店": `
【光线技巧推荐】
- 推荐自然光（阳光、柔和光线，干净专业的视觉效果）
- 推荐柔和的室内光线，画面明亮舒适
- 避免过强的光影对比，保持专业气质`,
  "学习机": `
【光线技巧推荐】
- 推荐自然光（温暖的阳光感）
- 推荐温暖的氛围光，营造温馨感和陪伴感
- 光线柔和舒适，避免过强的视觉冲击`,
};

/**
 * 标题设计要求（通用）
 */
const titleDesignRequirements = `
【标题文字设计要求】
- 字体描述必须包含 4 个要素：字体类型 + 笔画特征 + 材质质感 + 装饰效果
- 字体类型要与画面整体风格匹配（动漫→粗描边卡通/圆润膨胀字体，3D→立体浮雕/亚克力字体，写实→现代无衬线品牌字体）
- 笔画特征要具体（粗壮饱满/圆润软萌/棱角分明/纤细流畅/粗细对比强烈）
- 材质质感要明确（3D立体浮雕/发光描边霓虹/果冻气泡/金属反光/哑光描边）
- 字体配色要与背景形成高对比，确保可读性
- 副标题用标签条/底色块/小字号等方式与主标题区分层级
- 标题周围加入 1-2 种装饰元素（星星/粒子/速度线/标签角标/小图标等）提升海报完成度
- 标题区域不能遮挡人物面部和关键动作
- 文字清晰可读，不乱码、不拆字、不变形、不模糊
- 缩略图状态下标题也要能看清`;

/**
 * 构建知识补充上下文
 */
export function buildImageDescriptionKnowledgeContext(
  input: ImageDescriptionKnowledgeInput
): string {
  const channelRule = channelRules[input.channel] || "";
  const imageFormRule = imageFormRules[input.imageForm] || "";
  const styleModeRule = styleModeRules[input.styleMode] || "";
  const cameraTechniqueRule = cameraTechniqueRecommendations[input.channel] || "";
  const lightingRule = lightingRecommendations[input.channel] || "";

  return `
${channelRule}

${imageFormRule}

${styleModeRule}

${cameraTechniqueRule}

${lightingRule}

${titleDesignRequirements}
`;
}

/**
 * 获取构图规则
 */
export function getAspectRatioRule(aspectRatio: string): string {
  return aspectRatioRules[aspectRatio] || "构图聚焦当前图位职责，主体、标题区、品牌区主次清晰";
}