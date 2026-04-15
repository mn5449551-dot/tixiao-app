# Logo 移至导出阶段 + IP 模式配置残留修复

## 背景

两个独立但相关的改动：
1. Logo 目前在 AI 生图阶段叠加到图片上，导致生成的图片自带 Logo。需求改为仅在导出阶段叠加，生成的图片保持干净。
2. 从 IP 模式切换回普通模式后重新生图，生成的图片仍残留 IP 角色特征。根本原因是 `referenceImageUrl` 和 `ipRole` 未被清理。

## 改动一：Logo 移到导出阶段

### 当前行为
- `lib/image-generation-service.ts:301-306` — 生成时调用 `applyFixedLogoOverlay`
- `app/api/images/[id]/route.ts:294-300` — 单张重绘时调用 `applyFixedLogoOverlay`
- `app/api/projects/[id]/export/route.ts` — 导出时不叠加 logo

### 改为
- 生成阶段：不再叠加 logo
- 重绘阶段：不再叠加 logo
- 导出阶段：在写出图片文件前调用 `applyFixedLogoOverlay`

### 涉及文件
- `lib/image-generation-service.ts` — 移除 logo 叠加调用
- `app/api/images/[id]/route.ts` — 移除重绘时的 logo 叠加调用
- `app/api/projects/[id]/export/route.ts` — 添加 logo 叠加逻辑
- `components/cards/image-config/image-config-brand-section.tsx` — 更新 UI 提示文案

### Logo 叠加参数（不变）
- 大小：图片宽度的 22%（最小 180px）
- 位置：左上角，距顶部和左侧各 3%（最小 24px）
- 仅对 logo 不为 "none" 的图片叠加

## 改动二：IP 模式配置残留修复

### 根本原因
保存图片配置时（`saveImageConfig`），当用户将 `styleMode` 从 `"ip"` 切回 `"normal"`：
- `styleMode` 更新为 `"normal"` ✅
- `ipRole` 未清除，保留旧值 ❌
- `referenceImageUrl` 未清除，保留旧的 IP 角色参考图 ❌

重新生成时，`buildSharedBaseContext` 发现 `referenceImageUrl` 存在，将其作为"风格参考"传入提示词，导致生成的图片残留 IP 角色特征。

### 修复方案
在 `saveImageConfig` 函数中，当 `styleMode === "normal"` 时，强制将 `ipRole` 和 `referenceImageUrl` 设为 `null`。

### 涉及文件
- `lib/project-data-modules/image-config-operations.ts` — 保存时增加清理逻辑

### 验证场景
1. 选择 IP 模式 + IP 角色 → 保存 → 生图 → 结果包含 IP 特征 ✅
2. 切换回普通模式 → 保存 → 生图 → 结果无 IP 特征 ✅
3. 导出时 logo 正确叠加在图片上 ✅
4. 导出时 logo=none 的图片不叠加 ✅
