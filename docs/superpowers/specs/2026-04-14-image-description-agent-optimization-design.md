> Archived historical design note. This document records a past planning state and does not define the current implementation. Current behavior should be verified against `docs/agent-design/*` and the live code.

# Image Description Agent 系统提示词优化设计

## 背景

当前 image-description-agent 生成的提示词在画面质量和标题文字处理方面有提升空间。参考文生图结构.md和高质量提示词结构.md，需要融入更专业的镜头语言、光线设计技巧，并强化标题文字的设计要求。

## 目标

- **画面质量提升**：系统性地应用景别、视角、镜头类型、光线等技巧
- **标题文字处理**：强化标题的设计感、醒目度、融合度
- **保留业务逻辑**：渠道差异、图片形式、风格模式等现有逻辑完全保留

## 改动范围

| 文件 | 改动类型 |
|------|----------|
| `lib/ai/agents/image-description-agent.ts` | 修改 `buildSystemPrompt` 函数 |
| `lib/ai/knowledge/image-description-knowledge.ts` | 新增技巧模块 |

## 详细设计

### 1. buildSystemPrompt 结构调整

**现有结构（9个维度）：**
风格开头 → 人物描述 → 场景道具 → 动作姿态 → 表情情绪 → 氛围特效 → 标题文字 → 镜头构图 → 质量结尾

**优化后结构（11个维度）：**

| 序号 | 维度 | 说明 |
|------|------|------|
| 1 | 风格开头 | 保持现有，IP模式用"高质量动漫风格海报" |
| 2 | 人物描述 | 保持现有，参考IP特征 |
| 3 | 场景道具 | 保持现有 |
| 4 | 动作姿态 | 保持现有 |
| 5 | 表情情绪 | 保持现有 |
| 6 | 镜头语言（新增） | 明确要求指定景别、视角、镜头类型 |
| 7 | 光线设计（新增） | 明确要求指定光线类型 |
| 8 | 氛围特效 | 保持现有 |
| 9 | 标题文字设计（强化） | 增加设计感、醒目度、融合度要求 |
| 10 | 构图布局 | 保持现有，结合比例规则 |
| 11 | 质量结尾 | 保持现有，强调4K、细节丰富 |

**标题格式改动：**
- 使用引号代替【】
- 单图：主标题内容是"XXX"，副标题内容是"YYY"
- 双图：图1标题内容是"XXX"，图2标题内容是"YYY"
- 三图：图1标题内容是"XXX"，图2标题内容是"YYY"，图3标题内容是"ZZZ"

### 2. image-description-knowledge.ts 新增模块

**新增镜头技巧推荐：**

```typescript
const cameraTechniqueRecommendations: Record<Channel, string> = {
  "信息流（广点通）": "推荐：俯拍、大透视、鱼眼镜头等冲击力强的视角；特写或近景突出人物情绪",
  "应用商店": "推荐：平视视角、中景或全景，展示产品功能；构图平衡专业",
  "学习机": "推荐：平视或微仰视，中景或近景，营造陪伴感和温馨氛围"
};
```

**新增光线技巧推荐：**

```typescript
const lightingRecommendations: Record<Channel, string> = {
  "信息流（广点通）": "推荐：逆光、霓虹灯、氛围光等强视觉冲击的光线；高对比度",
  "应用商店": "推荐：自然光、柔和光线，干净专业的视觉效果",
  "学习机": "推荐：自然光、温暖的氛围光，营造温馨感"
};
```

**新增标题设计要求：**

```typescript
const titleDesignRequirements = `
【标题文字设计要求】
- 位置：根据构图合理放置，不遮挡关键人物/产品
- 设计感：标题要有设计感，不是简单文字叠加
- 醒目度：标题要醒目，缩略图状态下也能看清
- 融合度：标题与画面风格融合，不突兀
- 文字清晰：不乱码、不拆字、不变形`;
```

**修改 buildImageDescriptionKnowledgeContext：**
- 在返回内容中追加镜头技巧推荐、光线技巧推荐、标题设计要求

### 3. 保留内容

以下业务逻辑完全保留，不做改动：

- **渠道规则**：信息流（广点通）、应用商店、学习机的差异化要求
- **图片形式规则**：单图、双图、三图的文案格式和图间关系
- **风格模式规则**：normal、ip 模式的视觉基调
- **构图规则**：根据比例（9:16、16:9、1:1、4:3、3:4）的构图方式

## 验证方式

1. 运行现有测试确保无破坏性改动
2. 手动测试不同渠道、图片形式、风格模式的提示词生成
3. 对比优化前后生成的图片效果

## 参考文档

- `/Users/xhh/Desktop/test/文生图结构.md` — 提示词公式和词典
- `/Users/xhh/Desktop/test/高质量提示词结构.md` — 高质量动漫海报提示词示例
