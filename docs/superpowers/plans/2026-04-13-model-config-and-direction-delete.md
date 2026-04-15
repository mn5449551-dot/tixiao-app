> Archived historical implementation plan. This file is kept as process history and does not define the current implementation. Current behavior should be verified against `docs/agent-design/*` and the live code.

# 模型配置与方向卡删除功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现模型配置页面（全局配置各 agent 使用的模型）和方向卡删除功能（删除整张方向卡，保留下游检查逻辑）

**Architecture:** 使用 SQLite settings 表存储模型配置，改造 AI client 从数据库读取配置；新增 deleteDirectionCard 函数批量删除方向，在方向卡 UI 添加删除按钮

**Tech Stack:** Next.js 16 App Router, SQLite + Drizzle ORM, React Flow

---

## File Structure

### 新增文件
- `lib/project-data-modules/settings-operations.ts` - settings 读写操作
- `app/api/settings/route.ts` - settings API (GET/POST)
- `app/api/projects/[id]/directions-card/route.ts` - 方向卡删除 API (DELETE)
- `app/settings/page.tsx` - 设置页面 UI

### 修改文件
- `lib/schema.ts` - 新增 settings 表
- `lib/project-data.ts` - 导出 settings 操作和 deleteDirectionCard
- `lib/ai/client.ts` - 新增 getModelSetting，改造 completion 函数接受 modelKey 参数
- `lib/ai/agents/direction-agent.ts` - 传入 modelKey
- `lib/ai/agents/copy-agent.ts` - 传入 modelKey
- `lib/ai/agents/assistant-agent.ts` - 传入 modelKey
- `lib/ai/agents/image-description-agent.ts` - 传入 modelKey
- `lib/ai/agents/image-agent.ts` - 传入 modelKey
- `lib/project-data-modules-internal.ts` - 新增 deleteDirectionCard 函数
- `components/cards/direction-card.tsx` - 新增删除按钮
- `app/page.tsx` - 新增设置入口

---

## Task 1: 添加 settings 表到 schema

**Files:**
- Modify: `lib/schema.ts` (末尾追加)

- [ ] **Step 1: 在 schema.ts 末尾添加 settings 表定义**

```typescript
// 在 lib/schema.ts 末尾追加（第 217 行之后）

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
```

- [ ] **Step 2: 运行 typecheck 验证类型正确**

Run: `npm run typecheck`
Expected: 无类型错误

- [ ] **Step 3: 生成数据库迁移**

Run: `npm run db:generate`
Expected: 生成新的迁移文件（如 `drizzle/0003_*.sql`）

- [ ] **Step 4: 应用迁移到数据库**

Run: `npm run db:push`
Expected: 迁移成功，settings 表创建

- [ ] **Step 5: Commit**

```bash
git add lib/schema.ts drizzle/
git commit -m "feat: add settings table for model configuration"
```

---

## Task 2: 创建 settings 操作模块

**Files:**
- Create: `lib/project-data-modules/settings-operations.ts`
- Modify: `lib/project-data.ts` (导出 settings 操作)

- [ ] **Step 1: 创建 settings-operations.ts**

```typescript
// lib/project-data-modules/settings-operations.ts

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/schema";

const DEFAULT_MODEL_SETTINGS = {
  model_direction: "deepseek-v3-2-251201",
  model_copy: "deepseek-v3-2-251201",
  model_assistant: "deepseek-v3-2-251201",
  model_image_description: "gemini-3.1-pro-preview",
  model_image_generation: "gpt-image-1.5",
};

export type ModelSettingKey = keyof typeof DEFAULT_MODEL_SETTINGS;

export function getSetting(key: string): string | null {
  const db = getDb();
  const setting = db.select().from(settings).where(eq(settings.key, key)).get();
  return setting?.value ?? null;
}

export function getModelSetting(key: ModelSettingKey): string {
  return getSetting(key) ?? DEFAULT_MODEL_SETTINGS[key];
}

export function getAllModelSettings(): Record<ModelSettingKey, string> {
  const db = getDb();
  const storedSettings = db.select().from(settings).all();

  const result: Record<ModelSettingKey, string> = { ...DEFAULT_MODEL_SETTINGS };
  for (const setting of storedSettings) {
    if (setting.key in DEFAULT_MODEL_SETTINGS) {
      result[setting.key as ModelSettingKey] = setting.value;
    }
  }
  return result;
}

export function upsertSetting(key: string, value: string): boolean {
  const db = getDb();
  const now = Date.now();
  const existing = db.select().from(settings).where(eq(settings.key, key)).get();

  if (existing) {
    return db
      .update(settings)
      .set({ value, updatedAt: now })
      .where(eq(settings.key, key))
      .run().changes > 0;
  } else {
    return db
      .insert(settings)
      .values({ key, value, updatedAt: now })
      .run().changes > 0;
  }
}
```

