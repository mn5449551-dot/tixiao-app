# Finalized Card Adaptation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild finalized image handling so each confirmed candidate image gets its own finalized card, adaptation assets are reused by ratio across channels, and adaptation generation only exposes verified models that truly support reference-image ratio conversion.

**Architecture:** Replace the current per-config finalized pool node with per-source-image finalized cards. Keep adaptation assets in existing `image_groups` / `generated_images` tables, but reinterpret them as one original confirmed source group plus derived ratio assets. Introduce a dedicated finalized-adaptation model whitelist and tighten image generation so doubao/qwen edits always send the original finalized image as the real reference input, persist true request snapshots, and export by slot from a single finalized card.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, SQLite + Drizzle, Node test runner with `tsx`, AI gateway `/v1/images/edits`.

---

## File Structure

### Existing files to modify

| File | Responsibility |
| --- | --- |
| `lib/constants.ts` | Global model metadata; add finalized-adaptation whitelist helpers instead of reusing all `IMAGE_MODELS` |
| `lib/ai/image-chat.ts` | Route reference-image requests per model and normalize edit payload sizing for doubao/qwen |
| `lib/workflow-graph-types.ts` | Define the new finalized-card node shape |
| `lib/workflow-graph-builders.ts` | Build one finalized node per confirmed original group and attach derived assets by ratio |
| `lib/workflow-graph.ts` | Render multiple finalized nodes for one image config branch |
| `components/cards/finalized-pool-card.tsx` | Replace multi-group pool UI with single-source finalized card UI |
| `components/cards/finalized-pool/finalized-pool-actions.ts` | Send card-level payloads for adaptation and export |
| `app/api/projects/[id]/finalized/variants/route.ts` | Accept card-level payload (`source_group_id`, `channel`, `slot_names`, `image_model`) |
| `lib/project-data-modules-internal.ts` | Rework `generateFinalizedVariants()` around one source group, ratio dedupe, snapshot persistence, overwrite-on-regenerate behavior |
| `app/api/images/[id]/route.ts` | Keep derived-image regenerate anchored to the original finalized source image |
| `app/api/projects/[id]/export/route.ts` | Export only the slot selections for the active finalized card, using ratio assets from that card |
| `lib/export/utils.ts` | Add helpers to group slot specs by ratio and map slot requirements to existing assets |

### Existing tests to modify

| File | Responsibility |
| --- | --- |
| `lib/__tests__/workflow-graph.test.ts` | Assert finalized graph emits one node per confirmed source image |
| `lib/__tests__/finalized-variants-source.test.ts` | Assert route and internal module use the new payload, ratio dedupe, snapshot writes, and root reference image |
| `lib/__tests__/project-data.integration.test.ts` | Verify derived groups are regenerated per ratio from a single confirmed source group |
| `lib/__tests__/image-chat-source.test.ts` | Assert finalized adaptation model filtering and edits transport rules |

### New files to create

| File | Responsibility |
| --- | --- |
| `lib/finalized-card.ts` | Pure helpers for slot grouping, ratio asset lookup, and finalized-card view-model assembly |
| `lib/__tests__/finalized-pool-card-source.test.ts` | Source-level assertions for the new finalized card UI states |

## Task 1: Lock the adaptation-model whitelist and image-edit transport

**Files:**
- Create: `lib/__tests__/finalized-pool-card-source.test.ts`
- Modify: `lib/__tests__/image-chat-source.test.ts`
- Modify: `lib/constants.ts`
- Modify: `lib/ai/image-chat.ts`

- [ ] **Step 1: Add failing source tests for the finalized adaptation whitelist**

Add these assertions to `lib/__tests__/image-chat-source.test.ts`:

