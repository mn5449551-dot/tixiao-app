/**
 * 生图模型能力测试脚本
 * 测试所有模型的：调用方式、图片比例、分辨率、图生图、图像编辑能力
 *
 * 用法: cd tixiao2 && node --import tsx scripts/test-model-capabilities.ts
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";

const BASE_URL = process.env.NEW_API_BASE_URL ?? "https://ops-ai-gateway.yc345.tv";
const API_KEY = process.env.NEW_API_KEY;

const OUTPUT_DIR = join(process.cwd(), "image-model-test-capabilities");

const TEST_PROMPT = "一只可爱的橘猫坐在书桌前，戴着小眼镜看书，旁边有一杯热茶，温暖的光线，高质量插画风格";
const EDIT_PROMPT = "把猫的帽子换成红色圣诞帽";
const IMG2IMG_PROMPT = "把背景换成星空夜景，保持猫咪姿势不变";

// 所有待测模型
const MODELS = [
  "qwen-image-2.0",
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
  "gpt-image-1.5",
  "doubao-seedream-4-0",
  "doubao-seedream-4-5",
  "doubao-seedream-5-0-lite",
] as const;

type ModelName = (typeof MODELS)[number];

// 调用方式枚举
type TransportMethod = "openai_generations" | "chat_completions" | "qwen_format" | "openai_edits";

const TRANSPORT_LABELS: Record<TransportMethod, string> = {
  openai_generations: "OpenAI原生格式 (/v1/images/generations)",
  chat_completions: "Chat Completions (/v1/chat/completions)",
  qwen_format: "通义千问格式 (/v1/images/generations + input)",
  openai_edits: "OpenAI编辑格式 (/v1/images/edits)",
};

// 比例到 size 的映射（images_generations 方式）
function getSizeForRatio(model: string, ratio: string): string {
  if (model.includes("doubao")) {
    switch (ratio) {
      case "3:2": return "2352x1568";
      case "16:9": return "2560x1440";
      case "9:16": return "1440x2560";
      default: return "1920x1920";
    }
  }
  switch (ratio) {
    case "3:2": return "1536x1024";
    case "16:9": return "1792x1024";
    case "9:16": return "1024x1792";
    default: return "1024x1024";
  }
}

const ASPECT_RATIOS = ["1:1", "3:2", "16:9", "9:16"] as const;
const RESOLUTIONS = ["1K", "2K", "4K"] as const;

// 测试用的 base64 小图片（1x1 红色像素 PNG）
const TINY_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

// ============ API 调用函数 ============

async function callOpenAIGenerations(model: string, prompt: string, size: string): Promise<ApiResult> {
  return callApi("/v1/images/generations", {
    model,
    prompt,
    size,
    n: 1,
  });
}

async function callChatCompletions(
  model: string,
  prompt: string,
  options?: { aspectRatio?: string; resolution?: string; imageUrl?: string },
): Promise<ApiResult> {
  const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

  if (options?.imageUrl) {
    contentParts.push({ type: "image_url", image_url: { url: options.imageUrl } });
  }
  contentParts.push({ type: "text", text: prompt });

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: options?.imageUrl ? contentParts : prompt }],
    stream: false,
  };

  if (options?.aspectRatio || options?.resolution) {
    body.generationConfig = {
      imageConfig: {
        ...(options.resolution ? { imageSize: options.resolution } : {}),
        ...(options.aspectRatio ? { aspectRatio: options.aspectRatio } : {}),
      },
    };
  }

  return callApi("/v1/chat/completions", body);
}

async function callQwenFormat(model: string, prompt: string, size?: string): Promise<ApiResult> {
  const body: Record<string, unknown> = {
    model,
    input: {
      messages: [{ role: "user", content: prompt }],
    },
  };
  if (size) {
    body.parameters = { size };
  }
  return callApi("/v1/images/generations", body);
}

async function callOpenAIEdits(model: string, prompt: string): Promise<ApiResult> {
  // multipart/form-data
  const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
  const parts: Buffer[] = [];

  // model field
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`));
  // prompt field
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n${prompt}\r\n`));
  // image field (tiny PNG)
  const imgBuffer = Buffer.from(TINY_PNG_B64, "base64");
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`));
  parts.push(imgBuffer);
  parts.push(Buffer.from("\r\n"));
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  const startTime = Date.now();
  try {
    const response = await fetch(`${BASE_URL}/v1/images/edits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
      signal: AbortSignal.timeout(120_000),
    });
    const duration = Date.now() - startTime;
    const text = await response.text();

    if (!response.ok) {
      return { success: false, error: `${response.status} ${text.slice(0, 500)}`, duration };
    }

    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }
    return { success: true, data, duration };
  } catch (err) {
    return { success: false, error: String(err), duration: Date.now() - startTime };
  }
}

async function callApi(path: string, body: Record<string, unknown>): Promise<ApiResult> {
  const startTime = Date.now();
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    const duration = Date.now() - startTime;
    const text = await response.text();

    if (!response.ok) {
      return { success: false, error: `${response.status} ${text.slice(0, 500)}`, duration };
    }

    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }
    return { success: true, data, duration };
  } catch (err) {
    return { success: false, error: String(err), duration: Date.now() - startTime };
  }
}

// ============ 结果提取 ============

type ApiResult = {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
};

type TestResult = {
  test: string;
  success: boolean;
  duration: number;
  error?: string;
  actualSize?: string;
  imageSaved?: string;
  responseData?: unknown;
};

function extractImageUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  // OpenAI format: data[0].url or data[0].b64_json
  if (Array.isArray(obj.data) && obj.data.length > 0) {
    const item = obj.data[0] as Record<string, unknown>;
    if (typeof item.url === "string" && item.url.startsWith("http")) return item.url;
    if (typeof item.b64_json === "string") return `b64:${item.b64_json.slice(0, 20)}...`;
  }

  // Chat completions: choices[0].message.content might contain image
  if (Array.isArray(obj.choices) && obj.choices.length > 0) {
    const choice = obj.choices[0] as Record<string, unknown>;
    const msg = choice.message as Record<string, unknown> | undefined;
    if (msg && typeof msg.content === "string") {
      // Check for base64 or markdown image
      const mdMatch = msg.content.match(/!\[.*?\]\((data:image\/[^)]+)\)/);
      if (mdMatch) return `dataurl:${mdMatch[1].slice(0, 50)}...`;
      if (msg.content.includes("data:image")) return "inline_data_image";
    }
    // Check parts for inline data
    if (msg && Array.isArray(msg.parts)) {
      for (const part of msg.parts as Array<Record<string, unknown>>) {
        if (part.inlineData) return "inline_data_image";
      }
    }
  }

  // Gemini format: candidates[0].content.parts[].inlineData
  if (Array.isArray(obj.candidates) && obj.candidates.length > 0) {
    const cand = obj.candidates[0] as Record<string, unknown>;
    const content = cand.content as Record<string, unknown> | undefined;
    if (content && Array.isArray(content.parts)) {
      for (const part of content.parts as Array<Record<string, unknown>>) {
        if (part.inlineData) return "inline_data_image";
      }
    }
  }

  return null;
}

async function saveImage(data: unknown, model: string, testId: string): Promise<{ path: string; actualSize?: string } | null> {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  let imageBuffer: Buffer | null = null;
  let ext = "png";

  // OpenAI format
  if (Array.isArray(obj.data) && obj.data.length > 0) {
    const item = obj.data[0] as Record<string, unknown>;
    if (typeof item.b64_json === "string" && item.b64_json.length > 100) {
      imageBuffer = Buffer.from(item.b64_json, "base64");
    } else if (typeof item.url === "string" && item.url.startsWith("http")) {
      try {
        const resp = await fetch(item.url, { signal: AbortSignal.timeout(60_000) });
        if (resp.ok) {
          const ab = await resp.arrayBuffer();
          imageBuffer = Buffer.from(ab);
          const ct = resp.headers.get("content-type") ?? "";
          if (ct.includes("webp")) ext = "webp";
          if (ct.includes("jpeg") || ct.includes("jpg")) ext = "jpg";
        }
      } catch { /* ignore */ }
    }
  }

  // Chat completions / Gemini format - extract from content
  if (!imageBuffer) {
    const content = extractContentFromPayload(obj);
    if (content) {
      imageBuffer = content.buffer;
      if (content.mimeType.includes("webp")) ext = "webp";
      if (content.mimeType.includes("jpeg")) ext = "jpg";
    }
  }

  if (!imageBuffer) return null;

  const filename = `${model}_${testId}.${ext}`;
  const filepath = join(OUTPUT_DIR, filename);
  writeFileSync(filepath, imageBuffer);

  // Get actual dimensions using sharp or basic PNG parsing
  let actualSize: string | undefined;
  try {
    const size = getImageDimensions(imageBuffer, ext);
    if (size) actualSize = `${size.width}x${size.height}`;
  } catch { /* ignore */ }

  return { path: filepath, actualSize };
}

