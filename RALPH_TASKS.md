# RALPH Tasks - 每日 AI 动态聚合系统

状态说明：

- `todo`：尚未开始
- `doing`：当前进行中
- `partial`：MVP 可用，但生产化细节未完成
- `blocked`：被外部条件阻塞
- `done`：已完成并验证

Ralph 循环约定：

1. 每次只推进一个 task 或一个清晰子 task。
2. 开始前把状态改成 `doing`。
3. 完成后写清楚修改文件、验证命令、剩余风险，再改成 `done` 或 `partial`。
4. 如果其他 agent 接手，先读本文件和 `每日AI动态聚合系统PRD.md`。
5. 不把 secret/token 写入代码、文档或提交内容。

## 当前快照

- 工作目录：`/Users/liruolanxin/Desktop/ai热点`
- PRD：`每日AI动态聚合系统PRD.md`
- 当前阶段：后端 MVP 已打通
- 本地服务：`http://localhost:3100/`
- 下一步建议：用 `gpt-5.4-mini` 做完整四源 + LLM editor 验收；随后进入前端设计或生产化存储。

## T00 - 任务拆解与交接规范

状态：done  
目标：建立后续开发的任务清单、状态规范和交接约定。  
修改文件：

- `RALPH_TASKS.md`

验证：

- 已按可交接 slice 拆分 T01-T15。

## T01 - 项目脚手架

状态：done  
目标：创建可运行的 Web 服务基础项目。  
实现说明：为了先打通后端闭环，MVP 使用 Node.js 原生 HTTP server + ESM JS + node:test，不引入框架依赖。

修改文件：

- `package.json`
- `.env.example`
- `.gitignore`
- `README.md`
- `README.zh-CN.md`
- `src/server.js`
- `src/cli.js`
- `test/core.test.js`

验证：

- `npm test`
- `npm run build`
- `PORT=3100 npm run dev`

## T02 - 数据模型与存储层

状态：done  
目标：实现 raw items、normalized items、digests、source status 的存储。  
实现说明：MVP 使用 JSON 文件存储，后续可替换为 Postgres/SQLite。

修改文件：

- `src/store/jsonStore.js`

验证：

- `node src/cli.js run`
- 生成 `data/raw/2026-05-26.json`
- 生成 `data/items/2026-05-26.json`
- 生成 `data/digests/latest.json`
- 生成 `data/source-status.json`

## T03 - Collector 基础框架

状态：done  
目标：实现统一 collector runner、HTTP helper、错误隔离和 source status。

修改文件：

- `src/core/http.js`
- `src/collectors/index.js`
- `src/pipeline/normalize.js`

验证：

- 单个 source warning 不阻断日报生成。
- `GET /api/admin/source-status` 可查看各源状态。

## T04 - AI HOT Collector

状态：done  
目标：接入 AI HOT 公开 API。

修改文件：

- `src/collectors/aihot.js`

验收：

- 能拉取 `mode=selected&since=<ISO>`。
- 每条包含 title、url、publishedAt、source、category。

## T05 - Product Hunt Collector

状态：done  
目标：接入 Product Hunt GraphQL，拉取前一天 Product Hunt Top 10。

修改文件：

- `src/collectors/productHunt.js`

验收：

- 有 `PRODUCT_HUNT_TOKEN` 时按 Product Hunt 太平洋时间前一天拉 Top 10。
- 无 token 时明确记录 `PRODUCT_HUNT_TOKEN is not configured`，不阻断日报。
- 字段包含 votes、comments、topics、tagline、description、url。

备注：

- 当前没有把用户提供过的 token 写入 `.env`，避免泄漏 secret。需要用户或部署环境自行配置。

## T06 - GitHub Trending Collector

状态：done  
目标：接入 RSSHub GitHub Trending weekly，并预留 GitHubTrendingRSS 备源。

修改文件：

- `src/collectors/githubTrending.js`
- `test/core.test.js`

验收：

- 主源：`https://rsshub.rssforever.com/github/trending/weekly/any`
- 备源：`https://mshibanami.github.io/GitHubTrendingRSS/weekly/all.xml`
- 已验证主源 504 时备源接管。
- 已清洗 HTML/README 长文本，避免页面被 description 淹没。

## T07 - Follow Builders Collectors

状态：done  
目标：把 Follow Builders 从 skill 抽象为线上 collector。

修改文件：

- `src/collectors/followBuilders.js`

验收：