```ts
test("finalized adaptation models exclude Gemini Flash and non-4-ratio models", async () => {
  const constantsPath = new URL("../constants.ts", import.meta.url);
  const source = await readFile(constantsPath, "utf8");

  assert.match(source, /FINALIZED_ADAPTATION_MODEL_VALUES/);
  assert.match(source, /doubao-seedream-4-0/);
  assert.match(source, /doubao-seedream-4-5/);
  assert.match(source, /doubao-seedream-5-0-lite/);
  assert.match(source, /qwen-image-2\.0/);
  assert.doesNotMatch(source, /FINALIZED_ADAPTATION_MODEL_VALUES[\s\S]*gemini-3\.1-flash-image-preview/);
  assert.doesNotMatch(source, /FINALIZED_ADAPTATION_MODEL_VALUES[\s\S]*gpt-image-1\.5/);
});

test("image chat uses edits transport for finalized adaptation reference-image models", async () => {
  const imageChatPath = new URL("../ai/image-chat.ts", import.meta.url);
  const source = await readFile(imageChatPath, "utf8");

  assert.match(source, /supportsEdits/);
  assert.match(source, /generateImageViaEdits/);
  assert.match(source, /buildEditSize/);
  assert.match(source, /qwen-image-2\.0/);
});
```

- [ ] **Step 2: Add a failing UI source test for the finalized card model select**

Create `lib/__tests__/finalized-pool-card-source.test.ts` with:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cardPath = new URL("../../components/cards/finalized-pool-card.tsx", import.meta.url);