function extractContentFromPayload(obj: Record<string, unknown>): { buffer: Buffer; mimeType: string } | null {
  // Walk the payload to find image data
  function walk(node: unknown): { buffer: Buffer; mimeType: string } | null {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const r = walk(item);
        if (r) return r;
      }
      return null;
    }
    const rec = node as Record<string, unknown>;

    // inlineData (Gemini format)
    const inlineData = rec.inlineData as { mimeType?: string; data?: string } | undefined;
    if (inlineData && typeof inlineData.data === "string" && inlineData.data.length > 100) {
      return { buffer: Buffer.from(inlineData.data, "base64"), mimeType: inlineData.mimeType ?? "image/png" };
    }

    // b64_json
    if (typeof rec.b64_json === "string" && rec.b64_json.length > 100) {
      return { buffer: Buffer.from(rec.b64_json, "base64"), mimeType: "image/png" };
    }

    // data URL in text content
    for (const value of Object.values(rec)) {
      if (typeof value === "string") {
        const match = value.match(/data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]{100,})/);
        if (match) return { buffer: Buffer.from(match[2], "base64"), mimeType: match[1] };
      }
    }

    for (const value of Object.values(rec)) {
      const r = walk(value);
      if (r) return r;
    }
    return null;
  }

  return walk(obj);
}