- [ ] **Step 2: 在 project-data.ts 导出 settings 操作**

```typescript
// 在 lib/project-data.ts 末尾追加

export {
  getSetting,
  getModelSetting,
  getAllModelSettings,
  upsertSetting,
  type ModelSettingKey,
} from "@/lib/project-data-modules/settings-operations";
```

- [ ] **Step 3: 运行 typecheck 验证**

Run: `npm run typecheck`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add lib/project-data-modules/settings-operations.ts lib/project-data.ts
git commit -m "feat: add settings operations module"
```

---

## Task 3: 创建 settings API route

**Files:**
- Create: `app/api/settings/route.ts`

- [ ] **Step 1: 创建 settings API route**

```typescript
// app/api/settings/route.ts

import { NextResponse } from "next/server";

import { getAllModelSettings, upsertSetting, type ModelSettingKey } from "@/lib/project-data";

const VALID_MODEL_KEYS: ModelSettingKey[] = [
  "model_direction",
  "model_copy",
  "model_assistant",
  "model_image_description",
  "model_image_generation",
];

export async function GET() {
  const settings = getAllModelSettings();
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { key?: string; value?: string };

  if (!body.key || !body.value) {
    return NextResponse.json({ error: "缺少 key 或 value" }, { status: 400 });
  }

  if (!VALID_MODEL_KEYS.includes(body.key as ModelSettingKey)) {
    return NextResponse.json({ error: "无效的配置键" }, { status: 400 });
  }

  const ok = upsertSetting(body.key, body.value);
  if (!ok) {
    return NextResponse.json({ error: "保存失败" }, { status: 500 });
  }

  const settings = getAllModelSettings();
  return NextResponse.json({ settings });
}
```

- [ ] **Step 2: 运行 typecheck 验证**

Run: `npm run typecheck`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add app/api/settings/route.ts
git commit -m "feat: add settings API route"
```

---

## Task 4: 改造 AI client 支持模型配置

**Files:**
- Modify: `lib/ai/client.ts`

- [ ] **Step 1: 导入 getModelSetting 并改造 createChatCompletion**

