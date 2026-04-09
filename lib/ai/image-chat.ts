const DEFAULT_BASE_URL = process.env.NEW_API_BASE_URL ?? "https://ops-ai-gateway.yc345.tv";
const DEFAULT_IMAGE_MODEL = process.env.NEW_API_IMAGE_MODEL ?? "gemini-3-pro-image-preview";
export const DEFAULT_IMAGE_RESOLUTION = "2K" as const;
const IMAGE_REQUEST_RETRY_ATTEMPTS = 3;
const IMAGE_REQUEST_RETRY_DELAY_MS = 400;

export type ImageBinary = {
  buffer: Buffer;
  mimeType: string;
  source: "base64" | "url";
};

export type ImageResolution = "1K" | "2K" | "4K";
type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

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
  },
) {
  return generateImageViaChatCompletions({
    model: DEFAULT_IMAGE_MODEL,
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