test("finalized card uses finalized adaptation model whitelist instead of IMAGE_MODELS", async () => {
  const source = await readFile(cardPath, "utf8");
  assert.match(source, /FINALIZED_ADAPTATION_MODELS/);
  assert.doesNotMatch(source, /<option key=\{m\.value\} value=\{m\.value\}>[\s\S]*IMAGE_MODELS\.map/);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:

```bash
npm run test -- lib/__tests__/image-chat-source.test.ts lib/__tests__/finalized-pool-card-source.test.ts
```

Expected: FAIL because `FINALIZED_ADAPTATION_MODEL_VALUES`, `buildEditSize`, and `FINALIZED_ADAPTATION_MODELS` do not exist yet.

- [ ] **Step 4: Implement the whitelist and edit-size helpers**

In `lib/constants.ts`, add a dedicated finalized-adaptation whitelist immediately after `IMAGE_MODELS`:

```ts
export const FINALIZED_ADAPTATION_MODEL_VALUES = [
  "doubao-seedream-4-0",
  "doubao-seedream-4-5",
  "doubao-seedream-5-0-lite",
  "qwen-image-2.0",
] as const;

export const FINALIZED_ADAPTATION_MODELS = IMAGE_MODELS.filter((model) =>
  FINALIZED_ADAPTATION_MODEL_VALUES.includes(model.value as (typeof FINALIZED_ADAPTATION_MODEL_VALUES)[number]),
);

export const DEFAULT_FINALIZED_ADAPTATION_MODEL_VALUE = FINALIZED_ADAPTATION_MODELS[0].value;
```

In `lib/ai/image-chat.ts`, add a dedicated edit-size helper and use it inside `generateImageViaEdits()`:

```ts
function buildEditSize(input: {
  model: string;
  aspectRatio?: string;
  resolution: ImageResolution;
}) {
  const size = getModelDefaultSize(input.model, input.aspectRatio ?? "1:1");
  if (input.model === "qwen-image-2.0") {
    return size.replace("x", "*");
  }
  return size;
}
```

Then replace the existing `size:` call inside both `generateImageFromReference()` and `editImage()` edits branches:

```ts
size: buildEditSize({
  model: resolved.model,
  aspectRatio: input.aspectRatio,
  resolution: input.resolution ?? DEFAULT_IMAGE_RESOLUTION,
}),
```

- [ ] **Step 5: Update the finalized card source to consume the whitelist**

In `components/cards/finalized-pool-card.tsx`, replace:

```ts
import { IMAGE_MODELS } from "@/lib/constants";
```

with:

```ts
import {
  DEFAULT_FINALIZED_ADAPTATION_MODEL_VALUE,
  FINALIZED_ADAPTATION_MODELS,
} from "@/lib/constants";
```

and replace the model state initializer:

```ts
const [imageModel, setImageModel] = useState<string>(
  data.defaultImageModel ?? DEFAULT_FINALIZED_ADAPTATION_MODEL_VALUE,
);
```

and the options render:

```tsx
{FINALIZED_ADAPTATION_MODELS.map((m) => (
  <option key={m.value} value={m.value}>
    {m.label}
  </option>
))}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run:

```bash
npm run test -- lib/__tests__/image-chat-source.test.ts lib/__tests__/finalized-pool-card-source.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/constants.ts lib/ai/image-chat.ts components/cards/finalized-pool-card.tsx lib/__tests__/image-chat-source.test.ts lib/__tests__/finalized-pool-card-source.test.ts
git commit -m "feat: whitelist finalized adaptation models"
```

## Task 2: Reshape finalized nodes into one card per confirmed source image

**Files:**
- Create: `lib/finalized-card.ts`
- Modify: `lib/workflow-graph-types.ts`
- Modify: `lib/workflow-graph-builders.ts`
- Modify: `lib/workflow-graph.ts`
- Test: `lib/__tests__/workflow-graph.test.ts`

- [ ] **Step 1: Add failing graph tests for per-source finalized cards**

Extend `lib/__tests__/workflow-graph.test.ts` with a case that seeds one copy containing two confirmed original groups and one derived group, then asserts two finalized nodes are created:

```ts
assert.ok(graph.nodes.find((node) => node.id === "finalized-grp_source_1"));
assert.ok(graph.nodes.find((node) => node.id === "finalized-grp_source_2"));
assert.equal(graph.nodes.filter((node) => node.type === "finalizedPool").length, 2);
```

Also assert the node data exposes one source group plus ratio assets:

```ts
const finalizedNode = graph.nodes.find((node) => node.id === "finalized-grp_source_1");
assert.ok(finalizedNode && "sourceGroupId" in finalizedNode.data);
assert.equal(finalizedNode.data.sourceGroupId, "grp_source_1");
assert.equal(finalizedNode.data.sourceAspectRatio, "1:1");
assert.equal(finalizedNode.data.assets.some((asset) => asset.ratio === "16:9"), true);
```

- [ ] **Step 2: Run the graph test to verify it fails**

Run:

```bash
npm run test -- lib/__tests__/workflow-graph.test.ts
```

Expected: FAIL because the builder still emits `finalized-${config.id}` and does not expose `sourceGroupId` / `assets`.

- [ ] **Step 3: Define the finalized-card types**

In `lib/workflow-graph-types.ts`, replace the existing finalized pool union member with:

```ts
  | {
      displayMode: "single" | "double" | "triple";
      sourceGroupId: string;
      sourceImageConfigId: string;
      sourceAspectRatio: string;
      sourceImages: Array<{
        id: string;
        fileUrl: string | null;
        thumbnailUrl?: string | null;
        aspectRatio: string;
        updatedAt?: number;
      }>;
      assets: Array<{
        ratio: string;
        groupId: string;
        imageIds: string[];
        kind: "source" | "derived";
        images: Array<{
          id: string;
          fileUrl: string | null;
          thumbnailUrl?: string | null;
          aspectRatio: string;
          updatedAt?: number;
        }>;
      }>;
      projectId?: string;
      defaultImageModel?: string | null;
    }
```

- [ ] **Step 4: Create the pure finalized-card helper**

Create `lib/finalized-card.ts` with helpers to bucket groups by source group and ratio:

```ts
export function getDerivedSourceGroupId(groupType: string | undefined) {
  if (!groupType?.startsWith("derived|")) return null;
  return groupType.split("|")[1] ?? null;
}

export function getDerivedRatio(groupType: string | undefined) {
  if (!groupType?.startsWith("derived|")) return null;
  return groupType.split("|")[2] ?? null;
}
```

Add a card builder that takes confirmed groups plus config fallback:

```ts
export function buildFinalizedCardView(input: {
  sourceGroup: WorkspaceData["directions"][number]["copyCards"][number]["copies"][number]["groups"][number];
  siblingGroups: WorkspaceData["directions"][number]["copyCards"][number]["copies"][number]["groups"];
  fallbackAspectRatio: string;
}) {
  const sourceAspectRatio = input.sourceGroup.aspectRatio ?? input.fallbackAspectRatio;
  const relatedGroups = input.siblingGroups.filter((group) =>
    group.id === input.sourceGroup.id || getDerivedSourceGroupId(group.groupType) === input.sourceGroup.id,
  );

  return {
    sourceGroupId: input.sourceGroup.id,
    sourceAspectRatio,
    sourceImages: input.sourceGroup.images.filter((img) => img.status === "done"),
    assets: relatedGroups.map((group) => ({
      ratio: group.id === input.sourceGroup.id ? sourceAspectRatio : getDerivedRatio(group.groupType) ?? sourceAspectRatio,
      groupId: group.id,
      imageIds: group.images.filter((img) => img.status === "done").map((img) => img.id),
      kind: group.id === input.sourceGroup.id ? "source" as const : "derived" as const,
      images: group.images.filter((img) => img.status === "done"),
    })),
  };
}
```

- [ ] **Step 5: Switch the graph builders to emit one node per source group**

In `lib/workflow-graph-builders.ts`, replace `buildFinalizedPoolNode()` with `buildFinalizedPoolNodes()` returning an array of nodes:

```ts
export function buildFinalizedPoolNodes(input: {
  copy: WorkspaceData["directions"][number]["copyCards"][number]["copies"][number];
  configY: number;
  projectId: string;
  imageModel?: string | null;
}) {
  const confirmedOriginalGroups = copy.groups.filter(
    (group) => group.isConfirmed && !group.groupType.startsWith("derived|"),
  );

  return confirmedOriginalGroups.map((group, index) => ({
    id: `finalized-${group.id}`,
    type: "finalizedPool" as const,
    position: { x: 2320, y: input.configY + index * 360 },
    data: {
      displayMode: getDisplayMode(group.slotCount),
      sourceGroupId: group.id,
      sourceImageConfigId: group.imageConfigId,
      ...buildFinalizedCardView({
        sourceGroup: group,
        siblingGroups: copy.groups,
        fallbackAspectRatio: copy.imageConfig!.aspectRatio,
      }),
      projectId: input.projectId,
      defaultImageModel: input.imageModel ?? null,
    },
  }));
}
```

Update `lib/workflow-graph.ts` to iterate the array:

```ts
const finalizedPools = buildFinalizedPoolNodes({
  copy,
  configY,
  projectId: workspace.project.id,
  imageModel: copy.imageConfig?.imageModel ?? null,
});

for (const finalizedPool of finalizedPools) {
  nodes.push(finalizedPool);
  edges.push(edgeOf(candidatePool.node.id, finalizedPool.id, "定稿"));
}
```

- [ ] **Step 6: Run the graph test to verify it passes**

Run:

```bash
npm run test -- lib/__tests__/workflow-graph.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/finalized-card.ts lib/workflow-graph-types.ts lib/workflow-graph-builders.ts lib/workflow-graph.ts lib/__tests__/workflow-graph.test.ts
git commit -m "feat: split finalized nodes by confirmed source image"
```

## Task 3: Rework finalized-variant generation around one source group and true request snapshots

**Files:**
- Modify: `lib/project-data-modules-internal.ts`
- Modify: `app/api/projects/[id]/finalized/variants/route.ts`
- Modify: `app/api/images/[id]/route.ts`
- Test: `lib/__tests__/finalized-variants-source.test.ts`
- Test: `lib/__tests__/project-data.integration.test.ts`

- [ ] **Step 1: Add failing tests for the new payload and snapshot persistence**

In `lib/__tests__/finalized-variants-source.test.ts`, replace the old route expectations with:

```ts
assert.match(source, /source_group_id/);
assert.match(source, /target_channel/);
assert.match(source, /slot_names/);
assert.match(source, /generationRequestJson|generation_request_json/);
assert.match(source, /referenceImages/);
```

Add a source assertion that regenerated derived images stay anchored to the original source image:

```ts
assert.match(regenerateSource, /group\.groupType\.startsWith\("derived\|"\)/);
assert.match(regenerateSource, /parentImage/);
assert.match(regenerateSource, /generateImageFromReference/);
```

In `lib/__tests__/project-data.integration.test.ts`, add an integration assertion:

```ts
assert.equal(result.groups.length, 1);
const derivedImages = db.select().from(generatedImages).where(eq(generatedImages.imageGroupId, result.groups[0]!.id)).all();
assert.ok(derivedImages.every((image) => image.generationRequestJson));
assert.ok(derivedImages.every((image) => image.inpaintParentId));
```

- [ ] **Step 2: Run the finalized-variants tests to verify they fail**

Run:

```bash
npm run test -- lib/__tests__/finalized-variants-source.test.ts lib/__tests__/project-data.integration.test.ts
```

Expected: FAIL because the route still accepts `target_group_ids` / `target_channels` and the internal function does not persist derived request snapshots.

- [ ] **Step 3: Narrow the route payload to one finalized card**

In `app/api/projects/[id]/finalized/variants/route.ts`, change the request shape to:

```ts
const body = (await request.json()) as {
  source_group_id?: string;
  target_channel?: string;
  slot_names?: string[];
  image_model?: string;
};
```

and call:

```ts
const result = await generateFinalizedVariants(id, {
  sourceGroupId: body.source_group_id,
  targetChannel: body.target_channel,
  slotNames: body.slot_names,
  imageModel: body.image_model,
});
```

- [ ] **Step 4: Rebuild `generateFinalizedVariants()` for one source group**

In `lib/project-data-modules-internal.ts`, change the signature to:

```ts
export async function generateFinalizedVariants(
  projectId: string,
  input: {
    sourceGroupId?: string;
    targetChannel?: string;
    slotNames?: string[];
    imageModel?: string;
  },
)
```

Inside the function:

1. Load the single confirmed original group by `sourceGroupId`
2. Resolve slot specs with `{ targetChannels: [input.targetChannel], targetSlots: input.slotNames }`
3. Group the selected slots by `ratio`
4. Skip `direct` and `special` ratios
5. For each remaining ratio, delete any old derived group `derived|${sourceGroupId}|${ratio}`
6. Create a new derived group and one derived image per slot index
7. Read the original source image bytes and send them as the only reference image
8. Persist:

```ts
generationRequestJson: JSON.stringify({
  promptText: prompt,
  negativePrompt: null,
  model,
  aspectRatio: ratio,
  referenceImages: [{ url: dataUrl }],
})
```

- [ ] **Step 5: Keep regenerate anchored to the original source image**

In `app/api/images/[id]/route.ts`, keep the existing derived-image branch but tighten the fallback:

```ts
if (group?.groupType.startsWith("derived|") && image.inpaintParentId) {
  const parentImage = db.select().from(generatedImages).where(eq(generatedImages.id, image.inpaintParentId)).get();
  if (!parentImage?.filePath) {
    throw new Error("原始定稿图不存在");
  }
  // keep using parentImage as the only reference source
}
```

Do not switch to using the current derived image as the reference.

- [ ] **Step 6: Run the finalized-variants tests to verify they pass**

Run:

```bash
npm run test -- lib/__tests__/finalized-variants-source.test.ts lib/__tests__/project-data.integration.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/project-data-modules-internal.ts app/api/projects/[id]/finalized/variants/route.ts app/api/images/[id]/route.ts lib/__tests__/finalized-variants-source.test.ts lib/__tests__/project-data.integration.test.ts
git commit -m "feat: generate finalized variants per source card"
```

## Task 4: Rebuild the finalized card UI around one active channel and slot-based export

**Files:**
- Modify: `components/cards/finalized-pool-card.tsx`
- Modify: `components/cards/finalized-pool/finalized-pool-actions.ts`
- Modify: `lib/finalized-card.ts`
- Test: `lib/__tests__/finalized-pool-card-source.test.ts`

- [ ] **Step 1: Add failing UI source assertions for the channel-first flow**

Extend `lib/__tests__/finalized-pool-card-source.test.ts` with:

```ts
assert.match(source, /activeChannel/);
assert.match(source, /请选择渠道后查看该渠道版位/);
assert.match(source, /可直接导出/);
assert.match(source, /需适配/);
assert.match(source, /暂不支持/);
assert.match(source, /重新生成/);
assert.doesNotMatch(source, /selectedChannels/);
```

- [ ] **Step 2: Run the UI source test to verify it fails**

Run:

```bash
npm run test -- lib/__tests__/finalized-pool-card-source.test.ts
```

Expected: FAIL because the component still supports multi-channel selection and a global selected-group set.

- [ ] **Step 3: Simplify the card state to one source group and one active channel**

In `components/cards/finalized-pool-card.tsx`, remove:

```ts
selectedGroupIds
selectedChannels
selectedImages
selectedGroupCount
toggleSelectAllGroups
```

Replace with:

```ts
const [activeChannel, setActiveChannel] = useState<string | null>(null);
const [selectedSlotNames, setSelectedSlotNames] = useState<string[]>([]);
```

Compute slot sections from `data.assets` plus the active channel:

```ts
const activeSlotSpecs = useMemo(
  () => (activeChannel ? EXPORT_SLOT_SPECS.filter((spec) => spec.channel === activeChannel) : []),
  [activeChannel],
);
```

- [ ] **Step 4: Render the new sections**

Render this empty-state block before any slot UI:

```tsx
{!activeChannel ? (
  <div className="rounded-[var(--radius-md)] bg-[var(--surface-dim)] p-3 text-xs text-[var(--ink-muted)]">
    请选择渠道后查看该渠道版位
  </div>
) : null}
```

Render three sections when `activeChannel` exists:

```tsx
<p className="mb-2 text-xs font-medium text-[var(--ink-default)]">可直接导出</p>
<p className="mb-2 text-xs font-medium text-[var(--ink-default)]">需适配</p>
<p className="mb-2 text-xs font-medium text-[var(--ink-default)]">暂不支持</p>
```

The “生成适配版本” button must send only the active card:

```ts
await generateFinalizedVariants({
  projectId,
  sourceGroupId: data.sourceGroupId,
  targetChannel: activeChannel,
  slotNames: selectedAdaptiveSlotNames,
  imageModel,
});
```

- [ ] **Step 5: Update the client action payload**

In `components/cards/finalized-pool/finalized-pool-actions.ts`, change the function to:

```ts
export async function generateFinalizedVariants(input: {
  projectId: string;
  sourceGroupId: string;
  targetChannel: string;
  slotNames: string[];
  imageModel: string;
})
```

and send:

```ts
body: {
  source_group_id: input.sourceGroupId,
  target_channel: input.targetChannel,
  slot_names: input.slotNames,
  image_model: input.imageModel,
},
```

- [ ] **Step 6: Run the UI source test to verify it passes**

Run:

```bash
npm run test -- lib/__tests__/finalized-pool-card-source.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add components/cards/finalized-pool-card.tsx components/cards/finalized-pool/finalized-pool-actions.ts lib/finalized-card.ts lib/__tests__/finalized-pool-card-source.test.ts
git commit -m "feat: rebuild finalized card channel workflow"
```

## Task 5: Export only the selected slots from the active finalized card

**Files:**
- Modify: `app/api/projects/[id]/export/route.ts`
- Modify: `lib/export/utils.ts`
- Test: `lib/__tests__/finalized-variants-source.test.ts`

- [ ] **Step 1: Add a failing source assertion for card-level export**

Extend `lib/__tests__/finalized-variants-source.test.ts` with:

```ts
assert.match(source, /source_group_id/);
assert.match(source, /slot_names/);
assert.match(source, /classifyExportAdaptation/);
assert.match(source, /adaptation !== "direct"/);
```

- [ ] **Step 2: Run the source test to verify it fails**

Run:

```bash
npm run test -- lib/__tests__/finalized-variants-source.test.ts
```

Expected: FAIL because the export route still consumes `target_group_ids` and loops across every selected group.

- [ ] **Step 3: Narrow export to one source group and selected slots**

In `app/api/projects/[id]/export/route.ts`, change the request body to:

```ts
const body = (await request.json()) as {
  source_group_id?: string;
  target_channel?: string;
  slot_names?: string[];
  logo?: "onion" | "onion_app" | "none";
  file_format?: "jpg" | "png" | "webp";
  naming_rule?: string;
};
```

and pass only the one source group into `getProjectExportContext()`:

```ts
const exportContext = getProjectExportContext(id, {
  targetGroupIds: body.source_group_id ? [body.source_group_id] : [],
});
```

Then resolve slots using:

```ts
const slotSpecs = resolveExportSlotSpecs({
  targetChannels: body.target_channel ? [body.target_channel] : [],
  targetSlots: body.slot_names,
}).filter((spec) => !isSpecialRatio(spec.ratio));
```

- [ ] **Step 4: Pick the matching ratio asset before writing files**

Add a helper in `lib/export/utils.ts`:

```ts
export function findDirectExportImage(input: {
  images: Array<{ imageGroupId: string; filePath: string | null; imageConfigId: string }>;
  groupMap: Map<string, { aspectRatio: string | null }>;
  targetRatio: string;
}) {
  return input.images.find((image) => {
    const ratio = input.groupMap.get(image.imageGroupId)?.aspectRatio ?? "1:1";
    return classifyExportAdaptation(ratio, input.targetRatio) === "direct";
  }) ?? null;
}
```

Use it in the export loop so each selected slot exports exactly one matching asset from this card.

- [ ] **Step 5: Run the source test to verify it passes**

Run:

```bash
npm run test -- lib/__tests__/finalized-variants-source.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/projects/[id]/export/route.ts lib/export/utils.ts lib/__tests__/finalized-variants-source.test.ts
git commit -m "feat: export finalized assets by active card slots"
```

## Task 6: End-to-end verification

**Files:**
- Modify: none
- Test: `lib/__tests__/image-chat-source.test.ts`
- Test: `lib/__tests__/workflow-graph.test.ts`
- Test: `lib/__tests__/finalized-pool-card-source.test.ts`
- Test: `lib/__tests__/finalized-variants-source.test.ts`
- Test: `lib/__tests__/project-data.integration.test.ts`

- [ ] **Step 1: Run the focused automated suite**

Run:

```bash
npm run test -- lib/__tests__/image-chat-source.test.ts lib/__tests__/workflow-graph.test.ts lib/__tests__/finalized-pool-card-source.test.ts lib/__tests__/finalized-variants-source.test.ts lib/__tests__/project-data.integration.test.ts
```

Expected: PASS

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Manual verification checklist**

1. Open a project with two confirmed original images under the same copy.
2. Confirm the canvas shows two finalized cards, one per confirmed source image.
3. Open the first finalized card and verify no slot panels appear before choosing a channel.
4. Select `OPPO`; verify only `OPPO` slots appear and they are split into `可直接导出 / 需适配 / 暂不支持`.
5. Generate `16:9` from a `1:1` source using `即梦 5.0 Lite`; verify the created derived asset appears under the same finalized card.
6. Switch to `VIVO`; if `16:9` is required there too, verify the existing `16:9` asset is reused instead of regenerated.
7. Regenerate the derived `16:9` image; verify the asset is overwritten and still uses the original finalized source image as the reference.
8. Open “查看提示词” for both a candidate image and the derived image; verify reference images come from the persisted request snapshot instead of an invalid fallback label.
9. Generate an adaptation with `通义千问 2.0` from `9:16 -> 16:9`; verify the saved image really has `16:9` output dimensions.
10. Export two selected direct slots from one finalized card; verify only those selected slots are included in the ZIP.

- [ ] **Step 4: Commit verification notes if code changed during debugging**

```bash
git status --short
```

Expected: no unexpected files. If manual verification forced any code fixups, commit them with a specific message before handing off.

## Self-Review

- Spec coverage:
  - 独立定稿卡片: Task 2
  - 单渠道动态展开: Task 4
  - 比例资产跨渠道复用: Tasks 2, 4, 5
  - 重生成覆盖: Task 3 and Task 4
  - 适配模型白名单: Task 1
  - 即梦参考图 / 千问比例链路: Tasks 1 and 3
  - 提示词真实快照: Task 3 plus manual verification in Task 6
- Placeholder scan:
  - Plan contains no unfinished markers or deferred implementation notes
- Type consistency:
  - Plan standardizes on `sourceGroupId`, `targetChannel`, `slotNames`, `assets`, `FINALIZED_ADAPTATION_MODELS`
