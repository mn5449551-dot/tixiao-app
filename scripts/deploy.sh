#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo ">> 拉取最新代码"
git pull origin main

echo ">> 安装依赖"
npm install

echo ">> 构建"
npm run build

echo ">> 重启服务"
pm2 restart tixiao 2>/dev/null || pm2 start npm --name tixiao -- start

echo ">> 部署完成"
pm2 status
