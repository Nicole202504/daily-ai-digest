# 部署说明

推荐 MVP 使用 **GitHub Pages + GitHub Actions**：每天自动抓取四个源，生成静态 HTML，然后发布到 Pages。这样不需要 Supabase，也不需要长期运行 Node 服务或持久化磁盘。

## 为什么暂时不需要 Supabase

当前产品是“每日阅读页”，核心需求是：

- 每天定时生成一版日报。
- 公开访问最新日报。
- 保留按日期访问的历史页面。
- 前端不暴露 `Run Job`、`JSON`、`RSS` 等调试入口。

这些都可以由 GitHub Actions 生成静态文件完成。历史页面会随每次构建写入 `public/daily/YYYY-MM-DD/index.html` 并由 Pages 托管。

只有当后续需要用户登录、收藏、订阅、后台编辑、点击统计、全文搜索、多人协作审核时，再引入 Supabase 或其他数据库。

## 架构

```text
GitHub Actions cron
  -> npm install
  -> npm run build
  -> node src/cli.js run
  -> npm run export:static
  -> GitHub Pages deploy public/
```

线上用户只访问静态页面：

```text
https://<github-user>.github.io/<repo-name>/
https://<github-user>.github.io/<repo-name>/daily/2026-05-26/
```

## 定时任务

工作流文件：

```text
.github/workflows/pages.yml
```

默认北京时间每天 16:30 运行一次，也就是 UTC 08:30：

```yaml
schedule:
  - cron: "30 8 * * *"
```

也可以在 GitHub Actions 页面手动点 `Run workflow` 立刻生成一次。

## GitHub Secrets

在仓库的 `Settings -> Secrets and variables -> Actions` 中设置：

```text
PRODUCT_HUNT_TOKEN=Product Hunt Developer Token
OPENAI_API_KEY=OpenAI-compatible AI editor key
OPENAI_BASE_URL=https://athenai.mihoyo.com/v1
```

可选变量：

```text
AI_EDITOR_MODEL=gpt-5.4-mini
```

注意：密钥只放 GitHub Secrets，不写入 `.env`、代码、README 或前端页面。

## GitHub Pages 设置

在仓库中打开：

```text
Settings -> Pages -> Build and deployment -> Source
```

选择：

```text
GitHub Actions
```

然后手动运行一次 `Daily AI Digest` workflow。成功后页面会发布到：

```text
https://<github-user>.github.io/<repo-name>/
```

## 本地验证

```bash
npm install
npm test
npm run build
node src/cli.js run
npm run export:static
npm start
```

本地页面：

```text
http://localhost:3100/
```

健康检查：

```text
/healthz
```

## 公开页面约束

公开前端只展示日报内容和日期，不展示：

- `Run Job`
- `JSON`
- `RSS`
- admin/source status
- 原始抓取数据

这些能力只保留在服务端代码和本地调试里，不会出现在静态 Pages 页面中。

## 稳定性说明

外部源不是 100% 稳定：

- Product Hunt 依赖 `PRODUCT_HUNT_TOKEN`。
- GitHub Trending 依赖 RSSHub 和备用 RSS。
- Follow Builders 上游 transcript 偶尔会有 404 warning。
- LLM 失败会自动回退规则版日报。

单个源失败不会阻断整份日报；本地服务模式下会写入 `/api/admin/source-status`，静态部署不会把这个调试接口暴露给用户。

## 后续何时加数据库

继续使用 GitHub Pages：

- 只做每日公开阅读。
- 不需要用户系统。
- 不需要后台人工编辑。
- 每天一版结果即可。

升级到 Supabase：

- 要保存用户订阅邮箱、阅读偏好、收藏。
- 要做后台人工审核和修改日报。
- 要做搜索、统计、推荐。
- 要把抓取源和生成结果结构化查询。
