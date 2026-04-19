import { IMAGE_MODELS, DEFAULT_IMAGE_MODEL_VALUE, getModelDefaultSize } from "@/lib/constants";

const DEFAULT_BASE_URL = process.env.NEW_API_BASE_URL ?? "https://ops-ai-gateway.yc345.tv";
const DEFAULT_IMAGE_MODEL = process.env.NEW_API_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL_VALUE;
export const DEFAULT_IMAGE_RESOLUTION = "2K" as const;
const IMAGE_REQUEST_RETRY_ATTEMPTS = 3;
const IMAGE_REQUEST_RETRY_DELAY_MS = 400;
const IMAGE_MODEL_CAPABILITIES = new Map<string, (typeof IMAGE_MODELS)[number]>(
  IMAGE_MODELS.map((item) => [item.value, item]),
);

export type ImageBinary = {
  buffer: Buffer;
  mimeType: string;
  source: "base64" | "url";
};

export type ImageResolution = "1K" | "2K" | "4K";
type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type ImageTransport = "chat_completions" | "images_generations";

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

export async function generateImageFromPrompt(
  prompt: string,
  options?: {
    aspectRatio?: string;
    resolution?: ImageResolution;
    model?: string;
  },
) {
  const resolved = resolveImageModel(options?.model);

  if (resolved.transport === "images_generations") {
    return generateImageViaImagesGenerations({
      model: resolved.model,
      prompt,
      size: buildImagesGenerationSize({
        model: resolved.model,
        aspectRatio: options?.aspectRatio,
        resolution: options?.resolution ?? DEFAULT_IMAGE_RESOLUTION,
      }),
    });
  }

  return generateImageViaChatCompletions({
    model: resolved.model,
    messages: [{ role: "user", content: prompt }],
    aspectRatio: options?.aspectRatio,
    resolution: options?.resolution ?? DEFAULT_IMAGE_RESOLUTION,
  });
}

export async function generateImageFromReference(input: {
  instruction: string;
  imageUrl?: string;
  imageUrls?: string[];
  aspectRatio?: string;
  resolution?: ImageResolution;
  model?: string;
}) {
  const resolved = resolveImageModel(input.model);
  const urls = input.imageUrls?.filter(Boolean) ?? (input.imageUrl ? [input.imageUrl] : []);

  // Gemini 系列：chat_completions + image_url
  if (resolved.transport === "chat_completions") {
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
      model: resolved.model,
      messages,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution ?? DEFAULT_IMAGE_RESOLUTION,
    });
  }

  // doubao/qwen 系列：/v1/images/edits
  if (resolved.supportsEdits && urls.length > 0) {
    return generateImageViaEdits({
      model: resolved.model,
      prompt: input.instruction,
      imageUrl: urls[0],
      size: buildImagesGenerationSize({
        model: resolved.model,
        aspectRatio: input.aspectRatio,
        resolution: input.resolution ?? DEFAULT_IMAGE_RESOLUTION,
      }),
    });
  }

  // gpt-image 等不支持 edits 的模型：退化为纯文生图
  return generateImageViaImagesGenerations({
    model: resolved.model,
    prompt: input.instruction,
    size: buildImagesGenerationSize({
      model: resolved.model,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution ?? DEFAULT_IMAGE_RESOLUTION,
    }),
  });
}

function resolveImageModel(model?: string): {
  model: string;
  transport: ImageTransport;
  supportsReference: boolean;
  supportsEdits: boolean;
} {
  const resolvedModel = model ?? DEFAULT_IMAGE_MODEL;

  const capability = IMAGE_MODEL_CAPABILITIES.get(resolvedModel);
  return {
    model: resolvedModel,
    transport: (capability?.transport ?? "images_generations") as ImageTransport,
    supportsReference: capability?.supportsReference ?? true,
    supportsEdits: capability?.supportsEdits ?? false,
  };
}

