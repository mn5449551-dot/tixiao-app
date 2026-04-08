# 工作区性能重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改功能的前提下，把项目页从整页大对象与整页刷新模式重构为按区域取数、按区域更新，让首屏更快、交互更顺、轮询更轻。

**Architecture:** 拆分 `getProjectWorkspace()` 的运行时职责，新增轻量 workspace 查询层与局部 API；项目页只渲染稳定壳层，左树、画布、助手分别按需取数；把 `router.refresh()` 为主的刷新方式改成局部失效和局部数据重拉，同时对重量组件做懒加载并修复导出链路 tracing warning。

**Tech Stack:** Next.js 16.2.2 (App Router), React 19, React Flow, SQLite + Drizzle ORM, TypeScript, Node test runner

---

### Task 1: 拆出工作区轻量查询函数

**Files:**
- Modify: `lib/project-data.ts`
- Create: `lib/__tests__/workspace-queries.test.ts`

- [ ] **Step 1: 写失败测试，锁定查询边界**

在 `lib/__tests__/workspace-queries.test.ts` 中新增：

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import {
  getWorkspaceHeader,
  getProjectTreeData,
  getCanvasData,
  getGenerationStatusData,
} from "@/lib/project-data";

test("workspace query helpers return scoped payloads", () => {
  const projectId = "proj_fixture";

  const header = getWorkspaceHeader(projectId);
  const tree = getProjectTreeData(projectId);
  const canvas = getCanvasData(projectId);
  const status = getGenerationStatusData(projectId);

  assert.ok(header === null || ("project" in header && !("directions" in header)));
  assert.ok(tree === null || Array.isArray(tree.directions));
  assert.ok(canvas === null || Array.isArray(canvas.nodes));
  assert.ok(status === null || Array.isArray(status.images));
});
```

- [ ] **Step 2: 运行测试，确认当前缺少实现**

Run: `npm test -- lib/__tests__/workspace-queries.test.ts`
Expected: FAIL with export or function-not-found errors

- [ ] **Step 3: 在 `lib/project-data.ts` 中新增轻量查询函数**

添加并导出以下函数，复用现有序列化逻辑，但避免返回完整 `workspace`：

```typescript
export function getWorkspaceHeader(projectId: string) {
  const project = getProjectById(projectId);
  if (!project) return null;

  return {
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
    },
  };
}

export function getProjectTreeData(projectId: string) {
  const project = getProjectById(projectId);
  if (!project) return null;

  const requirement = getRequirement(projectId);
  const directions = listDirections(projectId).map((direction) => ({
    id: direction.id,
    title: direction.title,
    copyCards: listCopyCards(direction.id).map((card) => ({
      id: card.id,
      version: card.version,
      copies: card.copies.map((copy) => {
        const imageConfig = db
          .select({ id: imageConfigs.id })
          .from(imageConfigs)
          .where(eq(imageConfigs.copyId, copy.id))
          .get();

        return {
          id: copy.id,
          variantIndex: copy.variantIndex,
          titleMain: copy.titleMain,
          imageConfigId: imageConfig?.id ?? null,
        };
      }),
    })),
  }));

  return {
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
    },
    requirement,
    directions,
  };
}
```

同时补齐：

```typescript
export function getCanvasData(projectId: string) {
  const workspace = getProjectWorkspace(projectId);
  if (!workspace) return null;

  const graph = buildGraph(workspace);
  return {
    projectId,
    nodes: graph.nodes,
    edges: graph.edges,
  };
}

export function getGenerationStatusData(projectId: string) {
  const workspace = getProjectWorkspace(projectId);
  if (!workspace) return null;

  const images = workspace.directions.flatMap((direction) =>
    direction.copyCards.flatMap((card) =>
      card.copies.flatMap((copy) =>
        copy.groups.flatMap((group) =>
          group.images.map((image) => ({
            id: image.id,
            imageConfigId: image.imageConfigId,
            fileUrl: image.fileUrl,
            status: image.status,
            errorMessage: image.errorMessage ?? null,
            updatedAt: image.updatedAt,
          })),
        ),
      ),
    ),
  );

  return { projectId, images };
}
```

- [ ] **Step 4: 跑测试确认新查询可用**

Run: `npm test -- lib/__tests__/workspace-queries.test.ts`
Expected: PASS

- [ ] **Step 5: 类型检查**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add lib/project-data.ts lib/__tests__/workspace-queries.test.ts
git commit -m "refactor: split workspace query helpers"
```

