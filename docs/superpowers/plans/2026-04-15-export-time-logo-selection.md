# 导出时统一选择 Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move logo selection out of image configuration and into the export flow so each export run applies one explicitly chosen logo (`onion` / `onion_app` / `none`) to all exported images.

**Architecture:** Stop treating logo as an image-generation configuration concern. Remove the logo selector and logo payload from the image-config UI/save path, add a single export-time logo selector in the finalized pool, pass that logo through `exportFinalizedImages()` to the export API, and have the export route ignore any stored `group.logo` / `config.logo` values.

**Tech Stack:** Next.js App Router, React 19, TypeScript, SQLite/Drizzle, node:test source tests, existing finalized-pool export flow.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `components/cards/image-config-card.tsx` | Remove logo-specific state and payload wiring from image configuration |
| `components/cards/image-config/image-config-brand-section.tsx` | Remove logo selection UI, keep only IP-related controls |
| `components/cards/image-config/image-config-actions.ts` | Stop sending logo in image-config save/generate requests |
| `app/api/copies/[id]/image-config/route.ts` | Stop accepting/persisting logo from the create-and-generate config route |
| `components/cards/finalized-pool-card.tsx` | Add export-time logo selector with default `none` |
| `components/cards/finalized-pool/finalized-pool-actions.ts` | Send selected export logo to the export API |
| `app/api/projects/[id]/export/route.ts` | Use only request-time `logo` when overlaying exported images |
| `lib/__tests__/image-config-brand-section-source.test.ts` | Assert logo UI is gone from image configuration |
| `lib/__tests__/export-route-source.test.ts` | Assert export route reads `body.logo` instead of stored config/group logo |
| `lib/__tests__/finalized-pool-source.test.ts` | New source test for export-time logo selector and payload |

---

### Task 1: Add failing tests for moving logo selection to export time

**Files:**
- Modify: `lib/__tests__/image-config-brand-section-source.test.ts`
- Modify: `lib/__tests__/export-route-source.test.ts`
- Create: `lib/__tests__/finalized-pool-source.test.ts`

- [ ] **Step 1: Add a failing test showing image-config brand section no longer owns logo UI**

In `lib/__tests__/image-config-brand-section-source.test.ts`, replace the current logo assertion with:

```ts
test("image config brand section no longer exposes logo selection and only manages IP controls", async () => {
  const source = await readFile(brandSectionPath, "utf8");

  assert.doesNotMatch(source, /LOGO_ASSET_OPTIONS/);
  assert.doesNotMatch(source, /Logo/);
  assert.match(source, /普通模式不可选，切换到 IP 风格后才可选择/);
  assert.match(source, /showIpAssetSelector \? \(/);
});
```

- [ ] **Step 2: Add a failing export-route source test for request-time logo**

In `lib/__tests__/export-route-source.test.ts`, extend the test with:

```ts
  assert.match(source, /logo\?:\s*"onion"\s*\|\s*"onion_app"\s*\|\s*"none"/);
  assert.match(source, /body\.logo/);
  assert.doesNotMatch(source, /group\?\.logo \?\? config\?\.logo/);
```

- [ ] **Step 3: Add a failing source test for finalized-pool export logo selection**

Create `lib/__tests__/finalized-pool-source.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const finalizedPoolCardPath = new URL("../../components/cards/finalized-pool-card.tsx", import.meta.url);
const finalizedActionsPath = new URL("../../components/cards/finalized-pool/finalized-pool-actions.ts", import.meta.url);

test("finalized pool chooses logo at export time and defaults to none", async () => {
  const [cardSource, actionsSource] = await Promise.all([
    readFile(finalizedPoolCardPath, "utf8"),
    readFile(finalizedActionsPath, "utf8"),
  ]);

  assert.match(cardSource, /exportLogo/);
  assert.match(cardSource, /value="none"|\"none\"/);
  assert.match(cardSource, /logo/i);
  assert.match(actionsSource, /logo:\s*input\.logo/);
});
```

- [ ] **Step 4: Run the focused tests to verify they fail**

