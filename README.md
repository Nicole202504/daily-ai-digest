# 每日 AI/产品/开源动态聚合系统

一个可部署的后端 MVP，用来每天抓取四个信息源并生成中文日报：

1. AI HOT
2. Follow Builders
3. Product Hunt
4. GitHub Trending

当前版本用 Node.js 原生 HTTP server 和 JSON 文件存储，方便先验证数据管线。后续可以把 `src/store/jsonStore.js` 替换成 Postgres/SQLite。

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

## 环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

可选配置：

```text
PRODUCT_HUNT_TOKEN=Product Hunt Developer Token
OPENAI_API_KEY=OpenAI-compatible AI editor key
OPENAI_BASE_URL=OpenAI-compatible base URL, optional
AI_EDITOR_PROVIDER=openai
AI_EDITOR_MODEL=gpt-5.4-mini
AI_EDITOR_TIMEOUT_MS=30000
SOURCE_FETCH_TIMEOUT_MS=10000
AIHOT_USER_AGENT=Mozilla/5.0 daily-ai-digest/0.1
PORT=3000
DATA_DIR=./data
CRON_SECRET=保护 /api/jobs/run 的可选密钥
```

注意：不要把 `.env` 提交到仓库。

## 命令

生成并保存当天日报：

```bash
npm run job
```

只预览不保存：

```bash
node src/cli.js run --dry-run
```

生成指定日期：

```bash
node src/cli.js run --date=2026-05-26
```

## API

```text
GET /api/public/daily
GET /api/public/daily/:date
GET /api/public/items?date=YYYY-MM-DD
GET /api/public/rss
GET /api/admin/source-status
GET /api/jobs/run
```

## 当前实现

- `src/collectors/`：四个源的抓取器
- `src/pipeline/normalize.js`：统一字段、过滤低信号内容、去重
- `src/pipeline/editor.js`：确定性日报生成器
- `src/pipeline/job.js`：每日任务编排
- `src/server.js`：API + 简单 HTML 页面
- `src/store/jsonStore.js`：文件型存储

## 已知限制

- Product Hunt 需要 `PRODUCT_HUNT_TOKEN`，否则该源会记录 warning 并跳过。
- 配置 `OPENAI_API_KEY` 后会启用 OpenAI-compatible LLM editor；默认模型是 `gpt-5.4-mini`。LLM 失败时会自动回退规则版。
- 当前存储是 JSON 文件，适合 MVP 验证，不适合多实例生产部署。
- Follow Builders podcast feed 可能返回上游 transcript 错误，系统会记录 warning，不阻断日报生成。
