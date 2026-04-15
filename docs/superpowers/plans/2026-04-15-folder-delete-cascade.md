# 文件夹级联删除 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change folder deletion so deleting a folder permanently deletes all projects and project assets inside it instead of moving those projects to the uncategorized bucket.

**Architecture:** Reuse the existing `deleteProject()` workflow instead of duplicating project cleanup logic in the folder path. Make `deleteFolder()` async, delete each child project first, then delete the folder record, and update the folder-list confirmation copy to make the destructive scope explicit.

**Tech Stack:** Next.js App Router, TypeScript, SQLite/Drizzle, node:test integration/source tests, existing local storage cleanup helpers.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/project-data-modules-internal.ts` | Core folder/project deletion behavior; convert folder deletion into project-level cascade |
| `app/api/folders/[id]/route.ts` | Await async folder deletion and preserve API error propagation |
| `components/dashboard/folder-list.tsx` | Strong destructive confirmation copy for folder deletion |
| `lib/__tests__/project-data.integration.test.ts` | Integration coverage for folder cascade deleting DB records and project files |
| `lib/__tests__/homepage-source.test.ts` | Source-level coverage for updated folder deletion confirmation copy |

---

### Task 1: Add failing tests for folder cascade deletion and stronger confirmation copy

**Files:**
- Modify: `lib/__tests__/project-data.integration.test.ts`
- Modify: `lib/__tests__/homepage-source.test.ts`

- [ ] **Step 1: Add an integration test for folder deletion cascading through projects**

In `lib/__tests__/project-data.integration.test.ts`, extend the imports:

```ts
import {
  createProject,
  createFolder,
  deleteDirection,
  generateFinalizedVariants,
  getCanvasData,
  getProjectExportContext,
  getProjectById,
  saveImageConfig,
  upsertRequirement,
} from "../project-data";
import { projectFolders, projects, copies, directions, generatedImages, imageConfigs, imageGroups } from "../schema";
```

Then add this test after `deleteProject removes project-scoped image and export directories under .local-data storage`:

```ts
test("deleteFolder removes child projects and their project-scoped files instead of uncategorizing them", async () => {
  const folder = projectData.createFolder(`delete-folder-${Date.now()}`);
  assert.ok(folder);

  const projectA = createProject(`folder-project-a-${Date.now()}`, folder!.id);
  const projectB = createProject(`folder-project-b-${Date.now()}`, folder!.id);
  assert.ok(projectA);
  assert.ok(projectB);

  const storageRoot = getStorageRoot();
  const projectADirs = {
    image: path.join(storageRoot, "images", projectA!.id),
    export: path.join(storageRoot, "exports", projectA!.id),
  };
  const projectBDirs = {
    image: path.join(storageRoot, "images", projectB!.id),
    export: path.join(storageRoot, "exports", projectB!.id),
  };

  for (const dir of [projectADirs.image, projectADirs.export, projectBDirs.image, projectBDirs.export]) {
    await fs.mkdir(dir, { recursive: true });
  }

  await fs.writeFile(path.join(projectADirs.image, "img_demo.png"), "demo");
  await fs.writeFile(path.join(projectADirs.export, "export_demo.zip"), "demo");
  await fs.writeFile(path.join(projectBDirs.image, "img_demo.png"), "demo");
  await fs.writeFile(path.join(projectBDirs.export, "export_demo.zip"), "demo");

  await projectData.deleteFolder(folder!.id);

  const db = getDb();
  assert.equal(db.select().from(projectFolders).where(eq(projectFolders.id, folder!.id)).get(), undefined);
  assert.equal(db.select().from(projects).where(eq(projects.id, projectA!.id)).get(), undefined);
  assert.equal(db.select().from(projects).where(eq(projects.id, projectB!.id)).get(), undefined);
  assert.equal(fsSync.existsSync(projectADirs.image), false);
  assert.equal(fsSync.existsSync(projectADirs.export), false);
  assert.equal(fsSync.existsSync(projectBDirs.image), false);
  assert.equal(fsSync.existsSync(projectBDirs.export), false);
});
```

- [ ] **Step 2: Add a failing source test for the new folder confirmation copy**

In `lib/__tests__/homepage-source.test.ts`, add the folder list file handle:

```ts
const folderListPath = new URL("../../components/dashboard/folder-list.tsx", import.meta.url);
```

Then add this test:

```ts
test("folder list warns that deleting a folder permanently removes all child projects and assets", async () => {
  const source = await readFile(folderListPath, "utf8");

  assert.match(source, /永久删除该文件夹下的全部项目和素材/);
  assert.match(source, /无法恢复/);
  assert.doesNotMatch(source, /移到"未分类"/);
});
```

- [ ] **Step 3: Run the focused tests to verify they fail**

Run:

```bash
npm run test -- lib/__tests__/project-data.integration.test.ts lib/__tests__/homepage-source.test.ts
```

Expected:
- The new folder-delete integration test fails because `deleteFolder()` still uncategorizes projects instead of deleting them.
- The new source test fails because `folder-list.tsx` still says projects move to `未分类`.

- [ ] **Step 4: Commit the red tests**

```bash
git add lib/__tests__/project-data.integration.test.ts lib/__tests__/homepage-source.test.ts
git commit -m "test: cover folder cascade deletion behavior"
```

---

### Task 2: Implement async folder cascade deletion in project data and route layer

**Files:**
- Modify: `lib/project-data-modules-internal.ts`
- Modify: `app/api/folders/[id]/route.ts`
- Test: `lib/__tests__/project-data.integration.test.ts`

- [ ] **Step 1: Make `deleteFolder()` async and reuse `deleteProject()`**

In `lib/project-data-modules-internal.ts`, replace the current folder-delete implementation:

```ts
export function deleteFolder(folderId: string) {
  const db = getDb();
  // Move all projects in this folder to no folder
  db.update(projects)
    .set({ folderId: null, updatedAt: now() })
    .where(eq(projects.folderId, folderId))
    .run();
  db.delete(projectFolders).where(eq(projectFolders.id, folderId)).run();
}
```

with:

```ts
export async function deleteFolder(folderId: string) {
  const db = getDb();
  const projectsInFolder = db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.folderId, folderId))
    .all();

  for (const project of projectsInFolder) {
    await deleteProject(project.id);
  }

  db.delete(projectFolders).where(eq(projectFolders.id, folderId)).run();
}
```

Do not reimplement image/export directory cleanup here. The whole point is to keep folder deletion delegating to the existing project deletion path.

- [ ] **Step 2: Await folder deletion in the route**

In `app/api/folders/[id]/route.ts`, change:

```ts
    deleteFolder(id);
