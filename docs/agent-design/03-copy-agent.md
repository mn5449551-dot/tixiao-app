# Copy Agent (文案生成 Agent)

## Agent 概述

Copy Agent 是洋葱学园素材生产系统中的第三个 Agent，负责把"方向表"压缩成可直接投放的图文文案。它位于方向卡之后、图片配置之前，职责是把方向卡压成可直接进入图文生产的文案卡。

## 系统提示词

```
你是“营销图文文案生成 Agent”。

你的任务不是自由发挥写广告语，也不是只根据功能名堆砌文案，
而是根据“方向卡”信息，把一条已经成立的营销方向，
压缩成适合指定渠道、指定图片形式、可直接进入图文生产的投放文案。

你生成的文案将用于：
- 信息流（广点通）
- 应用商店
- 学习机

以及对应的：
- 单图
- 双图
- 三图

因此，你的核心职责不是“创作”，而是“压缩表达”：
把方向里的【场景问题 / 差异化解法 / 奇效】压缩成真实可投放、可直接上图的文案。

--------------------------------
【你的核心任务】
--------------------------------
根据输入的方向卡与投放参数，生成 N 套文案。

每套文案都必须：
1. 忠实表达方向逻辑，不能脱离方向自由发挥
2. 适配指定渠道的传播任务
3. 适配指定图片形式的结构约束
4. 在同一方向下形成不同表达角度，而不是机械改写
5. 真实可投放、具体、直接、可感知

--------------------------------
【输入信息】
--------------------------------
你会收到以下字段：
- directionTitle：素材方向
- targetAudience：目标人群
- adaptationStage：适配阶段
- scenarioProblem：用户在具体场景中的具体问题
- differentiation：一听很惊艳的不一样解法
- effect：该场景下的具体奇效
- channel：渠道（信息流、应用商店、学习机）
- imageForm：图片形式（single / double / triple）
- count：需要生成的文案数量
- existingCopies：已有文案（追加生成时用于去重）
- knowledgeContext：补充规则或示例（可为空）

你必须基于完整方向信息生成文案，
不能只看方向标题，也不能只复述功能名。

--------------------------------
【第一原则：文案必须忠实绑定方向】
--------------------------------
文案不是从“方向标题”自由联想出来的，
而必须同时忠实表达以下逻辑链：

具体场景中的具体问题
→ 我们提供的不一样解法
→ 最终带来的具体奇效

如果文案只写了功能名、品牌名、口号，或者只写情绪而没有方向逻辑，
都视为不合格。

--------------------------------
【第二原则：先看渠道，再决定怎么写】
--------------------------------
不同渠道的核心任务不同，你必须先判断渠道任务，再决定文案表达方式。

1. 信息流（广点通）
- 核心任务：抢第一眼停留，快速命中痛点，促点击/下载
- 表达重心：钩子、效率感、结果感、工具感
- 文案特征：短、狠、直给，先抓人，再补一句结果或解法
- 避免：慢热、过长、太像海报、只讲品牌不讲问题
- 固定约束：信息流只生成 single

2. 应用商店
- 核心任务：解释产品能力，建立下载说服力与差异化记忆点
- 表达重心：场景痛点、解法价值、收益落点
- 文案特征：要让用户知道“这个产品能帮我什么”
- 避免：只有情绪钩子，没有能力解释；像番剧标题，不像产品卖点

3. 学习机
- 核心任务：建立产品信任感、陪伴感和完整学习场景
- 表达重心：学习体验、陪伴感、成长收益、完整场景
- 文案特征：更稳、更完整，减少硬广感
- 避免：过于像信息流硬广，只有大字，没有场景感

--------------------------------
【第三原则：先看图片形式，再决定结构】
--------------------------------
不同图片形式对应不同表达结构，不是简单拆句。

1. single
- 必须输出：titleMain + titleSub
- 主标题负责：痛点钩子 / 场景命中 / 核心承诺
- 副标题负责：补足解法 / 产品机制 / 结果收益
- 主标题字数：6-22 字
- 副标题字数：7-31 字
- copyType 固定为：单图主副标题

2. double
- 必须输出：titleMain + titleSub + copyType
- 每句 4-10 字
- 两句必须形成真实关系，不能是同义改写
- 关系只能从以下枚举中选：并列 / 因果 / 递进 / 互补
- 常见结构：
  - 问题 → 解法
  - 旧状态 → 新状态
  - 痛点 → 结果
  - 场景 → 产品动作

3. triple
- 必须输出：titleMain + titleSub + titleExtra + copyType
- 每句 4-10 字
- 三句必须形成清晰逻辑链
- 关系只能从以下枚举中选：并列 / 因果 / 递进 / 互补
- 优先结构：
  - 问题 → 解法 → 结果
  - 场景 → 亮点 → 收益
  - 旧状态 → 产品介入 → 新状态

--------------------------------
【第四原则：同一批文案要有明显差异】
--------------------------------
同一方向下的多套文案，不能只是机械改写。

你可以从以下维度制造差异：
- 不同钩子切入：问题型 / 结果型 / 对比型 / 工具型 / 场景型
- 不同表达重心：更偏痛点 / 更偏解法 / 更偏结果
- 不同语言风格：更直给 / 更口语 / 更结果导向

但所有文案都必须仍然围绕同一个方向逻辑。

--------------------------------
【你要学会的真实表达风格】
--------------------------------
整体文风要求：
- 口语化、顺口、有节奏感
- 像学生或家长真实会说的话
- 有画面感，能让人一眼想到具体场景
- 不写说明书腔，不写汇报腔，不写空泛鸡血句

好的文案通常具备：
- 明确问题
- 明确产品动作
- 明确结果
- 读起来顺口，适合直接上图

--------------------------------
【信息流、商店、学习机的表达差异】
--------------------------------
1. 信息流文案
更适合：
- 强问题开头
- 强结果承诺
- 工具感表达
- 直给型短句
例如：
- 一道题卡半小时？
- 拍一下，思路立现
- 作业别再硬刚了

2. 应用商店文案
更适合：
- 场景 + 功能价值
- 产品能力更明确
- 有“下载理由”
例如：
- 解析看不懂？试试拍题精学
- 一拍拆解关键步骤
- 从看答案到会做题

3. 学习机文案
更适合：
- 更完整的学习场景
- 陪伴与成长感
- 沉浸但不空
例如：
- 看不懂答案？它陪你一步步拆
- 不只给答案，更带你学会
- 学习不卡壳，更有成就感

--------------------------------
【禁止事项】
--------------------------------
禁止出现以下问题：

1. 不绑定方向逻辑，只复述功能或品牌
2. 空泛口号，没有具体问题、解法或结果
3. 同一句话轻微改写生成多条
4. 字数超标
5. double / triple 里句子没有真实图间关系
6. 信息流写得过长、过慢、过像海报
7. 应用商店写得像纯情绪广告，没有功能锚点
8. 学习机写得像硬广，没有场景和陪伴感

同时禁止以下红线表达：
- 保证提分、必然涨分、100%有效、包过
- 笨、差生、落后生等负面标签
- 输在起跑线、不学就晚了等焦虑营销
- 革命性、颠覆性、史上最强、AI万能等夸大表述

--------------------------------
【追加生成规则】
--------------------------------
如果输入中有 existingCopies，说明是追加生成。

此时你必须：
- 避开已有文案的钩子角度
- 避开已有文案的重心表达
- 避开已有文案的句式结构
- 生成新的有效表达，而不是换几个词

追加生成时只新增 1 条。

--------------------------------
【输出要求】
--------------------------------
你必须只输出 JSON。
不要输出解释，不要输出分析过程，不要输出 markdown 代码块。

输出格式如下：

single:
{
  "copies": [
    {
      "titleMain": "主标题",
      "titleSub": "副标题",
      "titleExtra": null,
      "copyType": "单图主副标题"
    }
  ]
}

double:
{
  "copies": [
    {
      "titleMain": "第一图文案",
      "titleSub": "第二图文案",
      "titleExtra": null,
      "copyType": "并列/因果/递进/互补"
    }
  ]
}

triple:
{
  "copies": [
    {
      "titleMain": "第一图文案",
      "titleSub": "第二图文案",
      "titleExtra": "第三图文案",
      "copyType": "并列/因果/递进/互补"
    }
  ]
}

--------------------------------
【输出前自检】
--------------------------------
输出前逐条检查：

- 是否忠实表达了方向里的场景问题、解法、奇效？
- 是否符合对应渠道的核心任务？
- 是否符合对应图片形式的结构要求？
- 是否字数合规？
- 是否口语化、顺口、可上图？
- 同一批文案之间是否有明显差异？
- JSON 是否严格合法？

如果不满足，先修正再输出。
```

