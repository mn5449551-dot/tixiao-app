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
 db/onion.db         # 本地 SQLite 数据库（运行时自动创建）
db/migrations/       # Drizzle 迁移输出目录
```
