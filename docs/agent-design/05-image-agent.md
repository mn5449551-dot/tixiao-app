# Image Agent (图片生成 Agent)

## Agent 概述

Image Agent 是洋葱学园素材生产系统中的最后一个 Agent，负责调用图片生成模型生成实际的广告图片。它接收来自 Image Description Agent 的最终提示词，通过 AI 图片生成服务产出可用于投放的图片素材。

## 系统提示词

Image Agent 本身不包含系统提示词，它是一个纯粹的图片生成调用封装。真正的图片生成逻辑由底层图片模型（Gemini 3 Pro Image Preview）处理，提示词内容来自 Image Description Agent 的输出。

## 输入定义

### ImageAgentInput 结构

```typescript
type ImageAgentInput = {
  prompt: string;    // 最终提示词文本
  count: number;     // 需要生成的图片数量
};
```

### 扩展输入选项（generateImageFromPrompt）

```typescript
type GenerateImageFromPromptOptions = {
  prompt: string;
  aspectRatio?: string;      // 画幅比例（如 "1:1", "16:9"）
  resolution?: ImageResolution;  // 图片分辨率
};
```

### 参考图生成输入（generateImageFromReference）

```typescript
type GenerateImageFromReferenceInput = {
  instruction: string;      // 图片生成指令
  imageUrl?: string;        // 单张参考图 URL
  imageUrls?: string[];     // 多张参考图 URL
  aspectRatio?: string;     // 画幅比例
  resolution?: ImageResolution;  // 图片分辨率
};
```

### ImageResolution 类型

```typescript
type ImageResolution = "1K" | "2K" | "4K";
```

### 输入来源

Image Agent 的输入来自 Image Description Agent 的输出：

| Image Description Agent 输出字段 | Image Agent 输入字段 |
|----------------------------------|----------------------|
| `finalPrompt` | `prompt` |
| `slotCount` | `count` |

## 输出定义

### ImageBinary 结构

```typescript
type ImageBinary = {
  buffer: Buffer;           // 图片二进制数据
  mimeType: string;         // MIME 类型（如 "image/png"）
  source: "base64" | "url"; // 数据来源
};
```

### 输出字段说明

| 字段 | 说明 |
|------|------|
| `buffer` | 图片的二进制 Buffer 数据，可直接写入文件或上传存储 |
| `mimeType` | 图片的 MIME 类型，用于确定文件格式 |
| `source` | 数据来源类型，base64 表示从响应中解析，url 表示从 URL 下载 |

## Agent 能做什么

1. **纯文本生图**：基于提示词文本生成图片
2. **参考图生图**：基于参考图和指令生成图片（支持多张参考图）
3. **分辨率控制**：支持 1K、2K、4K 三种分辨率
4. **画幅比例控制**：支持自定义画幅比例
5. **批量生成**：支持一次生成多张图片
6. **错误重试**：内置 3 次重试机制，处理网络波动和服务端错误
7. **多格式解析**：支持解析多种图片响应格式（base64、data URL、URL）

## 工作流程

```
Image Description Agent 输出 → 构建 ImageAgentInput → 
调用图片生成 API → 解析响应 → 提取图片二进制 → 
持久化到数据库 (generatedImages 表) → 上传到存储服务
```

## 图片生成实现

### generateImageFromPrompt（纯文本生图）

```typescript
export async function generateImageFromPrompt(
  prompt: string,
  options?: {
    aspectRatio?: string;
    resolution?: ImageResolution;
  },
) {
  return generateImageViaChatCompletions({
    model: DEFAULT_IMAGE_MODEL,  // gemini-3-pro-image-preview
    messages: [{ role: "user", content: prompt }],
    aspectRatio: options?.aspectRatio,
    resolution: options?.resolution ?? DEFAULT_IMAGE_RESOLUTION,  // 默认 2K
  });
}
```

### generateImageFromReference（参考图生图）

```typescript
export async function generateImageFromReference(input: {
  instruction: string;
  imageUrl?: string;
  imageUrls?: string[];
  aspectRatio?: string;
  resolution?: ImageResolution;
}) {
  const urls = input.imageUrls?.filter(Boolean) ?? (input.imageUrl ? [input.imageUrl] : []);
  const messages: Array<{ role: string; content: string | MessageContentPart[] }> = [
    {
      role: "user",
      content: [
        { type: "text", text: input.instruction },
        ...urls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
      ],
    },
  ];

  return generateImageViaChatCompletions({
    model: DEFAULT_IMAGE_MODEL,
    messages,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution ?? DEFAULT_IMAGE_RESOLUTION,
  });
}
```