## 输入定义

### CopyAgentInput 结构

```typescript
type CopyAgentInput = {
  directionTitle: string;      // 方向名称
  targetAudience: string;      // 目标人群
  scenarioProblem: string;     // 场景问题
  differentiation: string;     // 差异化解法
  effect: string;              // 奇效
  channel: string;             // 投放渠道
  imageForm: string;           // 图片形式 (single/double/triple)
  count: number;               // 需要生成的文案数量
  existingCopies?: Array<{     // 已有文案（追加生成时使用）
    titleMain: string;
    titleSub?: string | null;
    titleExtra?: string | null;
    copyType?: string | null;
  }>;
  knowledgeContext?: string;   // 知识补充上下文
};
```

### 输入来源

Copy Agent 的输入来自方向卡（Direction Card）：

| 方向卡字段 | Copy Agent 输入字段 |
|-----------|---------------------|
| `title` | `directionTitle` |
| `targetAudience` | `targetAudience` |
| `scenarioProblem` | `scenarioProblem` |
| `differentiation` | `differentiation` |
| `effect` | `effect` |
| `channel` | `channel` |
| `imageForm` | `imageForm` |

### User Prompt 示例

```
方向上下文：
- 方向名称：拍题精学·作业卡壳秒解决
- 目标人群：面向家长：关注孩子期中考试阶段学习效率与提分节奏的家长
- 场景问题：期中考试阶段做题频繁卡住，家长都在追进度却找不到突破口。
- 差异化解法：用 拍题精学 把难题拆成可执行的小步骤，孩子能立刻继续写。
- 奇效：从不会下笔到自己能顺着思路完成整题。

知识补充上下文：
渠道规则：
- 信息流优先第一眼停留、痛点命中、行动引导、产品锚点。
- 文案更适合钩子感、结果感、工具感表达。
- 避免信息过载、慢热和过长解释。
- 优先短句、口语化、画面感强的表达，读起来要顺口。

形式规则：
- 单图文案需要在一张图内完成完整表达。
- 主标题负责钩子或核心承诺，副标题补足解法或结果。
- 主标题控制在 6~22 字，副标题控制在 7~31 字。

真实文案例子：
- 示例：主标题更强调问题和结果，副标题补足解法。
- 示例：信息流适合直给型表达，避免太像海报文案。

目标人群语气参考：
- 家长更关注孩子是否主动学、提分效果可视化、学习是否省心安心。
- 家长表达要避免过度学生黑话，强调解决方案、信任感和可感知变化。

当前方向：拍题精学·作业卡壳秒解决

投放约束：
- 渠道：信息流（广点通）
- 图片形式：single
- 需要生成文案数：3

请输出 3 套真正可用于投放的图文文案，确保文案与方向逻辑强绑定，而不是只复述功能。
```

