export type TimeNodeKnowledgeEntry = {
  node: string;
  timeRange: string;
  preheat?: string;
  targetAudience: string[];
  painPoints: string[];
  sceneDescription: string;
  subScenarios: Array<{
    audience: string;
    painPoint: string;
    sceneDescription: string;
  }>;
  recommendedFeatures: string[];
};

export const TIME_NODE_KNOWLEDGE = {
  source: "agent-co-creation/时间节点决策表.md",
  version: "2026-04-01",
  entries: [
    {
      node: "开学季",
      timeRange: "8月下旬 - 9月中旬",
      preheat: "提前2周开始投放",
      targetAudience: ["小学生家长", "初中生家长", "高中生家长", "小升初学生", "7升8学生", "新初三学生"],
      painPoints: [
        "学习状态不在线，无法快速回归学习状态",
        "知识难度增大、学科增多",
        "学习方式改变，更看重自主学习",
      ],
      sceneDescription:
        "孩子刚刚经历了暑假，玩心大，学习上难免有所放松，一开学很难迅速进入学习状态；初一新生面临知识难度增大、学科增多的挑战。",
      subScenarios: [
        {
          audience: "小升初学生",
          painPoint: "初中知识比小学难，学科增多",
          sceneDescription: "孩子一上初中学习突然吃力，课上听不懂，课下作业不会做。",
        },
        {
          audience: "通用学生",
          painPoint: "学习状态不在线",
          sceneDescription: "一开学很难迅速进入学习状态，一开始跟不上节奏，逐渐失去学习兴趣。",
        },
      ],
      recommendedFeatures: ["动画讲解", "同步课", "AI定制班"],
    },
    {
      node: "期中考试",
      timeRange: "10月下旬 - 11月中旬",
      preheat: "提前3周开始投放",
      targetAudience: ["基础薄弱学生", "中等生", "优等生", "各学段家长"],
      painPoints: ["不会备考", "复习没规划", "不知道重点难点", "课上听懂了下课题不会做"],
      sceneDescription:
        "临近考试，家长没有给孩子做复习规划，孩子面对众多科目和知识点不知从何入手；复习时不知道重点难点易考点。",
      subScenarios: [
        {
          audience: "基础薄弱学生",
          painPoint: "基础差，课上记不住跟不上，作业不会做",
          sceneDescription: "平时课上讲的记不住跟不上，回家作业也不会做，家长也不会教。",
        },
        {
          audience: "中等生",
          painPoint: "课上听懂了，一做题就不会",
          sceneDescription: "一知半解，没有真正理解知识，更不会运用做题。",
        },
      ],
      recommendedFeatures: ["精准复习", "总复习课", "日常练习", "拍题精学"],
    },
    {
      node: "期末冲刺",
      timeRange: "12月下旬 - 1月中旬 / 6月下旬 - 7月上旬",
      preheat: "提前3周开始投放",
      targetAudience: ["全学段学生及家长"],
      painPoints: ["不会备考", "不知道复习重点", "时间紧任务重", "担心成绩下滑"],
      sceneDescription:
        "备考时面对一段时间学习的知识无从下手，不知道该看书还是该做题，不知道复习重点是否正确，备考花很多时间但效率不尽人意。",
      subScenarios: [],
      recommendedFeatures: ["精准复习", "试卷库", "错题本"],
    },
    {
      node: "寒假预习",
      timeRange: "1月中旬 - 2月下旬",
      preheat: "考试结束后即开始投放",
      targetAudience: ["全学段学生及家长"],
      painPoints: ["放假松懈学习状态下滑", "期末考不好不知道怎么补", "没有学习目标不会规划", "想提前学不知道怎么学"],
      sceneDescription:
        "担心孩子在假期中放松学习导致新学期开始时成绩下滑；期末考试没考好不知道如何查漏补缺；没有合理的假期学习计划导致时间被浪费。",
      subScenarios: [
        {
          audience: "寒假末期学生",
          painPoint: "作业还没写完，开学要抽查",
          sceneDescription: "开学要抽查寒假作业，还有一大半没写，不知道怎么补。",
        },
        {
          audience: "想提前学的学生",
          painPoint: "想预习新学期内容，不知道怎么学",
          sceneDescription: "不知道怎么预习新学期知识，家长不会规划引导。",
        },
      ],
      recommendedFeatures: ["AI定制班", "动画讲解", "学情诊断", "拍题精学"],
    },
    {
      node: "暑假提升",
      timeRange: "7月上旬 - 8月下旬",
      preheat: "考试结束后即开始投放",
      targetAudience: ["全学段学生及家长"],
      painPoints: ["假期松懈学习状态下滑", "没有学习规划", "想提前学但不知道怎么学", "对比线下补习班"],
      sceneDescription:
        "担心孩子在假期中放松学习，导致新学期开始时成绩下滑；缺乏学习动力和好的学习习惯；想预习新学期内容但没有好的学习方法。",
      subScenarios: [],
      recommendedFeatures: ["AI定制班", "动画讲解", "学情诊断"],
    },
  ] satisfies TimeNodeKnowledgeEntry[],
} as const;