Run:

```bash
npm run test -- lib/__tests__/image-config-brand-section-source.test.ts lib/__tests__/export-route-source.test.ts lib/__tests__/finalized-pool-source.test.ts
```

Expected:
- The image-config brand-section test fails because logo UI still exists.
- The export-route source test fails because the route still reads `group?.logo ?? config?.logo`.
- The finalized-pool source test fails because there is no export-time logo state yet.

- [ ] **Step 5: Commit the red tests**

```bash
git add lib/__tests__/image-config-brand-section-source.test.ts lib/__tests__/export-route-source.test.ts lib/__tests__/finalized-pool-source.test.ts
git commit -m "test: cover export-time logo selection"
```

---

### Task 2: Remove logo from the image-configuration flow

**Files:**
- Modify: `components/cards/image-config/image-config-brand-section.tsx`
- Modify: `components/cards/image-config-card.tsx`
- Modify: `components/cards/image-config/image-config-actions.ts`
- Modify: `app/api/copies/[id]/image-config/route.ts`
- Test: `lib/__tests__/image-config-brand-section-source.test.ts`

- [ ] **Step 1: Remove logo UI from the brand section**

In `components/cards/image-config/image-config-brand-section.tsx`:
- Delete the `LOGO_ASSET_OPTIONS` import
- Remove `useLogo`, `logoOption`, `onUseLogoChange`, `onLogoOptionChange` props
- Delete the whole “Logo” checkbox + card grid block
- Keep the IP section only

The props interface should become:

```ts
export function ImageConfigBrandSection({
  ipRole,
  isIpMode,
  showIpAssetSelector,
  activeIpDescription,
  onIpRoleChange,
}: {
  ipRole: string;
  isIpMode: boolean;
  showIpAssetSelector: boolean;
  activeIpDescription?: string;
  onIpRoleChange: (value: string) => void;
}) {
```

- [ ] **Step 2: Remove logo-specific state from `ImageConfigCard`**

In `components/cards/image-config-card.tsx`:
- Remove the `LOGO_OPTIONS` import
- Delete `useLogo` / `logoOption` state
- Delete the corresponding reset logic in `useEffect`
- Update the `ImageConfigBrandSection` usage to pass only IP-related props
- Remove `logo: useLogo ? logoOption : "none"` from the `saveImageConfigAndGenerate()` payload

The payload body should no longer include `logo`.

- [ ] **Step 3: Remove logo from the image-config action payload**

In `components/cards/image-config/image-config-actions.ts`:
- Delete `logo: string` from the function input type
- Remove `logo: input.logo` from the request body

- [ ] **Step 4: Stop accepting logo in the create-and-generate route**

In `app/api/copies/[id]/image-config/route.ts`:
- Remove `logo?: string` from the parsed request body type
- Remove `logo: body.logo` from the `saveImageConfig()` call

Do not attempt to backfill or clear old stored logo values in this task. The export route will stop reading them in the next task.

- [ ] **Step 5: Run the brand-section test**

Run:

```bash
npm run test -- lib/__tests__/image-config-brand-section-source.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the configuration-side removal**

```bash
git add components/cards/image-config/image-config-brand-section.tsx components/cards/image-config-card.tsx components/cards/image-config/image-config-actions.ts 'app/api/copies/[id]/image-config/route.ts' lib/__tests__/image-config-brand-section-source.test.ts
git commit -m "refactor: remove logo selection from image configuration"
```

---

### Task 3: Add export-time logo selection and ignore stored config/group logos

**Files:**
- Modify: `components/cards/finalized-pool-card.tsx`
- Modify: `components/cards/finalized-pool/finalized-pool-actions.ts`
- Modify: `app/api/projects/[id]/export/route.ts`
- Test: `lib/__tests__/export-route-source.test.ts`
- Test: `lib/__tests__/finalized-pool-source.test.ts`

- [ ] **Step 1: Add export-time logo state in finalized pool**

In `components/cards/finalized-pool-card.tsx`:
- Import `LOGO_ASSET_OPTIONS`
- Add:

```ts
  const [exportLogo, setExportLogo] = useState<"onion" | "onion_app" | "none">("none");
