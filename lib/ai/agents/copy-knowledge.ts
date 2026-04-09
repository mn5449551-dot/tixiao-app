export type CopyKnowledgeContext = {
  channelRules: string[];
  formRules: string[];
  exampleSnippets: string[];
  audienceToneSnippets: string[];
  promptBlock: string;
};

const CHANNEL_RULES: Record<string, string[]> = {
  "信息流（广点通）": [
    "信息流优先第一眼停留、痛点命中、行动引导、产品锚点。",
    "文案更适合钩子感、结果感、工具感表达。",
    "避免信息过载、慢热和过长解释。",
  ],
  "应用商店": [
    "应用商店更强调真实场景痛点、解法价值、使用收益。",
    "文案需要兼顾学生和家长双重理解。",
    "避免只有情绪钩子，没有产品能力解释。",
  ],
  "学习机": [
    "学习机更强调学习体验、成长感、陪伴感和设备场景适配。",
    "文案应减少过强的成人广告感，增强学生视角的成就感。",
    "避免只有大字没有场景，或只有氛围没有销售逻辑。",
  ],
};

const FORM_RULES: Record<string, string[]> = {
  single: [
    "单图文案需要在一张图内完成完整表达。",
    "主标题负责钩子或核心承诺，副标题补足解法或结果。",
  ],
  double: [
    "双图文案不能只是把一句长句硬拆成两句。",
    "两句必须形成真正的图间关系，如问题/解法、旧状态/新状态、痛点/结果。",
  ],
  triple: [
    "三图文案需要形成清晰逻辑链。",
    "优先采用 问题->解法->结果 或 场景->亮点->收益 的结构。",
  ],
};

function getDirectionExampleSnippets(channel: string, imageForm: string) {
  if (channel === "应用商店" && imageForm === "single") {
    return [
      "示例：主：作业写不动了？ 副：来洋葱拍一下！秒解难题",
      "示例：主：洋葱一拍拆解得分点 副：拍题精学步骤细，一看就懂拿满分！",
    ];
  }

  if (channel === "应用商店" && imageForm === "double") {
    return [
      "示例：图一：一道难题，卡住半小时？ 图二：洋葱一拍，秒出完整解析",
      "示例：图一：别人死抄步骤 图二：洋葱拍题教你拿捏得分要点",
    ];
  }

  if (channel === "应用商店" && imageForm === "triple") {
    return [
      "示例：图一：得分秘籍，一拍掌握 图二：硬核拆解，吃透逻辑 图三：寒假蓄力，开学逆袭",
      "示例：图一：题目卡壳一拍精学 图二：归纳重点解锁大招 图三：智能推题举一反三",
    ];
  }

  if (channel === "学习机") {
    return [
      "示例：主：和作业硬刚两小时？ 副：用洋葱拍一下，半小时结束战斗！",
      "示例：主：别再死磕干巴巴的答案了 副：寒假来洋葱学透解题步骤，get得分清单！",
    ];
  }

  return [
    "示例：主标题更强调问题和结果，副标题补足解法。",
    "示例：信息流适合直给型表达，避免太像海报文案。",
  ];
}

function getAudienceToneSnippets(targetAudience: string) {
  if (targetAudience.includes("家长")) {
    return [
      "家长更关注孩子是否主动学、提分效果可视化、学习是否省心安心。",
      "家长表达要避免过度学生黑话，强调解决方案、信任感和可感知变化。",
    ];
  }

  return [
    "学生更容易被痛点命中、效率感、开窍感、成就感吸引。",
    "学生表达可以更直接、更有画面感，但不能空喊口号。",
  ];
}

export function buildCopyKnowledgeContext(input: {
  channel: string;
  imageForm: string;
  targetAudience: string;
  directionTitle: string;
}): CopyKnowledgeContext {
  const channelRules = CHANNEL_RULES[input.channel] ?? [];
  const formRules = FORM_RULES[input.imageForm] ?? [];
  const exampleSnippets = getDirectionExampleSnippets(input.channel, input.imageForm);
  const audienceToneSnippets = getAudienceToneSnippets(input.targetAudience);

  const promptBlock = [
    channelRules.length ? `渠道规则：\n- ${channelRules.join("\n- ")}` : null,
    formRules.length ? `形式规则：\n- ${formRules.join("\n- ")}` : null,
    exampleSnippets.length ? `真实文案例子：\n- ${exampleSnippets.join("\n- ")}` : null,
    audienceToneSnippets.length ? `目标人群语气参考：\n- ${audienceToneSnippets.join("\n- ")}` : null,
    `当前方向：${input.directionTitle}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    channelRules,
    formRules,
    exampleSnippets,
    audienceToneSnippets,
    promptBlock,
  };
}