## 输出定义

### CopyAgentOutput 结构

```typescript
type CopyAgentOutput = {
  copies: CopyAgentIdea[];
};

type CopyAgentIdea = {
  titleMain: string;           // 主标题
  titleSub?: string | null;    // 副标题
  titleExtra?: string | null;  // 第三标题（三图时）
  copyType?: string | null;    // 图间关系类型
};
```

### 输出字段说明

| 字段 | 说明 | 字数限制 |
|------|------|----------|
| `titleMain` | 主标题，负责钩子或核心承诺 | 单图: 6~22 字；双图/三图: 4~10 字 |
| `titleSub` | 副标题，补足解法或结果 | 单图: 7~31 字；双图/三图: 4~10 字 |
| `titleExtra` | 第三标题（仅三图） | 4~10 字 |
| `copyType` | 图间关系类型 | 并列、因果、递进、互补 |

### 不同图片形式的输出要求

| 图片形式 | 必需字段 | 字数限制 | copyType 可选值 |
|----------|----------|----------|-----------------|
| `single` | titleMain, titleSub | 主: 6~22字；副: 7~31字 | 单图主副标题（默认） |
| `double` | titleMain, titleSub, copyType | 每句: 4~10字 | 并列、因果、递进、互补 |
| `triple` | titleMain, titleSub, titleExtra, copyType | 每句: 4~10字 | 并列、因果、递进、互补 |

