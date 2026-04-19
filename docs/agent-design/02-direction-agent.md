# Direction Agent (方向生成 Agent)

## Agent 概述

Direction Agent 是洋葱学园素材生产系统中的第二个 Agent，负责把需求卡内容推导成业务人员可以直接使用的"方向表前六列"。它位于需求卡之后、文案生成之前，输出真实可投放、可继续生成文案的方向条目。

## 系统提示词

```
你是“营销素材方向生成 Agent”。

你的任务不是写最终广告文案，不是罗列功能卖点，也不是泛泛地 brainstorm 创意，
而是根据输入的需求信息，生成若干条“可直接用于后续物料生产的素材方向”。

这里的“素材方向”，本质上是：
在某个真实场景里，某类用户遇到了一个具体问题，
而我们的某个具体功能 / 核心卖点，恰好提供了一个有差异感的解决方式，
从而形成一个值得继续展开成图文、视频、口播、应用商店物料的信息骨架。

你的输出将被继续用于生成：
- 信息流图文
- 应用商店图
- 学习机场景物料
- 视频脚本
- 口播表达
- PPT 内容

所以你输出的不是某一种物料的成品文案，
而是能被多种物料继续加工的“方向结构”。

--------------------------------
【输入字段】
--------------------------------
你可能会收到以下字段：
- businessGoal：业务目标
- formatType：形式
- targetAudience：目标人群
- feature：主推功能
- sellingPoints：卖点列表（可能有多个）
- timeNode：时间节点 / 场景阶段
- directionCount：需要生成的方向数量
- existingDirections：已有方向（追加生成时用于去重）

输入信息不一定完整一致。
你需要基于已有信息做合理判断，但不能虚构输入中没有的核心能力。

--------------------------------
【你的核心任务】
--------------------------------
你要生成 N 条素材方向。

每条方向都必须回答清楚以下 6 个问题：
1. 这条素材方向叫什么
2. 它面向的是哪类更具体的人群
3. 它适合哪个阶段 / 场景
4. 它解决的是哪个具体场景里的哪个具体问题
5. 它提供了什么一听就有差异感的解法
6. 它最终在该场景里带来了什么具体奇效

--------------------------------
【最重要的原则】
--------------------------------
1. 一个方向，只能围绕一个核心卖点展开
如果输入中有多个卖点，你必须先判断这些卖点分别适合什么场景，
但每条方向最终只能选择其中一个最适合作为主轴的卖点展开。

禁止在同一条方向中并列展开多个卖点。
禁止把多个卖点混成一个“大而全”的方向。

2. 一个方向，只解决一个核心问题
每条方向只能聚焦一个最主要的问题。
不要在一条方向里同时讲效率、理解、提分、互动、准确率等多个问题。

3. 卖点必须场景化
不要只是重复卖点原文，
而要把卖点翻译成：
它在什么人、什么场景、什么问题下，为什么会变得有吸引力。

4. 方向之间必须有差异
多个方向之间的差异，至少来自以下一个维度：
- 不同场景
- 不同目标人群状态
- 不同问题
- 不同核心卖点
- 不同结果奇效

不能只是同一个方向换个说法。

--------------------------------
【你生成方向时的判断逻辑】
--------------------------------
你需要像一个有经验的营销策略人员一样判断：

- 这个目标人群最可能在哪些具体场景下被打动？
- 当前功能最适合承接哪类问题？
- 多个卖点里，哪个卖点最适合切这个场景？
- 这个卖点能不能形成一个用户一听就懂的惊艳解法？
- 这个方向最终能不能继续被扩展成不同形式的物料？

你需要有判断力，但不要脱离输入乱发散。

--------------------------------
【什么样的方向是好方向】
--------------------------------
好方向要同时满足：

1. 场景真实
让人能想到真实发生的时刻，而不是抽象概括

2. 问题具体
用户到底被什么卡住、为什么会焦虑，要说清楚

3. 解法有差异感
不能只是“帮助提升”“更加高效”“更智能”
要写出这个卖点为什么在这个场景里更值得打

4. 奇效可感知
不能写“提升效率”“增强效果”这种抽象结果
要写成用户能直接想象到的变化

5. 可继续延展
这条方向要能自然延展成图文、视频、口播、商店物料等不同形式

--------------------------------
【禁止事项】
--------------------------------
禁止出现以下问题：

1. 一个方向多个卖点
2. 一个方向多个核心问题
3. 只有功能介绍，没有场景
4. 只有结论，没有解法
5. 只有抽象收益，没有具体奇效
6. 多个方向高度重复
7. 使用空泛正确但没用的话，例如：
- 全面提升
- 显著改善
- 高效赋能
- 深度助力
- 多维升级
- 更智能更高效

--------------------------------
【追加生成规则】
--------------------------------
如果输入包含 existingDirections，说明是追加生成。

此时你必须主动避开已有方向已经覆盖的：
- 核心卖点
- 核心问题
- 主要场景
- 解法角度
- 奇效表达

追加生成不是换句话说，
而是补充一个新的有效切角。

--------------------------------
【输出要求】
--------------------------------
你必须只输出 JSON。
不要输出解释、不要输出分析过程、不要输出 markdown 代码块。

输出格式如下：

{
  "ideas": [
    {
      "title": "素材方向",
      "targetAudience": "目标人群",
      "adaptationStage": "适配阶段",
      "scenarioProblem": "能解决用户在具体哪个场景里的哪个具体问题",
      "differentiation": "能带来什么不一样的一听很惊艳的解法",
      "effect": "因此带来了哪个场景下的什么奇效"
    }
  ]
}

--------------------------------
【字段要求】
--------------------------------
title：
- 要像业务团队会讨论的方向名
- 不能写“方向一”“方向二”
- 要能体现该方向的核心切口

targetAudience：
- 不能只写“学生”“家长”
- 必须写成更具体的人群状态

adaptationStage：
- 与 timeNode 一致
- 必要时可以更贴近场景，例如：
  日常学习、晚间作业场景、寒假末期、开学衔接期、期中考试前等

scenarioProblem：
- 必须写清楚“哪个具体场景里的哪个具体问题”
- 最好包含人物状态、阻碍、情绪、后果
- 不能抽象

differentiation：
- 必须写清楚“为什么这个解法不一样”
- 必须体现这个卖点在该场景里的差异感
- 要做到用户一听就能理解，不需要复杂教育

effect：
- 必须写清楚“在哪个场景下带来了什么奇效”
- 要尽量具体、可感知
- 最好体现前后反差

--------------------------------
【输出前自检】
--------------------------------
输出前逐条检查：

- 这条方向是否只围绕一个核心卖点？
- 这条方向是否只解决一个核心问题？
- 这条方向是否有真实场景？
- 这条方向的解法是否有差异感？
- 这条方向的奇效是否具体可感知？
- 这条方向是否和其他方向明显不同？
- JSON 是否严格合法？

如果不满足，先修正再输出。
```

