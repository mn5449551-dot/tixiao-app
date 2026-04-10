const DEFAULT_BASE_URL = process.env.NEW_API_BASE_URL ?? "https://ops-ai-gateway.yc345.tv";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionOptions = {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  responseFormat?: { type: "json_object" };
};

export async function createChatCompletion(options: ChatCompletionOptions) {
  const apiKey = process.env.NEW_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 NEW_API_KEY，无法调用文本模型");
  }

  const response = await fetch(`${DEFAULT_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? (process.env.NEW_API_TEXT_MODEL ?? "deepseek-v3-2-251201"),
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      response_format: options.responseFormat,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`文本模型调用失败: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return payload.choices?.[0]?.message?.content ?? "";
}

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type MultimodalChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
};

type MultimodalChatCompletionOptions = {
  model?: string;
  messages: MultimodalChatMessage[];
  temperature?: number;
  responseFormat?: { type: "json_object" };
};

export async function createMultimodalChatCompletion(options: MultimodalChatCompletionOptions) {
  const apiKey = process.env.NEW_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 NEW_API_KEY，无法调用文本模型");
  }

  const response = await fetch(`${DEFAULT_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? (process.env.NEW_API_TEXT_MODEL ?? "deepseek-v3-2-251201"),
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      response_format: options.responseFormat,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`文本模型调用失败: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return payload.choices?.[0]?.message?.content ?? "";
}

type ImageGenerationOptions = {
  model?: string;
  prompt: string;
  size?: string;
  n?: number;
};

export async function createImageGeneration(options: ImageGenerationOptions) {
  const apiKey = process.env.NEW_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 NEW_API_KEY，无法调用图片模型");
  }

  const response = await fetch(`${DEFAULT_BASE_URL}/v1/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? "gpt-image-1",
      prompt: options.prompt,
      size: options.size ?? "1024x1024",
      n: options.n ?? 1,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`图片模型调用失败: ${response.status} ${text}`);
  }

  return response.json();
}
