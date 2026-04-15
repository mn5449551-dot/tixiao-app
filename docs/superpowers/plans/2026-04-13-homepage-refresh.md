> Archived historical implementation plan. This file is kept as process history and does not define the current implementation. Current behavior should be verified against `docs/agent-design/*` and the live code.

# Homepage Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the homepage so it keeps the warm brand look while simplifying the layout, moving project creation into a modal, and reducing list noise.

**Architecture:** Keep the existing App Router homepage and dashboard components, add one lightweight shared modal component, and adjust the homepage composition plus dashboard copy. Cover the changed behaviors with source tests first because the current test suite already guards component structure through file-content assertions.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4 utilities, node:test source tests

---

### Task 1: Lock The New Homepage Contract With Failing Source Tests

**Files:**
- Modify: `lib/__tests__/create-project-form-source.test.ts`
- Create: `lib/__tests__/homepage-source.test.ts`
- Test: `npm run test -- lib/__tests__/create-project-form-source.test.ts lib/__tests__/homepage-source.test.ts`

- [ ] **Step 1: Write the failing create-project form source assertions**

```ts
test("create project form opens a modal and keeps local validation inside the submit handler", async () => {
  const source = await readFile(createProjectFormPath, "utf8");

  assert.match(source, /const \[isOpen, setIsOpen\] = useState\(false\)/);
  assert.match(source, /<Modal[\s\S]*title="新建项目"/);
  assert.match(source, /输入项目名称后即可进入工作台继续编辑/);
  assert.match(source, /placeholder="例如：Q2-期中冲刺拍题精学"/);
  assert.match(source, /const trimmedTitle = title\.trim\(\)/);
  assert.match(source, /setError\("项目标题不能为空"\)/);
  assert.match(source, /onClick=\{\(\) => setIsOpen\(true\)\}/);
  assert.match(source, /onClose=\{handleClose\}/);
});
```

- [ ] **Step 2: Write the failing homepage source assertions**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const homePagePath = new URL("../../app/page.tsx", import.meta.url);
const projectListPath = new URL("../../components/dashboard/project-list.tsx", import.meta.url);

test("homepage hero copy is rewritten for the operator-facing workbench", async () => {
  const source = await readFile(homePagePath, "utf8");

  assert.match(source, /AI 图文生产工作台/);
  assert.match(source, /集中管理您的 AI 图文创作项目与素材资产。/);
  assert.match(source, /方向卡总数/);
  assert.match(source, /文案卡总数/);
  assert.doesNotMatch(source, /已接入本地 SQLite/);
});

test("project list uses textual enter action and hover-softened delete action", async () => {
  const source = await readFile(projectListPath, "utf8");

  assert.match(source, /进入 >/);
  assert.match(source, /group-hover:opacity-100/);
  assert.doesNotMatch(source, /flex h-8 w-8 items-center justify-center rounded-full/);
});
```

- [ ] **Step 3: Run the targeted tests to verify they fail for the expected reasons**

Run:

```bash
npm run test -- lib/__tests__/create-project-form-source.test.ts lib/__tests__/homepage-source.test.ts
```

Expected:

```text
FAIL create-project-form-source.test.ts
FAIL homepage-source.test.ts
```

- [ ] **Step 4: Commit the red test state**

```bash
git add lib/__tests__/create-project-form-source.test.ts lib/__tests__/homepage-source.test.ts
git commit -m "test(home): capture refreshed homepage contract"
```

### Task 2: Add A Lightweight Shared Modal And Move Project Creation Into It

**Files:**
- Create: `components/ui/modal.tsx`
- Modify: `components/dashboard/create-project-form.tsx`
- Test: `npm run test -- lib/__tests__/create-project-form-source.test.ts`

- [ ] **Step 1: Implement the lightweight shared modal**

```tsx
"use client";

import { useEffect, useState, type PropsWithChildren } from "react";
import { createPortal } from "react-dom";