## 输入定义

### DirectionAgentInput 结构

```typescript
type DirectionAgentInput = {
  targetAudience: string;      // 目标人群 (parent/student)
  feature: string;             // 主推功能
  sellingPoints?: string[];    // 卖点列表
  timeNode: string;            // 时间节点
  count: number;               // 需要生成的方向数量
  existingDirections?: Array<{ // 已有方向（追加生成时使用）
    title: string;
    targetAudience: string;
    adaptationStage: string;
    scenarioProblem: string;
    differentiation: string;
    effect: string;
  }>;
};
```

### 输入来源

Direction Agent 的输入来自需求卡（Requirement Card）：

| 需求卡字段 | Direction Agent 输入字段 |
|-----------|-------------------------|
| `targetAudience` | `targetAudience` |
| `feature` | `feature` |
| `sellingPoints` | `sellingPoints` |
| `timeNode` | `timeNode` |
| `directionCount` | `count` |

### User Prompt 示例

```
需求卡信息：
- 目标人群：parent
- 功能：拍题精学
- 卖点：10秒出解析、像老师边写边讲
- 适配阶段 / 时间节点：期中考试
- 需要生成方向数：3

请基于以上信息，推导 3 条真实可投放的方向。
```

### 追加生成时的 User Prompt

```
需求卡信息：
- 目标人群：parent
- 功能：拍题精学
- 卖点：10秒出解析、像老师边写边讲
- 适配阶段 / 时间节点：期中考试
- 需要生成方向数：1

当前已生成方向：
1. 拍题精学·作业卡壳秒解决｜面向家长：关注孩子期中考试阶段学习效率与提分节奏的家长｜期中考试｜期中考试阶段做题频繁卡住，家长都在追进度却找不到突破口。｜用 拍题精学 把难题拆成可执行的小步骤，孩子能立刻继续写。｜从不会下笔到自己能顺着思路完成整题。
2. 拍题精学·薄弱点精准击破｜面向家长：关注孩子期中考试阶段学习效率与提分节奏的家长｜期中考试｜期中考试阶段刷题很多，但总在同一类题目反复出错。｜把错题和知识点快速归因，告诉用户先补什么最值。｜复习不再平均用力，提分更有方向。

请基于以上信息，推导 1 条真实可投放的方向。
```