```typescript
// lib/ai/client.ts - 修改导入和函数签名

import { getModelSetting, type ModelSettingKey } from "@/lib/project-data";

const DEFAULT_BASE_URL = process.env.NEW_API_BASE_URL ?? "https://ops-ai-gateway.yc345.tv";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionOptions = {
  model?: string;
  modelKey?: ModelSettingKey; // 新增：配置键名
  messages: ChatMessage[];
  temperature?: number;
  responseFormat?: { type: "json_object" };
};

export async function createChatCompletion(options: ChatCompletionOptions) {
  const apiKey = process.env.NEW_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 NEW_API_KEY，无法调用文本模型");
  }

  // 优先使用传入的 model，其次从数据库读取配置，最后使用默认值
  const model = options.model ?? (options.modelKey ? getModelSetting(options.modelKey) : "deepseek-v3-2-251201");

  const response = await fetch(`${DEFAULT_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      response_format: options.responseFormat,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`文本模型调用失败: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return payload.choices?.[0]?.message?.content ?? "";
}
```

- [ ] **Step 2: 改造 createMultimodalChatCompletion**

```typescript
// lib/ai/client.ts - 修改 MultimodalChatCompletionOptions 和函数

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type MultimodalChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
};

type MultimodalChatCompletionOptions = {
  model?: string;
  modelKey?: ModelSettingKey; // 新增
  messages: MultimodalChatMessage[];
  temperature?: number;
  responseFormat?: { type: "json_object" };
};

export async function createMultimodalChatCompletion(options: MultimodalChatCompletionOptions) {
  const apiKey = process.env.NEW_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 NEW_API_KEY，无法调用文本模型");
  }

  const model = options.model ?? (options.modelKey ? getModelSetting(options.modelKey) : "deepseek-v3-2-251201");

  const response = await fetch(`${DEFAULT_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      response_format: options.responseFormat,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`文本模型调用失败: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return payload.choices?.[0]?.message?.content ?? "";
}
```

- [ ] **Step 3: 改造 createImageGeneration**

```typescript
// lib/ai/client.ts - 修改 ImageGenerationOptions 和函数

type ImageGenerationOptions = {
  model?: string;
  modelKey?: ModelSettingKey; // 新增
  prompt: string;
  size?: string;
  n?: number;
};

export async function createImageGeneration(options: ImageGenerationOptions) {
  const apiKey = process.env.NEW_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 NEW_API_KEY，无法调用图片模型");
  }

  const model = options.model ?? (options.modelKey ? getModelSetting(options.modelKey) : "gpt-image-1.5");

  const response = await fetch(`${DEFAULT_BASE_URL}/v1/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: options.prompt,
      size: options.size ?? "1024x1024",
      n: options.n ?? 1,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`图片模型调用失败: ${response.status} ${text}`);
  }

  return response.json();
}
```

- [ ] **Step 4: 运行 typecheck 验证**

Run: `npm run typecheck`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git add lib/ai/client.ts
git commit -m "feat: add modelKey parameter to AI client functions"
```

---

## Task 5: 改造 agents 传入 modelKey

**Files:**
- Modify: `lib/ai/agents/direction-agent.ts`
- Modify: `lib/ai/agents/copy-agent.ts`
- Modify: `lib/ai/agents/assistant-agent.ts`
- Modify: `lib/ai/agents/image-description-agent.ts`
- Modify: `lib/ai/agents/image-agent.ts`

- [ ] **Step 1: 改造 direction-agent.ts**

```typescript
// lib/ai/agents/direction-agent.ts - 修改 generateDirectionIdeas 函数调用

// 第 96-100 行，修改 createChatCompletion 调用
export async function generateDirectionIdeas(input: DirectionAgentInput) {
  const messages = buildDirectionAgentMessages(input);

  const content = await createChatCompletion({
    modelKey: "model_direction", // 新增
    messages,
    temperature: 0.8,
    responseFormat: { type: "json_object" },
  });

  return JSON.parse(content) as DirectionAgentOutput;
}
```

- [ ] **Step 2: 改造 copy-agent.ts**

```typescript
// lib/ai/agents/copy-agent.ts - 修改 generateCopyIdeas 函数调用

// 第 105-114 行，修改 createChatCompletion 调用
export async function generateCopyIdeas(input: CopyAgentInput) {
  const messages = buildCopyAgentMessages(input);

  const content = await createChatCompletion({
    modelKey: "model_copy", // 新增
    messages,
    temperature: 0.8,
    responseFormat: { type: "json_object" },
  });

  return JSON.parse(content) as CopyAgentOutput;
}
```

- [ ] **Step 3: 改造 assistant-agent.ts**

```typescript
// lib/ai/agents/assistant-agent.ts - 修改 runRequirementAssistant 函数调用

// 第 109-113 行，修改 createChatCompletion 调用
export async function runRequirementAssistant(input: AssistantAgentInput): Promise<AssistantAgentResult> {
  try {
    const raw = await createChatCompletion({
      modelKey: "model_assistant", // 新增
      messages: buildRequirementAssistantMessages(input),
      temperature: 0.4,
      responseFormat: { type: "json_object" },
    });
    // ... 后续代码不变
```

- [ ] **Step 4: 改造 image-description-agent.ts**

