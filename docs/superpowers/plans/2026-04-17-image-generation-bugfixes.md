# Image Generation Pipeline Bugfixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 bugs in the image config → candidate image generation pipeline that cause incorrect series image routing, cascading failures, stale reference images, and data inconsistency.

**Architecture:** All fixes are in the backend generation pipeline. Each bug is isolated to specific functions in `lib/image-generation-service.ts`, `lib/ai/agents/image-description-agent.ts`, `lib/project-data-modules-internal.ts`, and `components/cards/image-config-card.tsx`. Tests follow the existing pattern using Node's built-in test runner with `node:test` and `node:assert/strict`.

**Tech Stack:** TypeScript, Node.js test runner, Drizzle ORM, better-sqlite3

---

## Files to Create or Modify

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/ai/agents/image-description-agent.ts` | Modify | Fix `buildRoutingMeta` to route series to series agent |
| `lib/image-generation-service.ts` | Modify | Fix per-group slot1 failure tracking, per-group delta prompts, remove logo passthrough |
| `lib/project-data-modules-internal.ts` | Modify | Fix `variantIndex` in append mode |
| `components/cards/image-config-card.tsx` | Modify | Remove hardcoded `referenceImageUrl: null` |
| `lib/__tests__/image-description-agent.test.ts` | Modify | Update tests for series routing fix |
| `lib/__tests__/image-generation-service.test.ts` | Create | New test file for generation service fixes |

---

### Task 1: Fix `buildRoutingMeta` to route series images to series system prompt

**Files:**
- Modify: `lib/ai/agents/image-description-agent.ts:177-195`
- Modify: `lib/__tests__/image-description-agent.test.ts:47-75`

- [ ] **Step 1: Update the failing test**

In `lib/__tests__/image-description-agent.test.ts`, update the test at line 47 "buildImageDescriptionMessages routes single and multi-image to poster agent for slot 1 generation". The current test asserts series uses poster agent (line 68). Change it to assert series uses the series agent:

```typescript
test("buildImageDescriptionMessages routes single to poster and series to series agent", () => {
  const singleMessages = buildImageDescriptionMessages({
    ...baseInput,
    direction: { ...baseInput.direction, channel: "信息流（广点通）" },
    config: { ...baseInput.config, imageForm: "single", ctaEnabled: true, ctaText: "立即下载" },
    copySet: { ...baseInput.copySet, titleSub: "副标题", titleExtra: null },
  });
  const seriesMessages = buildImageDescriptionMessages({
    ...baseInput,
    config: { ...baseInput.config, imageForm: "double" },
    copySet: { ...baseInput.copySet, titleExtra: null },
  });

  const singleSystem = typeof singleMessages[0]?.content === "string" ? singleMessages[0].content : "";
  const seriesSystem = typeof seriesMessages[1]?.content === "string" ? seriesMessages[1].content : "";

  // Single uses poster agent
  assert.match(singleSystem, /单图广告海报提示词生成 Agent/);
  assert.match(singleSystem, /single 必须同时处理/);
  assert.match(singleSystem, /titleMain/);
  assert.match(singleSystem, /titleSub/);
  // Series uses series agent
  assert.match(seriesSystem, /系列组图广告提示词生成 Agent/);
  assert.match(seriesSystem, /double|triple/);
  assert.match(seriesSystem, /系列优先于单张/);
});
```

Also update the test at line 126 "generateImageDescription returns only slot 1 prompt". The series system prompt now generates multiple prompts. Update the mock response to return multiple prompts and the assertion to expect them:

```typescript
test("generateImageDescription returns prompts for all slots in series mode", async () => {
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.NEW_API_KEY;
  process.env.NEW_API_KEY = "test-key";
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                prompts: [
                  { slotIndex: 1, prompt: "第一张 prompt", negativePrompt: "第一张 negative" },
                  { slotIndex: 2, prompt: "第二张 prompt", negativePrompt: "第二张 negative" },
                ],
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;

  try {
    const result = await generateImageDescription({
      ...baseInput,
      config: { ...baseInput.config, imageForm: "double" },
      copySet: { ...baseInput.copySet, titleExtra: null },
    });

    assert.equal(result.prompts.length, 2);
    assert.equal(result.prompts[0]?.slotIndex, 1);
    assert.equal(result.prompts[0]?.prompt, "第一张 prompt");
    assert.equal(result.prompts[1]?.slotIndex, 2);
    assert.equal(result.prompts[1]?.prompt, "第二张 prompt");
  } finally {
    globalThis.fetch = previousFetch;
    process.env.NEW_API_KEY = previousApiKey;
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tixiao2 && npm run test lib/__tests__/image-description-agent.test.ts`
Expected: FAIL — series still routes to poster agent, and `generateImageDescription` still slices to 1 prompt.

- [ ] **Step 3: Fix `buildRoutingMeta` in image-description-agent.ts**

In `lib/ai/agents/image-description-agent.ts`, modify `buildRoutingMeta` (line 177-195) to set `agentType` based on `imageForm`:

```typescript
function buildRoutingMeta(input: ImageDescriptionInput): ImageDescriptionRouteMeta {
  validateImageDescriptionInput(input);

  const allowCTA =
    input.direction.channel === "信息流（广点通）" &&
    input.config.imageForm === "single" &&
    input.config.ctaEnabled &&
    Boolean(input.config.ctaText);

  const isSeries = input.config.imageForm === "double" || input.config.imageForm === "triple";

  if (isSeries) {
    const slotCount = getPromptCount(input.config.imageForm);
    return {
      agentType: "series",
      allowCTA: false,
      referenceMode: input.config.styleMode === "ip" ? "ip_identity" : "style_reference",
      primaryReferenceLabel: input.referenceImages.length > 0 ? "参考图1" : null,
      seriesGoal: getSeriesGoal(input.config.imageForm),
      slotRoles: getSlotRoles(input.config.imageForm, input.copySet.copyType, slotCount),
      consistencySummary: getConsistencySummary(input.config.imageForm),
    };
  }

  return {
    agentType: "poster",
    allowCTA,
    referenceMode: input.config.styleMode === "ip" ? "ip_identity" : "style_reference",
    primaryReferenceLabel: input.referenceImages.length > 0 ? "参考图1" : null,
    seriesGoal: null,
    slotRoles: ["完整海报图"],
    consistencySummary: null,
  };
}
```

Also fix `generateImageDescription` (line 1178-1184) — it currently slices to 1 prompt (`parsed.prompts.slice(0, 1)`). Change it to return all prompts from the agent:

```typescript
const fallback = buildFallbackOutput(input);
const expectedCount = getPromptCount(input.config.imageForm);
const returned = parsed.prompts.slice(0, expectedCount);
if (returned.length === 0) {
  return fallback;
}
return {
  prompts: returned.map((item, index) => ({
    slotIndex: item.slotIndex ?? (index + 1),
    prompt: item.prompt?.trim() || fallback.prompts[Math.min(index, fallback.prompts.length - 1)]!.prompt,
    negativePrompt: item.negativePrompt?.trim() || getDefaultNegativePrompt(input),
  })),
};
```

Also update `buildFallbackOutput` (line 1217-1232) to generate prompts for all slots, not just slot 1:

```typescript
function buildFallbackOutput(input: ImageDescriptionInput): ImageDescriptionOutput {
  const referenceDesc = getReferenceDescription(input.referenceImages);
  const ctaDesc = getFallbackCtaDescription(input);
  const stylePrefix = input.config.styleMode === "ip" ? "高质量动漫风格广告海报，" : "高质量商业广告海报，";
  const count = getPromptCount(input.config.imageForm);
  const texts = [input.copySet.titleMain, input.copySet.titleSub ?? "", input.copySet.titleExtra ?? ""];
  const roles = getSlotRoles(input.config.imageForm, input.copySet.copyType, count);

  const prompts: ImageDescriptionPrompt[] = [];
  for (let i = 0; i < count; i += 1) {
    const text = texts[i] ?? texts[0] ?? "";
    const role = getFallbackRoleText(count, i);
    const prompt = `${stylePrefix}${input.direction.targetAudience}，场景是${input.direction.scenarioProblem}，突出${input.direction.differentiation}带来的${input.direction.effect}，${role}，标题内容是"${text}"，画幅比例${input.config.aspectRatio}，${referenceDesc ? `参考${referenceDesc}，` : ""}构图清晰，标题完整易读，商业海报感强${i === 0 ? ctaDesc : ""}，4k分辨率，结构清晰，细节丰富`;
    prompts.push({
      slotIndex: i + 1,
      prompt,
      negativePrompt: getDefaultNegativePrompt(input),
    });
  }

  return { prompts };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tixiao2 && npm run test lib/__tests__/image-description-agent.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd tixiao2 && git add lib/ai/agents/image-description-agent.ts lib/__tests__/image-description-agent.test.ts
git commit -m "fix: route series images (double/triple) to series system prompt instead of poster"
```

---

### Task 2: Fix series prompt generation to return all slot prompts (image-generation-service)

Now that `generateImageDescription` returns multiple prompts for series mode, the image-generation-service needs to use all prompts instead of just slot 1's prompt. This also fixes the per-group failure tracking (Bug 1) since we need to restructure the Phase 1/Phase 2 logic.

**Files:**
- Modify: `lib/image-generation-service.ts:260-575`

- [ ] **Step 1: Write the test**

Create `lib/__tests__/image-generation-service.test.ts`:

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const servicePath = new URL("../image-generation-service.ts", import.meta.url);

test("processPreparedImageGeneration uses per-group slot1 success tracking", async () => {
  const source = await readFile(servicePath, "utf8");

  // Should NOT have a global slot1Failed boolean
  // Instead should track per-group via slot1DoneMap
  assert.doesNotMatch(source, /let slot1Failed/);
  // Should check slot1DoneMap per group for series continuation
  assert.match(source, /slot1DoneMap\.get\(group\.id\)/);
  // Should not have a global skip for all slot 2+ when one group fails
  assert.doesNotMatch(source, /if \(isSeries && slot1Failed\)/);
});

test("processPreparedImageGeneration calls series-image-agent per group for delta prompts", async () => {
  const source = await readFile(servicePath, "utf8");

  // Should NOT take only the first entry for all groups
  assert.doesNotMatch(source, /firstSlot1Entry/);
  // Should iterate groups and call series agent for each group with its own slot1
  assert.match(source, /for \(const group of groups\)/);
  assert.match(source, /slot1DoneMap\.get\(group\.id\)/);
});

test("processPreparedImageGeneration removes logo from group snapshot update", async () => {
  const source = await readFile(servicePath, "utf8");

  // The group update block should not set logo
  const groupUpdatePattern = /db\.update\(imageGroups\)[\s\S]*?\.set\(\{[\s\S]*?\}\)/g;
  const matches = source.match(groupUpdatePattern);
  assert.ok(matches, "expected db.update(imageGroups) calls");

  for (const match of matches) {
    if (match.includes("promptBundleJson") && match.includes("updatedAt")) {
      assert.doesNotMatch(match, /logo:/, "group update should not set logo field");
    }
  }
});

test("processPreparedImageGeneration does not pass logo to buildSharedBaseContext", async () => {
  const source = await readFile(servicePath, "utf8");

  // buildSharedBaseContext should not reference config.logo
  const baseContextMatch = source.match(/async function buildSharedBaseContext[\s\S]*?return \{[\s\S]*?\};/);
  assert.ok(baseContextMatch, "expected buildSharedBaseContext function");
  assert.doesNotMatch(baseContextMatch[0], /logo/, "buildSharedBaseContext should not reference logo");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tixiao2 && npm run test lib/__tests__/image-generation-service.test.ts`
Expected: FAIL — current code has `slot1Failed`, `firstSlot1Entry`, and `logo` in group updates.

- [ ] **Step 3: Rewrite `processPreparedImageGeneration` in image-generation-service.ts**

Replace the function body in `lib/image-generation-service.ts` (lines 260-575). The key changes:

1. **Remove global `slot1Failed`** — track per-group via `slot1DoneMap`
2. **Use all prompts from agent** — not just slot 1
3. **Per-group series-image-agent calls** — each group gets its own delta prompt
4. **Remove `logo` from group snapshot update and `buildSharedBaseContext`**

Here is the full replacement for `processPreparedImageGeneration`:

```typescript
export async function processPreparedImageGeneration(input: {
  runId: string;
  prepared: PreparedImageGeneration;
}) {
  const db = getDb();
  const { runId, prepared } = input;
  const { groups, config, direction, copy, projectId } = prepared;
  let hadFailure = false;
  let batchErrorMessage: string | null = null;

  try {
    const ipMetadata = config.ipRole ? getIpAssetMetadata(config.ipRole) : null;
    const sharedBase = await buildSharedBaseContext({
      config,
      direction,
      copy,
      ipMetadata,
    });
    const descriptionResult = await generateImageDescription(sharedBase);
    const promptMap = new Map(
      descriptionResult.prompts.map((prompt) => [prompt.slotIndex, prompt]),
    );
    if (descriptionResult.prompts.length === 0) {
      throw new Error("图片描述生成失败：未生成任何 prompt");
    }

    const promptBundleJson = JSON.stringify({
      agentType: isSeriesMode(direction) ? "series" : "poster",
      prompts: descriptionResult.prompts,
    });

    db.update(imageConfigs)
      .set({ promptBundleJson, updatedAt: Date.now() })
      .where(eq(imageConfigs.id, config.id))
      .run();

    const snapshotTimestamp = Date.now();
    for (const group of groups) {
      db.update(imageGroups)
        .set({
          promptBundleJson,
          referenceImageUrl: config.referenceImageUrl ?? null,
          updatedAt: snapshotTimestamp,
        })
        .where(eq(imageGroups.id, group.id))
        .run();
    }

    const isSeries = isSeriesMode(direction);
    const slotCount = isSeries ? getSeriesSlotCount(direction.imageForm) : 1;

    // Phase 1: Generate ALL slot images using prompts from agent
    const allWorkItems: Array<{
      imageId: string;
      groupId: string;
      slotIndex: number;
      prompt: string;
      negativePrompt: string | null;
      referenceImageUrls: string[];
      groupModel: string | null;
    }> = [];

    for (const group of groups) {
      const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
      const groupReferenceImageUrl = group.referenceImageUrl ?? config.referenceImageUrl ?? null;
      const groupModel = group.imageModel ?? config.imageModel ?? null;
      const groupReferenceImageUrls = [groupReferenceImageUrl].filter(Boolean) as string[];

      for (const image of images) {
        const prompt = promptMap.get(image.slotIndex);
        if (!prompt) continue;
        allWorkItems.push({
          imageId: image.id,
          groupId: group.id,
          slotIndex: image.slotIndex,
          prompt: prompt.prompt,
          negativePrompt: prompt.negativePrompt,
          referenceImageUrls: image.slotIndex === 1 ? groupReferenceImageUrls : [],
          groupModel,
        });
      }
    }

    // Save prompt snapshots for all images
    for (const item of allWorkItems) {
      db.update(generatedImages)
        .set({
          finalPromptText: item.prompt,
          finalNegativePrompt: item.negativePrompt,
          promptType: "full",
          generationRequestJson: buildGenerationRequestJson({
            promptText: item.prompt,
            negativePrompt: item.negativePrompt,
            model: item.groupModel,
            aspectRatio: config.aspectRatio,
            referenceImages: item.referenceImageUrls.map((url) => ({ url })),
          }),
          updatedAt: Date.now(),
        })
        .where(eq(generatedImages.id, item.imageId))
        .run();
    }

    // Generate slot 1 images in parallel (with reference image if present)
    const slot1Items = allWorkItems.filter((item) => item.slotIndex === 1);
    const slot1Results = await Promise.allSettled(
      slot1Items.map(async (item) => {
        const binaries = item.referenceImageUrls.length > 0
          ? await generateImageFromReference({
              instruction: item.prompt,
              imageUrls: item.referenceImageUrls,
              aspectRatio: config.aspectRatio,
              model: item.groupModel ?? undefined,
            })
          : await generateImageFromPrompt(item.prompt, {
              aspectRatio: config.aspectRatio,
              model: item.groupModel ?? undefined,
            });

        const binary = binaries[0];
        const pngBuffer = await sharp(binary.buffer).png().toBuffer();
        const saved = await saveImageBuffer({
          projectId,
          imageId: item.imageId,
          buffer: pngBuffer,
          extension: "png",
        });
        return { imageId: item.imageId, saved };
      }),
    );

    // Process slot 1 results into per-group map
    const slot1DoneMap = new Map<string, { fileUrl: string; filePath: string; imageId: string }>();

    for (let i = 0; i < slot1Results.length; i += 1) {
      const result = slot1Results[i];
      const item = slot1Items[i];
      const imageId = item.imageId;
      const groupId = item.groupId;

      if (result.status === "fulfilled") {
        markGeneratedImageDone({ imageId, saved: result.value.saved });
        // Find the file path from the DB (it was just set by markGeneratedImageDone)
        const updatedImage = db.select().from(generatedImages).where(eq(generatedImages.id, imageId)).get();
        slot1DoneMap.set(groupId, {
          fileUrl: result.value.saved.fileUrl,
          filePath: updatedImage?.filePath ?? "",
          imageId,
        });
      } else {
        const message = result.reason instanceof Error ? result.reason.message : "图片生成失败";
        hadFailure = true;
        markGeneratedImageFailed(imageId, message);
      }
    }

    // Phase 2: For series mode, generate slot 2+ per group with its own delta prompt
    if (isSeries) {
      // Process each group independently
      for (const group of groups) {
        const slot1Info = slot1DoneMap.get(group.id);
        if (!slot1Info) {
          // Slot 1 failed for this group — mark all slot 2+ as failed
          const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
          for (const image of images) {
            if (image.slotIndex > 1 && image.status !== "done") {
              markGeneratedImageFailed(image.id, "系列图第 1 张生成失败，后续图无法生成");
            }
          }
          hadFailure = true;
          continue;
        }

        // Build delta prompt for this group via series-image-agent
        const images = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, group.id)).all();
        const slot1Prompt = promptMap.get(1)?.prompt ?? descriptionResult.prompts[0]!.prompt;
        const copyTexts = [copy.titleMain, copy.titleSub ?? "", copy.titleExtra ?? ""].filter(Boolean);
        const targetTexts = new Map<number, string>();
        for (let i = 1; i < slotCount; i += 1) {
          const text = copyTexts[i] ?? copyTexts[0] ?? "";
          targetTexts.set(i + 1, text);
        }

        const slotRoles = resolveSeriesSlotRoles(copy.copyType, slotCount);
        const deltaResult = await generateSeriesDeltaPrompts({
          slot1Prompt,
          slot1ImageUrl: slot1Info.fileUrl,
          targetTexts,
          copyType: copy.copyType,
          slotRoles,
        });

        const deltaMap = new Map(deltaResult.deltas.map((d) => [d.slotIndex, d]));

        // Update promptBundleJson with delta prompts for this group
        const groupPromptBundleJson = JSON.stringify({
          agentType: "series",
          prompts: [
            { slotIndex: 1, prompt: slot1Prompt, negativePrompt: promptMap.get(1)?.negativePrompt },
            ...deltaResult.deltas.map((d) => ({ slotIndex: d.slotIndex, prompt: d.prompt, negativePrompt: d.negativePrompt })),
          ],
        });

        db.update(imageGroups)
          .set({ promptBundleJson: groupPromptBundleJson, updatedAt: Date.now() })
          .where(eq(imageGroups.id, group.id))
          .run();

        // Build slot 2+ work items for this group
        const slot2PlusItems: Array<{
          imageId: string;
          slotIndex: number;
          prompt: string;
          negativePrompt: string;
        }> = [];

        for (const image of images) {
          if (image.slotIndex <= 1) continue;
          const delta = deltaMap.get(image.slotIndex);
          if (!delta) continue;

          slot2PlusItems.push({
            imageId: image.id,
            slotIndex: image.slotIndex,
            prompt: delta.prompt,
            negativePrompt: delta.negativePrompt,
          });
        }

        // Save slot 2+ prompt snapshots for this group
        for (const item of slot2PlusItems) {
          db.update(generatedImages)
            .set({
              finalPromptText: item.prompt,
              finalNegativePrompt: item.negativePrompt,
              promptType: "delta",
              generationRequestJson: buildGenerationRequestJson({
                promptText: item.prompt,
                negativePrompt: item.negativePrompt,
                model: "qwen-image-2.0",
                aspectRatio: config.aspectRatio,
                referenceImages: [{ url: slot1Info.fileUrl }],
              }),
              updatedAt: Date.now(),
            })
            .where(eq(generatedImages.id, item.imageId))
            .run();
        }

        // Generate slot 2+ for this group via qwen-image-2.0 images/edits
        const slot2PlusResults = await Promise.allSettled(
          slot2PlusItems.map(async (item) => {
            const imageBuffer = await readFile(slot1Info.filePath);
            const ext = slot1Info.filePath.split(".").pop()?.toLowerCase();
            const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
            const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

            const binaries = await generateImageFromReference({
              instruction: item.prompt,
              imageUrl: dataUrl,
              aspectRatio: config.aspectRatio,
              model: "qwen-image-2.0",
            });

            const binary = binaries[0];
            const pngBuffer = await sharp(binary.buffer).png().toBuffer();
            const saved = await saveImageBuffer({
              projectId,
              imageId: item.imageId,
              buffer: pngBuffer,
              extension: "png",
            });
            return { imageId: item.imageId, saved };
          }),
        );

        for (let i = 0; i < slot2PlusResults.length; i += 1) {
          const result = slot2PlusResults[i];
          const imageId = slot2PlusItems[i].imageId;

          if (result.status === "fulfilled") {
            markGeneratedImageDone({ imageId, saved: result.value.saved });
          } else {
            const message = result.reason instanceof Error ? result.reason.message : "图片生成失败";
            hadFailure = true;
            markGeneratedImageFailed(imageId, message);
          }
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "图片生成流程失败";
    hadFailure = true;
    batchErrorMessage = message;
    markUndoneGroupImagesFailed(groups, message);
  } finally {
    finishGenerationRun(runId, {
      status: hadFailure ? "failed" : "done",
      errorMessage: hadFailure ? batchErrorMessage ?? "部分图片生成失败" : null,
    });
  }
}
```

Also update `buildSharedBaseContext` to remove `logo` from the return value. Replace the `config` field (line 232-240):

```typescript
    config: {
      imageForm: (input.direction.imageForm ?? "single") as "single" | "double" | "triple",
      aspectRatio: input.config.aspectRatio,
      styleMode: (input.config.styleMode ?? "normal") as "normal" | "ip",
      imageStyle: input.config.imageStyle,
      ctaEnabled: input.config.ctaEnabled === 1,
      ctaText: input.config.ctaText,
    },
```

And update `ImageDescriptionInput.config` type in `image-description-agent.ts` to remove `logo`:

```typescript
  config: {
    imageForm: "single" | "double" | "triple";
    aspectRatio: string;
    styleMode: "normal" | "ip";
    imageStyle: string;
    ctaEnabled: boolean;
    ctaText: string | null;
  };
```

Note: `logo` remains in the `imageConfigs` and `imageGroups` DB tables — we just stop passing it through the generation pipeline. The `ImageDescriptionInput.config.logo` field is removed since nothing uses it.

Update `baseInput` in the test file to remove `logo` from `config`:

```typescript
  config: {
    imageForm: "double",
    aspectRatio: "3:2",
    styleMode: "ip",
    imageStyle: "animation",
    ctaEnabled: false,
    ctaText: null,
  },
```

- [ ] **Step 4: Run all related tests**

Run: `cd tixiao2 && npm run test lib/__tests__/image-generation-service.test.ts lib/__tests__/image-description-agent.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd tixiao2 && git add lib/image-generation-service.ts lib/__tests__/image-generation-service.test.ts lib/ai/agents/image-description-agent.ts lib/__tests__/image-description-agent.test.ts
git commit -m "fix: per-group slot1 tracking, per-group delta prompts, remove logo from generation pipeline"
```

---

### Task 3: Fix `referenceImageUrl` hardcoded `null` in frontend

**Files:**
- Modify: `components/cards/image-config-card.tsx:275`

- [ ] **Step 1: Fix the frontend to not hardcode `referenceImageUrl`**

In `components/cards/image-config-card.tsx`, the `saveImageConfigAndGenerate` call at line 266-278 hardcodes `referenceImageUrl: null`. Since the current UI doesn't have a normal-mode reference image picker, the correct behavior is to **not send the field at all** so the backend preserves any existing value.

But since `saveImageConfigAndGenerate` in `image-config-actions.ts` always sends the field in the body, the simplest fix is to change the actions file to make `referenceImageUrl` optional in the payload:

In `components/cards/image-config/image-config-actions.ts`, update the body construction to conditionally include `reference_image_url`:

```typescript
export async function saveImageConfigAndGenerate(input: {
  copyId: string;
  imageConfigId?: string;
  aspectRatio: string;
  styleMode: string;
  imageStyle: string;
  imageModel: string | null;
  count: number;
  ipRole: string | null;
  referenceImageUrl?: string | null;
  ctaEnabled: boolean;
  ctaText?: string | null;
}) {
  try {
    const body: Record<string, unknown> = {
      aspect_ratio: input.aspectRatio,
      style_mode: input.styleMode,
      ip_role: input.ipRole,
      image_style: input.imageStyle,
      image_model: input.imageModel,
      count: input.count,
      cta_enabled: input.ctaEnabled,
      cta_text: input.ctaText ?? null,
      append: !!input.imageConfigId,
      generate: true,
    };

    if (input.referenceImageUrl !== undefined) {
      body.reference_image_url = input.referenceImageUrl;
    }

    const payload = await apiFetch<{ id?: string; created_group_ids?: string[] }>(
      `/api/copies/${input.copyId}/image-config`,
      { method: "POST", body },
    );

    if (!payload.id) {
      return { ok: false, configSaved: false, error: "图片配置保存失败" };
    }
    return { ok: true, configSaved: true, error: null as string | null };
  } catch (error) {
    return {
      ok: false,
      configSaved: false,
      error: error instanceof ApiError ? error.message : "图片配置保存失败",
    };
  }
}
```

Then in `image-config-card.tsx`, remove the `referenceImageUrl` property from the call entirely (line 275):

```typescript
const result = await saveImageConfigAndGenerate({
  copyId,
  imageConfigId: data.imageConfigId,
  aspectRatio,
  styleMode,
  imageStyle: resolveImageStyleForMode(styleMode, imageStyle),
  imageModel,
  count,
  ipRole: showIpAssetSelector ? ipRole : null,
  ctaEnabled: supportsCta ? ctaEnabled : false,
  ctaText: supportsCta ? ctaText : null,
});
```

This way, when `referenceImageUrl` is not passed, the backend `saveImageConfig` receives `undefined` for that field, and `getResolvedReferenceImageUrlInput` falls through to preserve the existing config value. When a future feature adds a reference image picker, it can simply pass `referenceImageUrl` with the actual value.

- [ ] **Step 2: Verify build passes**

Run: `cd tixiao2 && npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd tixiao2 && git add components/cards/image-config-card.tsx components/cards/image-config/image-config-actions.ts
git commit -m "fix: stop hardcoding referenceImageUrl as null, preserve existing value on save"
```

---

### Task 4: Fix `variantIndex` conflict in append mode

**Files:**
- Modify: `lib/project-data-modules-internal.ts:407-416`

- [ ] **Step 1: Write the test**

Add to `lib/__tests__/image-generation-service.test.ts`:

```typescript
test("createCandidateGroupsForConfig uses MAX variantIndex for append mode", async () => {
  const source = await readFile(new URL("../project-data-modules-internal.ts", import.meta.url), "utf8");

  // In createCandidateGroupsForConfig, append mode should use MAX(variantIndex) not groups.length
  const fnMatch = source.match(/function createCandidateGroupsForConfig[\s\S]*?function\s+\w+/);
  assert.ok(fnMatch, "expected createCandidateGroupsForConfig function");

  // Should call getNextCandidateVariantIndex or equivalent MAX logic for append
  // The current buggy code uses groups.length + 1
  assert.doesNotMatch(fnMatch[0], /groups\.length\s*\+\s*1/, "should not use groups.length for variantIndex in append mode");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tixiao2 && npm run test lib/__tests__/image-generation-service.test.ts`
Expected: FAIL — `groups.length + 1` is found.

- [ ] **Step 3: Fix `createCandidateGroupsForConfig`**

In `lib/project-data-modules-internal.ts`, change lines 407-416:

From:
```typescript
  const groups = listImageConfigGroups(input.imageConfigId);
  const startIndex = input.append ? groups.length + 1 : 1;
  const groupCount = input.append ? (input.requestedCount ?? 1) : input.configCount;
  const slotCount = imageSlotCount(input.directionImageForm);
  const createdGroups: Array<typeof imageGroups.$inferSelect> = [];

  for (let offset = 0; offset < groupCount; offset += 1) {
    const group = createCandidateGroupWithImages({
      imageConfigId: input.imageConfigId,
      variantIndex: startIndex + offset,
```

To:
```typescript
  const groups = listImageConfigGroups(input.imageConfigId);
  const startIndex = input.append
    ? Math.max(...groups.map((g) => g.variantIndex), 0) + 1
    : 1;
  const groupCount = input.append ? (input.requestedCount ?? 1) : input.configCount;
  const slotCount = imageSlotCount(input.directionImageForm);
  const createdGroups: Array<typeof imageGroups.$inferSelect> = [];

  for (let offset = 0; offset < groupCount; offset += 1) {
    const group = createCandidateGroupWithImages({
      imageConfigId: input.imageConfigId,
      variantIndex: startIndex + offset,
```

This uses `MAX(variantIndex) + 1` which matches the logic in `getNextCandidateVariantIndex` used by `appendImageConfigGroup`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tixiao2 && npm run test lib/__tests__/image-generation-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd tixiao2 && git add lib/project-data-modules-internal.ts lib/__tests__/image-generation-service.test.ts
git commit -m "fix: use MAX(variantIndex) instead of groups.length for append mode variantIndex"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd tixiao2 && npm run test`
Expected: ALL PASS

- [ ] **Step 2: Run typecheck**

Run: `cd tixiao2 && npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `cd tixiao2 && npm run lint`
Expected: PASS (no new warnings)

---

## Self-Review

**Spec coverage:** All 6 bugs have corresponding tasks:
- Bug 1 (slot1Failed) → Task 2
- Bug 2 (series routing) → Task 1 + Task 2
- Bug 3 (shared delta) → Task 2
- Bug 4 (referenceImageUrl null) → Task 3
- Bug 5 (logo) → Task 2 (removed from buildSharedBaseContext and group update)
- Bug 6 (variantIndex) → Task 4

**Placeholder scan:** No TBD/TODO found. All steps have complete code.

**Type consistency:** `ImageDescriptionInput.config` removes `logo` — all usages updated in both agent and test. `buildSharedBaseContext` return type matches `ImageDescriptionInput`. `generateImageDescription` return type unchanged (`ImageDescriptionOutput`). `slot1DoneMap` now stores `{ fileUrl, filePath, imageId }` to support per-group slot 2+ generation.
