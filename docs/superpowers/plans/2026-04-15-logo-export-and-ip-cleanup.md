# Logo 移至导出阶段 + IP 模式配置残留修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Logo 叠加从生图阶段移到导出阶段，并修复 IP 模式切回普通模式后 referenceImageUrl 未清理的 bug。

**Architecture:** 生成阶段不再调用 `applyFixedLogoOverlay`，改为在导出路由的 `writeExportImage` 调用中传入 `logoPath`。IP 残留修复在 `saveImageConfig` 中当 `styleMode === "normal"` 时强制清空 `ipRole` 和 `referenceImageUrl`。

**Tech Stack:** Next.js 16, Drizzle ORM, Sharp (图片处理), Node.js test runner

---

### Task 1: 移除生成阶段的 Logo 叠加

**Files:**
- Modify: `lib/image-generation-service.ts:299-306`
- Modify: `app/api/images/[id]/route.ts:293-300`

- [ ] **Step 1: 移除 image-generation-service.ts 中的 logo 叠加**

在 `lib/image-generation-service.ts` 中，将 logo 叠加逻辑替换为直接保存：

```typescript
// 替换前 (lines 300-306):
// let pngBuffer = await sharp(binary.buffer).png().toBuffer();
// if (item.groupLogo && item.groupLogo !== "none") {
//   pngBuffer = await applyFixedLogoOverlay({
//     buffer: pngBuffer,
//     logoPath: getLogoAssetPath(item.groupLogo as "onion" | "onion_app"),
//   });
// }

// 替换后:
let pngBuffer = await sharp(binary.buffer).png().toBuffer();
```

同时检查文件顶部的 import，移除不再使用的 `applyFixedLogoOverlay` 和 `getLogoAssetPath` 导入（如果该文件中不再有其他地方使用）。

- [ ] **Step 2: 移除单张重绘路由中的 logo 叠加**

在 `app/api/images/[id]/route.ts` 中，将 logo 叠加逻辑替换：

```typescript
// 替换前 (lines 293-300):
// let pngBuffer = await sharp(binary.buffer).png().toBuffer();
// const outputLogo = group?.logo ?? config.logo;
// if (outputLogo && outputLogo !== "none") {
//   pngBuffer = await applyFixedLogoOverlay({
//     buffer: pngBuffer,
//     logoPath: getLogoAssetPath(outputLogo as "onion" | "onion_app"),
//   });
// }

// 替换后:
let pngBuffer = await sharp(binary.buffer).png().toBuffer();
```

同样移除不再使用的 import。

- [ ] **Step 3: 运行 typecheck 验证**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/image-generation-service.ts app/api/images/[id]/route.ts
git commit -m "refactor: remove logo overlay from image generation phase"
```

---

### Task 2: 导出阶段添加 Logo 叠加

**Files:**
- Modify: `app/api/projects/[id]/export/route.ts:62-93`
- Modify: `lib/logo-assets.ts` (可能需要确认 `getLogoAssetPath` 导出)

- [ ] **Step 1: 在导出路由中传入 logoPath**

在 `app/api/projects/[id]/export/route.ts` 中，修改导出循环。在调用 `writeExportImage` 前，根据 config 的 logo 字段计算 logoPath：

```typescript
// 在文件顶部添加 import:
import { getLogoAssetPath } from "@/lib/logo-assets";

// 在 for 循环内，writeExportImage 调用之前添加:
const outputLogo = group?.logo ?? config?.logo;
const logoPath = outputLogo && outputLogo !== "none"
  ? getLogoAssetPath(outputLogo as "onion" | "onion_app")
  : null;
```

然后修改 `writeExportImage` 调用，加入 `logoPath`：

```typescript
await writeExportImage({
  sourcePath: image.filePath!,
  outputPath,
  format,
  targetWidth: slotSize?.width,
  targetHeight: slotSize?.height,
  adaptationMode: "direct",
  logoPath,
});
```

- [ ] **Step 2: 运行 typecheck 验证**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/api/projects/[id]/export/route.ts
git commit -m "feat: add logo overlay during export instead of generation"
```

---

### Task 3: 更新 UI 提示文案

**Files:**
- Modify: `components/cards/image-config/image-config-brand-section.tsx:76`

- [ ] **Step 1: 更新文案**

将：
```typescript
<p className="text-xs text-[var(--ink-400)]">（生成阶段会纳入画面，导出阶段不再重复叠加）</p>
```

改为：
```typescript
<p className="text-xs text-[var(--ink-400)]">（导出时叠加至图片固定位置）</p>
```

- [ ] **Step 2: Commit**

```bash
git add components/cards/image-config/image-config-brand-section.tsx
git commit -m "docs: update logo hint text to reflect export-phase overlay"
```

---

### Task 4: 修复 IP 模式切换时配置残留