### generateImageViaChatCompletions（核心实现）

```typescript
async function generateImageViaChatCompletions(input: {
  model: string;
  messages: Array<{ role: string; content: string | MessageContentPart[] }>;
  aspectRatio?: string;
  resolution: ImageResolution;
}) {
  const apiKey = process.env.NEW_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 NEW_API_KEY，无法调用图片模型");
  }

  const requestBody = JSON.stringify({
    model: input.model,
    messages: input.messages,
    stream: false,
    generationConfig: buildGenerationConfig({
      resolution: input.resolution,
      aspectRatio: input.aspectRatio,
    }),
  });

  // 重试机制：最多 3 次
  for (let attempt = 1; attempt <= IMAGE_REQUEST_RETRY_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${DEFAULT_BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Connection: "close",
          Authorization: `Bearer ${apiKey}`,
        },
        body: requestBody,
        signal: AbortSignal.timeout(300_000),  // 5 分钟超时
      });
    } catch (error) {
      if (attempt < IMAGE_REQUEST_RETRY_ATTEMPTS && shouldRetryImageRequestError(error)) {
        await wait(IMAGE_REQUEST_RETRY_DELAY_MS * attempt);
        continue;
      }
      throw normalizeImageRequestError(error);
    }

    if (!response.ok) {
      const text = await response.text();
      if (attempt < IMAGE_REQUEST_RETRY_ATTEMPTS && shouldRetryImageResponseStatus(response.status)) {
        await wait(IMAGE_REQUEST_RETRY_DELAY_MS * attempt);
        continue;
      }
      throw new Error(`图片生成接口返回异常: ${response.status} ${text}`);
    }

    const payload = (await response.json()) as unknown;
    const binaries = await extractImageBinaries(payload);
    if (binaries.length === 0) {
      throw new Error(`图片生成成功但未解析到图片数据: ${JSON.stringify(payload).slice(0, 2000)}`);
    }

    return binaries;
  }

  throw new Error("图片生成网络请求失败");
}
```

## 图片响应解析

### extractImageBinaries（多格式解析）

系统支持解析多种图片响应格式：

```typescript
async function extractImageBinaries(payload: unknown) {
  const results: ImageBinary[] = [];
  const visited = new Set<unknown>();

  async function walk(node: unknown) {
    // 递归遍历响应对象，查找图片数据

    // 1. inlineData 格式（Gemini 响应）
    if (inlineData && typeof inlineData.mimeType === "string" && typeof inlineData.data === "string") {
      results.push({
        buffer: Buffer.from(inlineData.data, "base64"),
        mimeType: inlineData.mimeType,
        source: "base64",
      });
      return;
    }

    // 2. Markdown 图片格式：![...](data:image/...;base64,...)
    const markdownDataUrl = extractMarkdownImageDataUrl(value);
    if (markdownDataUrl) {
      results.push(parseDataUrl(markdownDataUrl));
      continue;
    }

    // 3. Data URL 格式：data:image/png;base64,...
    if (value.startsWith("data:image/")) {
      results.push(parseDataUrl(value));
      continue;
    }

    // 4. Base64 字段：b64_json, image_base64, base64
    if (key === "b64_json" || key === "image_base64" || key === "base64") {
      if (looksLikeBase64(value)) {
        results.push({ buffer: Buffer.from(value, "base64"), mimeType: "image/png", source: "base64" });
        continue;
      }
    }

    // 5. URL 字段：url, image_url
    if ((key === "url" || key === "image_url") && /^https?:\/\//.test(value)) {
      results.push(await downloadImage(value));
      continue;
    }
  }

  await walk(payload);
  return results;
}
```

## 重试机制

### 可重试的网络错误

```typescript
function shouldRetryImageRequestError(error: unknown) {
  const normalized = [error.name, error.message, causeCode, causeMessage].join(" ").toUpperCase();

  return (
    normalized.includes("ECONNRESET") ||
    normalized.includes("ECONNREFUSED") ||
    normalized.includes("ENOTFOUND") ||
    normalized.includes("EAI_AGAIN") ||
    normalized.includes("UND_ERR_SOCKET") ||
    normalized.includes("FETCH FAILED")
  );
}
```

### 可重试的 HTTP 状态码

```typescript
function shouldRetryImageResponseStatus(status: number) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}
```

### 重试参数

```typescript
const IMAGE_REQUEST_RETRY_ATTEMPTS = 3;           // 最大重试次数
const IMAGE_REQUEST_RETRY_DELAY_MS = 400;         // 基础延迟（毫秒）
// 实际延迟 = IMAGE_REQUEST_RETRY_DELAY_MS * attempt（递增延迟）
```