export function Modal({
  children,
  description,
  isOpen,
  onClose,
  title,
}: PropsWithChildren<{
  description?: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}>) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={onClose}>
      <div className="absolute inset-0 bg-[rgba(28,25,23,0.42)] backdrop-blur-sm" />
      <div className="relative w-full max-w-xl rounded-[28px] border border-[var(--line-soft)] bg-[var(--surface-0)] p-6 shadow-[var(--shadow-elevated)]" onClick={(event) => event.stopPropagation()}>
        <div className="space-y-2">
          <h2 id="modal-title" className="text-2xl font-semibold text-[var(--ink-950)]">{title}</h2>
          {description ? <p className="text-sm text-[var(--ink-600)]">{description}</p> : null}
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: Rewrite `CreateProjectForm` as trigger button plus modal form**

```tsx
const [isOpen, setIsOpen] = useState(false);

const handleClose = () => {
  setIsOpen(false);
  setTitle("");
  setError(null);
};

const handleSubmit = () => {
  const trimmedTitle = title.trim();

  if (!trimmedTitle) {
    setError("项目标题不能为空");
    return;
  }

  startTransition(async () => {
    setError(null);

    try {
      const payload = await apiFetch<{ id?: string }>("/api/projects", {
        method: "POST",
        body: { title: trimmedTitle },
      });

      if (!payload?.id) {
        setError("新建项目失败");
        return;
      }

      handleClose();
      router.push(`/projects/${payload.id}`);
      router.refresh();
    } catch (error) {
      setError(error instanceof ApiError ? error.message : "新建项目失败");
    }
  });
};
```

```tsx
return (
  <>
    <Button size="lg" onClick={() => setIsOpen(true)} className="w-full justify-center lg:w-auto">
      ＋ 新建项目
    </Button>

    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="新建项目"
      description="输入项目名称后即可进入工作台继续编辑。"
    >
      <div className="space-y-4">
        <Input
          autoFocus
          placeholder="例如：Q2-期中冲刺拍题精学"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error) setError(null);
          }}
        />
        {error ? <div className="rounded-2xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-700)]">{error}</div> : null}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>取消</Button>
          <Button disabled={isPending} onClick={handleSubmit}>
            {isPending ? "创建中..." : "创建项目"}
          </Button>
        </div>
      </div>
    </Modal>
  </>
);
```

- [ ] **Step 3: Run the focused test to verify the modal contract now passes**

Run:

```bash
npm run test -- lib/__tests__/create-project-form-source.test.ts
```

Expected:

```text
ok create-project-form-source.test.ts
```

- [ ] **Step 4: Commit the modal-based create flow**

```bash
git add components/ui/modal.tsx components/dashboard/create-project-form.tsx lib/__tests__/create-project-form-source.test.ts
git commit -m "feat(home): move project creation into modal"
```

### Task 3: Refresh Homepage Composition And List Presentation

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/dashboard/project-list.tsx`
- Modify: `lib/__tests__/homepage-source.test.ts`
- Test: `npm run test -- lib/__tests__/homepage-source.test.ts`

- [ ] **Step 1: Update the homepage hero and metric cards**

```tsx
const metrics = [
  { label: "项目总数", value: projects.length, accent: "from-[var(--brand-200)] to-[var(--brand-50)]" },
  { label: "活跃项目", value: activeProjects, accent: "from-[var(--accent-300)] to-[var(--brand-50)]" },
  { label: "方向卡总数", value: totalDirections, accent: "from-[var(--brand-300)] to-[var(--surface-0)]" },
  { label: "文案卡总数", value: totalCopyCards, accent: "from-[var(--accent-300)] to-[var(--surface-0)]" },
];
```

```tsx
<section className="relative overflow-hidden rounded-[36px] border border-[var(--line-soft)] bg-white/82 px-8 py-8 shadow-[var(--shadow-panel)] lg:flex lg:items-center lg:justify-between lg:px-10">
  <div className="space-y-4">
    <Badge tone="brand" size="sm">图文提效工作台</Badge>
    <div className="space-y-3">
      <h1 className="text-4xl font-semibold tracking-tight text-[var(--ink-950)] lg:text-5xl">AI 图文生产工作台</h1>
      <p className="max-w-2xl text-base leading-8 text-[var(--ink-600)]">集中管理您的 AI 图文创作项目与素材资产。</p>
    </div>
  </div>
  <div className="mt-6 lg:mt-0 lg:shrink-0">
    <CreateProjectForm />
  </div>