### 输出格式特点

Copy Agent 采用 **纯 JSON 输出格式**：

1. 只输出合法 JSON
2. 顶层对象固定为 `copies`
3. 文案字段固定为 `titleMain`、`titleSub`、`titleExtra`、`copyType`
4. 不输出思考过程、不输出分隔符、不输出 markdown

这种格式的好处是：
- 更稳定，便于前端和服务端直接解析
- 与文案卡消费结构完全一致
- 避免模型输出额外说明导致解析失败

### 输出示例

#### 单图 (single)

```json
{
  "copies": [
    {
      "titleMain": "孩子一做题就卡壳？",
      "titleSub": "拍一下 10 秒出解析，像老师边写边讲",
      "copyType": "单图主副标题"
    },
    {
      "titleMain": "一道题卡半小时",
      "titleSub": "洋葱学园帮你把思路掰开讲清楚",
      "copyType": "单图主副标题"
    },
    {
      "titleMain": "写作业总要等人教",
      "titleSub": "现在自己拍题就能立刻继续学",
      "copyType": "单图主副标题"
    }
  ]
}
```

#### 双图 (double)

```json
{
  "copies": [
    {
      "titleMain": "卡题不慌",
      "titleSub": "拍一下就懂",
      "titleExtra": null,
      "copyType": "因果"
    },
    {
      "titleMain": "晚间作业",
      "titleSub": "秒出解析",
      "titleExtra": null,
      "copyType": "递进"
    }
  ]
}
```

#### 三图 (triple)

```json
{
  "copies": [
    {
      "titleMain": "卡题不慌",
      "titleSub": "拍一下就懂",
      "titleExtra": "错题不再拖",
      "copyType": "递进"
    },
    {
      "titleMain": "不会就拍",
      "titleSub": "思路立现",
      "titleExtra": "越学越稳",
      "copyType": "因果"
    }
  ]
}
```

## 知识补充上下文

Copy Agent 会根据渠道、图片形式、目标人群动态生成知识补充上下文。

### 渠道规则

| 渠道 | 规则 |
|------|------|
| **信息流（广点通）** | 优先第一眼停留、痛点命中、行动引导、产品锚点；文案更适合钩子感、结果感、工具感表达；避免信息过载、慢热和过长解释；优先短句、口语化、画面感强的表达 |
| **应用商店** | 更强调真实场景痛点、解法价值、使用收益；文案需要兼顾学生和家长双重理解；避免只有情绪钩子，没有产品能力解释；像说明书精华版，而不是技术说明书；要明确、有获得感，但不能拗口 |
| **学习机** | 更强调学习体验、成长感、陪伴感和设备场景适配；文案应减少过强的成人广告感，增强学生视角的成就感；避免只有大字没有场景，或只有氛围没有销售逻辑；语言要有陪伴感和沉浸感，专业但不生硬，有趣但不轻浮 |

### 形式规则

| 形式 | 规则 |
|------|------|
| **single** | 单图文案需要在一张图内完成完整表达；主标题负责钩子或核心承诺，副标题补足解法或结果；主标题 6~22 字，副标题 7~31 字 |
| **double** | 双图文案不能只是把一句长句硬拆成两句；两句必须形成真正的图间关系（问题/解法、旧状态/新状态、痛点/结果）；每句 4~10 字，独立可读 |
| **triple** | 三图文案需要形成清晰逻辑链；优先采用 问题→解法→结果 或 场景→亮点→收益 的结构；三句都 4~10 字，节奏紧凑、朗读顺口 |

### 目标人群语气参考

| 目标人群 | 语气参考 |
|----------|----------|
| **家长** | 更关注孩子是否主动学、提分效果可视化、学习是否省心安心；表达要避免过度学生黑话，强调解决方案、信任感和可感知变化 |
| **学生** | 更容易被痛点命中、效率感、开窍感、成就感吸引；表达可以更直接、更有画面感，但不能空喊口号；要像真实学生会说的话，避免拗口书面语 |

## Agent 能做什么

1. **文案生成**：基于方向上下文生成多条投放文案
2. **文案追加**：在已有文案基础上追加新文案，确保不重复
3. **渠道适配**：根据不同渠道调整文案风格和表达方式
4. **形式适配**：根据不同图片形式生成对应结构的文案
5. **人群适配**：根据目标人群调整语气和表达方式

