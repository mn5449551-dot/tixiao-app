# Image Description Agent (图片描述/提示词生成 Agent)

## Agent 概述

Image Description Agent 负责把方向卡、文案卡和图片配置路由到对应的提示词生成器，输出可直接用于生图模型的最终 prompt。

当前主流程采用路由分发模式：

- `single` → **Poster Agent**（单图广告海报提示词生成）
- `double/triple` → **Series Agent**（系列组图广告提示词生成）

主输出契约为 `prompts[]`，每个图位直接产出：

- `slotIndex`（图位索引，1-based）
- `prompt`（最终连续自然语言提示词）
- `negativePrompt`（负向提示词）

## 路由元信息（buildRoutingMeta）

每次生成前，先根据输入计算 `ImageDescriptionRouteMeta`，用于决定系统提示词、用户提示词的构建策略：

```typescript
type ImageDescriptionRouteMeta = {
  agentType: "poster" | "series";           // 决定使用哪个系统提示词
  allowCTA: boolean;                         // 是否允许 CTA
  referenceMode: "ip_identity" | "style_reference";  // 参考图模式
  primaryReferenceLabel: string | null;      // 参考图标签（"参考图1" 或 null）
  seriesGoal: string | null;                 // 系列目标描述
  slotRoles: string[];                       // 每张图的角色
  consistencySummary: string | null;         // 一致性要求描述
};
```

### 路由规则

| 输入 | agentType | seriesGoal | slotRoles |
|------|-----------|------------|-----------|
| single | poster | null | `["完整海报图"]` |
| double | series | "双图要形成清晰图间关系" | 由 copyType 决定 |
| triple | series | "三图要形成问题到解法到结果的连续叙事" | 由 copyType 决定 |

### CTA 规则

CTA 仅在以下条件**全部满足**时允许出现：

- 渠道 = `信息流（广点通）`
- 图片形式 = `single`
- `ctaEnabled = true`
- `ctaText` 非空

### 参考图模式

| styleMode | referenceMode | 含义 |
|-----------|---------------|------|
| `ip` | `ip_identity` | 参考图1只锁人物身份特征，不锁服装、动作和姿势 |
| `normal` | `style_reference` | 参考图1只锁整体画风、质感和商业海报感，不锁具体构图 |

### SlotRoles 分配（resolveSeriesSlotRoles）

根据 `copyType` 分配每张图的叙事角色：

**双图（count=2）：**

| copyType | slotRoles |
|----------|-----------|
| 因果 | `["问题图", "解法图"]` |
| 递进 | `["起点图", "推进图"]` |
| 互补 | `["主问题图", "补充解法图"]` |
| 默认 | `["第一图", "第二图"]` |

**三图（count=3）：**

| copyType | slotRoles |
|----------|-----------|
| 因果 | `["问题图", "解法图", "结果图"]` |
| 并列 | `["卖点一", "卖点二", "卖点三"]` |
| 互补 | `["主问题图", "补充解法图", "补充收益图"]` |
| 默认 | `["问题图", "解法图", "结果图"]` |

### 一致性要求

系列图（double/triple）自动附加一致性约束：

> 整组图必须保持同一角色身份、同一风格、同一场景 family、同一标题系统。

## 系统提示词

### Poster 系统提示词（single）

```
你是"单图广告海报提示词生成 Agent"。

你的任务不是写普通插画描述，而是根据方向卡、文案卡、渠道、图片配置和参考图，生成一条可以直接用于文生图模型的广告海报级最终提示词。

你的输出必须同时满足：
1. 这是可投放的广告海报，不是普通插画
2. 主事件清晰，一眼能看懂
3. 主标题和副标题有明确、清晰、易读的呈现方式
4. 参考图用途准确，不滥用
5. CTA 只有在 信息流 + single + ctaEnabled=true 时才允许出现

关键要求：
- single 必须同时处理 titleMain 和 titleSub
- 主标题更大、更醒目，副标题为辅助信息
- 标题完整、清晰、可读，不乱码、不拆字、不模糊
- ip 模式参考图1只锁人物身份特征，不锁服装动作
- normal 模式参考图1只锁整体风格，不锁具体构图
- 不要提 Logo，不要写 Logo 约束
- 最终 prompt 必须是连续自然语言，不要写结构化块

输出要求：
你只输出 JSON，不要输出解释，不要输出分析过程。

{
  "prompts": [
    {
      "slotIndex": 1,
      "prompt": "最终连续自然语言提示词",
      "negativePrompt": "负向提示词"
    }
  ]
}
```

### Series 系统提示词（double/triple）