```typescript
// lib/ai/agents/image-description-agent.ts - 修改 generateSlotImagePrompt 函数调用

// 第 887-894 行，修改 createMultimodalChatCompletion 调用
export async function generateSlotImagePrompt(input: {
  sharedBase: SharedBaseContext;
  slot: SlotSpecificContext;
}) {
  try {
    const content = await createMultimodalChatCompletion({
      modelKey: "model_image_description", // 新增
      messages: buildSlotImageDescriptionMessages(input),
    });
    return normalizeSlotPromptPayload(input, { finalPrompt: content });
  } catch {
    return normalizeSlotPromptPayload(input);
  }
}
```

- [ ] **Step 5: 改造 image-agent.ts**

```typescript
// lib/ai/agents/image-agent.ts - 修改 generateImages 函数调用

// 第 3-5 行，修改 createImageGeneration 调用
import { createImageGeneration } from "@/lib/ai/client";

export async function generateImages(prompt: string, count: number) {
  return createImageGeneration({
    modelKey: "model_image_generation", // 新增
    prompt,
    n: count,
  });
}
```

- [ ] **Step 6: 运行 typecheck 验证**

Run: `npm run typecheck`
Expected: 无类型错误

- [ ] **Step 7: Commit**

```bash
git add lib/ai/agents/
git commit -m "feat: pass modelKey to AI agents for configurable models"
```

---

## Task 6: 创建设置页面 UI

**Files:**
- Create: `app/settings/page.tsx`

- [ ] **Step 1: 创建设置页面**

```typescript
// app/settings/page.tsx

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";

type ModelSettings = {
  model_direction: string;
  model_copy: string;
  model_assistant: string;
  model_image_description: string;
  model_image_generation: string;
};

const TEXT_MODEL_OPTIONS = [
  { value: "deepseek-v3-2-251201", label: "DeepSeek V3" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
  { value: "gpt-5.4", label: "GPT-5.4" },
  { value: "doubao-seed-2-0-pro", label: "Doubao Seed 2.0 Pro" },
];

const IMAGE_MODEL_OPTIONS = [
  { value: "gpt-image-1.5", label: "GPT Image 1.5" },
  { value: "gemini-3-pro-image-preview", label: "Gemini 3 Pro Image" },
  { value: "gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash Image" },
];

const MODEL_CONFIG_LABELS: Record<keyof ModelSettings, string> = {
  model_direction: "方向生成模型",
  model_copy: "文案生成模型",
  model_assistant: "需求助手模型",
  model_image_description: "图片描述模型",
  model_image_generation: "图片生成模型",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<ModelSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data.settings);
        setIsLoading(false);
      })
      .catch(() => {
        setSaveError("加载配置失败");
        setIsLoading(false);
      });
  }, []);

  const handleChange = useCallback((key: keyof ModelSettings, value: string) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
    setSaveSuccess(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!settings) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "model_direction", value: settings.model_direction }),
      });
      if (!res.ok) throw new Error("保存失败");

      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "model_copy", value: settings.model_copy }),
      });
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "model_assistant", value: settings.model_assistant }),
      });
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "model_image_description", value: settings.model_image_description }),
      });
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "model_image_generation", value: settings.model_image_generation }),
      });

      setSaveSuccess(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[800px] flex-col gap-8 px-8 py-10">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[var(--brand-200)] border-t-[var(--brand-500)]" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[800px] flex-col gap-8 px-8 py-10">
      <section className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge tone="brand" size="sm">系统设置</Badge>
          <h1 className="text-2xl font-semibold text-[var(--ink-950)]">模型配置</h1>
        </div>
        <Link href="/">
          <Button variant="ghost" size="sm">返回首页</Button>
        </Link>
      </section>

      {saveError && (
        <div className="rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-700)]">
          {saveError}
        </div>
      )}

      {saveSuccess && (
        <div className="rounded-xl bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success-700)]">
          配置已保存，后续生成将使用新模型
        </div>
      )}

      <Card className="space-y-6 p-6">
        <div>
          <h2 className="mb-4 text-lg font-medium text-[var(--ink-900)]">文本模型配置</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {(["model_direction", "model_copy", "model_assistant", "model_image_description"] as const).map((key) => (
              <Field key={key} label={MODEL_CONFIG_LABELS[key]}>
                <Select
                  value={settings?.[key] ?? ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                >
                  {TEXT_MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        </div>

        <div className="h-px bg-[var(--line-soft)]" />

        <div>
          <h2 className="mb-4 text-lg font-medium text-[var(--ink-900)]">图片模型配置</h2>
          <Field label={MODEL_CONFIG_LABELS.model_image_generation}>
            <Select
              value={settings?.model_image_generation ?? ""}
              onChange={(e) => handleChange("model_image_generation", e.target.value)}
            >
              {IMAGE_MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            重置
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "保存中..." : "保存配置"}
          </Button>
        </div>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: 运行 typecheck 验证**

Run: `npm run typecheck`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add app/settings/page.tsx
git commit -m "feat: add settings page for model configuration"
```