## 工作流程

```
方向卡信息 → 构建知识上下文 → 构建 Prompt → 调用 AI → 解析输出（JSON.parse） → 
  ├─ 首次生成 → 生成 count 条文案
  └─ 追加生成 → 参考已有文案，生成 1 条新文案
→ 持久化到数据库 (copies 表)
```

### JSON 解析逻辑

Copy Agent 使用 3 次重试循环解析 AI 输出，每次重试都会重新调用模型：

```typescript
export async function generateCopyIdeas(input: CopyAgentInput) {
  const messages = buildCopyAgentMessages(input);
  const maxAttempts = 3;
  let lastContent = "";
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const content = await createChatCompletion({
      modelKey: "model_copy",
      messages,
      temperature: 0.8,
      responseFormat: { type: "json_object" },
    });
    lastContent = content;

    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const items = parsed?.items ?? parsed?.copies;
      if (Array.isArray(items) && items.length > 0) {
        return parsed as unknown as CopyAgentOutput;
      }
      lastError = `copies 数组为空或不存在，解析结果 keys: ${Object.keys(parsed).join(",")}`;
    } catch (parseError) {
      lastError = parseError instanceof Error ? parseError.message : "JSON 解析失败";
    }

    if (attempt === maxAttempts) {
      logAgentError({
        agent: "copy",
        requestSummary: `方向: ${input.directionTitle}, 渠道: ${input.channel}, 形式: ${input.imageForm}, 数量: ${input.count}`,
        rawResponse: lastContent,
        errorMessage: lastError,
        attemptCount: maxAttempts,
      });
      throw new Error("AI 文案生成格式异常，已重试 3 次仍失败，请稍后再试");
    }
  }

  throw new Error("AI 文案生成格式异常");
}
```

重试机制要点：
- 最多 3 次重试，每次重新调用模型生成
- 验证条件：`parsed?.items ?? parsed?.copies` 必须是非空数组（兼容模型可能用 `items` 或 `copies` 作为顶层 key）
- 3 次全部失败后，通过 `logAgentError` 记录错误到 `agent_error_logs` 表
- 最终抛出异常，由调用方处理

## 本地规则生成（Fallback）

当 AI 生成失败时，系统会使用本地规则生成文案：

### 单图文案模板 (singleCopyAngles)

```typescript
const singleCopyAngles = [
  ["孩子一做题就卡壳？", "拍一下 10 秒出解析，像老师边写边讲"],
  ["一道题卡半小时", "洋葱学园帮你把思路掰开讲清楚"],
  ["写作业总要等人教", "现在自己拍题就能立刻继续学"],
  ["会做题却不会讲", "看懂解析后，孩子自己也能讲出来"],
  ["难题一拖就放弃", "先拍一下，马上知道从哪一步开始"],
];
```

### 双图/三图文案模板 (duoCopyAngles)

```typescript
const duoCopyAngles = [
  ["卡题不慌", "拍一下就懂", "错题不再拖"],
  ["晚间作业", "秒出解析", "家长少焦虑"],
  ["不会就拍", "思路立现", "越学越稳"],
  ["题目太难", "讲解很清楚", "孩子能复述"],
  ["不会写步骤", "拆成得分点", "考试更稳"],
];
```

## 数据库持久化

生成的文案会持久化到 `copies` 表和 `copyCards` 表：

```typescript
// copyCards 表结构
{
  id: string;              // 主键
  directionId: string;     // 方向 ID
  channel: string;         // 投放渠道
  imageForm: string;       // 图片形式
  version: number;         // 版本号
  sourceReason: string;    // 来源原因
  createdAt: number;       // 创建时间
  updatedAt: number;       // 更新时间
}

// copies 表结构
{
  id: string;              // 主键
  copyCardId: string;      // 文案卡 ID
  directionId: string;     // 方向 ID
  titleMain: string;       // 主标题
  titleSub: string;        // 副标题
  titleExtra: string;      // 第三标题
  copyType: string;        // 图间关系类型
  variantIndex: number;    // 变体索引
  isLocked: number;        // 是否锁定
  createdAt: number;       // 创建时间
  updatedAt: number;       // 更新时间
}
```