## 输出定义

### DirectionAgentOutput 结构

```typescript
type DirectionAgentOutput = {
  ideas: DirectionAgentIdea[];
};

type DirectionAgentIdea = {
  title: string;              // 素材方向名称
  targetAudience: string;     // 细分目标人群
  adaptationStage: string;    // 适配阶段
  scenarioProblem: string;    // 场景问题
  differentiation: string;    // 惊艳解法
  effect: string;             // 奇效
};
```

### 输出字段说明

| 字段 | 说明 | 要求 |
|------|------|------|
| `title` | 素材方向名称 | 业务能直接拿去讨论和投放的方向名，不能只是功能名或口号 |
| `targetAudience` | 细分目标人群 | 在原始人群桶内进一步细分，写出更具体的人群状态、压力或目标 |
| `adaptationStage` | 适配阶段 | 根据营销场景标注，如"寒假"、"开学季"、"日常学习"等 |
| `scenarioProblem` | 场景问题 | 必须具体，包含场景、阻碍、情绪或后果 |
| `differentiation` | 惊艳解法 | 把产品能力翻译成解法机制，说明为什么这个产品在这个场景下更值得用 |
| `effect` | 奇效 | 可感知的结果变化，最好是前后反差 |

### 输出格式特点

Direction Agent 采用 **纯 JSON 输出格式**：

1. 只输出合法 JSON
2. 顶层对象固定为 `ideas`
3. 每条方向固定包含 6 个英文 key
4. 不输出思考过程、不输出分隔符、不输出 markdown

这种格式的好处是：
- 更稳定，便于前端和服务端直接解析
- 与方向卡消费结构完全一致
- 避免模型输出额外说明导致解析失败

### 输出示例

```json
{
  "ideas": [
    {
      "title": "方向一：传统拍搜买点素材",
      "targetAudience": "日常有作业负担、追求效率、想平衡学习与休息的学生",
      "adaptationStage": "日常学习",
      "scenarioProblem": "每天晚上作业一堆，数学题卡住半小时没进展，眼看时间溜走，既担心熬夜伤身，又怕明天交不上作业被点名。",
      "differentiation": "用洋葱拍题精学一拍，题目秒识别，答案与完整解析立刻呈现。不绕弯、不跳步，随拍随得，像身边坐了个"参考答案生成器"。",
      "effect": "原本要磨两小时的作业，现在半小时就能搞定。省下的时间可以用来复习其他科目、预习新课，甚至看一集动画片。周末也不再被拖沓的作业占满，终于有时间做自己喜欢的事。"
    },
    {
      "title": "方向二：投放"给得分点、讲透步骤"素材",
      "targetAudience": "寒假期间希望突破薄弱题型、想要真正学懂的学生",
      "adaptationStage": "寒假",
      "scenarioProblem": "寒假学习时遇到数学难题，看标准答案只有干巴巴的步骤，完全不明白"为什么第一步要这样变形""哪几步是得分关键"。感觉自己会了，但换个数字又不会做。",
      "differentiation": "洋葱拍题精学把题目拆解成"阅卷老师看的得分点清单"，还会标记关键步骤，并贴心告诉你："这一步写对公式能拿1分""这个结论必须写出推导过程才能得满分"。遇到卡顿时，你可以随时说"没听懂"，立刻换个更形象的例子重新讲，直到你学懂为止。",
      "effect": "寒假结束前，你发现自己居然能独立解出之前"看到就跳过"的题型。同类的压轴题你不仅做对了，还在草稿纸上自信地标出了每个得分点。同学惊讶地问："你是不是偷偷补课了？""
    },
    {
      "title": "方向三：验证"得分点心智"对中高意向学生的收割效率",
      "targetAudience": "初高中备考学生，尤其是有提分压力的中上游学生",
      "adaptationStage": "开学",
      "scenarioProblem": "考试卷子发下来，发现大题明明结果对，却因为"步骤不全""书写不规范"被扣了好几分。对照标准答案也不理解：到底怎么写才能让阅卷老师给满分？",
      "differentiation": "洋葱拍题精学，依托学科专家与阅卷标准研究团队，提供"专家级得分点拆解"。不仅告诉你正确答案，更告诉你"老师判卷时看哪几步、怎么写才能拿到每一分"，相当于直接把阅卷标准提前交给你。",
      "effect": "下一次考试，你遇到同类大题时，心里有底、笔下有谱。写步骤时就知道"这里必须写公式""这里要说明依据"。成绩出来，那道题果然拿了满分！老师还在班上表扬你"步骤规范、逻辑清晰"。你心里清楚：这不是偶然，是你掌握了"得分点的写法"。"
    }
  ]
}
```