**Files:**
- Modify: `lib/project-data-modules-internal.ts:996-1006`
- Test: `lib/__tests__/project-data.integration.test.ts`

- [ ] **Step 1: 写失败测试**

在 `lib/__tests__/project-data.integration.test.ts` 中添加测试用例：

```typescript
test("saveImageConfig clears ipRole and referenceImageUrl when switching to normal mode", async () => {
  const db = getDb();
  const timestamp = Date.now();

  // 创建项目、需求、方向、文案卡、文案
  db.insert(projects).values({
    id: "proj_ip_test", title: "IP Test", status: "active",
    folderId: null, createdAt: timestamp, updatedAt: timestamp,
  }).run();
  db.insert(requirementCards).values({
    id: "req_ip_test", projectId: "proj_ip_test", rawInput: null,
    businessGoal: "app", targetAudience: "parent", formatType: "image_text",
    feature: "拍题精学", sellingPoints: '["10秒出解析"]', timeNode: "期中考试",
    directionCount: 1, createdAt: timestamp, updatedAt: timestamp,
  }).run();
  db.insert(directions).values({
    id: "dir_ip_test", projectId: "proj_ip_test", requirementCardId: "req_ip_test",
    title: "方向IP", targetAudience: "家长", channel: "信息流（广点通）",
    imageForm: "single", copyGenerationCount: 1, imageTextRelation: "单图直给",
    sortOrder: 0, isSelected: 1, createdAt: timestamp, updatedAt: timestamp,
  }).run();
  db.insert(copyCards).values({
    id: "cc_ip_test", directionId: "dir_ip_test", channel: "信息流（广点通）",
    imageForm: "single", version: 1, sourceReason: "initial",
    createdAt: timestamp, updatedAt: timestamp,
  }).run();
  db.insert(copies).values({
    id: "copy_ip_test", copyCardId: "cc_ip_test", directionId: "dir_ip_test",
    titleMain: "主标题", titleSub: "副标题", copyType: "单图主副标题",
    variantIndex: 1, isLocked: 0, createdAt: timestamp, updatedAt: timestamp,
  }).run();

  // 1. 先保存为 IP 模式
  await saveImageConfig("copy_ip_test", {
    aspectRatio: "1:1",
    styleMode: "ip",
    ipRole: "onion_kid",
    logo: "onion",
    imageStyle: "realistic",
    createGroups: false,
  });

  const ipConfig = db.select().from(imageConfigs)
    .where(eq(imageConfigs.copyId, "copy_ip_test")).get();
  assert.ok(ipConfig);
  assert.equal(ipConfig.styleMode, "ip");
  assert.equal(ipConfig.ipRole, "onion_kid");

  // 2. 切换回普通模式
  await saveImageConfig("copy_ip_test", {
    styleMode: "normal",
    createGroups: false,
  });

  const normalConfig = db.select().from(imageConfigs)
    .where(eq(imageConfigs.copyId, "copy_ip_test")).get();
  assert.ok(normalConfig);
  assert.equal(normalConfig.styleMode, "normal");
  assert.equal(normalConfig.ipRole, null);
  assert.equal(normalConfig.referenceImageUrl, null);
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm run test lib/__tests__/project-data.integration.test.ts`
Expected: FAIL — `ipRole` is still "onion_kid" after switching to normal

- [ ] **Step 3: 修复 saveImageConfig**

在 `lib/project-data-modules-internal.ts` 的 `saveImageConfig` 函数中，在 `nextStyleMode` 计算之后添加清理逻辑：

```typescript
// 在 line 996 之后:
const nextStyleMode = input.styleMode ?? current?.styleMode ?? "normal";

// 添加以下清理逻辑:
const shouldClearIp = nextStyleMode === "normal";
const nextIpRole = shouldClearIp ? null : (input.ipRole ?? current?.ipRole ?? null);
```

同时修改 `resolveReferenceImageUrl` 调用，当 `shouldClearIp` 为 true 时直接传 null：

```typescript
const nextReferenceImageUrl = shouldClearIp ? null : await resolveReferenceImageUrl({
  styleMode: nextStyleMode,
  ipRole: nextIpRole,
  referenceImageUrl: input.referenceImageUrl !== undefined ? input.referenceImageUrl : (current?.referenceImageUrl ?? null),
});
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm run test lib/__tests__/project-data.integration.test.ts`
Expected: PASS

- [ ] **Step 5: 运行全部测试**

Run: `npm run test`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add lib/project-data-modules-internal.ts lib/__tests__/project-data.integration.test.ts
git commit -m "fix: clear ipRole and referenceImageUrl when switching to normal style mode"
```

---

## 验证

1. `npm run typecheck` — 通过
2. `npm run test` — 全部通过
3. 手动验证：创建项目 → 配置 IP 模式 → 生图 → 切回普通模式 → 生图 → 确认无 IP 特征残留
4. 手动验证：导出 zip → 确认图片带有 Logo 叠加