function buildImagesGenerationSize(input: {
  model: string;
  aspectRatio?: string;
  resolution: ImageResolution;
}) {
  return getModelDefaultSize(input.model, input.aspectRatio ?? "1:1");
}

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
        signal: AbortSignal.timeout(300_000),
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

async function generateImageViaImagesGenerations(input: {
  model: string;
  prompt: string;
  size: string;
}) {
  const apiKey = process.env.NEW_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 NEW_API_KEY，无法调用图片模型");
  }

  const requestBody = JSON.stringify({
    model: input.model,
    prompt: input.prompt,
    size: input.size,
    n: 1,
  });

  for (let attempt = 1; attempt <= IMAGE_REQUEST_RETRY_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${DEFAULT_BASE_URL}/v1/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: requestBody,
        signal: AbortSignal.timeout(300_000),
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

async function generateImageViaEdits(input: {
  model: string;
  prompt: string;
  imageUrl: string;
  size: string;
  maskDataUrl?: string;
}) {
  const apiKey = process.env.NEW_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 NEW_API_KEY，无法调用图片模型");
  }

  for (let attempt = 1; attempt <= IMAGE_REQUEST_RETRY_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      // 使用 multipart/form-data 格式，image 作为文件上传
      const imageBlob = await imageUrlToBlob(input.imageUrl);
      const formData = new FormData();
      formData.append("model", input.model);
      formData.append("prompt", input.prompt);
      formData.append("image", imageBlob, "image.png");
      formData.append("size", input.size);
      formData.append("n", "1");
      if (input.maskDataUrl) {
        const maskBlob = await imageUrlToBlob(input.maskDataUrl);
        formData.append("mask", maskBlob, "mask.png");
      }

      response = await fetch(`${DEFAULT_BASE_URL}/v1/images/edits`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
        signal: AbortSignal.timeout(300_000),
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
      throw new Error(`图片编辑接口返回异常: ${response.status} ${text}`);
    }

    const payload = (await response.json()) as unknown;
    const binaries = await extractImageBinaries(payload);
    if (binaries.length === 0) {
      throw new Error(`图片编辑成功但未解析到图片数据: ${JSON.stringify(payload).slice(0, 2000)}`);
    }

    return binaries;
  }

  throw new Error("图片编辑网络请求失败");
}

/** 将 data URL 或 HTTP URL 转为 Blob，用于 multipart/form-data 上传 */
async function imageUrlToBlob(dataOrUrl: string): Promise<Blob> {
  if (dataOrUrl.startsWith("data:")) {
    const match = dataOrUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) throw new Error("无法解析 data URL");
    const buffer = Buffer.from(match[2], "base64");
    return new Blob([buffer], { type: match[1] });
  }
  const resp = await fetch(dataOrUrl, { signal: AbortSignal.timeout(120_000) });
  if (!resp.ok) throw new Error(`下载图片失败: ${resp.status} ${dataOrUrl.slice(0, 200)}`);
  return await resp.blob();
}

export async function editImage(input: {
  prompt: string;
  imageUrl: string;
  model?: string;
  aspectRatio?: string;
  maskDataUrl?: string;
}) {
  const resolved = resolveImageModel(input.model);

  if (!resolved.supportsEdits) {
    throw new Error(`图像编辑不支持当前模型：${resolved.model}，请改用即梦或通义千问系列模型`);
  }

  return generateImageViaEdits({
    model: resolved.model,
    prompt: input.prompt,
    imageUrl: input.imageUrl,
    size: buildImagesGenerationSize({
      model: resolved.model,
      aspectRatio: input.aspectRatio,
      resolution: DEFAULT_IMAGE_RESOLUTION,
    }),
    maskDataUrl: input.maskDataUrl,
  });
}

