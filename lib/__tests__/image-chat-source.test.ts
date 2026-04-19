import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const imageChatPath = new URL("../ai/image-chat.ts", import.meta.url);

test("image chat supports both chat-completions and images-generations transports", async () => {
  const source = await readFile(imageChatPath, "utf8");

  assert.match(source, /DEFAULT_IMAGE_RESOLUTION\s*=\s*"2K"/);
  assert.match(source, /fetch\(`\$\{DEFAULT_BASE_URL\}\/v1\/chat\/completions`/);
  assert.match(source, /fetch\(`\$\{DEFAULT_BASE_URL\}\/v1\/images\/generations`/);
  assert.match(source, /generationConfig:/);
  assert.match(source, /imageSize:\s*input\.resolution/);
  assert.match(source, /aspectRatio:\s*input\.aspectRatio/);
  assert.match(source, /"image_url"/);
  assert.doesNotMatch(source, /v1beta\/models\/\$\{input\.model\}:generateContent/);
  assert.doesNotMatch(source, /buildNativeParts/);
});

test("image chat resolves the default image-generation model and routes by model capability", async () => {
  const [source, constantsSource] = await Promise.all([
    readFile(imageChatPath, "utf8"),
    readFile(new URL("../constants.ts", import.meta.url), "utf8"),
  ]);

  assert.match(source, /DEFAULT_IMAGE_MODEL/);
  assert.doesNotMatch(source, /model_image_generation/);
  assert.doesNotMatch(source, /getModelSetting/);
  assert.match(constantsSource, /qwen-image-2\.0/);
  assert.match(constantsSource, /gpt-image-1\.5/);
  assert.match(constantsSource, /doubao-seedream-5-0-lite/);
  assert.match(source, /supportsReference/);
  assert.match(source, /supportsEdits/);
  assert.match(source, /\/v1\/images\/edits/);
});

test("finalized adaptation models exclude Gemini Flash and non-4-ratio models", async () => {
  const constantsPath = new URL("../constants.ts", import.meta.url);
  const source = await readFile(constantsPath, "utf8");

  assert.match(source, /FINALIZED_ADAPTATION_MODEL_VALUES/);
  assert.match(source, /doubao-seedream-4-0/);
  assert.match(source, /doubao-seedream-4-5/);
  assert.doesNotMatch(source, /FINALIZED_ADAPTATION_MODEL_VALUES[\s\S]*doubao-seedream-5-0-lite/);
  assert.doesNotMatch(source, /FINALIZED_ADAPTATION_MODEL_VALUES[\s\S]*qwen-image-2\.0/);
  assert.doesNotMatch(source, /FINALIZED_ADAPTATION_MODEL_VALUES[\s\S]*gemini-3\.1-flash-image-preview/);
  assert.doesNotMatch(source, /FINALIZED_ADAPTATION_MODEL_VALUES[\s\S]*gpt-image-1\.5/);
});

test("image chat uses edits transport for finalized adaptation reference-image models", async () => {
  const source = await readFile(imageChatPath, "utf8");

  assert.match(source, /supportsEdits/);
  assert.match(source, /generateImageViaEdits/);
  assert.match(source, /buildEditSize/);
  assert.match(source, /qwen-image-2\.0/);
});

test("image chat source maps transport failures to specific timeout and network errors", async () => {
  const source = await readFile(imageChatPath, "utf8");

  assert.match(source, /图片生成请求超时/);
  assert.match(source, /图片生成网络请求失败/);
  assert.match(source, /ECONNRESET/);
  assert.match(source, /for \(let attempt = 1; attempt <=/);
  assert.match(source, /shouldRetryImageRequestError/);
  assert.match(source, /Connection": "close"|Connection:\s*"close"/);
});

test("text client supports multimodal content parts for Gemini prompt generation", async () => {
  const source = await readFile(new URL("../ai/client.ts", import.meta.url), "utf8");

  assert.match(source, /type:\s*"image_url"/);
  assert.match(source, /createMultimodalChatCompletion/);
  // model 从 options 中读取（model ?? modelKey ?? default）
  assert.match(source, /options\.model/);
});