function getImageDimensions(buffer: Buffer, ext: string): { width: number; height: number } | null {
  if (ext === "png") {
    // PNG: width/height at offset 16, 4 bytes each, big-endian
    if (buffer.length > 24 && buffer.slice(0, 8).toString("hex") === "89504e470d0a1a0a") {
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
      };
    }
  }
  if (ext === "jpg" || ext === "jpeg") {
    // JPEG: scan for SOF0 marker (0xFFC0)
    let i = 2;
    while (i < buffer.length - 9) {
      if (buffer[i] === 0xff && buffer[i + 1] === 0xc0) {
        return {
          height: buffer.readUInt16BE(i + 5),
          width: buffer.readUInt16BE(i + 7),
        };
      }
      i += 2 + buffer.readUInt16BE(i + 2);
    }
  }
  return null;
}

// ============ 测试执行 ============

type ModelTestResults = {
  model: string;
  probe: Record<TransportMethod, ApiResult>;
  workingTransports: TransportMethod[];
  ratioTests: TestResult[];
  resolutionTests: TestResult[];
  img2imgTests: TestResult[];
  editTests: TestResult[];
};

async function probeModel(model: string): Promise<ModelTestResults["probe"]> {
  const probe: Record<TransportMethod, ApiResult> = {
    openai_generations: { success: false, duration: 0 },
    chat_completions: { success: false, duration: 0 },
    qwen_format: { success: false, duration: 0 },
    openai_edits: { success: false, duration: 0 },
  };

  // A. OpenAI 原生格式
  console.log(`  探测 OpenAI原生格式...`);
  probe.openai_generations = await callOpenAIGenerations(model, TEST_PROMPT, "1024x1024");
  console.log(`    ${probe.openai_generations.success ? "✓" : "✗"} (${probe.openai_generations.duration}ms)`);

  // B. Chat Completions
  console.log(`  探测 Chat Completions格式...`);
  probe.chat_completions = await callChatCompletions(model, TEST_PROMPT);
  console.log(`    ${probe.chat_completions.success ? "✓" : "✗"} (${probe.chat_completions.duration}ms)`);

  // C. 通义千问格式
  console.log(`  探测 通义千问格式...`);
  probe.qwen_format = await callQwenFormat(model, TEST_PROMPT, "1024x1024");
  console.log(`    ${probe.qwen_format.success ? "✓" : "✗"} (${probe.qwen_format.duration}ms)`);

  // D. OpenAI 编辑格式
  console.log(`  探测 OpenAI编辑格式...`);
  probe.openai_edits = await callOpenAIEdits(model, EDIT_PROMPT);
  console.log(`    ${probe.openai_edits.success ? "✓" : "✗"} (${probe.openai_edits.duration}ms)`);

  return probe;
}