## 调用方式

### API 调用

```typescript
// POST /api/directions/[id]/copy-cards/generate
const response = await fetch(`/api/directions/${directionId}/copy-cards/generate`, {
  method: 'POST',
  body: JSON.stringify({
    count: 3,
    use_ai: true,  // 是否使用 AI 生成
    append: false, // 是否追加生成
  }),
});
```

### 直接调用 Agent

```typescript
import { generateCopyIdeas, buildCopyAgentMessages } from "@/lib/ai/agents/copy-agent";
import { buildCopyKnowledgeContext } from "@/lib/ai/agents/copy-knowledge";

// 构建知识上下文
const knowledge = buildCopyKnowledgeContext({
  channel: "信息流（广点通）",
  imageForm: "single",
  targetAudience: "面向家长：关注孩子期中考试阶段学习效率与提分节奏的家长",
  directionTitle: "拍题精学·作业卡壳秒解决",
});

// 构建消息
const messages = buildCopyAgentMessages({
  directionTitle: "拍题精学·作业卡壳秒解决",
  targetAudience: "面向家长：关注孩子期中考试阶段学习效率与提分节奏的家长",
  scenarioProblem: "期中考试阶段做题频繁卡住，家长都在追进度却找不到突破口。",
  differentiation: "用 拍题精学 把难题拆成可执行的小步骤，孩子能立刻继续写。",
  effect: "从不会下笔到自己能顺着思路完成整题。",
  channel: "信息流（广点通）",
  imageForm: "single",
  count: 3,
  knowledgeContext: knowledge.promptBlock,
});

// 调用 AI
const result = await generateCopyIdeas({
  directionTitle: "拍题精学·作业卡壳秒解决",
  targetAudience: "面向家长：关注孩子期中考试阶段学习效率与提分节奏的家长",
  scenarioProblem: "期中考试阶段做题频繁卡住，家长都在追进度却找不到突破口。",
  differentiation: "用 拍题精学 把难题拆成可执行的小步骤，孩子能立刻继续写。",
  effect: "从不会下笔到自己能顺着思路完成整题。",
  channel: "信息流（广点通）",
  imageForm: "single",
  count: 3,
  knowledgeContext: knowledge.promptBlock,
});
```

## 模型配置

- **模型**: modelKey `"model_copy"`（通过 `createChatCompletion`）
- **Temperature**: 0.8
- **Response Format**: `json_object`

## 提示词工程最佳实践

Copy Agent 的系统提示词遵循以下最佳实践：

### 1. 框架五要素

- **背景**：明确角色定位和服务对象
- **目的**：清晰定义生成目标和质量要求
- **风格**：定义输出的语言风格（口语化、有节奏感）
- **语气**：定义输出的语气特点（直接、有钩子感）
- **受众**：明确输出内容的接收者（家长或学生）

### 2. 判断逻辑前置，但不输出推理过程

系统提示词仍然要求模型内部遵守：
- 方向逻辑强绑定
- 渠道优先
- 图片形式优先
- 同一批文案必须有明显差异

但这些判断逻辑只用于生成质量，不再作为外显输出的一部分。

### 3. 输出样例

提供不同图片形式的完整输出样例，帮助模型理解期望的输出格式和内容质量。

### 4. 纯 JSON 契约

输出只允许合法 JSON，固定使用英文 key，便于前端和后端稳定消费。

### 5. 决策规则

将抽象要求转化为具体的、可执行的规则（如"钩子优先"、"口语化表达"、"字数控制"）。

## 限制与边界

1. **文案数量上限**: 每个方向最多 10 条文案
2. **字数限制**: 
   - 单图: 主标题 6~22 字，副标题 7~31 字
   - 双图/三图: 每句 4~10 字
3. **追加生成**: 固定只新增 1 条文案
4. **copyType 限制**: 只能从并列、因果、递进、互补中选择

## 文件位置

- Agent 实现: `lib/ai/agents/copy-agent.ts`
- 知识库: `lib/ai/agents/copy-knowledge.ts`
- 业务逻辑: `lib/project-data-modules-internal.ts` (generateCopyCardSmart, appendCopyToCardSmart)
- API 路由: `app/api/directions/[id]/copy-cards/generate/route.ts`
- 数据库 Schema: `lib/schema.ts` (copies, copyCards 表)
