# 提示词弹窗滚动 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the candidate prompt modal scrollable so long prompt content can be fully viewed and the reference-image section remains reachable on smaller viewports.

**Architecture:** Extend the shared `Modal` component with an optional scrollable content mode instead of building one-off scrolling logic inside the prompt modal. Then opt the prompt modal into that shared behavior and verify both the generic modal and the business modal source reflect the change.

**Tech Stack:** Next.js App Router, React 19, TypeScript, existing `Modal` component, node:test source-level tests.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `components/ui/modal.tsx` | Shared modal container; add scrollable content support |
| `components/cards/candidate-pool/prompt-details-modal.tsx` | Enable modal scrolling for prompt details |
| `lib/__tests__/pool-card-source.test.ts` | Assert prompt modal uses the scrollable modal path |

---

### Task 1: Add a failing source test for scrollable prompt modal behavior

**Files:**
- Modify: `lib/__tests__/pool-card-source.test.ts`

- [ ] **Step 1: Add failing assertions**

Extend `candidate pool prompt details modal shows prompt sections and copy actions` with:

```ts
  assert.match(source, /scrollable/);
  assert.match(source, /overflow-y-auto/);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm run test -- lib/__tests__/pool-card-source.test.ts
```

Expected: FAIL because neither `Modal` nor the prompt modal currently expose scrollable content behavior.

- [ ] **Step 3: Commit the red test**

```bash
git add lib/__tests__/pool-card-source.test.ts
git commit -m "test: cover prompt modal scroll behavior"
```

---

### Task 2: Implement scrollable shared modal support and opt in the prompt modal

**Files:**
- Modify: `components/ui/modal.tsx`
- Modify: `components/cards/candidate-pool/prompt-details-modal.tsx`
- Test: `lib/__tests__/pool-card-source.test.ts`

- [ ] **Step 1: Add `scrollable` support to the shared modal**

In `components/ui/modal.tsx`, extend the props with:

```ts
  scrollable?: boolean;
```

Then update the inner modal container and content area so when `scrollable` is true:

```tsx
      <div
        className="relative w-full max-w-xl rounded-[28px] border border-[var(--line-soft)] bg-[var(--surface-0)] p-6 shadow-[var(--shadow-elevated)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-2">
          <h2 id="modal-title" className="text-2xl font-semibold text-[var(--ink-950)]">
            {title}
          </h2>
          {description ? <p className="text-sm leading-7 text-[var(--ink-600)]">{description}</p> : null}
        </div>
        <div className={scrollable ? "mt-5 max-h-[70vh] overflow-y-auto pr-1" : "mt-5"}>
          {children}
        </div>
      </div>
```

Also add a viewport cap only when scrollable:

```tsx
        className={cn(
          "relative w-full max-w-xl rounded-[28px] border border-[var(--line-soft)] bg-[var(--surface-0)] p-6 shadow-[var(--shadow-elevated)]",
          scrollable && "max-h-[85vh]",
        )}
```

- [ ] **Step 2: Enable scrolling for the prompt modal**

In `components/cards/candidate-pool/prompt-details-modal.tsx`, pass the new prop:

```tsx
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="生图提示词"
      description="查看该候选图真实传入模型的提示词与参考信息。"
      scrollable
    >
```

- [ ] **Step 3: Run the focused test again**

Run:

```bash
npm run test -- lib/__tests__/pool-card-source.test.ts
```

Expected: PASS, including the new scrollability assertions.

- [ ] **Step 4: Commit the implementation**

```bash
git add components/ui/modal.tsx components/cards/candidate-pool/prompt-details-modal.tsx lib/__tests__/pool-card-source.test.ts
git commit -m "feat: add scrollable prompt modal content"
```

---

### Task 3: Verify and finish

**Files:**
- Modify: none unless verification uncovers issues

- [ ] **Step 1: Run focused verification**

Run:

```bash
npm run test -- lib/__tests__/pool-card-source.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run type checking**

Run:

```bash
npm run typecheck
```

Expected: PASS with no modal prop typing regressions.

- [ ] **Step 3: Manual verification**

Run:

```bash
npm run dev
```

Then verify:
- Open a prompt modal with long content and scroll to the reference-image section.
- The title remains visible at the top while content scrolls.
- The page background does not scroll instead of the modal content.

- [ ] **Step 4: Commit the verified state**

```bash
git add components/ui/modal.tsx components/cards/candidate-pool/prompt-details-modal.tsx lib/__tests__/pool-card-source.test.ts
git commit -m "fix: make prompt modal content scrollable"
```

---

## Self-Review

### Spec coverage

- Shared modal gets scrollable content support: covered in Task 2.
- Prompt modal opts into that shared behavior: covered in Task 2.
- Scroll verification for long content: covered in Task 3.

### Placeholder scan

- No `TODO`/`TBD` placeholders.
- Every task includes exact code targets and commands.

### Type consistency

- `scrollable` is defined once on `Modal` props and consumed from the prompt modal with the same name.