- 直接抓 GitHub raw feed，不依赖本地 skill。
- X tweets 展开为 item-level 数据。
- podcast transcript 保留为 body。
- blogs 为空时正常返回空列表。
- stale/warning 会进入 source status。

## T08 - Normalizer 与去重

状态：done  
目标：把四个源转成统一 item，并做简单去重和低信号过滤。

修改文件：

- `src/core/dedupe.js`
- `src/pipeline/normalize.js`
- `test/core.test.js`

验收：

- 同 URL 合并。
- GitHub repo 字段结构化。
- Product Hunt、AI HOT、Follow Builders、GitHub Trending 统一到同一 item shape。
- 过滤低信号 Follow Builders tweets。

## T09 - Source Summarizer

状态：done  
目标：先压缩长内容，尤其 Follow Builders podcast 和多 tweet。

已完成：

- Follow Builders X 按 author + category 聚合，避免碎片 tweets 刷屏。
- Follow Builders podcast transcript 做确定性压缩，避免长 transcript 直接进入 editor。
- RSS description 做 HTML 清洗和截断。

修改文件：

- `src/pipeline/sourceSummarizer.js`
- `src/pipeline/job.js`
- `test/core.test.js`

验证：

- `npm test`

## T10 - AI Editor

状态：done  
目标：把 normalized items 重新归类成四栏目日报。

实现说明：

- 已实现确定性规则版 editor。
- 已接入 OpenAI-compatible optional LLM editor：配置 `OPENAI_API_KEY` 后自动调用 `/chat/completions`。
- OpenAI-compatible 默认模型已从当前网关无权限的 `gpt-4.1-mini` 改为 `gpt-5.4-mini`。
- LLM 响应支持解析 ```json fenced block，并增加 `AI_EDITOR_TIMEOUT_MS` 超时保护。
- LLM 输入已压缩到摘要优先、短 body，默认 LLM 超时改为 30 秒，避免整份日报改写阶段长时间等待。
- 外部 source fetch 增加 `SOURCE_FETCH_TIMEOUT_MS` 超时保护，避免 RSSHub/GitHub raw 等服务无响应时 CLI 长时间无输出。
- 内容编辑协议已升级为“主编制”：增加 digestSummary、今日先看、栏目主线、信号/标签/关键点/编辑判断字段；产品栏严格使用 Product Hunt Top 10，GitHub 栏严格使用 Trending Top 10，技术/新闻避免重复。
- 内容字段已改为按栏目动态 details：产品讲“目标用户与场景/原始问题/产品怎么解”，GitHub 讲“工程问题/项目怎么做/适合谁用”，技术和新闻使用各自字段，不再所有模块套同一套字段。
- 2026-05-26 后续简化为每条只展示两点：`做什么` 和 `为什么需要`，减少重复解释和信息过载。
- 实测 `gpt-5.4` 全量改写 90 秒超时；`gpt-5.4-mini` 使用同一两点式 prompt 约 25 秒完成，作为默认模型更实用。
- 技术发展和新闻观点不再展示“为什么需要”，改为 `影响与背景`；builder 观点标题强制提炼观点本身，避免“某某的 builder 观点”这类零信息标题。
- Web 页面已改为 RSSHub 风格前端：顶部 hero、橙色品牌图形、今日先看、四个栏目 tab、双列摘要卡片；正文链接改为当前窗口打开，兼容 Codex in-app browser。
- LLM 输出后增加全局 URL 去重，防止同一事件跨栏目重复出现。
- LLM 失败或无 key 时自动回退规则版，保证日报可生成。

修改文件：

- `src/pipeline/editor.js`
- `src/pipeline/llmEditor.js`
- `src/core/render.js`
- `test/core.test.js`

验收：

- 输出四个栏目：产品动态、GitHub 动态、模型/技术发展动态、新闻/观点。
- 每条都有链接。
- Product Hunt/GitHub 条目包含功能、目标用户、解决需求。

备注：

- 部署环境配置 `OPENAI_API_KEY`、可选 `OPENAI_BASE_URL`、`AI_EDITOR_MODEL` 后会走 LLM editor。
- 当前网关已验证 `claude-sonnet-4-6`、`aws/claude-sonnet-4-6`、`zenlayer/claude-sonnet-4-6` 都可用；默认使用 `claude-sonnet-4-6`。
- Claude/Sonnet 通过 OpenAI-compatible `/chat/completions` 调用时不能传 `response_format`，否则会返回 `{}` / `tool_calls`。代码已对 Claude 模型自动禁用 `response_format`。
- Sonnet 全量单 prompt 容易超时，已改为按栏目并行编辑：product/github/technical/news 分别生成，字段也按栏目不同。

## T11 - Job Orchestration

状态：done  
目标：实现每日任务：collect -> normalize -> edit -> publish。

修改文件：

- `src/pipeline/job.js`
- `src/cli.js`

验证：

- `node src/cli.js run --dry-run`
- `node src/cli.js run`
- 支持 `--date=YYYY-MM-DD`

## T12 - Public API

状态：done  
目标：提供线上读取接口。

修改文件：

- `src/server.js`

接口：

- `GET /api/public/daily`
- `GET /api/public/daily/:date`
- `GET /api/public/items?date=YYYY-MM-DD`
- `GET /api/public/rss`
- `GET /api/admin/source-status`
- `GET /api/jobs/run`

验证：

- `curl http://localhost:3100/api/public/daily`
- `curl http://localhost:3100/api/public/rss`
- `curl http://localhost:3100/api/admin/source-status`

