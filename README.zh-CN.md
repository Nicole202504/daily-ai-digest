# 每日 AI/产品/开源动态聚合系统

这是当前目录里的开发项目说明。详细产品与技术方案见：

- [每日AI动态聚合系统PRD.md](./每日AI动态聚合系统PRD.md)
- [RALPH_TASKS.md](./RALPH_TASKS.md)

## 快速开始

```bash
npm test
npm run build
npm run job
PORT=3100 npm run dev
```

打开：

```text
http://localhost:3100/
```

## 数据源

1. AI HOT
2. Follow Builders
3. Product Hunt
4. GitHub Trending

## 环境变量

复制 `.env.example` 为 `.env`，然后按需配置：

```text
PRODUCT_HUNT_TOKEN=
OPENAI_API_KEY=
OPENAI_BASE_URL=
AI_EDITOR_PROVIDER=openai
AI_EDITOR_MODEL=gpt-5.4-mini
AI_EDITOR_TIMEOUT_MS=30000
SOURCE_FETCH_TIMEOUT_MS=10000
AIHOT_USER_AGENT=Mozilla/5.0 daily-ai-digest/0.1
PORT=3000
DATA_DIR=./data
CRON_SECRET=
```

不要把 `.env` 提交到仓库。

## API

```text
GET /api/public/daily
GET /api/public/daily/:date
GET /api/public/items?date=YYYY-MM-DD
GET /api/public/rss
GET /api/admin/source-status
GET /api/jobs/run
```
