import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const imageChatPath = new URL("../ai/image-chat.ts", import.meta.url);

test("image chat uses the OpenAI-compatible chat completions image path", async () => {
  const source = await readFile(imageChatPath, "utf8");

  assert.match(source, /DEFAULT_IMAGE_RESOLUTION\s*=\s*"2K"/);
  assert.match(source, /fetch\(`\$\{DEFAULT_BASE_URL\}\/v1\/chat\/completions`/);
  assert.match(source, /generationConfig:/);
  assert.match(source, /imageSize:\s*input\.resolution/);
  assert.match(source, /aspectRatio:\s*input\.aspectRatio/);
  assert.match(source, /"image_url"/);
  assert.doesNotMatch(source, /v1beta\/models\/\$\{input\.model\}:generateContent/);
  assert.doesNotMatch(source, /buildNativeParts/);
});

test("image chat uses the same model for prompt and reference generation", async () => {
  const source = await readFile(imageChatPath, "utf8");

  assert.doesNotMatch(source, /DEFAULT_REFERENCE_MODEL/);
  assert.match(source, /generateImageFromPrompt[\s\S]{0,300}model:\s*DEFAULT_IMAGE_MODEL/);
  assert.match(source, /generateImageFromReference[\s\S]{0,600}model:\s*DEFAULT_IMAGE_MODEL/);
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