```
你是"系列组图广告提示词生成 Agent"。

你的任务不是分别写出几张独立好看的图，而是根据方向卡、文案卡、渠道、图片配置和参考图，生成一组可直接用于文生图模型的系列广告组图提示词。

你的首要目标不是单张图各自炸裂，而是整组图看起来像同一套物料：人物一致、风格一致、场景 family 一致、标题系统一致、图间逻辑清晰。

关键要求：
- 先识别整组图在讲什么、图间关系是什么
- 为每张图分配明确 slotRole
- double / triple 永远没有 CTA
- ip 模式参考图1只锁人物身份特征，不锁服装动作
- normal 模式参考图1只锁整体风格，不锁具体构图
- 所有图位必须保持角色身份一致、风格一致、场景 family 一致、标题系统一致
- 最终 prompt 必须是连续自然语言，不要写结构化块

输出要求：
你只输出 JSON，不要输出解释，不要输出分析过程。

{
  "prompts": [
    {
      "slotIndex": 1,
      "prompt": "第1张图的最终连续自然语言提示词",
      "negativePrompt": "负向提示词"
    }
  ]
}

当前需要输出 {count} 张图。
```

## 用户提示词

### Poster 用户提示词（single）

```
方向：{direction.title}
目标人群：{direction.targetAudience}
适配阶段：{direction.adaptationStage}
场景问题：{direction.scenarioProblem}
差异化解法：{direction.differentiation}
奇效：{direction.effect}
渠道：{direction.channel}
图片形式：single
画幅比例：{config.aspectRatio}（{aspectRatioRule}）
风格模式：{config.styleMode}
图片风格：{config.imageStyle}
主标题：{copySet.titleMain}
副标题：{copySet.titleSub}
CTA是否允许：{allowCTA ? "是，文案为"{ctaText}"" : "否"}
参考图规则：{referenceRule 或 "无参考图"}
参考图：
- 参考图1（{ref.role}）：{ref.usage}

补充上下文：
{knowledgeContext}

请输出 1 条 single 广告海报 prompt。
```

### Series 用户提示词（double/triple）

```
方向：{direction.title}
目标人群：{direction.targetAudience}
适配阶段：{direction.adaptationStage}
场景问题：{direction.scenarioProblem}
差异化解法：{direction.differentiation}
奇效：{direction.effect}
渠道：{direction.channel}
图片形式：{config.imageForm}
画幅比例：{config.aspectRatio}（{aspectRatioRule}）
风格模式：{config.styleMode}
图片风格：{config.imageStyle}
图间关系：{copySet.copyType}
系列目标：{seriesGoal}
一致性要求：{consistencySummary}
各图角色：
- 第1张：{slotRoles[0]}
- 第2张：{slotRoles[1]}
文案分配：
- 第1张文案：{titleMain}
- 第2张文案：{titleSub}
CTA：系列图不允许 CTA
参考图规则：{referenceRule 或 "无参考图"}
参考图：
- 参考图1（{ref.role}）：{ref.usage}

补充上下文：
{knowledgeContext}

请输出 {count} 条系列组图 prompt。
```

## 参考图处理

参考图在消息构建阶段附加到用户消息的 `image_url` 中，**logo 角色的参考图会被过滤掉**：

```typescript
// 过滤 logo 角色，只保留 ip/style 等参考图
input.referenceImages
  .filter((ref) => ref.role !== "logo")
  .flatMap((ref, index) => [
    { type: "text", text: `参考图${index + 1}：${ref.role}；用途：${ref.usage}` },
    { type: "image_url", image_url: { url: ref.url } },
  ])
```

编号从 1 开始，过滤后连续编号。

## 输入定义

### ImageDescriptionInput 结构

```typescript
type ImageDescriptionInput = {
  direction: {
    title: string;              // 方向名称
    targetAudience: string;     // 目标人群
    adaptationStage?: string;   // 适配阶段（新增）
    scenarioProblem: string;    // 场景问题
    differentiation: string;    // 差异化解法
    effect: string;             // 奇效
    channel: string;            // 投放渠道
  };
  copySet: {
    titleMain: string;          // 主标题
    titleSub: string | null;    // 副标题
    titleExtra: string | null;  // 第三标题
    copyType: string | null;    // 图间关系类型（因果/递进/互补/并列）
  };
  config: {
    imageForm: "single" | "double" | "triple";  // 图片形式
    aspectRatio: string;        // 画幅比例
    styleMode: "normal" | "ip"; // 风格模式
    imageStyle: string;         // 图片风格
    logo: "onion" | "onion_app" | "none";  // Logo配置
    ctaEnabled: boolean;        // 是否启用CTA
    ctaText: string | null;     // CTA文案
  };
  ip: {
    ipRole: string | null;      // IP角色名
    ipDescription: string | null;  // IP角色描述
    ipPromptKeywords: string | null;  // IP提示词关键词
  };
  referenceImages: Array<{
    role: "ip" | "style" | string;  // 参考图角色（logo 角色会被过滤）
    url: string;               // 参考图URL
    usage: string;             // 参考图用途说明
  }>;
};
```

