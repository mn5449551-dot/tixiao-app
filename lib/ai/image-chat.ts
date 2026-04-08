const DEFAULT_BASE_URL = process.env.NEW_API_BASE_URL ?? "https://ops-ai-gateway.yc345.tv";
const DEFAULT_IMAGE_MODEL = process.env.NEW_API_IMAGE_MODEL ?? "gemini-3-pro-image-preview";
const DEFAULT_REFERENCE_MODEL = process.env.NEW_API_REFERENCE_MODEL ?? "nano-banana-pro-preview";

export type ImageBinary = {
  buffer: Buffer;
  mimeType: string;
  source: "base64" | "url";
};

type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export async function generateImageFromPrompt(prompt: string) {
  return generateImageViaChat({
    model: DEFAULT_IMAGE_MODEL,
    messages: [{ role: "user", content: prompt }],
  });
}

export async function generateImageFromReference(input: {
  instruction: string;
  imageUrl?: string;
  imageUrls?: string[];
}) {
  const urls = input.imageUrls?.filter(Boolean) ?? (input.imageUrl ? [input.imageUrl] : []);
  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: input.instruction },
        ...urls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
      ] as MessageContentPart[],
    },
  ];

  try {
    return await generateImageViaChat({
      model: DEFAULT_REFERENCE_MODEL,
      messages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("model_not_found")) {
      throw error;
    }

    return generateImageViaChat({
      model: DEFAULT_IMAGE_MODEL,
      messages,
    });
  }
}

async function generateImageViaChat(input: {
  model: string;
  messages: Array<{ role: string; content: string | MessageContentPart[] }>;
}) {
  const apiKey = process.env.NEW_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 NEW_API_KEY，无法调用图片模型");
  }

  const response = await fetch(`${DEFAULT_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      stream: false,
    }),
    signal: AbortSignal.timeout(300_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`图片生成失败: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as unknown;
  const binaries = await extractImageBinaries(payload);
  if (binaries.length === 0) {
    throw new Error(`图片生成成功但未解析到图片数据: ${JSON.stringify(payload).slice(0, 2000)}`);
  }

  return binaries;
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
