import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cardPath = new URL("../../components/cards/image-config-card.tsx", import.meta.url);
const actionsPath = new URL("../../components/cards/image-config/image-config-actions.ts", import.meta.url);

test("image config card surfaces request failures to the user", async () => {
  const source = await readFile(cardPath, "utf8");

  assert.match(source, /setSubmitError/);
  assert.match(source, /submitError/);
  assert.match(source, /图片生成失败/);
  assert.match(source, /\(isLoading \|\| isSubmitting\)/);
  assert.match(source, /正在生成候选图/);
  assert.match(source, /result\.configSaved/);
  assert.match(source, /dispatchWorkspaceInvalidated\(\)/);
});

test("image config card delegates form and action logic", async () => {
  const [source, actionsSource] = await Promise.all([
    readFile(cardPath, "utf8"),
    readFile(actionsPath, "utf8"),
  ]);

  assert.match(source, /ImageConfigForm/);
  assert.match(source, /ImageConfigBrandSection/);
  assert.match(source, /image-config-actions/);
  assert.match(source, /className="w-full py-3 text-sm font-semibold"/);
  assert.match(actionsSource, /@\/lib\/api-fetch/);
  assert.match(actionsSource, /created_group_ids/);
});

test("image config card supports CTA only for information-flow single-image cases", async () => {
  const [cardSource, formSource, actionsSource] = await Promise.all([
    readFile(cardPath, "utf8"),
    readFile(new URL("../../components/cards/image-config/image-config-form.tsx", import.meta.url), "utf8"),
    readFile(actionsPath, "utf8"),
  ]);

  assert.match(cardSource, /initialCtaEnabled/);
  assert.match(cardSource, /supportsCta/);
  assert.match(formSource, /CTA/);
  assert.match(formSource, /立即下载/);
  assert.match(actionsSource, /cta_enabled/);
  assert.match(actionsSource, /cta_text/);
});

test("image config actions save and start generation in one request", async () => {
  const actionsSource = await readFile(actionsPath, "utf8");

  assert.match(actionsSource, /generate:\s*true/);
  assert.doesNotMatch(actionsSource, /\/api\/image-configs\/\$\{payload\.id\}\/generate/);
});