### Task 2: 为左树、画布、状态轮询补充局部 API

**Files:**
- Modify: `app/api/projects/[id]/route.ts`
- Create: `app/api/projects/[id]/tree/route.ts`
- Create: `app/api/projects/[id]/graph/route.ts`
- Create: `app/api/projects/[id]/generation-status/route.ts`
- Create: `lib/__tests__/workspace-routes.test.ts`

- [ ] **Step 1: 写失败测试，锁定 API 结构**

在 `lib/__tests__/workspace-routes.test.ts` 中新增对以下返回结构的断言：

```typescript
test("project tree route returns scoped tree payload", async () => {
  const response = await GET_TREE(new Request("http://localhost"), {
    params: Promise.resolve({ id: "missing" }),
  });

  assert.equal(response.status, 404);
});
```

并为 `graph`、`generation-status` 路由各写一个 404 基线测试。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- lib/__tests__/workspace-routes.test.ts`
Expected: FAIL with missing route imports or handlers

- [ ] **Step 3: 新增 tree/workspace/generation-status 路由**

分别实现：

```typescript
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const payload = getProjectTreeData(id);

  if (!payload) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  return NextResponse.json(payload);
}
```

`graph/route.ts` 返回 `getCanvasData(id)` 的结果，`generation-status/route.ts` 返回轻量图片状态。

- [ ] **Step 4: 收窄现有 `app/api/projects/[id]/route.ts`**

将当前 `GET /api/projects/[id]` 从返回整份 `workspace` 调整为返回 header 级别数据：

```typescript
const header = getWorkspaceHeader(id);
if (!header) {
  return NextResponse.json({ error: "项目不存在" }, { status: 404 });
}
return NextResponse.json(header);
```

- [ ] **Step 5: 跑路由测试**

Run: `npm test -- lib/__tests__/workspace-routes.test.ts`
Expected: PASS

- [ ] **Step 6: 类型检查**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add app/api/projects/[id]/route.ts app/api/projects/[id]/tree/route.ts app/api/projects/[id]/graph/route.ts app/api/projects/[id]/generation-status/route.ts lib/__tests__/workspace-routes.test.ts
git commit -m "feat: add scoped workspace api routes"
```

### Task 3: 重构项目页和工作区壳层的数据边界

**Files:**
- Modify: `app/projects/[id]/page.tsx`
- Modify: `components/workspace/workspace-shell.tsx`
- Create: `components/workspace/project-tree-panel.tsx`
- Create: `components/workspace/workflow-canvas-panel.tsx`
- Modify: `components/workspace/project-tree.tsx`
- Modify: `components/workspace/agent-panel.tsx`
- Create: `lib/__tests__/workspace-shell-source.test.ts` or update existing assertions

- [ ] **Step 1: 写失败测试，锁定壳层职责**

在现有源码断言测试中增加：

```typescript
assert.match(source, /getWorkspaceHeader/);
assert.doesNotMatch(source, /getProjectWorkspace/);
```