async function testRatios(
  model: string,
  probe: ModelTestResults["probe"],
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const transport = getWorkingTransport(probe);

  for (const ratio of ASPECT_RATIOS) {
    const size = getSizeForRatio(model, ratio);
    console.log(`  测试比例 ${ratio} (${size})...`);

    let result: ApiResult;
    if (transport === "chat_completions") {
      result = await callChatCompletions(model, TEST_PROMPT, { aspectRatio: ratio });
    } else if (transport === "qwen_format") {
      result = await callQwenFormat(model, TEST_PROMPT, size);
    } else {
      result = await callOpenAIGenerations(model, TEST_PROMPT, size);
    }

    const testResult: TestResult = {
      test: `ratio_${ratio}`,
      success: result.success,
      duration: result.duration,
      error: result.success ? undefined : result.error?.slice(0, 300),
      responseData: result.success ? summarizeResponse(result.data) : undefined,
    };

    // Save image and get actual dimensions
    if (result.success && result.data) {
      const saved = await saveImage(result.data, model, `ratio_${ratio.replace(":", "x")}`);
      if (saved) {
        testResult.imageSaved = saved.path;
        testResult.actualSize = saved.actualSize;
      }
    }

    console.log(`    ${testResult.success ? "✓" : "✗"} ${testResult.actualSize ?? ""} (${testResult.duration}ms)`);
    results.push(testResult);
  }

  return results;
}

async function testResolutions(
  model: string,
  probe: ModelTestResults["probe"],
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const transport = getWorkingTransport(probe);
  if (transport !== "chat_completions") {
    console.log(`  跳过分辨率测试（仅 Chat Completions 格式支持）`);
    return results;
  }

  for (const res of RESOLUTIONS) {
    console.log(`  测试分辨率 ${res}...`);
    const result = await callChatCompletions(model, TEST_PROMPT, { resolution: res });

    const testResult: TestResult = {
      test: `resolution_${res}`,
      success: result.success,
      duration: result.duration,
      error: result.success ? undefined : result.error?.slice(0, 300),
      responseData: result.success ? summarizeResponse(result.data) : undefined,
    };

    if (result.success && result.data) {
      const saved = await saveImage(result.data, model, `res_${res}`);
      if (saved) {
        testResult.imageSaved = saved.path;
        testResult.actualSize = saved.actualSize;
      }
    }

    console.log(`    ${testResult.success ? "✓" : "✗"} ${testResult.actualSize ?? ""} (${testResult.duration}ms)`);
    results.push(testResult);
  }

  return results;
}

