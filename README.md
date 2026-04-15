# tixiao-app

洋葱学园图文提效工作流的本地开发版本。

## 当前阶段
- 已创建独立新项目目录 `tixiao-app/`
- 已接入 Next.js App Router + SQLite + Drizzle + React Flow
- 已完成项目列表页、工作区三栏骨架、需求卡/方向卡/文案卡/图片配置的初始 API 骨架
- Claude Code 已安装，但当前本机未登录；后续可补跑前端 UI 设计深化产物

## 启动
```bash
npm install
npm run dev
```

## 常用命令
```bash
npm run lint
npm run typecheck
npm run db:generate
npm run db:push
```

## 环境变量
复制 `.env.example` 为 `.env.local` 后填写：

```bash
NEW_API_BASE_URL=https://ops-ai-gateway.yc345.tv
NEW_API_KEY=replace-me
```

## 目录
```text
app/                 # 页面与 API Route
components/          # UI、Dashboard、Workspace、Canvas
lib/                 # db、schema、仓储与生成逻辑
.local-data/         # 运行时数据（数据库、图片、导出），自动创建
db/migrations/       # Drizzle 迁移输出目录
```

## 服务器部署

### 首次部署

```bash
# 克隆仓库（国内服务器可用 ghfast.top 镜像加速）
git clone https://github.com/mn5449551-dot/tixiao-app.git ~/tixiao-app
cd ~/tixiao-app

# 配置环境变量
cp .env.example .env.local
nano .env.local  # 填写实际的 NEW_API_KEY

# 一键构建并启动
npm install && npm run build
pm2 start npm --name tixiao -- start
pm2 save
```

### 后续更新

```bash
bash scripts/deploy.sh
```

该脚本自动完成：拉取代码 → 安装依赖 → 构建 → 重启服务。

数据库结构会在应用启动时自动迁移（`lib/db.ts` 的 `bootstrap` 函数），**无需手动操作数据库**。

### 开发者注意事项

修改 `lib/schema.ts` 添加新表或新列时，务必同步在 `lib/db.ts` 的 `bootstrap()` 函数中添加对应的 `CREATE TABLE IF NOT EXISTS` 或 `ALTER TABLE` 迁移检查，确保服务器更新后数据库能自动升级。