---

## Task 7: 在首页添加设置入口

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: 在首页添加设置按钮**

```typescript
// app/page.tsx - 在第 1 行添加 Link 导入，在第 44-46 行区域添加设置按钮

// 第 1 行，添加导入
import Link from "next/link";

// 第 44-46 行区域，修改为：
        <div className="relative z-10 mt-6 animate-scale-in stagger-4 lg:mt-0 lg:shrink-0 lg:flex lg:items-center lg:gap-3">
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              设置
            </Button>
          </Link>
          <CreateProjectForm />
        </div>
```

- [ ] **Step 2: 运行 typecheck 验证**

Run: `npm run typecheck`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add settings entry on homepage"
```

---

## Task 8: 新增 deleteDirectionCard 函数

**Files:**
- Modify: `lib/project-data-modules-internal.ts`
- Modify: `lib/project-data-modules/direction-operations.ts`
- Modify: `lib/project-data.ts`

- [ ] **Step 1: 在 project-data-modules-internal.ts 添加 deleteDirectionCard 函数**

```typescript
// lib/project-data-modules-internal.ts - 在 deleteDirection 函数之后添加（约第 721 行之后）

export async function deleteDirectionCard(projectId: string) {
  const db = getDb();
  const cardDirections = db
    .select()
    .from(directions)
    .where(eq(directions.projectId, projectId))
    .all();

  if (cardDirections.length === 0) {
    return false;
  }

  // 检查是否有任何方向存在下游内容
  for (const direction of cardDirections) {
    const downstreamCards = db
      .select({ id: copyCards.id })
      .from(copyCards)
      .where(eq(copyCards.directionId, direction.id))
      .all();

    if (downstreamCards.length > 0) {
      throw new Error("已有下游内容，不能删除方向卡");
    }
  }

  // 删除所有方向及其关联配置
  for (const direction of cardDirections) {
    for (const configId of listDirectionImageConfigIds(direction.id)) {
      await deleteImageConfigCascade(configId);
    }
    db.delete(directions).where(eq(directions.id, direction.id)).run();
  }

  return true;
}
```

- [ ] **Step 2: 在 direction-operations.ts 导出 deleteDirectionCard**

```typescript
// lib/project-data-modules/direction-operations.ts - 修改导出

export {
  generateDirectionsSmart,
  appendDirectionSmart,
  updateDirection,
  deleteDirection,
  deleteDirectionCard, // 新增
} from "@/lib/project-data-modules-internal";
```

- [ ] **Step 3: 在 project-data.ts 导出 deleteDirectionCard**

```typescript
// lib/project-data.ts - 在 direction-operations 导出区域添加

export {
  generateDirectionsSmart,
  appendDirectionSmart,
  updateDirection,
  deleteDirection,
  deleteDirectionCard, // 新增
} from "@/lib/project-data-modules/direction-operations";
```

- [ ] **Step 4: 运行 typecheck 验证**

Run: `npm run typecheck`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git add lib/project-data-modules-internal.ts lib/project-data-modules/direction-operations.ts lib/project-data.ts
git commit -m "feat: add deleteDirectionCard function"
```

---

## Task 9: 创建方向卡删除 API route

**Files:**
- Create: `app/api/projects/[id]/directions-card/route.ts`

- [ ] **Step 1: 创建方向卡删除 API route**

