# Requirement Agent (需求采集助手)

## Agent 概述

Requirement Agent 是洋葱学园素材生产系统中的第一个 Agent，负责通过多轮对话帮助用户整理需求卡信息。它位于图文素材生产链路的最前置入口，为后续的方向生成和文案生成提供结构化的输入。

## 系统提示词

```
角色定位：
你是洋葱学园素材生产系统里的真实 AI 对话助手，也是需求采集与结构化整理助手。

业务背景：
你处在图文素材生产链路的最前置入口，职责是通过多轮对话帮助用户整理需求卡信息，方便后续方向生成与文案生成继续使用。
当前仅支持 APP + 图文。
businessGoal 固定为 app，formatType 固定为 image_text，不需要再追问。

核心任务：
你当前只负责收集和整理以下需求字段：targetAudience、feature、sellingPoints、timeNode、directionCount。
当需求信息足够形成可检查草稿时，stage 设为 confirming，并在 reply 中简明总结要填充的内容。
如果用户还在补充信息，stage 设为 collecting。
只有当需求卡已经填充完成且用户只是闲聊时，才允许 stage 为 done。

可信输入：
- 当前字段草稿
- 最近对话
- 轻量知识补充上下文
- 当前需求卡是否已存在

决策规则：
- 一次只追问一个最关键缺口，不要同时抛多个问题。
- 如果用户表达了"你帮我补全 / 帮我生成剩余字段 / 全部帮忙生成"之类意图，你可以基于已有上下文补全 feature、sellingPoints、timeNode、directionCount。
- targetAudience 优先使用枚举值：parent 或 student。
- directionCount 必须是 1-5 的整数。
- 如果用户没提 timeNode，可以使用系统时间推断的默认时间节点。
- 如果用户没提 directionCount，默认使用 3。

字段判断标准：
- targetAudience：谁是核心投放对象，家长或学生。
- feature：本次主推功能，必须是业务人员能看懂的文本。
- sellingPoints：本次重点卖点数组，尽量 1-3 条，文本化表达。
- timeNode：时间节点或适配阶段，文本化表达。
- directionCount：需要生成几个方向。

硬性边界：
- 确认前不回填需求卡，需求卡必须保持空白/占位，直到用户点击"确认并填充需求卡"后才一次性写入。
- 确认后只回填左侧需求卡，不自动生成方向卡。
- 不要输出方向建议、创意方案、执行建议。
- 不要输出 Markdown、解释、额外注释。

输出契约：
- 只输出 JSON
- 必须包含 reply、fields、stage、nextField、missingFields、ui、confirmation
- fields 里只能出现上述 5 个字段
```

## 输入定义

### 输入字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `draft` | `AssistantDraft` | 当前字段草稿状态 |
| `conversation` | `AssistantConversationMessage[]` | 最近对话历史 |
| `hasRequirement` | `boolean` | 当前需求卡是否已存在 |

### AssistantDraft 结构

```typescript
type AssistantDraft = {
  targetAudience: "parent" | "student" | null;  // 目标人群
  feature: string | null;                        // 主推功能
  sellingPoints: string[];                       // 卖点列表
  timeNode: string | null;                       // 时间节点
  directionCount: number | null;                 // 方向数量 (1-5)
};
```

### AssistantConversationMessage 结构

```typescript
type AssistantConversationMessage = {
  role: "ai" | "user";
  content: string;
};
```

### 知识补充上下文

Agent 会根据当前时间、用户已输入的信息动态生成知识补充上下文，包括：
- 功能库建议 (FEATURE_LIBRARY)
- 时间节点建议 (TIME_NODES)
- 卖点建议 (基于选定的功能)

## 输出定义

### 输出字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `reply` | `string` | 助手回复文本 |
| `fields` | `Partial<AssistantDraft>` | 更新后的字段草稿 |
| `stage` | `"collecting" \| "confirming" \| "done"` | 当前阶段状态 |
| `nextField` | `string \| null` | 下一个需要追问的字段 |
| `missingFields` | `string[]` | 缺失字段列表 |
| `ui` | `AssistantUiAction[]` | UI 操作建议 |
| `confirmation` | `AssistantConfirmation \| null` | 确认信息（当 stage=confirming 时） |

### AssistantUiAction 结构

```typescript
type AssistantUiAction = {
  type: "reminder" | "audience_buttons" | "feature_suggestions" | 
        "selling_point_suggestions" | "time_node_suggestions";
  text?: string;      // 用于 reminder
  options?: Array<{ label: string; value: string }>;  // 用于建议类
};
```

### AssistantConfirmation 结构

```typescript
type AssistantConfirmation = {
  businessGoal: "app";
  formatType: "image_text";
  targetAudience: string;
  feature: string;
  sellingPoints: string[];
  timeNode: string;
  directionCount: number;
};
```

## Agent 能做什么

1. **需求采集**：通过多轮对话收集用户的需求信息
2. **字段推断**：基于用户输入和上下文自动推断缺失字段
3. **智能追问**：一次只追问一个最关键的缺失字段
4. **知识补充**：提供功能库、时间节点、卖点等建议
5. **草稿管理**：维护和更新需求字段草稿状态
6. **确认生成**：当信息完整时生成确认信息供用户确认

## 工作流程

```
用户输入 → 解析意图 → 更新草稿 → 检查完整性 → 
  ├─ 信息不完整 → 追问缺失字段 (stage=collecting)
  ├─ 信息完整 → 生成确认信息 (stage=confirming)
  └─ 用户确认后 → 填充需求卡 (stage=done)
```

## 常量定义

### 功能库 (FEATURE_LIBRARY)

| ID | 功能名 | 卖点 |
|----|--------|------|
| F001 | 拍题精学 | 10秒出解析、像老师边写边讲、定位易错点 |
| F002 | 错题本 | 自动收录错题、按知识点归类、考前快速复盘 |
| F003 | 动画讲解 | 难题讲得更直观、抽象知识可视化、孩子更愿意看 |

### 时间节点 (TIME_NODES)

- 开学季
- 期中考试
- 期末冲刺
- 寒假预习
- 暑假提升

### 目标人群

- `parent` - 家长
- `student` - 学生

## 调用方式

```typescript
import { runRequirementAssistant } from "@/lib/ai/agents/assistant-agent";

const result = await runRequirementAssistant({
  draft: {
    targetAudience: null,
    feature: null,
    sellingPoints: [],
    timeNode: null,
    directionCount: null,
  },
  conversation: [
    { role: "user", content: "我想给家长做一个期中考试的素材" }
  ],
  hasRequirement: false,
});
```

## 模型配置

- **模型**: Claude (通过 createChatCompletion)
- **Temperature**: 0.4
- **Response Format**: JSON Object

## 文件位置

- Agent 实现: `lib/ai/agents/assistant-agent.ts`
- 知识库: `lib/ai/agents/assistant-knowledge.ts`
- 常量定义: `lib/constants.ts`
- 数据库 Schema: `lib/schema.ts` (requirementCards 表)