## T13 - Web 页面

状态：done  
目标：实现最小可读前端。

修改文件：

- `src/server.js`

验收：

- 首页展示 latest digest。
- 历史日期可点击。
- 外链可点击。
- 四栏目结构清楚。

验证：

- `curl http://localhost:3100/`

## T14 - Cron / 部署配置

状态：partial  
目标：准备线上定时生成。

已完成：

- 提供 `/api/jobs/run` 手动触发。
- 增加可选 `CRON_SECRET` 保护：配置后需要 `?secret=` 或 `x-cron-secret`。
- `.env.example` 和 README 已记录。
- CLI job 已增加阶段进度日志：collecting sources -> normalizing -> editing with LLM -> saving digest，避免长外部请求看起来像卡住。

待补：

- 北京时间 16:00 触发
- 部署文档

## T15 - 质量与观测

状态：partial  
目标：保证线上可维护。

已完成：

- `GET /api/admin/source-status`
- source 失败不阻断整份日报
- warning 写入 `data/source-status.json`

待补：

- job history
- 告警
- 管理后台
- source latency/timeout 统计

## 当前验证记录

已执行：

```bash
npm test
npm run build
node src/cli.js run --dry-run
node src/cli.js run
SOURCE_FETCH_TIMEOUT_MS=5000 AI_EDITOR_PROVIDER=openai AI_EDITOR_MODEL=azure/gpt-5.4-mini AI_EDITOR_TIMEOUT_MS=30000 node src/cli.js run --dry-run
PORT=3100 npm run dev
curl http://localhost:3100/
curl http://localhost:3100/api/public/daily
curl http://localhost:3100/api/public/rss
curl http://localhost:3100/api/admin/source-status
```

当前 source status 摘要：

- AI HOT：成功
- Product Hunt：成功，本次用临时环境变量注入 token，未写入文件
- GitHub Trending：成功；RSSHub 偶发 504 时备源可接管
- Follow Builders X：成功
- Follow Builders Podcast：成功返回 1 条，但上游有 transcript 404 warning
- Follow Builders Blog：成功，当前为空

最新排查记录：

- “卡住”不是死锁，而是外部请求无进度输出。已给 CLI 增加逐阶段日志。
- GitHub Trending/RSSHub 慢时现在会受 `SOURCE_FETCH_TIMEOUT_MS` 控制，不会无限等待。
- `gpt-4.1-mini` 在当前网关无权限，已改为 `azure/gpt-5.4-mini`。
- 压缩 LLM 输入后，`azure/gpt-5.4-mini` dry-run 已验证能返回 `editor=llm`；本次约 23 秒完成 edit 阶段。
- 2026-05-26 最新版 digest 已用现有完整 items 重编排并保存：`editor=llm`，产品 10 条、GitHub 10 条、技术 7 条、新闻 6 条，顶部含“今日先看”和主编摘要。
- 2026-05-26 已用 `zenlayer/claude-sonnet-4-6` 分栏目重编排保存：产品条目改为“目标用户与场景/产品怎么解/产品判断”，GitHub 改为“工程问题/项目怎么做/采用判断”，内容更连贯。

## 下一步建议

1. 把新的 Product Hunt developer token 放入 `.env`，不要继续使用已暴露 token。
2. 配置 `OPENAI_API_KEY` 后重新运行 `node src/cli.js run`，验证 LLM editor 输出质量。
3. 选择部署平台并完成 T14 的定时任务。
4. 再开始正式前端设计。