并对 `workspace-shell.tsx` 增加“不接受完整 directions 数据作为 props”的源码断言。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- lib/__tests__/workspace-shell-source.test.ts`
Expected: FAIL on old data boundary assertions

- [ ] **Step 3: 修改项目页，仅传 header 数据**

将页面改为：

```typescript
import { notFound } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { getWorkspaceHeader } from "@/lib/project-data";

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const header = getWorkspaceHeader(id);

  if (!header) {
    notFound();
  }

  return (
    <main className="flex h-screen flex-col">
      <WorkspaceShell project={header.project} />
    </main>
  );
}
```

- [ ] **Step 4: 将壳层改成纯布局容器**

`WorkspaceShell` 改为只接收：

```typescript
type WorkspaceShellProps = {
  project: {
    id: string;
    title: string;
    status: string;
  };
};
```

并在内部渲染：

```tsx
<ProjectTreePanel projectId={project.id} />
<WorkflowCanvasPanel projectId={project.id} />
<AgentPanel projectId={project.id} />
```

- [ ] **Step 5: 为左右栏和画布新增 panel 包装器**

三个 panel 分别负责：

- `ProjectTreePanel`: 拉取 `/api/projects/[id]/tree`
- `WorkflowCanvasPanel`: 拉取 `/api/projects/[id]/graph`
- `AgentPanel`: 改为只接收 `projectId`

取数可以先使用 `useEffect + fetch + local state`，不额外引入新库。

- [ ] **Step 6: 跑源码断言和类型检查**

Run: `npm test -- lib/__tests__/workspace-shell-source.test.ts`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add app/projects/[id]/page.tsx components/workspace/workspace-shell.tsx components/workspace/project-tree-panel.tsx components/workspace/workflow-canvas-panel.tsx components/workspace/project-tree.tsx components/workspace/agent-panel.tsx lib/__tests__/workspace-shell-source.test.ts
git commit -m "refactor: split workspace shell data boundaries"
```

### Task 4: 把整页刷新改成局部失效和局部轮询

**Files:**
- Create: `lib/workspace-events.ts`
- Modify: `lib/hooks/use-generation-polling.ts`
- Modify: `components/canvas/workflow-canvas.tsx`
- Modify: `components/workspace/project-tree-panel.tsx`
- Modify: `components/workspace/agent-panel.tsx`
- Modify: `components/cards/direction-card.tsx`
- Modify: `components/cards/copy-card.tsx`
- Modify: `components/cards/candidate-pool-card.tsx`
- Modify: `components/cards/finalized-pool-card.tsx`
- Modify: `components/cards/image-config-card.tsx`
- Modify: `components/cards/requirement-card.tsx`

- [ ] **Step 1: 写失败测试，锁定事件命名与轮询行为**

新增或更新测试，断言：

```typescript
assert.match(source, /workspace:canvas-invalidated/);
assert.match(source, /workspace:tree-invalidated/);
assert.doesNotMatch(source, /router\\.refresh\\(/);
```

对 `use-generation-polling.ts` 增加源码断言，不再直接调用 `router.refresh()`。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- lib/__tests__/workflow-canvas-source.test.ts lib/__tests__/workspace-shell-source.test.ts`
Expected: FAIL with old refresh model still present

- [ ] **Step 3: 新增统一事件工具**

在 `lib/workspace-events.ts` 中实现：

```typescript
export const WORKSPACE_CANVAS_INVALIDATED = "workspace:canvas-invalidated";
export const WORKSPACE_TREE_INVALIDATED = "workspace:tree-invalidated";

export function dispatchCanvasInvalidated() {
  window.dispatchEvent(new CustomEvent(WORKSPACE_CANVAS_INVALIDATED));
}

export function dispatchTreeInvalidated() {
  window.dispatchEvent(new CustomEvent(WORKSPACE_TREE_INVALIDATED));
}
```

- [ ] **Step 4: 将卡片组件中的 `canvas-refresh` 替换为显式局部失效**

规则：

- 只影响画布的操作，派发 `dispatchCanvasInvalidated()`
- 同时会改变左树结构或计数的操作，再额外派发 `dispatchTreeInvalidated()`

- [ ] **Step 5: 把画布轮询改成轻量状态轮询**

将 `useGenerationPolling` 改为接收：

```typescript
type GenerationPollingOptions = {
  projectId: string;
  enabled: boolean;
  onStatuses: (payload: GenerationStatusPayload) => void;
};
```

并改为轮询 `/api/projects/${projectId}/generation-status`，不再调用 `router.refresh()`。

- [ ] **Step 6: 在 panel 层监听失效事件并重拉局部数据**

`ProjectTreePanel` 和 `WorkflowCanvasPanel` 分别监听自己的 invalidation 事件，重新 fetch 局部 payload 并更新 state。

- [ ] **Step 7: 跑相关测试和类型检查**

Run: `npm test -- lib/__tests__/workflow-canvas-source.test.ts lib/__tests__/project-data.integration.test.ts`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add lib/workspace-events.ts lib/hooks/use-generation-polling.ts components/canvas/workflow-canvas.tsx components/workspace/project-tree-panel.tsx components/workspace/agent-panel.tsx components/cards/direction-card.tsx components/cards/copy-card.tsx components/cards/candidate-pool-card.tsx components/cards/finalized-pool-card.tsx components/cards/image-config-card.tsx components/cards/requirement-card.tsx
git commit -m "refactor: replace workspace full refresh with scoped invalidation"
```