## Agent 能做什么

1. **方向生成**：基于需求卡信息生成多条投放方向
2. **方向追加**：在已有方向基础上追加新方向，确保不重复
3. **场景推导**：从真实学习场景里找投放切口
4. **逻辑链构建**：构建"场景问题 → 惊艳解法 → 奇效"的完整逻辑链
5. **人群细分**：在原始人群桶内进一步细分目标人群
6. **阶段适配**：根据营销场景标注适配阶段

## 工作流程

```
需求卡信息 → 构建 Prompt → 调用 AI → 解析输出（JSON.parse） → 
  ├─ 首次生成 → 生成 count 条方向
  └─ 追加生成 → 参考已有方向，生成 1 条新方向
→ 持久化到数据库 (directions 表)
```

### JSON 解析逻辑

Direction Agent 使用 3 次重试循环解析 AI 输出，每次重试都会重新调用模型：

```typescript
export async function generateDirectionIdeas(input: DirectionAgentInput) {
  const messages = buildDirectionAgentMessages(input);
  const maxAttempts = 3;
  let lastContent = "";
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const content = await createChatCompletion({
      modelKey: "model_direction",
      messages,
      temperature: 0.8,
      responseFormat: { type: "json_object" },
    });
    lastContent = content;

    try {
      const parsed = JSON.parse(content) as DirectionAgentOutput;
      if (Array.isArray(parsed?.ideas) && parsed.ideas.length > 0) {
        return parsed;
      }
      lastError = `ideas 数组为空或不存在，解析结果 keys: ${Object.keys(parsed).join(",")}`;
    } catch (parseError) {
      lastError = parseError instanceof Error ? parseError.message : "JSON 解析失败";
    }

    if (attempt === maxAttempts) {
      logAgentError({
        agent: "direction",
        requestSummary: `目标人群: ${input.targetAudience}, 功能: ${input.feature}, 数量: ${input.count}`,
        rawResponse: lastContent,
        errorMessage: lastError,
        attemptCount: maxAttempts,
      });
      throw new Error("AI 方向生成格式异常，已重试 3 次仍失败，请稍后再试");
    }
  }

  throw new Error("AI 方向生成格式异常");
}
```

重试机制要点：
- 最多 3 次重试，每次重新调用模型生成
- 验证条件：`parsed.ideas` 必须是非空数组
- 3 次全部失败后，通过 `logAgentError` 记录错误到 `agent_error_logs` 表
- 最终抛出异常，由调用方处理

## 本地规则生成（Fallback）

当 AI 生成失败时，系统会使用本地规则生成方向蓝图：

```typescript
const blueprints = [
  {
    title: `${feature}·作业卡壳秒解决`,
    adaptationStage: node,
    scenarioProblem: `${node}阶段做题频繁卡住，${audience}都在追进度却找不到突破口。`,
    differentiation: `用 ${feature} 把难题拆成可执行的小步骤，孩子能立刻继续写。`,
    effect: "从不会下笔到自己能顺着思路完成整题。",
  },
  {
    title: `${feature}·薄弱点精准击破`,
    adaptationStage: node,
    scenarioProblem: `${node}阶段刷题很多，但总在同一类题目反复出错。`,
    differentiation: `把错题和知识点快速归因，告诉用户先补什么最值。`,
    effect: "复习不再平均用力，提分更有方向。",
  },
  {
    title: `${feature}·晚间陪学省心版`,
    adaptationStage: "日常学习",
    scenarioProblem: `晚上写作业最容易卡在关键题，家长也未必讲得清。`,
    differentiation: `把讲解交给系统，家长只需要陪伴，不需要硬讲题。`,
    effect: "减少催促和争执，家庭学习氛围更顺。",
  },
  {
    title: `${feature}·考前冲刺抢分`,
    adaptationStage: node,
    scenarioProblem: `${node}前的复盘时间紧，最怕会做题但步骤扣分。`,
    differentiation: "直接给出得分点与标准步骤表达，帮助快速校准答题方式。",
    effect: "同样会做，写出来更容易拿到完整分数。",
  },
  {
    title: `${feature}·看懂之后会表达`,
    adaptationStage: "日常学习",
    scenarioProblem: "很多孩子看过答案也只是照抄，真正上手还是不会。",
    differentiation: "强调过程解释和语言重构，让孩子知道为什么这么做。",
    effect: "从被动看答案，变成主动讲得出来。",
  },
];
```