```

- Add a new UI block near export settings:

```tsx
      <div className="mb-3 rounded-[22px] bg-[var(--surface-1)] p-3">
        <Field label="导出 Logo">
          <Select value={exportLogo} onChange={(event) => setExportLogo(event.target.value as "onion" | "onion_app" | "none")}>
            <option value="none">不添加 Logo</option>
            {LOGO_ASSET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
```

- Pass `logo: exportLogo` into `exportFinalizedImages(...)`

- [ ] **Step 2: Extend export action payload**

In `components/cards/finalized-pool/finalized-pool-actions.ts`:
- Add to the input type:

```ts
  logo: "onion" | "onion_app" | "none";
```

- Add to the POST body:

```ts
        logo: input.logo,
```

- [ ] **Step 3: Make export route use only request-time logo**

In `app/api/projects/[id]/export/route.ts`:
- Extend the request body type with:

```ts
      logo?: "onion" | "onion_app" | "none";
```

- Replace:

```ts
        const outputLogo = group?.logo ?? config?.logo;
        const logoPath = outputLogo && outputLogo !== "none"
```

with:

```ts
        const logoPath = body.logo && body.logo !== "none"
          ? getLogoAssetPath(body.logo)
          : null;
```

After this change, export no longer reads stored config/group logo values at all.

- [ ] **Step 4: Run the export/logo focused tests**

Run:

```bash
npm run test -- lib/__tests__/export-route-source.test.ts lib/__tests__/finalized-pool-source.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the export-time logo flow**

```bash
git add components/cards/finalized-pool-card.tsx components/cards/finalized-pool/finalized-pool-actions.ts 'app/api/projects/[id]/export/route.ts' lib/__tests__/export-route-source.test.ts lib/__tests__/finalized-pool-source.test.ts
git commit -m "feat: choose logo at export time"
```

---

### Task 4: Verify and finish

**Files:**
- Modify: none unless verification finds issues

- [ ] **Step 1: Run the focused regression suite**

Run:

```bash
npm run test -- lib/__tests__/image-config-brand-section-source.test.ts lib/__tests__/export-route-source.test.ts lib/__tests__/finalized-pool-source.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run type checking**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run the full test suite**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 4: Manual verification**

Run:

```bash
npm run dev
```

Then verify:
- 图片配置界面不再出现 logo 选择。
- 定稿池导出区域出现统一的 logo 选择器，默认是 `不添加 Logo`。
- 导出时选择 `洋葱 Logo` / `洋葱 App Icon` / `不添加 Logo`，本次导出的全部图片都按该值叠加。
- 旧项目即使数据库里存了 `config.logo` / `group.logo`，导出时也不会影响这次选择。

- [ ] **Step 5: Commit the verified state**

```bash
git add components/cards/image-config/image-config-brand-section.tsx components/cards/image-config-card.tsx components/cards/image-config/image-config-actions.ts 'app/api/copies/[id]/image-config/route.ts'
git add components/cards/finalized-pool-card.tsx components/cards/finalized-pool/finalized-pool-actions.ts 'app/api/projects/[id]/export/route.ts'
git add lib/__tests__/image-config-brand-section-source.test.ts lib/__tests__/export-route-source.test.ts lib/__tests__/finalized-pool-source.test.ts
git commit -m "feat: move logo selection to export time"
```

---

## Self-Review

### Spec coverage

- Logo no longer selectable in image config: covered in Task 2.
- Export-time unified logo selection with default `none`: covered in Task 3.
- Export route ignores stored config/group logo values: covered in Task 3.

### Placeholder scan

- No `TODO`/`TBD` placeholders.
- Every task includes exact files, commands, and concrete code direction.

### Type consistency

- `logo` is consistently typed as `"onion" | "onion_app" | "none"` in export flow only.
- Image-config-side logo props and payloads are removed consistently across UI and API layers.