### Task 5: 收敛画布渲染并增加懒加载边界

**Files:**
- Modify: `components/canvas/workflow-canvas.tsx`
- Modify: `components/workspace/workspace-shell.tsx`
- Modify: `components/inpaint/inpaint-modal.tsx`
- Modify: `components/ui/image-preview-modal.tsx`
- Create or update: `lib/__tests__/workflow-canvas-source.test.ts`

- [ ] **Step 1: 写失败测试，锁定懒加载与索引优化**

断言：

```typescript
assert.match(shellSource, /dynamic\\(/);
assert.match(canvasSource, /new Map\\(/);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- lib/__tests__/workflow-canvas-source.test.ts`
Expected: FAIL

- [ ] **Step 3: 在壳层增加懒加载**

将重量组件改为 `next/dynamic`：

```typescript
const WorkflowCanvasPanel = dynamic(
  () => import("@/components/workspace/workflow-canvas-panel").then((mod) => mod.WorkflowCanvasPanel),
  { ssr: false, loading: () => <div className="h-full animate-pulse bg-[var(--surface-1)]" /> },
);
```

对 `AgentPanel` 或其 panel 包装层也做同样处理。

- [ ] **Step 4: 在画布中用索引 map 替代重复查找**

示例：

```typescript
const nodeMap = useMemo(
  () => new Map(canvasNodes.map((node) => [node.id, node])),
  [canvasNodes],
);

const edges = useMemo(
  () =>
    canvasEdges.filter((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      return source && target && getNodeTier(source) <= maxVisibleTier && getNodeTier(target) <= maxVisibleTier;
    }),
  [canvasEdges, nodeMap, maxVisibleTier],
);
```

- [ ] **Step 5: 跑测试和类型检查**

Run: `npm test -- lib/__tests__/workflow-canvas-source.test.ts`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add components/canvas/workflow-canvas.tsx components/workspace/workspace-shell.tsx components/inpaint/inpaint-modal.tsx components/ui/image-preview-modal.tsx lib/__tests__/workflow-canvas-source.test.ts
git commit -m "perf: lazy load workspace panels and tighten canvas rendering"
```

### Task 6: 修复导出链路 tracing warning 并做最终回归

**Files:**
- Modify: `app/api/projects/[id]/export/route.ts`
- Modify: `lib/export/utils.ts`
- Modify: `lib/storage.ts`
- Modify: `lib/db.ts` if needed for static path scoping
- Create or update: `lib/__tests__/export-route.integration.test.ts`

- [ ] **Step 1: 写失败测试或更新现有集成测试**

确保导出接口现有行为仍然成立，并补一个路径构造的最小断言。

- [ ] **Step 2: 运行测试建立基线**

Run: `npm test -- lib/__tests__/export-route.integration.test.ts`
Expected: PASS or FAIL only if current test gaps require update

- [ ] **Step 3: 收窄文件系统路径构造**

优先把类似以下代码改为静态子目录约束：

```typescript
const exportRoot = path.join(process.cwd(), "storage", "exports");
```

避免把 `process.cwd()` 与动态路径直接拼到项目根随机子路径。

- [ ] **Step 4: 跑最终验证**

Run: `npm test`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

Run: `npm run build`
Expected: PASS with no new type/build errors and tracing warning removed or narrowed

- [ ] **Step 5: 提交**

```bash
git add app/api/projects/[id]/export/route.ts lib/export/utils.ts lib/storage.ts lib/db.ts lib/__tests__/export-route.integration.test.ts
git commit -m "perf: tighten export tracing and verify workspace refactor"
```
