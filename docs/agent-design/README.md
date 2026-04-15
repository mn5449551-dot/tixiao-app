# Agent 设计文档

本目录包含洋葱学园素材生产系统中所有 Agent 的设计文档。

## Agent 概览

系统包含 5 个 Agent，形成完整的图文素材生产链路：

| 序号 | Agent | 职责 | 输入来源 | 输出去向 |
|------|-------|------|----------|----------|
| 1 | Requirement Agent | 需求采集与结构化整理 | 用户对话 | 需求卡 |
| 2 | Direction Agent | 方向生成 | 需求卡 | 方向表 |
| 3 | Copy Agent | 文案生成 | 方向卡 | 文案卡 |
| 4 | Image Description Agent | 图片提示词生成 | 方向卡 + 文案卡 + 图片配置 | 图片提示词 |
| 5 | Image Agent | 图片生成 | 图片提示词 | 图片素材 |

## 工作流程

```
用户对话 → Requirement Agent → 需求卡 → 
Direction Agent → 方向表 → 
Copy Agent → 文案卡 → 
Image Description Agent → 图片提示词 → 
Image Agent → 图片素材
```

## 文档列表

1. [01-requirement-agent.md](01-requirement-agent.md) - 需求采集助手
2. [02-direction-agent.md](02-direction-agent.md) - 方向生成 Agent
3. [03-copy-agent.md](03-copy-agent.md) - 文案生成 Agent
4. [04-image-description-agent.md](04-image-description-agent.md) - 图片描述/提示词生成 Agent
5. [05-image-agent.md](05-image-agent.md) - 图片生成 Agent
6. [06-finalized-pool.md](06-finalized-pool.md) - 定稿池设计文档

## 数据流向

### 需求卡字段

```typescript
{
  targetAudience: "parent" | "student";  // 目标人群
  feature: string;                        // 主推功能
  sellingPoints: string[];                // 卖点列表
  timeNode: string;                       // 时间节点
  directionCount: number;                 // 方向数量 (1-5)
}
```

### 方向表字段

```typescript
{
  title: string;              // 素材方向名称
  targetAudience: string;     // 细分目标人群
  adaptationStage: string;    // 适配阶段
  scenarioProblem: string;    // 场景问题
  differentiation: string;    // 惊艳解法
  effect: string;             // 奇效
  channel: string;            // 投放渠道
  imageForm: string;          // 图片形式
}
```

### 文案卡字段

```typescript
{
  titleMain: string;           // 主标题
  titleSub: string | null;     // 副标题
  titleExtra: string | null;   // 第三标题（三图时）
  copyType: string | null;     // 图间关系类型
}
```

### 图片配置字段

```typescript
{
  imageForm: "single" | "double" | "triple";  // 图片形式
  aspectRatio: string;        // 画幅比例
  styleMode: "normal" | "ip"; // 风格模式
  imageStyle: string;         // 图片风格
  logo: "onion" | "onion_app" | "none";  // Logo配置
  ctaEnabled: boolean;        // 是否启用CTA
  ctaText: string | null;     // CTA文案
}
```

### 图片提示词结构

```typescript
// Image Description Agent 输出
{
  prompts: Array<{
    slotIndex: number;       // 图位索引（1-based）
    prompt: string;          // 最终连续自然语言提示词
    negativePrompt: string;  // 负向提示词
  }>;
}
```

## 模型配置

| Agent | 模型 | modelKey | Temperature | Response Format |
|-------|------|----------|-------------|-----------------|
| Requirement Agent | DeepSeek V3 | `model_assistant` | 0.4 | JSON Object |
| Direction Agent | DeepSeek V3 | `model_direction` | 0.8 | JSON Object |
| Copy Agent | DeepSeek V3 | `model_copy` | 0.8 | JSON Object |
| Image Description Agent | 可配置 | `model_image_description` | 0.8 | JSON Object |
| Image Agent | 可配置 | `model_image_generation` | - | 图片二进制 |

## 常量定义

### 目标人群

- `parent` - 家长
- `student` - 学生

### 图片形式

- `single` - 单图
- `double` - 双图
- `triple` - 三图

### 图片风格

- `realistic` - 写实风格
- `3d` - 3D立体渲染
- `animation` - 日系二次元动画风格
- `felt` - 毛毡手工质感
- `img2img` - 参考图生图

### 投放渠道

- 信息流（广点通）
- 应用商店
- 学习机

### 图间关系类型

- 并列
- 因果
- 递进
- 互补

## 数据库表

| 表名 | 说明 |
|------|------|
| `projects` | 项目表 |
| `requirementCards` | 需求卡表 |
| `directions` | 方向表 |
| `copyCards` | 文案卡表 |
| `copies` | 文案表 |
| `imageConfigs` | 图片配置表 |
| `imageGroups` | 图片组表 |
| `generatedImages` | 生成图片表 |

## 文件位置

### Agent 实现

- `lib/ai/agents/assistant-agent.ts` - Requirement Agent
- `lib/ai/agents/direction-agent.ts` - Direction Agent
- `lib/ai/agents/copy-agent.ts` - Copy Agent
- `lib/ai/agents/copy-knowledge.ts` - Copy Agent 知识库
- `lib/ai/agents/image-description-agent.ts` - Image Description Agent
- `lib/ai/agents/image-agent.ts` - Image Agent 封装
- `lib/ai/image-chat.ts` - Image Agent 实现

### AI 客户端

- `lib/ai/client.ts` - AI 客户端（文本和图片）
- `lib/ai/services/prompt-template.ts` - 提示词模板

### 业务逻辑

- `lib/project-data-modules-internal.ts` - 业务逻辑封装
- `lib/image-generation-service.ts` - 图片生成服务

### 常量定义

- `lib/constants.ts` - 常量定义

### 数据库

- `lib/schema.ts` - 数据库 Schema