```

to:

```ts
    await deleteFolder(id);
```

The rest of the route stays the same so existing error handling and JSON response shape remain stable.

- [ ] **Step 3: Run the focused tests again**

Run:

```bash
npm run test -- lib/__tests__/project-data.integration.test.ts lib/__tests__/homepage-source.test.ts
```

Expected:
- The new integration test now passes on the data-layer behavior.
- The folder-copy source test still fails until the UI message is updated in the next task.

- [ ] **Step 4: Commit the backend cascade behavior**

```bash
git add lib/project-data-modules-internal.ts app/api/folders/[id]/route.ts lib/__tests__/project-data.integration.test.ts
git commit -m "feat: cascade folder deletion through child projects"
```

---

### Task 3: Update the folder deletion confirmation copy

**Files:**
- Modify: `components/dashboard/folder-list.tsx`
- Test: `lib/__tests__/homepage-source.test.ts`

- [ ] **Step 1: Replace the old “uncategorize” confirmation message**

In `components/dashboard/folder-list.tsx`, change:

```tsx
if (!confirm(`确定删除文件夹「${folder.name}」吗？文件夹内的项目会移到"未分类"。`)) return;
```

to:

```tsx
if (!confirm(`确定删除文件夹「${folder.name}」吗？会同时永久删除该文件夹下的全部项目和素材，无法恢复。`)) return;
```

Keep the rest of the click handler unchanged.

- [ ] **Step 2: Run the focused tests again**

Run:

```bash
npm run test -- lib/__tests__/project-data.integration.test.ts lib/__tests__/homepage-source.test.ts
```

Expected: PASS for both the integration test and the folder-copy source test.

- [ ] **Step 3: Commit the UI warning update**

```bash
git add components/dashboard/folder-list.tsx lib/__tests__/homepage-source.test.ts
git commit -m "feat: strengthen folder deletion warning copy"
```

---

### Task 4: Full verification and cleanup

**Files:**
- Modify: none unless verification uncovers issues
- Test: `lib/__tests__/project-data.integration.test.ts`
- Test: `lib/__tests__/homepage-source.test.ts`

- [ ] **Step 1: Run the focused regression checks**

Run:

```bash
npm run test -- lib/__tests__/project-data.integration.test.ts lib/__tests__/homepage-source.test.ts
```

Expected: PASS with the new folder-delete integration/source tests green.

- [ ] **Step 2: Run type checking**

Run:

```bash
npm run typecheck
```

Expected: PASS with no TypeScript regressions from making `deleteFolder()` async.

- [ ] **Step 3: Run the full test suite**

Run:

```bash
npm run test
```

Expected: PASS, confirming the folder deletion semantic change did not regress project/file cleanup elsewhere.

- [ ] **Step 4: Manual verification**

Run the app:

```bash
npm run dev
```

Then verify:
- Deleting an empty folder removes the folder cleanly.
- Deleting a folder with one project removes both the folder and the project.
- Deleting a folder with multiple projects removes all child projects.
- Deleted projects do not reappear under `未分类`.
- The confirmation dialog clearly states that all child projects and assets will be permanently removed.

- [ ] **Step 5: Commit the verified implementation state**

```bash
git add lib/project-data-modules-internal.ts app/api/folders/[id]/route.ts components/dashboard/folder-list.tsx
git add lib/__tests__/project-data.integration.test.ts lib/__tests__/homepage-source.test.ts
git commit -m "feat: cascade folder deletion through child projects and assets"
```

---

## Self-Review

### Spec coverage

- Folder deletion now permanently deletes child projects: covered in Task 2.
- Project files/assets are removed via reused `deleteProject()`: covered in Task 2 and the integration test from Task 1.
- Confirmation copy explicitly warns about permanent deletion: covered in Task 3.
- No “move to uncategorized” behavior remains: covered in Tasks 1 and 3.

### Placeholder scan

- No `TODO`/`TBD` placeholders.
- Each code change step includes concrete code and exact verification commands.

### Type consistency

- `deleteFolder()` is consistently treated as async in the data layer and route layer.
- Test names and assertions match the final destructive semantics rather than the old uncategorize behavior.