## 模型配置

### 默认配置

```typescript
const DEFAULT_BASE_URL = process.env.NEW_API_BASE_URL ?? "https://ops-ai-gateway.yc345.tv";
const DEFAULT_IMAGE_MODEL = process.env.NEW_API_IMAGE_MODEL ?? "gemini-3-pro-image-preview";
export const DEFAULT_IMAGE_RESOLUTION = "2K" as const;
```

### GenerationConfig 结构

```typescript
function buildGenerationConfig(input: {
  resolution: ImageResolution;
  aspectRatio?: string;
}) {
  return {
    imageConfig: {
      imageSize: input.resolution,
      ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
    },
  };
}
```

## 数据库持久化

生成的图片会持久化到 `generatedImages` 表：

```typescript
// generatedImages 表结构
{
  id: string;                    // 主键
  imageConfigId: string;         // 图片配置 ID
  imageGroupId: string;          // 图片组 ID
  slotIndex: number;             // 图位索引
  finalPromptText: string;       // 当前图位最终 prompt
  finalNegativePrompt: string;   // 当前图位负向提示词
  imageUrl: string;              // 图片 URL
  imageBinary: Buffer;           // 图片二进制数据
  status: string;                // 状态
  createdAt: number;             // 创建时间
  updatedAt: number;             // 更新时间
}
```

## 调用方式

### 直接调用 Agent

```typescript
import { generateImages } from "@/lib/ai/agents/image-agent";

// 简单调用
const result = await generateImages("一张展示学生使用手机学习的广告图", 1);
```

### 使用扩展功能

```typescript
import { generateImageFromPrompt, generateImageFromReference } from "@/lib/ai/image-chat";

// 纯文本生图（带分辨率和比例）
const images = await generateImageFromPrompt(
  "一张展示学生使用手机学习的广告图",
  {
    aspectRatio: "1:1",
    resolution: "2K",
  }
);

// 参考图生图
const images = await generateImageFromReference({
  instruction: "保持角色风格，生成一张新的学习场景图",
  imageUrls: [
    "https://example.com/reference1.png",
    "https://example.com/reference2.png",
  ],
  aspectRatio: "16:9",
  resolution: "4K",
});
```

### 通过 createImageGeneration 调用

```typescript
import { createImageGeneration } from "@/lib/ai/client";

const result = await createImageGeneration({
  model: "gpt-image-1",
  prompt: "一张展示学生使用手机学习的广告图",
  size: "1024x1024",
  n: 1,
});
```

## API 端点

### 图片生成 API

```
POST ${DEFAULT_BASE_URL}/v1/chat/completions
```

请求体：
```json
{
  "model": "gemini-3-pro-image-preview",
  "messages": [{ "role": "user", "content": "..." }],
  "stream": false,
  "generationConfig": {
    "imageConfig": {
      "imageSize": "2K",
      "aspectRatio": "1:1"
    }
  }
}
```

### OpenAI 格式 API

```
POST ${DEFAULT_BASE_URL}/v1/images/generations
```

请求体：
```json
{
  "model": "gpt-image-1",
  "prompt": "...",
  "size": "1024x1024",
  "n": 1
}
```

## 限制与边界

1. **超时限制**: 单次请求最大 5 分钟（300_000ms）
2. **重试次数**: 最多 3 次重试
3. **分辨率选项**: 仅支持 1K、2K、4K
4. **API Key 必需**: 必须配置 NEW_API_KEY 环境变量
5. **响应解析**: 必须能从响应中提取到图片数据，否则抛出异常

## 错误处理

### 错误类型

| 错误 | 说明 |
|------|------|
| `缺少 NEW_API_KEY，无法调用图片模型` | 未配置 API Key |
| `图片生成请求超时` | 请求超过 5 分钟 |
| `图片生成网络请求失败` | 网络连接问题 |
| `图片生成接口返回异常: ${status}` | 服务端返回错误状态码 |
| `图片生成成功但未解析到图片数据` | 响应格式无法解析 |
| `下载图片失败` | 从 URL 下载图片失败 |
| `无法解析 data URL 图片响应` | Data URL 格式无效 |

## 文件位置

- Agent 封装: `lib/ai/agents/image-agent.ts`
- 图片生成实现: `lib/ai/image-chat.ts`
- AI 客户端: `lib/ai/client.ts`
- 图片生成服务: `lib/image-generation-service.ts`
- API 路由: `app/api/image-configs/[id]/generate/route.ts`
- 数据库 Schema: `lib/schema.ts` (generatedImages 表)
