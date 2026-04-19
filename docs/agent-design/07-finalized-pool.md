# 定稿池 (Finalized Pool) 设计文档

## 概述

定稿池是洋葱学园素材生产工作流中的最后环节，负责管理从候选图池确认的图片素材，并提供适配版本生成和多渠道导出能力。

## 在工作流中的位置

```
需求卡 → 方向卡 → 文案卡 → 图片配置 → 候选图池 → 定稿池 → 导出
                                              ↑选定稿    ↑适配/导出
```

定稿池节点通过 React Flow 图中的边连接到对应的图片配置节点，每个图片配置（`imageConfig`）对应一个独立的定稿池节点。

## 数据模型

### 核心表：`imageGroups`

定稿池不使用独立表，而是复用 `imageGroups` 表，通过 `isConfirmed` 和 `groupType` 字段区分状态：

| 字段 | 类型 | 说明 |
|------|------|------|
| `isConfirmed` | integer (0/1) | 是否已定稿 |
| `groupType` | text | 分组类型标识 |
| `variantIndex` | integer | 变体序号 |
| `slotCount` | integer | 槽位数量（1=单图，2=双图，3=三图） |
| `aspectRatio` | text | 画幅比例 |
| `imageConfigId` | text | 所属图片配置 ID |

### groupType 取值

| 值 | 含义 |
|----|------|
| `"candidate"` | 候选组，未定稿 |
| `"finalized"` | 原始定稿组 |
| `"derived\|{groupId}\|{ratio}"` | 适配版本，从原始定稿组派生 |

例如 `"derived|grp_abc123|16:9"` 表示从 `grp_abc123` 定稿组派生的 16:9 适配版本。

### 关联表：`generatedImages`

每张实际图片存储在 `generatedImages` 表，通过 `imageGroupId` 关联到分组：

| 关键字段 | 说明 |
|----------|------|
| `imageGroupId` | 所属分组 |
| `imageConfigId` | 所属图片配置 |
| `filePath` | 图片文件路径 |
| `fileUrl` | 图片访问 URL |
| `status` | 状态：pending/generating/done/failed |
| `slotIndex` | 槽位序号（多图时区分第几张） |
| `inpaintParentId` | 局部重绘的父图片 ID |

## 状态流转

### 候选 → 定稿

```
候选图池 "选定稿" → PUT /api/image-groups/{id} { confirmed: true }
                     → isConfirmed = 1, groupType = "finalized"
                     → 定稿池节点自动出现（有已定稿组时才渲染）
```

### 定稿 → 候选

```
候选图池 "取消定稿" → PUT /api/image-groups/{id} { confirmed: false }
                      → isConfirmed = 0, groupType = "candidate"
                      → 若无其他已定稿组，定稿池节点消失
```

## 定稿池节点构建

### 触发条件

`buildFinalizedPoolNode()` 在满足以下条件时生成节点：

1. 文案（copy）有关联的图片配置（`imageConfig`）
2. 配置下存在 `isConfirmed = 1` 的分组
3. 分组中有 `status = "done"` 的图片
4. 排除派生分组（`groupType` 以 `"derived|"` 开头），派生分组在生成适配版本时才创建

### 节点数据结构

```typescript
type FinalizedPoolCardData = {
  displayMode: "single" | "double" | "triple";  // 根据 slotCount 决定
  groups: FinalizedGroup[];
  groupLabel?: string;       // 如 "5 张已定稿" 或 "3 套已定稿"
  projectId?: string;        // 用于适配版本生成和导出
};

type FinalizedGroup = {
  id: string;
  variantIndex: number;
  slotCount: number;
  groupType?: string;        // "finalized" 或 "derived|...|..."
  images: FinalizedImage[];
};

type FinalizedImage = {
  id: string;
  fileUrl: string | null;
  aspectRatio: string;
  groupLabel?: string;       // "组 #1" 或 "适配 16:9"
  isConfirmed: boolean;
  updatedAt?: number;
};
```

### 图布局

- 节点位置：`x: 2320, y: configY`（位于候选图池右侧）
- 节点 ID：`finalized-{configId}`
- 宽度：480px

## 适配版本生成

### 触发路径

```
定稿池 UI → "生成适配版本" → generateFinalizedVariants()
         → POST /api/projects/{id}/finalized/variants
         → generateFinalizedVariants()（lib/project-data-modules-internal.ts）
```

### 生成逻辑

1. 遍历项目下所有方向的文案和图片配置
2. 筛选已定稿且非派生的分组（可按 `targetGroupIds` 过滤）
3. 对每个定稿组，按目标投放版位的比例逐一处理：
   - **direct**（比例相同）：跳过，不生成
   - **transform/postprocess**（比例不同）：创建派生分组并生成适配图片

### 派生分组创建

```typescript
// 分组类型命名规则
groupType = `derived|${sourceGroupId}|${targetRatio}`;

// 示例
groupType = "derived|grp_abc123|9:16";
```

### 图片适配方式

使用 Sharp 库对原始图片进行 resize：

| 适配模式 | resize fit | 说明 |
|----------|-----------|------|
| `direct` | 不处理 | 源比例与目标比例相同 |
| `transform` | `cover` | 居中裁切填充 |
| `postprocess` | `contain` | 保持完整内容，留白填充（适用于 16:11、√2:1 等特殊比例） |

### 特殊比例判断

```typescript
function classifyExportAdaptation(sourceRatio, targetRatio) {
  if (sourceRatio === targetRatio) return "direct";
  if (targetRatio === "16:11" || targetRatio === "√2:1") return "postprocess";
  return "transform";
}
```

