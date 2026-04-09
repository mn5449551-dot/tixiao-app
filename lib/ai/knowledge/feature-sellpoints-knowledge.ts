export type FeatureSellpointKnowledgeEntry = {
  featureId: string;
  featureName: string;
  featureDescription: string;
  targetAudience: string[];
  sellingPoints: Array<{
    id: string;
    label: string;
    description: string;
    scenario: string;
    audience: string;
  }>;
};

export const FEATURE_SELLPOINT_KNOWLEDGE = {
  source: "agent-co-creation/功能卖点库.md",
  version: "2026-04-01",
  entries: [
    {
      featureId: "F004",
      featureName: "拍题精学",
      featureDescription:
        "拍照识别题目，提供得分点拆解、AI交互式讲解、步骤精讲，帮助学生从“看答案”到“会解题”。",
      targetAudience: ["日常作业遇到难题的学生", "追求效率的学生", "理科薄弱学生"],
      sellingPoints: [
        {
          id: "F004-S01",
          label: "一拍秒出答案解析",
          description: "拍照识别题目，秒出答案与完整解析，不绕弯不跳步。",
          scenario: "日常作业卡壳、追求效率的学生",
          audience: "有作业负担的学生",
        },
        {
          id: "F004-S02",
          label: "得分点拆解",
          description:
            "把题目拆解成“阅卷老师看的得分点清单”，标记关键步骤，告诉学生每步怎么写能拿满分。",
          scenario: "备考学生，担心步骤扣分的学生",
          audience: "中上游备考学生",
        },
        {
          id: "F004-S03",
          label: "AI交互式精学",
          description: "AI私教引导式提问，给思路骨架而非直接答案，帮助学生自己推导出答案。",
          scenario: "看不懂解析跳步的学生",
          audience: "理科薄弱学生",
        },
        {
          id: "F004-S04",
          label: "步骤详细不跳步",
          description: "每一步都拆得够细、讲得够清楚，关键步骤绝不跳过。",
          scenario: "觉得“答案讲了等于没讲”的学生",
          audience: "基础薄弱学生",
        },
      ],
    },
    {
      featureId: "F009",
      featureName: "错题本",
      featureDescription: "自动收录错题，支持反复温习，帮助学生消灭易错题型。",
      targetAudience: ["全学段学生"],
      sellingPoints: [
        {
          id: "F009-S01",
          label: "自动收录反复温习",
          description: "错题自动收录，反复温习加深印象，避免同类型题目再出错。",
          scenario: "日常错题整理",
          audience: "全学段学生",
        },
        {
          id: "F009-S02",
          label: "详细解题思路",
          description: "提供详细解题思路，帮助消除易错题型。",
          scenario: "错题不会解的学生",
          audience: "需要错题攻关的学生",
        },
      ],
    },
    {
      featureId: "F001",
      featureName: "动画讲解",
      featureDescription:
        "5-8分钟趣味动画视频，将抽象知识可视化，让知识点更通俗易懂，适合预习、复习和提升学习兴趣。",
      targetAudience: ["学习兴趣不足的学生", "基础薄弱学生", "需要预习复习的学生"],
      sellingPoints: [
        {
          id: "F001-S01",
          label: "有趣易懂，愿意学能学会",
          description:
            "老中青三代教师合力拆解知识点，把知识变得通俗易懂有趣味。几分钟动画课程历经2个月研发，层层把控。",
          scenario: "对学习没兴趣、厌学的学生",
          audience: "学习兴趣不足的学生",
        },
        {
          id: "F001-S02",
          label: "5-8分钟短时高频",
          description: "每个知识点5-8分钟，短小精悍易吸收，碎片化学习，时间安排灵活易坚持。",
          scenario: "时间紧张、需要碎片化学习的学生",
          audience: "时间碎片化的学生",
        },
        {
          id: "F001-S04",
          label: "将抽象知识可视化",
          description: "动画形式让抽象概念变得直观展示，好理解、记得牢。",
          scenario: "理科概念抽象难理解的学生",
          audience: "物理化学等理科学习者",
        },
      ],
    },
  ] satisfies FeatureSellpointKnowledgeEntry[],
} as const;