## 输出定义

### ImageDescriptionOutput 结构

```typescript
type ImageDescriptionOutput = {
  prompts: ImageDescriptionPrompt[];
};

type ImageDescriptionPrompt = {
  slotIndex: number;       // 图位索引（1-based）
  prompt: string;          // 最终连续自然语言提示词
  negativePrompt: string;  // 对应图位的负向提示词
};
```

## 输入验证（validateImageDescriptionInput）

生成前会进行以下校验：

| 条件 | 错误信息 |
|------|---------|
| 信息流渠道 + 非 single | "信息流（广点通）仅支持 single 图片描述生成" |
| titleMain 为空 | "图片描述生成失败：缺少 titleMain" |
| double + titleSub 为空 | "图片描述生成失败：double 缺少 titleSub" |
| triple + titleSub 或 titleExtra 为空 | "图片描述生成失败：triple 缺少 titleSub 或 titleExtra" |
| 系列 + copyType 为空 | "图片描述生成失败：系列图缺少 copyType" |

## 负向提示词

### 默认负向提示词（base）

```
extra arms, extra hands, floating hands, deformed fingers, deformed body, blurry, low quality, text distortion, garbled text, split text, watermark, cropped face, messy background, dark horror mood, adult content
```

### IP 模式追加

```
{base}, realistic photo look, photorealistic skin texture, style drift
```

## Fallback 机制

当 AI 输出解析失败（格式错误、数量不对、异常）时，自动降级到 `buildFallbackOutput`，基于输入信息拼接基础提示词：

- 使用方向卡的 targetAudience、scenarioProblem、differentiation、effect 构建画面描述
- 根据图位分配角色（问题图/解法图/结果图）
- IP 模式以"高质量动漫风格广告海报"开头，普通模式以"高质量商业广告海报"开头
- 自动附加画幅比例、参考图描述、CTA 信息

## 知识库模块

知识库模块根据渠道、图片形式、风格模式动态生成补充上下文。

### 渠道规则

| 渠道 | 规则 |
|------|------|
| 信息流（广点通） | 强调冲击力、钩子感、缩略图识别度；标题醒目、高对比、强色彩策略；人物表情要有情绪张力；可加入问号、感叹号、速度线、发光粒子增强视觉冲击 |
| 应用商店 | 强调功能展示、信任感、产品价值；画面干净专业；人物表情自然可信；避免过度广告感 |
| 学习机 | 强调陪伴感、沉浸感、成长感；画面温馨友好；人物表情有成就感；避免过强成人广告感 |

### 镜头技巧推荐（根据渠道）

| 渠道 | 景别 | 视角 | 镜头类型 | 焦点 |
|------|------|------|---------|------|
| 信息流（广点通） | 特写或近景 | 俯拍、大透视 | 鱼眼、广角 | 人物面部表情，背景微微虚化 |
| 应用商店 | 中景或全景 | 平视 | 标准、长焦 | 产品界面或人物与产品互动 |
| 学习机 | 中景或近景 | 平视或微仰视 | 标准 | 人物表情或学习场景 |

### 光线技巧推荐（根据渠道）

| 渠道 | 推荐 |
|------|------|
| 信息流（广点通） | 逆光（金色光环）、霓虹灯光效、氛围光、高对比度 |
| 应用商店 | 自然光、柔和室内光线，避免过强光影对比 |
| 学习机 | 自然光（温暖阳光感）、温暖氛围光 |

### 图片形式规则

| 形式 | 规则 |
|------|------|
| 单图 | 一张图内完成完整表达；标题格式：主标题内容是【XXX】副标题内容是【YYY】；构图紧凑 |
| 双图 | 两张图形成图间关系；每张图一个文案；图1用 titleMain，图2用 titleSub；人物、场景、风格一致；参考图编号统一 |
| 三图 | 三张图形成清晰逻辑链；每张图一个文案；图1/2/3分别用 titleMain/titleSub/titleExtra；人物、场景、风格一致；参考图编号统一 |

### 风格模式规则

| 模式 | 规则 |
|------|------|
| normal | 保持广告画面的商业完成度；人物可以是写实或插画风格；缩略图识别度和视觉冲击力 |
| ip | 提示词必须以"高质量动漫风格海报"开头；整体人物视觉必须完全服从当前IP风格；不要出现真人写实质感 |