async function testImg2Img(
  model: string,
  probe: ModelTestResults["probe"],
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const transport = getWorkingTransport(probe);

  // 图生图需要通过 chat_completions 传 image_url
  if (transport === "chat_completions") {
    console.log(`  测试图生图（Chat Completions + image_url）...`);
    // 用一张在线图片作为参考
    const testImageUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg";
    const result = await callChatCompletions(model, IMG2IMG_PROMPT, { imageUrl: testImageUrl });

    const testResult: TestResult = {
      test: "img2img_chat",
      success: result.success,
      duration: result.duration,
      error: result.success ? undefined : result.error?.slice(0, 300),
      responseData: result.success ? summarizeResponse(result.data) : undefined,
    };

    if (result.success && result.data) {
      const saved = await saveImage(result.data, model, "img2img");
      if (saved) {
        testResult.imageSaved = saved.path;
        testResult.actualSize = saved.actualSize;
      }
    }

    console.log(`    ${testResult.success ? "✓" : "✗"} (${testResult.duration}ms)`);
    results.push(testResult);
  } else {
    console.log(`  跳过图生图测试（非 Chat Completions 格式，代码中标记为不支持）`);

    // 但还是尝试一下，有些模型可能通过 images/generations 也能图生图
    console.log(`  尝试 images_generations 方式图生图...`);
    const result = await callOpenAIGenerations(model, IMG2IMG_PROMPT, "1024x1024");
    results.push({
      test: "img2img_generations_attempt",
      success: result.success,
      duration: result.duration,
      error: "此模型使用 images_generations 方式，理论上不支持图生图（仅供参考）",
    });
    console.log(`    ${result.success ? "✓ 意外支持" : "✗ 不支持"} (${result.duration}ms)`);
  }

  return results;
}

async function testEdits(
  model: string,
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // OpenAI 编辑格式
  console.log(`  测试 OpenAI 编辑格式...`);
  let result = await callOpenAIEdits(model, EDIT_PROMPT);
  results.push({
    test: "edit_openai",
    success: result.success,
    duration: result.duration,
    error: result.success ? undefined : result.error?.slice(0, 300),
  });
  console.log(`    ${result.success ? "✓" : "✗"} (${result.duration}ms)`);

  // 通义千问编辑格式
  console.log(`  测试 通义千问编辑格式...`);
  const qwenEditBody = {
    model,
    input: {
      messages: [{ role: "user", content: EDIT_PROMPT }],
    },
  };
  result = await callApi("/v1/images/edits", qwenEditBody);
  results.push({
    test: "edit_qwen",
    success: result.success,
    duration: result.duration,
    error: result.success ? undefined : result.error?.slice(0, 300),
  });
  console.log(`    ${result.success ? "✓" : "✗"} (${result.duration}ms)`);

  return results;
}

// ============ 辅助函数 ============

function getWorkingTransport(probe: ModelTestResults["probe"]): TransportMethod | null {
  if (probe.chat_completions.success) return "chat_completions";
  if (probe.qwen_format.success) return "qwen_format";
  if (probe.openai_generations.success) return "openai_generations";
  return null;
}

function summarizeResponse(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const obj = data as Record<string, unknown>;
  const summary: Record<string, unknown> = {};

  if (obj.created) summary.created = obj.created;
  if (obj.model) summary.model = obj.model;
  if (obj.id) summary.id = obj.id;

  if (Array.isArray(obj.data)) {
    summary.dataCount = obj.data.length;
    if (obj.data.length > 0) {
      const item = obj.data[0] as Record<string, unknown>;
      summary.dataFields = Object.keys(item);
      if (typeof item.b64_json === "string") summary.hasB64 = item.b64_json.length;
      if (typeof item.url === "string") summary.imageUrl = item.url.slice(0, 100);
      if (item.revised_prompt) summary.revised_prompt = (item.revised_prompt as string).slice(0, 100);
    }
  }

  if (obj.usage) summary.usage = obj.usage;
  if (obj.usageMetadata) summary.usageMetadata = obj.usageMetadata;

  // Chat completions
  if (Array.isArray(obj.choices)) {
    summary.choicesCount = obj.choices.length;
  }
  if (Array.isArray(obj.candidates)) {
    summary.candidatesCount = obj.candidates.length;
  }

  return Object.keys(summary).length > 0 ? summary : String(data).slice(0, 500);
}

// ============ 主函数 ============