</section>
```

- [ ] **Step 2: Simplify metric card copy and remove hint text**

```tsx
{metrics.map((metric) => (
  <Card className="relative overflow-hidden bg-white/92 px-6 py-5">
    <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-br ${metric.accent} opacity-60`} />
    <div className="relative">
      <p className="text-3xl font-semibold tracking-tight text-[var(--ink-950)]">{metric.value}</p>
      <p className="mt-2 text-sm text-[var(--ink-500)]">{metric.label}</p>
    </div>
  </Card>
))}
```

- [ ] **Step 3: Rework the project list row hierarchy and actions**

```tsx
{projects.map((project, index) => (
  <div
    key={project.id}
    className="group flex flex-col gap-4 rounded-[26px] border border-[var(--line-soft)] bg-white/92 px-5 py-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--line-brand)] hover:shadow-[var(--shadow-card-hover)] md:flex-row md:items-center md:justify-between"
    style={{ animationDelay: `${index * 50}ms` }}
  >
    <Link href={`/projects/${project.id}`} className="min-w-0 flex-1">
      <div className="flex items-center gap-3">
        <h3 className="truncate text-xl font-semibold text-[var(--ink-950)]">{project.title}</h3>
        <Badge tone={project.status === "draft" ? "neutral" : "brand"} size="sm">{project.status === "draft" ? "草稿" : "进行中"}</Badge>
      </div>
      <p className="mt-2 text-sm text-[var(--ink-500)]">图文 · 方向 {project.directionCount} 条 · 文案 {project.copyCardCount} 条</p>
    </Link>
    <div className="flex items-center gap-3 self-end md:self-center">
      <span className="text-xs text-[var(--ink-400)]">{formatRelativeDate(project.updatedAt)}</span>
      <Button className="opacity-35 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" variant="ghost" size="sm">删除</Button>
      <Link href={`/projects/${project.id}`} className="rounded-full border border-[var(--line-medium)] px-4 py-2 text-sm text-[var(--ink-700)] transition-colors hover:border-[var(--brand-300)] hover:text-[var(--brand-700)]">进入 &gt;</Link>
    </div>
  </div>
))}
```

- [ ] **Step 4: Run the homepage source test to verify the new structure passes**

Run:

```bash
npm run test -- lib/__tests__/homepage-source.test.ts
```

Expected:

```text
ok homepage-source.test.ts
```

- [ ] **Step 5: Commit the homepage presentation refresh**

```bash
git add app/page.tsx components/dashboard/project-list.tsx lib/__tests__/homepage-source.test.ts
git commit -m "feat(home): simplify homepage layout"
```

### Task 4: Full Verification For The Homepage Refresh

**Files:**
- Modify: `components/dashboard/create-project-form.tsx` (only if verification exposes issues)
- Modify: `components/dashboard/project-list.tsx` (only if verification exposes issues)
- Modify: `app/page.tsx` (only if verification exposes issues)
- Test: `npm run test -- lib/__tests__/create-project-form-source.test.ts lib/__tests__/homepage-source.test.ts && npm run lint && npm run typecheck`

- [ ] **Step 1: Run the targeted source tests together**

Run:

```bash
npm run test -- lib/__tests__/create-project-form-source.test.ts lib/__tests__/homepage-source.test.ts
```

Expected:

```text
ok create-project-form-source.test.ts
ok homepage-source.test.ts
```

- [ ] **Step 2: Run lint across the app**

Run:

```bash
npm run lint
```

Expected:

```text
exit code 0
```

- [ ] **Step 3: Run type-checking**

Run:

```bash
npm run typecheck
```

Expected:

```text
exit code 0
```

- [ ] **Step 4: Commit the verified homepage refresh**

```bash
git add app/page.tsx components/dashboard/create-project-form.tsx components/dashboard/project-list.tsx components/ui/modal.tsx lib/__tests__/create-project-form-source.test.ts lib/__tests__/homepage-source.test.ts
git commit -m "feat(home): refresh homepage layout"
```