## 数据库持久化

生成的方向会持久化到 `directions` 表：

```typescript
// directions 表结构
{
  id: string;                    // 主键
  projectId: string;             // 项目 ID
  requirementCardId: string;     // 需求卡 ID
  title: string;                 // 方向名称
  targetAudience: string;        // 目标人群
  adaptationStage: string;       // 适配阶段
  scenarioProblem: string;       // 场景问题
  differentiation: string;       // 惊艳解法
  effect: string;                // 奇效
  channel: string;               // 投放渠道
  imageForm: string;             // 图片形式
  copyGenerationCount: number;   // 文案生成数量
  sortOrder: number;             // 排序顺序
  isSelected: number;            // 是否选中
  createdAt: number;             // 创建时间
  updatedAt: number;             // 更新时间
}
```

## 调用方式

### API 调用

```typescript
// POST /api/projects/[id]/directions/generate
const response = await fetch(`/api/projects/${projectId}/directions/generate`, {
  method: 'POST',
  body: JSON.stringify({
    channel: '信息流（广点通）',
    image_form: 'single',
    copy_generation_count: 3,
    use_ai: true,  // 是否使用 AI 生成
    append: false, // 是否追加生成
  }),
});
```

### 直接调用 Agent

```typescript
import { generateDirectionIdeas, buildDirectionAgentMessages } from "@/lib/ai/agents/direction-agent";

// 构建消息
const messages = buildDirectionAgentMessages({
  targetAudience: "parent",
  feature: "拍题精学",
  sellingPoints: ["10秒出解析", "像老师边写边讲"],
  timeNode: "期中考试",
  count: 3,
});

// 调用 AI
const result = await generateDirectionIdeas({
  targetAudience: "parent",
  feature: "拍题精学",
  sellingPoints: ["10秒出解析", "像老师边写边讲"],
  timeNode: "期中考试",
  count: 3,
});
```

## 模型配置

- **模型**: modelKey `"model_direction"`（通过 `createChatCompletion`）
- **Temperature**: 0.8
- **Response Format**: `json_object`

## 提示词工程最佳实践

Direction Agent 的系统提示词遵循以下最佳实践：

### 1. 框架五要素

- **背景**：明确角色定位和服务对象
- **目的**：清晰定义生成目标和质量要求
- **风格**：定义输出的语言风格
- **语气**：定义输出的语气特点
- **受众**：明确输出内容的接收者

### 2. 判断逻辑前置，但不输出推理过程

系统提示词仍然要求模型在内部遵守：
- 一个方向一个核心卖点
- 一个方向一个核心问题
- 卖点必须场景化
- 追加生成必须去重

但这些判断逻辑只用于生成质量，不再作为外显输出的一部分。

### 3. 输出样例

提供完整的输出样例，帮助模型理解期望的输出格式和内容质量。

### 4. 纯 JSON 契约

输出只允许合法 JSON，固定使用英文 key，便于前端和后端稳定消费。

### 5. 决策规则

将抽象要求转化为具体的、可执行的规则（如"场景具体化"、"痛点可视化"）。

## 限制与边界

1. **方向数量上限**: 最多 10 条方向
2. **首次生成**: 数量严格等于需求卡要求的数量
3. **追加生成**: 固定只新增 1 条方向
4. **字段完整性**: 每条方向必须包含 6 个必需字段

## 文件位置

- Agent 实现: `lib/ai/agents/direction-agent.ts`
- 业务逻辑: `lib/project-data-modules-internal.ts` (generateDirectionsSmart, appendDirectionSmart)
- API 路由: `app/api/projects/[id]/directions/generate/route.ts`
- 数据库 Schema: `lib/schema.ts` (directions 表)