```typescript
// app/api/projects/[id]/directions-card/route.ts

import { NextResponse } from "next/server";

import { deleteDirectionCard } from "@/lib/project-data";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const ok = await deleteDirectionCard(id);
    if (!ok) {
      return NextResponse.json({ error: "方向卡不存在" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除失败";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
```

- [ ] **Step 2: 运行 typecheck 验证**

Run: `npm run typecheck`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add app/api/projects/[id]/directions-card/route.ts
git commit -m "feat: add directions-card DELETE API route"
```

---

## Task 10: 在方向卡添加删除按钮

**Files:**
- Modify: `components/cards/direction-card.tsx`
- Create: `components/cards/direction-card/direction-card-delete-action.ts` (可选，如需分离 action)

- [ ] **Step 1: 在 direction-card.tsx 添加删除按钮**

```typescript
// components/cards/direction-card.tsx - 在第 14 行导入区域添加

import {
  appendDirectionGeneration,
  deleteDirectionItem,
  deleteDirectionCardAction, // 新增
  generateSelectedDirections,
  saveDirectionItem,
} from "@/components/cards/direction-card/direction-card-actions";

// 在第 203-215 行的 header 区域，修改为：
        <div className="flex items-center gap-1.5">
          <Badge tone="brand" size="sm">方向</Badge>
          {isDone && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--success-500)] text-[9px] text-white">
              ✓
            </span>
          )}
          {isError && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--danger-500)] text-[9px] text-white">
              ✕
            </span>
          )}
          {/* 新增删除按钮 */}
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 text-[var(--danger-600)] hover:text-[var(--danger-700)] hover:bg-[var(--danger-soft)]"
            onClick={async () => {
              if (!data.projectId) return;
              if (!confirm(`确定删除整张方向卡（包含 ${directions.length} 条方向）？`)) return;
              try {
                setActionError(null);
                const ok = await deleteDirectionCardAction(data.projectId);
                if (!ok) {
                  throw new Error("删除方向卡失败");
                }
                dispatchWorkspaceInvalidated();
              } catch (error) {
                setActionError(error instanceof Error ? error.message : "删除方向卡失败");
              }
            }}
          >
            删除
          </Button>
        </div>
```

- [ ] **Step 2: 在 direction-card-actions.ts 添加 deleteDirectionCardAction**

```typescript
// components/cards/direction-card/direction-card-actions.ts - 添加新函数

export async function deleteDirectionCardAction(projectId: string): Promise<boolean> {
  const res = await fetch(`/api/projects/${projectId}/directions-card`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? "删除失败");
  }

  const data = (await res.json()) as { success?: boolean };
  return data.success ?? false;
}
```

- [ ] **Step 3: 运行 typecheck 验证**

Run: `npm run typecheck`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add components/cards/direction-card.tsx components/cards/direction-card/direction-card-actions.ts
git commit -m "feat: add delete button to direction card"
```

---

## Task 11: 验证功能

- [ ] **Step 1: 启动开发服务器**

Run: `npm run dev`
Expected: 服务器启动成功

- [ ] **Step 2: 验证模型配置功能**

1. 访问 `http://localhost:3000/settings`
2. 确认页面加载，显示当前模型配置
3. 修改模型配置，点击保存
4. 确认保存成功提示
5. 创建新项目，生成方向，观察是否使用新模型（可通过日志或响应时间判断）

- [ ] **Step 3: 验证方向卡删除功能**

1. 创建新项目，填写需求卡，生成方向
2. 在方向卡头部找到删除按钮
3. 点击删除，确认二次确认弹窗显示正确数量
4. 确认删除，验证方向卡消失
5. 创建新项目，生成方向后生成文案
6. 尝试删除方向卡，验证错误提示 "已有下游内容，不能删除方向卡"

- [ ] **Step 4: 运行测试**

Run: `npm run test`
Expected: 所有测试通过

- [ ] **Step 5: 运行 typecheck**

Run: `npm run typecheck`
Expected: 无类型错误

- [ ] **Step 6: 最终 Commit**

```bash
git add -A
git commit -m "feat: complete model configuration and direction card delete features"
```
