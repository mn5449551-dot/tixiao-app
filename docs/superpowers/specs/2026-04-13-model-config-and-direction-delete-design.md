> Archived historical design note. This document records a past planning state and does not define the current implementation. Current behavior should be verified against `docs/agent-design/*` and the live code.

# 模型配置与方向卡删除功能设计

## Context

用户需要两个新功能：
1. **模型配置功能**：全局配置页面，允许用户为每个 AI agent 选择不同的模型，配置立即生效
2. **方向卡删除功能**：在方向卡头部添加删除整张卡的按钮，保留现有的下游检查逻辑

## 功能一：模型配置

### 1. 数据存储方案

使用 SQLite 数据库存储配置，而非环境变量。原因：
- Next.js 环境变量在运行时不可更新
- 数据库配置可立即生效，无需重启服务

**Schema 设计**（遵循现有 `lib/schema.ts` 模式）：

```typescript
// lib/schema.ts 新增
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
```

**配置键名**：
- `model_direction` - 方向生成 agent
- `model_copy` - 文案生成 agent
- `model_assistant` - 需求助手 agent
- `model_image_description` - 图片描述 agent
- `model_image_generation` - 图片生成 agent

### 2. 可选模型列表

**文本模型**（用于 direction、copy、assistant、image-description）：
- `deepseek-v3-2-251201`（默认）
- `gemini-3.1-pro-preview`
- `gpt-5.4`
- `doubao-seed-2-0-pro`

**图片模型**（用于 image-generation）：
- `gpt-image-1.5`（默认）
- `gemini-3-pro-image-preview`
- `gemini-3.1-flash-image-preview`

### 3. AI Client 改造

修改 `lib/ai/client.ts`，从数据库读取模型配置：

```typescript
// 新增 getSetting 函数
export async function getModelSetting(key: string, fallback: string): Promise<string> {
  const db = getDb();
  const setting = db.select().from(settings).where(eq(settings.key, key)).get();
  return setting?.value ?? fallback;
}

// 改造 createChatCompletion
export async function createChatCompletion(options: ChatCompletionOptions) {
  const model = options.model ?? await getModelSetting("model_direction", "deepseek-v3-2-251201");
  // ...
}

// 改造 createImageGeneration
export async function createImageGeneration(options: ImageGenerationOptions) {
  const model = options.model ?? await getModelSetting("model_image_generation", "gpt-image-1.5");
  // ...
}
```

**Agent 调用改造**：

每个 agent 需传入对应的配置键名：

| Agent | 配置键 | 默认模型 |
|-------|--------|----------|
| `direction-agent.ts` | `model_direction` | `deepseek-v3-2-251201` |
| `copy-agent.ts` | `model_copy` | `deepseek-v3-2-251201` |
| `assistant-agent.ts` | `model_assistant` | `deepseek-v3-2-251201` |
| `image-description-agent.ts` | `model_image_description` | `gemini-3.1-pro-preview` |
| `image-agent.ts` | `model_image_generation` | `gpt-image-1.5` |

### 4. API Routes

**GET `/api/settings`** - 获取所有模型配置
```typescript
// 返回格式
{
  model_direction: "deepseek-v3-2-251201",
  model_copy: "deepseek-v3-2-251201",
  model_assistant: "deepseek-v3-2-251201",
  model_image_description: "gemini-3.1-pro-preview",
  model_image_generation: "gpt-image-1.5"
}
```

**POST `/api/settings`** - 更新模型配置
```typescript
// 请求体
{
  key: "model_direction",
  value: "gpt-5.4"
}
```

### 5. Settings 页面 UI

**路由**：`app/settings/page.tsx`

**布局**：
- 页面标题：模型配置
- 分组展示：文本模型配置、图片模型配置
- 每个配置项：Label + Select 下拉框
- 保存按钮：保存所有配置变更

**首页入口**：
在 `app/page.tsx` 第 44-46 行的 `CreateProjectForm` 旁边添加设置按钮，使用 `Button` 组件 `variant="ghost"`，图标为齿轮图标，点击跳转 `/settings`。

## 功能二：方向卡删除

### 1. 删除逻辑

复用现有 `deleteDirection` 函数（`lib/project-data-modules-internal.ts` 第 701-721 行）：
- 检查是否存在下游 copy cards
- 若存在下游内容，抛出错误 "已有下游内容，不能删除"
- 删除关联的 image configs
- 删除 direction 记录

**新增批量删除函数**：

```typescript
// lib/project-data-modules-internal.ts
export async function deleteDirectionCard(projectId: string) {
  const db = getDb();
  const cardDirections = db
    .select()
    .from(directions)
    .where(eq(directions.projectId, projectId))
    .all();

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

### 2. UI 改造

**位置**：方向卡头部右侧，Badge 旁边（`components/cards/direction-card.tsx` 第 203-215 行）

**按钮样式**：
- 使用 `Button` 组件，`variant="ghost"`
- 图标：垃圾桶图标或 "删除" 文字
- 点击触发二次确认

**二次确认**：
```typescript
if (!confirm(`确定删除整张方向卡（包含 ${directions.length} 条方向）？`)) return;
```

**错误处理**：
- 若删除失败（存在下游内容），显示错误提示
- 使用现有的 `actionError` state 显示错误信息

### 3. API Route

**DELETE `/api/projects/[id]/directions`** - 删除项目的所有方向

```typescript
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const ok = await deleteDirectionCard(id);
    return Response.json({ success: ok });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 422 });
  }
}
```

## 文件修改清单

### 新增文件
- `app/settings/page.tsx` - 设置页面
- `app/api/settings/route.ts` - 设置 API
- `app/api/projects/[id]/directions/route.ts` - 方向卡删除 API（DELETE 方法）

### 修改文件
- `lib/schema.ts` - 新增 `settings` 表
- `lib/ai/client.ts` - 新增 `getModelSetting` 函数，改造 completion 函数
- `lib/ai/agents/direction-agent.ts` - 传入模型配置键
- `lib/ai/agents/copy-agent.ts` - 传入模型配置键
- `lib/ai/agents/assistant-agent.ts` - 传入模型配置键
- `lib/ai/agents/image-description-agent.ts` - 传入模型配置键
- `lib/ai/agents/image-agent.ts` - 传入模型配置键
- `lib/project-data-modules-internal.ts` - 新增 `deleteDirectionCard` 函数
- `lib/project-data.ts` - 导出 `deleteDirectionCard`
- `components/cards/direction-card.tsx` - 新增删除按钮
- `app/page.tsx` - 新增设置入口
- `drizzle/0003_settings.sql` - 数据库迁移（自动生成）

## 验证步骤

1. 运行 `npm run db:generate` 生成迁移
2. 运行 `npm run db:push` 应用迁移
3. 运行 `npm run dev` 启动开发服务器
4. 验证模型配置：
   - 访问 `/settings` 页面
   - 修改模型配置并保存
   - 创建新项目，生成方向，验证使用新模型
5. 验证方向卡删除：
   - 创建项目并生成方向
   - 点击删除按钮，确认二次确认弹窗
   - 验证删除成功
   - 生成文案后尝试删除，验证错误提示