## 导出流程

### 触发路径

```
定稿池 UI → "确认导出" → exportFinalizedImages()
         → POST /api/projects/{id}/export
         → 导出路由处理
```

### 导出步骤

1. **获取导出上下文** — `getProjectExportContext()`
   - 筛选已定稿分组（可按 `targetGroupIds` 过滤）
   - 只包含有实际文件路径的图片

2. **解析投放版位** — `resolveExportSlotSpecs()`
   - 根据选中的渠道和版位名过滤 `EXPORT_SLOT_SPECS`
   - 每个版位有固定的比例和尺寸要求

3. **生成导出图片** — 遍历版位 × 图片
   - 对每张图片按目标版位尺寸和适配模式处理
   - 输出到临时目录

4. **打包 ZIP** — `zipAndCleanupDirectory()`
   - 将导出目录压缩为 ZIP
   - 清理临时目录

5. **记录导出** — 写入 `exportRecords` 表

6. **返回下载** — 以 `application/zip` 格式返回 ZIP 文件

### 文件命名规则

默认规则 `channel_slot_date_version`：

```
{项目名}_{渠道}_{版位名}_{日期}_{版本号}.{格式}
```

示例：`洋葱学园_OPPO_富媒体-横版大图_20260415_v01.jpg`

### 支持的导出格式

| 格式 | 说明 |
|------|------|
| JPG | 默认格式，适合信息流投放 |
| PNG | 无损格式 |
| WEBP | 高压缩比格式 |

## 投放渠道与版位

### 渠道列表

OPPO、VIVO、小米、荣耀

### 版位规格（EXPORT_SLOT_SPECS）

| 渠道 | 版位名称 | 比例 | 尺寸 | 最大体积 |
|------|----------|------|------|----------|
| OPPO | 富媒体-横版大图 | 16:9 | 1280×720 | <150 KB |
| OPPO | 富媒体-横版两图 | 9:16 | 474×768 | <150 KB |
| OPPO | 竞价 banner | 16:9 | 1280×720 | <150 KB |
| VIVO | 搜索-首位-三图 | 9:16 | 1080×1920 | <150 KB |
| VIVO | 搜索富媒体-单图文 | √2:1 | 202×142 | <50 KB |
| VIVO | 搜索富媒体-三图 | 3:2 | 320×211 | <80 KB |
| VIVO | 顶部 banner | 16:11 | 720×498 | <150 KB |
| 小米 | 搜索-大图 | 16:9 | 960×540 | <500 KB |
| 小米 | 搜索-二图 | 16:9 | 960×540 | <500 KB |
| 小米 | 搜索-横版三图 | 16:9 | 960×540 | <500 KB |
| 小米 | 搜索-搜索三图 | 1:1 | 320×320 | <300 KB |
| 小米 | 富媒体广告-大图 | 16:9 | 960×540 | <500 KB |
| 荣耀 | 大图文 | 16:9 | 1280×720 | <150 KB |
| 荣耀 | 三图文 | 9:16 | 1080×1920 | <150 KB |

## UI 组件

### 定稿池卡片（`finalized-pool-card.tsx`）

**展示区域：**
- 已定稿预览 — 按分组展示，区分"原始定稿"和"适配版本"
- 单图模式：每组的图片平铺展示，显示组号和比例
- 多图模式：每组按 grid 布局展示，显示套数和图数

**交互功能：**
- 全选/全不选 — 批量选择定稿组
- 单个选择 — 复选框切换
- 投放渠道选择 — OPPO/VIVO/小米/荣耀
- 投放版位选择 — 根据渠道动态显示可选版位
- 适配预览 — 实时显示直接导出/需适配/需后处理的数量
- 生成适配版本 — 对选中的定稿组按目标版位比例生成派生图
- 删除适配版本 — 删除派生分组及其图片文件
- 确认导出 — 选择格式和命名规则后打包下载

### 定稿预览卡片（`finalized-preview-card.tsx`）

单张图片的缩略预览，支持点击放大查看。

## API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| PUT | `/api/image-groups/{id}` | 切换定稿状态（`confirmed: true/false`） |
| DELETE | `/api/image-groups/{id}` | 删除分组及关联图片（用于删除适配版本） |
| POST | `/api/projects/{id}/finalized/variants` | 生成适配版本 |
| POST | `/api/projects/{id}/export` | 导出定稿图片为 ZIP |

## 关键文件

| 文件 | 说明 |
|------|------|
| `components/cards/finalized-pool-card.tsx` | 定稿池节点组件 |
| `components/cards/finalized-pool/finalized-pool-actions.ts` | 前端 action：适配版本生成、导出 |
| `components/cards/finalized-pool/finalized-preview-card.tsx` | 图片预览子组件 |
| `lib/workflow-graph-builders.ts` | `buildFinalizedPoolNode()` 节点构建 |
| `lib/workflow-graph-types.ts` | 定稿池节点类型定义 |
| `lib/project-data-modules-internal.ts` | `generateFinalizedVariants()`、`getProjectExportContext()` |
| `lib/export/utils.ts` | 版位规格、比例分类、文件命名 |
| `lib/storage.ts` | `writeExportImage()` 图片处理 |
| `lib/export/zip.ts` | ZIP 打包 |
| `app/api/image-groups/[id]/route.ts` | 分组状态切换 API |
| `app/api/projects/[id]/finalized/variants/route.ts` | 适配版本生成 API |
| `app/api/projects/[id]/export/route.ts` | 导出 API |