async function main() {
  if (!API_KEY) {
    console.error("❌ 缺少 NEW_API_KEY 环境变量");
    process.exit(1);
  }

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("=== 生图模型能力测试 ===\n");
  console.log(`API: ${BASE_URL}`);
  console.log(`模型数量: ${MODELS.length}`);
  console.log(`输出目录: ${OUTPUT_DIR}\n`);

  const allResults: ModelTestResults[] = [];

  for (const model of MODELS) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`测试模型: ${model}`);
    console.log("=".repeat(60));

    const modelResults: ModelTestResults = {
      model,
      probe: {
        openai_generations: { success: false, duration: 0 },
        chat_completions: { success: false, duration: 0 },
        qwen_format: { success: false, duration: 0 },
        openai_edits: { success: false, duration: 0 },
      },
      workingTransports: [],
      ratioTests: [],
      resolutionTests: [],
      img2imgTests: [],
      editTests: [],
    };

    // 1. 探测可用调用方式
    console.log("\n--- 1. 探测可用调用方式 ---");
    modelResults.probe = await probeModel(model);
    modelResults.workingTransports = (Object.entries(modelResults.probe) as [TransportMethod, ApiResult][])
      .filter(([, r]) => r.success)
      .map(([m]) => m);

    const transport = getWorkingTransport(modelResults.probe);
    if (!transport) {
      console.log(`\n⚠️ 模型 ${model} 所有调用方式均失败，跳过后续测试`);
      allResults.push(modelResults);
      continue;
    }

    console.log(`\n可用方式: ${modelResults.workingTransports.map(t => TRANSPORT_LABELS[t]).join(", ")}`);

    // 保存探测响应
    for (const [method, result] of Object.entries(modelResults.probe) as [TransportMethod, ApiResult][]) {
      if (result.success && result.data) {
        writeFileSync(
          join(OUTPUT_DIR, `${model}_probe_${method}.json`),
          JSON.stringify(result.data, null, 2).slice(0, 50000),
        );
        // 也保存探测生成的图片
        await saveImage(result.data, model, `probe_${method}`);
      }
    }

    // 2. 图片比例测试
    console.log("\n--- 2. 图片比例测试 ---");
    modelResults.ratioTests = await testRatios(model, modelResults.probe);

    // 3. 分辨率测试
    console.log("\n--- 3. 分辨率测试 ---");
    modelResults.resolutionTests = await testResolutions(model, modelResults.probe);

    // 4. 图生图测试
    console.log("\n--- 4. 图生图测试 ---");
    modelResults.img2imgTests = await testImg2Img(model, modelResults.probe);

    // 5. 图像编辑测试
    console.log("\n--- 5. 图像编辑测试 ---");
    modelResults.editTests = await testEdits(model);

    allResults.push(modelResults);
  }

  // 保存汇总
  const summaryPath = join(OUTPUT_DIR, "summary.json");
  writeFileSync(summaryPath, JSON.stringify(allResults, null, 2));
  console.log(`\n汇总数据已保存: ${summaryPath}`);

  // 打印汇总表
  console.log("\n" + "=".repeat(80));
  console.log("测试汇总");
  console.log("=".repeat(80));

  for (const r of allResults) {
    console.log(`\n${r.model}:`);
    console.log(`  可用方式: ${r.workingTransports.length > 0 ? r.workingTransports.join(", ") : "无"}`);

    const ratioOk = r.ratioTests.filter(t => t.success).map(t => `${t.test.replace("ratio_", "")}(${t.actualSize ?? "?"})`).join(", ");
    console.log(`  支持比例: ${ratioOk || "无"}`);

    const resOk = r.resolutionTests.filter(t => t.success).map(t => `${t.test.replace("resolution_", "")}(${t.actualSize ?? "?"})`).join(", ");
    console.log(`  支持分辨率: ${resOk || "无"}`);

    console.log(`  图生图: ${r.img2imgTests.some(t => t.success) ? "支持" : "不支持"}`);
    console.log(`  图像编辑: ${r.editTests.some(t => t.success) ? "支持" : "不支持"}`);
  }
}

// 直接运行入口
const entryArg = process.argv[1];
const isTestRunner = process.argv.includes("--test") || process.env.NODE_ENV === "test";
const isDirectRun = !isTestRunner && entryArg ? import.meta.url === pathToFileURL(entryArg).href : false;

if (isDirectRun) {
  main().catch(console.error);
}