### 标题文字设计要求

- 位置：根据构图合理放置，不遮挡关键人物/产品
- 设计感：标题要有设计感，不是简单文字叠加，融入画面风格
- 醒目度：标题要醒目，缩略图状态下也能看清
- 融合度：标题与画面风格融合，不突兀
- 字体风格：IP模式用动漫风格字体，普通模式与画面整体风格一致
- 装饰元素：标题可以有适当的装饰（发光、描边、阴影等增强醒目度）
- 文字质量：确保文字清晰可读，不乱码、不拆字、不变形、不模糊

### 构图规则（根据画幅比例）

| 比例 | 构图规则 |
|------|---------|
| 9:16 | 竖版构图，人物居中或偏下，标题在上方，产品/手机在前景 |
| 16:9 | 横版构图，人物在左侧或右侧，标题在另一侧，产品/手机在前景 |
| 1:1 | 方形构图，人物居中，标题在上方或下方，产品/手机在前景 |
| 4:3 | 接近方形构图，人物居中偏左，标题在右侧 |
| 3:4 | 竖版构图，人物居中，标题在上方 |
| 其他 | 构图聚焦当前图位职责，主体、标题区、品牌区主次清晰 |

## 工作流程

```
图片配置 + 方向卡 + 文案卡 → 输入验证(validateImageDescriptionInput)
  → 构建路由元信息(buildRoutingMeta) → 选择 agentType(poster/series)
  → 构建系统提示词(poster/series) → 构建用户提示词 + 知识库上下文
  → 附加参考图到用户消息 → 调用 AI(createMultimodalChatCompletion)
  → 解析 JSON 输出 → 失败时降级到 fallback → 返回 prompts[]
```

## 调用方式

```typescript
import { generateImageDescription, buildImageDescriptionMessages } from "@/lib/ai/agents/image-description-agent";

const input: ImageDescriptionInput = {
  direction: {
    title: "作业卡壳秒解决",
    targetAudience: "初中生",
    adaptationStage: "初一",
    scenarioProblem: "卡题",
    differentiation: "拍题拆解",
    effect: "继续写下去",
    channel: "应用商店",
  },
  copySet: {
    titleMain: "图一文案",
    titleSub: "图二文案",
    titleExtra: null,
    copyType: "因果",
  },
  config: {
    imageForm: "double",
    aspectRatio: "3:2",
    styleMode: "ip",
    imageStyle: "animation",
    logo: "onion",
    ctaEnabled: false,
    ctaText: null,
  },
  ip: {
    ipRole: "豆包",
    ipDescription: "篮球少年 · 阳光活力型",
    ipPromptKeywords: "dark spiky hair",
  },
  referenceImages: [
    { role: "ip", url: "data:image/png;base64,ip", usage: "保持角色长相一致" },
  ],
};

// 调用 AI
const output = await generateImageDescription(input);
// output.prompts[0].prompt = "高质量动漫风格海报，..."
// output.prompts[0].negativePrompt = "extra arms, ..."
```

## 模型配置

- **模型**: 通过 `createMultimodalChatCompletion`，modelKey = `model_image_description`
- **支持多模态**: 可以接收参考图作为输入（image_url 类型）
- **Temperature**: 0.8
- **输出格式**: JSON（`responseFormat: { type: "json_object" }`）

## 图片风格定义

| 风格 | 描述 |
|------|------|
| `realistic` | 写实风格，光影自然，色调偏暖 |
| `3d` | 3D立体渲染，卡通感，色彩明快 |
| `animation` | 日系二次元动画风格，线条柔和，色彩清新 |
| `felt` | 毛毡手工质感，温暖可爱，适合教育场景 |
| `img2img` | 参考图生图，保留整体构图 |

## 限制与边界

1. **信息流仅支持单图**: 信息流（广点通）渠道只能生成 single 图片
2. **系列图禁止 CTA**: double/triple 永远不允许 CTA
3. **Logo 参考图被过滤**: logo 角色的参考图不会传入 AI
4. **禁止结构化块格式**: 最终 prompt 必须是连续自然语言
5. **禁止额外手臂**: 负向提示词中明确排除 extra arms/hands
6. **标题文字质量**: 不乱码、不拆字、不变形、不模糊
7. **不提 Logo**: 系统提示词中明确要求不要在 prompt 中写 Logo 约束

## 文件位置

- Agent 实现: `lib/ai/agents/image-description-agent.ts`
- 知识库模块: `lib/ai/knowledge/image-description-knowledge.ts`
- 测试文件: `lib/__tests__/image-description-agent.test.ts`
