# Whole Codebase Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变任何业务行为的前提下，对全仓做分批等价重构，降低嵌套条件、重复 UI 逻辑和超长函数的理解成本。

**Architecture:** 先做“低风险、横向统一”的整理，再做“大文件拆分、职责收口”的结构性整理。每一批都限定在清晰边界内完成，并用现有源码测试、单测和 `typecheck` 做回归验证。

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, Node.js test runner

---

### Task 1: 第一批全仓可读性整理

**Files:**
- Modify: `components/workspace/agent-panel.tsx`
- Modify: `components/cards/direction-card.tsx`
- Modify: `components/workspace/candidate-pool-preview.tsx`
- Modify: `components/cards/image-config-card.tsx`
- Modify: `lib/ai/agents/image-description-agent.ts`
- Modify: `lib/project-data-modules-internal.ts`
- Modify: `app/api/images/[id]/route.ts`
- Verify: `lib/__tests__/agent-panel-source.test.ts`
- Verify: `lib/__tests__/direction-card-source.test.ts`
- Verify: `lib/__tests__/image-config-card-source.test.ts`
- Verify: `lib/__tests__/project-data-query-source.test.ts`
- Verify: `lib/__tests__/image-generation-routes-source.test.ts`
- Verify: `lib/__tests__/image-description-agent.test.ts`
- Verify: `lib/__tests__/copy-normalization.test.ts`

- [ ] **Step 1: 消除明显的嵌套三元表达式**

将重复出现的显示逻辑抽成命名函数，例如：
- 目标人群值转中文标签
- 图片形式值转中文标签
- 候选图组按 `slotCount` 选择网格列数
- 重绘时按扩展名推导 `mimeType`
- 文案默认 `copyType` 推导
- 多图 fallback prompt 中的角色文案推导

- [ ] **Step 2: 抽取重复但稳定的 UI/文案辅助函数**

把 `agent-panel.tsx` 中重复出现的需求摘要字段和推荐标题映射收口为小函数；把 `image-config-card.tsx` 中普通模式样式回填逻辑抽为单独 helper，避免在 `useState` 和 `useEffect` 中写两遍。

- [ ] **Step 3: 跑第一批验证**

Run:
```bash
npm run test lib/__tests__/agent-panel-source.test.ts lib/__tests__/direction-card-source.test.ts lib/__tests__/image-config-card-source.test.ts lib/__tests__/project-data-query-source.test.ts lib/__tests__/image-generation-routes-source.test.ts lib/__tests__/image-description-agent.test.ts lib/__tests__/copy-normalization.test.ts
npm run typecheck
```

Expected: PASS

---

### Task 2: Workspace / Canvas 模块整理

**Files:**
- Modify: `components/workspace/workflow-canvas-panel.tsx`
- Modify: `components/workspace/project-tree-panel.tsx`
- Modify: `components/workspace/workspace-shell.tsx`
- Modify: `lib/workspace-graph-sync.ts`
- Modify: `lib/hooks/use-generation-polling.ts`
- Verify: `lib/__tests__/workflow-canvas-source.test.ts`
- Verify: `lib/__tests__/workspace-graph-sync.test.ts`
- Verify: `lib/__tests__/workspace-shell-source.test.ts`

- [ ] **Step 1: 将轮询、错误解析、无效化刷新逻辑进一步拆分为命名 helper**
- [ ] **Step 2: 保持请求竞争控制和局部刷新行为完全不变**
- [ ] **Step 3: 跑相关源码测试和 `typecheck`**

---

### Task 3: 卡片组件批量整理

**Files:**
- Modify: `components/cards/candidate-pool-card.tsx`
- Modify: `components/cards/finalized-pool-card.tsx`
- Modify: `components/cards/copy-card.tsx`
- Modify: `components/cards/requirement-card.tsx`
- Modify: `components/inpaint/inpaint-modal.tsx`
- Verify: 对应 `*-source.test.ts` 和行为测试

- [ ] **Step 1: 合并重复状态文案、样式 class 和错误处理分支**
- [ ] **Step 2: 把长组件内的纯展示逻辑拆成同文件 helper 或邻近子组件**
- [ ] **Step 3: 保持 props 结构和外部行为不变并跑验证**

---

### Task 4: 数据层与 AI 模块结构整理

**Files:**
- Modify: `lib/project-data-modules-internal.ts`
- Modify: `lib/ai/agents/assistant-agent.ts`
- Modify: `lib/ai/agents/copy-agent.ts`
- Modify: `lib/ai/agents/direction-agent.ts`
- Modify: `lib/ai/agents/image-description-agent.ts`
- Modify: `lib/image-generation-service.ts`
- Verify: `lib/__tests__/project-data.integration.test.ts`
- Verify: `lib/__tests__/image-description-agent.test.ts`
- Verify: `lib/__tests__/generation-runs.test.ts`

- [ ] **Step 1: 优先抽出纯函数，减少 300-1000 行文件中的内联条件拼装**
- [ ] **Step 2: 仅在边界清晰时做文件级拆分，避免一次性重构过深**
- [ ] **Step 3: 每次只移动一个职责块并补回归验证**

---

### Task 5: API 路由统一整理

**Files:**
- Modify: `app/api/**/*.ts`
- Verify: `lib/__tests__/image-generation-routes-source.test.ts`
- Verify: `lib/__tests__/export-route-source.test.ts`
- Verify: `lib/__tests__/workspace-routes.test.ts`

- [ ] **Step 1: 统一参数解析、错误返回、资源清理和 response 构造风格**
- [ ] **Step 2: 复用现有 service / data helpers，避免路由内堆积业务逻辑**
- [ ] **Step 3: 跑相关源码测试和 `typecheck`**

---

### Completion Gate

- [ ] **Step 1: 跑全量验证**

Run:
```bash
npm run test
npm run typecheck
```

Expected: PASS

- [ ] **Step 2: 汇总仍然偏大的文件**

重点复查：
- `lib/project-data-modules-internal.ts`
- `lib/ai/agents/image-description-agent.ts`
- `components/inpaint/inpaint-modal.tsx`
- `components/cards/finalized-pool-card.tsx`

- [ ] **Step 3: 按模块分批提交**

建议提交粒度：
- `refactor: simplify display helpers and conditional branches`
- `refactor: streamline workspace polling and graph sync`
- `refactor: split card component display helpers`
- `refactor: extract pure helpers from data and ai modules`