async function extractImageBinaries(payload: unknown) {
  const results: ImageBinary[] = [];
  const visited = new Set<unknown>();

  async function walk(node: unknown) {
    if (!node || typeof node !== "object" || visited.has(node)) return;
    visited.add(node);

    if (Array.isArray(node)) {
      for (const item of node) await walk(item);
      return;
    }

    const record = node as Record<string, unknown>;
    const inlineData = record.inlineData as
      | { mimeType?: unknown; data?: unknown }
      | undefined;

    if (
      inlineData &&
      typeof inlineData.mimeType === "string" &&
      typeof inlineData.data === "string"
    ) {
      results.push({
        buffer: Buffer.from(inlineData.data, "base64"),
        mimeType: inlineData.mimeType,
        source: "base64",
      });
      return;
    }

    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "string") {
        const markdownDataUrl = extractMarkdownImageDataUrl(value);
        if (markdownDataUrl) {
          results.push(parseDataUrl(markdownDataUrl));
          continue;
        }

        if (value.startsWith("data:image/")) {
          results.push(parseDataUrl(value));
          continue;
        }

        if (key === "b64_json" || key === "image_base64" || key === "base64") {
          if (looksLikeBase64(value)) {
            results.push({ buffer: Buffer.from(value, "base64"), mimeType: "image/png", source: "base64" });
            continue;
          }
        }

        if ((key === "url" || key === "image_url") && /^https?:\/\//.test(value)) {
          results.push(await downloadImage(value));
          continue;
        }
      }

      await walk(value);
    }
  }

  await walk(payload);
  return results;
}

function parseDataUrl(value: string): ImageBinary {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("无法解析 data URL 图片响应");
  }

  return {
    buffer: Buffer.from(match[2], "base64"),
    mimeType: match[1],
    source: "base64",
  };
}

function looksLikeBase64(value: string) {
  return value.length > 128 && /^[A-Za-z0-9+/=\n\r]+$/.test(value);
}

function shouldRetryImageRequestError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const cause = (error as Error & { cause?: unknown }).cause;
  const causeCode =
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    typeof (cause as { code: unknown }).code === "string"
      ? (cause as { code: string }).code
      : "";
  const causeMessage =
    typeof cause === "object" &&
    cause !== null &&
    "message" in cause &&
    typeof (cause as { message: unknown }).message === "string"
      ? (cause as { message: string }).message
      : "";

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

function shouldRetryImageResponseStatus(status: number) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeImageRequestError(error: unknown) {
  if (!(error instanceof Error)) {
    return new Error("图片生成网络请求失败");
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  const causeCode =
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    typeof (cause as { code: unknown }).code === "string"
      ? (cause as { code: string }).code
      : "";
  const causeMessage =
    typeof cause === "object" &&
    cause !== null &&
    "message" in cause &&
    typeof (cause as { message: unknown }).message === "string"
      ? (cause as { message: string }).message
      : "";

  const normalized = [error.name, error.message, causeCode, causeMessage].join(" ").toLowerCase();

  if (
    error.name === "TimeoutError" ||
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    causeCode === "ETIMEDOUT" ||
    causeCode.startsWith("UND_ERR_CONNECT_TIMEOUT")
  ) {
    return new Error("图片生成请求超时");
  }

  if (
    normalized.includes("fetch failed") ||
    normalized.includes("econnreset") ||
    normalized.includes("econnrefused") ||
    normalized.includes("enotfound") ||
    normalized.includes("eai_again") ||
    normalized.includes("socket")
  ) {
    const detail = causeCode || causeMessage || error.message;
    return new Error(`图片生成网络请求失败: ${detail}`);
  }

  return new Error(`图片生成网络请求失败: ${error.message}`);
}

async function downloadImage(url: string): Promise<ImageBinary> {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    throw new Error(`下载图片失败: ${response.status} ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: response.headers.get("content-type") ?? "image/png",
    source: "url",
  };
}

function extractMarkdownImageDataUrl(value: string) {
  const match = value.match(/!\[[^\]]*\]\((data:image\/[a-zA-Z0-9.+-]+;base64,[^)]+)\)/);
  return match?.[1] ?? null;
}
