import http from "node:http";
import { fileURLToPath } from "node:url";
import { JsonStore } from "./store/jsonStore.js";
import { runDailyJob } from "./pipeline/job.js";
import { loadDotEnv } from "./core/env.js";

await loadDotEnv();

const store = new JsonStore();
const port = Number(process.env.PORT ?? 3000);

function sendJson(res, value, status = 200) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(value, null, 2));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownToHtml(markdown) {
  const lines = markdown.split("\n");
  const html = [];
  let inList = false;
  for (const line of lines) {
    if (line.startsWith("# ")) {
      if (inList) html.push("</ol>");
      inList = false;
      html.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (line.startsWith("## ")) {
      if (inList) html.push("</ol>");
      inList = false;
      html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith("> ")) {
      if (inList) html.push("</ol>");
      inList = false;
      html.push(`<blockquote>${escapeHtml(line.slice(2))}</blockquote>`);
    } else if (/^\d+\.\s/.test(line)) {
      if (!inList) {
        html.push("<ol>");
        inList = true;
      }
      const content = line.replace(/^\d+\.\s/, "");
      const linked = escapeHtml(content).replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2">$1</a>'
      );
      html.push(`<li>${linked}</li>`);
    } else if (line.trim().startsWith("- ")) {
      html.push(`<p class="detail">${escapeHtml(line.trim().slice(2))}</p>`);
    } else if (line.trim()) {
      html.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  if (inList) html.push("</ol>");
  return html.join("\n");
}

const SECTION_META = {
  product: { icon: "✦", eyebrow: "Product Hunt" },
  github: { icon: "⌘", eyebrow: "Open Source" },
  technical: { icon: "◈", eyebrow: "Models & Tech" },
  news: { icon: "✺", eyebrow: "News & Takes" }
};

function sectionSecondaryLabel(key) {
  return key === "technical" || key === "news" ? "影响与背景" : "为什么需要";
}

function sectionSecondaryValue(section, item) {
  if (section.key === "technical" || section.key === "news") {
    return item.context ?? item.takeaway ?? item.insight ?? item.whyItMatters;
  }
  return item.why ?? item.takeaway ?? item.insight ?? item.whyItMatters;
}

function publicMetaText(value) {
  return String(value ?? "")
    .replace(/\bRSSHub\b/gi, "")
    .replace(/\bRSS\b/gi, "")
    .replace(/[()（）]/g, "")
    .replace(/\s*[·,，|/]\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function publicSignalText(item) {
  const sourceText = item.sourceLabel || item.sources?.join(", ");
  return [publicMetaText(sourceText), publicMetaText(item.metricsText)].filter(Boolean).join(" · ");
}

function renderHighlights(highlights = []) {
  if (!highlights.length) return "";
  return `<section class="highlights" aria-label="今日先看">
    ${highlights
      .slice(0, 3)
      .map(
        (item, index) => `<a class="highlight" href="${escapeHtml(item.url)}">
          <span class="highlight-index">0${index + 1}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.reason ?? "")}</span>
        </a>`
      )
      .join("")}
  </section>`;
}

function renderSectionPanel(section, active) {
  const meta = SECTION_META[section.key] ?? { icon: "•", eyebrow: section.key };
  const items = section.items ?? [];
  return `<section class="tab-panel${active ? " active" : ""}" id="panel-${escapeHtml(section.key)}" data-panel="${escapeHtml(
    section.key
  )}">
    <div class="section-head">
      <div>
        <span class="eyebrow">${escapeHtml(meta.eyebrow)}</span>
        <h2>${escapeHtml(section.title)}</h2>
      </div>
      <p>${escapeHtml(section.description ?? "")}</p>
    </div>
    <div class="item-grid">
      ${items
        .map((item, index) => {
          const signal = publicSignalText(item);
          const secondary = sectionSecondaryValue(section, item);
          return `<article class="digest-card">
            <a class="card-title" href="${escapeHtml(item.url)}">
              <span class="card-rank">${index + 1}</span>
              <span>${escapeHtml(item.title)}</span>
            </a>
            ${signal ? `<div class="signal">${escapeHtml(signal)}</div>` : ""}
            <div class="card-copy">
              <p><b>做什么</b>${escapeHtml(item.what ?? item.lead ?? item.summary ?? item.oneLiner ?? "")}</p>
              ${
                secondary
                  ? `<p><b>${sectionSecondaryLabel(section.key)}</b>${escapeHtml(secondary)}</p>`
                  : ""
              }
            </div>
          </article>`;
        })
        .join("")}
    </div>
  </section>`;
}

function digestToHtml(digest) {
  if (!digest) {
    return `<section class="empty">
      <h1>每日 AI/产品/开源动态</h1>
      <p>还没有生成今天的日报，请稍后刷新。</p>
    </section>`;
  }

  const sections = digest.sections ?? [];
  const firstKey = sections[0]?.key ?? "product";
  return `
    <section class="hero">
      <div class="hero-copy">
        <div class="brand">AIHot Daily</div>
        <div class="date-badge">${escapeHtml(digest.date)}</div>
        <h1>Everything is<br />AI-readable</h1>
        <p>${escapeHtml(digest.digestSummary ?? "每日 AI、产品、GitHub、模型技术与新闻观点聚合。")}</p>
      </div>
      <div class="brand-mark" aria-hidden="true">
        <span class="mark-large"></span>
        <span class="mark-small"></span>
      </div>
    </section>
    ${renderHighlights(digest.highlights)}
    <section class="digest-tabs">
      <div class="tab-list" role="tablist" aria-label="日报栏目">
        ${sections
          .map((section) => {
            const meta = SECTION_META[section.key] ?? { icon: "•", eyebrow: section.key };
            const active = section.key === firstKey;
            return `<button class="tab${active ? " active" : ""}" type="button" data-tab="${escapeHtml(section.key)}" role="tab" aria-selected="${
              active ? "true" : "false"
            }">
              <span>${escapeHtml(meta.icon)}</span>
              ${escapeHtml(section.title)}
              <em>${section.items?.length ?? 0}</em>
            </button>`;
          })
          .join("")}
      </div>
      ${sections.map((section) => renderSectionPanel(section, section.key === firstKey)).join("")}
    </section>
  `;
}

export function pageHtml(digest, dates = []) {
  const body = digestToHtml(digest);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>每日 AI/产品/开源动态</title>
  <style>
    :root { --ink:#0b0b0f; --muted:#5f6368; --line:#ececf1; --soft:#f4f4f6; --orange:#ff5a1f; --orange2:#ff8f47; --peach:#ffd19d; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 15px/1.6 Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: #fff; }
    main { max-width: 1120px; margin: 0 auto; padding: 26px 20px 64px; }
    header { display:flex; gap:16px; justify-content:space-between; align-items:center; margin-bottom: 28px; }
    a { color: inherit; text-decoration: none; }
    a:hover { color: var(--orange); }
    .dates { color:#71717a; font-size: 13px; }
    .top-links { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
    .top-link { color:#52525b; font-weight:700; font-size:13px; }
    .hero { display:grid; grid-template-columns: minmax(0, 1.2fr) 330px; gap:52px; align-items:center; min-height: 270px; }
    .brand { color: var(--orange); font-size: 44px; line-height: 1; font-weight: 900; letter-spacing: 0; margin-bottom: 8px; }
    .date-badge { display:inline-flex; align-items:center; min-height:34px; padding:0 14px; border-radius:999px; background:#f1f1f4; color:#4b4b52; font-size:13px; font-weight:900; margin: 2px 0 14px; }
    h1 { font-size: clamp(46px, 7vw, 72px); line-height: .98; margin: 0 0 18px; letter-spacing: 0; }
    .hero p { max-width: 720px; margin: 0; color:#4b4b52; font-size: 20px; line-height: 1.55; }
    .brand-mark { position:relative; width: 238px; height: 238px; margin-left:auto; border-radius: 72px; background: linear-gradient(145deg, var(--peach), #ffd6aa); overflow:hidden; box-shadow: 0 28px 70px rgba(255, 111, 49, .20); }
    .mark-large { position:absolute; left:-50px; bottom:-6px; width: 238px; height:188px; border-radius: 50% 50% 0 0; background: linear-gradient(180deg, #ff9950, #ff6030); }
    .mark-small { position:absolute; left:54px; bottom:40px; width:78px; height:78px; border-radius:50%; background:#ff260c; }
    .highlights { display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin: 48px 0 28px; }
    .highlight { min-height:126px; padding:22px 24px; border-radius:8px; background:var(--soft); display:flex; flex-direction:column; gap:9px; }
    .highlight-index { width:44px; height:36px; display:inline-flex; align-items:center; justify-content:center; background:#e9e9ee; border-radius:7px; color:var(--orange); font-weight:900; }
    .highlight strong { font-size:17px; line-height:1.35; }
    .highlight span:last-child { color:#55565c; font-weight:600; }
    .digest-tabs { margin-top: 28px; }
    .tab-list { display:flex; gap:10px; flex-wrap:wrap; margin-bottom: 20px; position:sticky; top:0; z-index:2; padding:10px 0; background:rgba(255,255,255,.92); backdrop-filter: blur(10px); }
    .tab { border:0; cursor:pointer; min-height:42px; padding:0 16px; border-radius:999px; background:#ececf1; color:#111; font: inherit; font-weight:850; display:inline-flex; gap:8px; align-items:center; }
    .tab em { font-style:normal; color:#73737d; font-weight:800; }
    .tab.active { background:var(--orange); color:white; }
    .tab.active em { color:#ffe0d2; }
    .tab-panel { display:none; }
    .tab-panel.active { display:block; }
    .section-head { display:flex; justify-content:space-between; gap:28px; align-items:end; margin: 10px 0 16px; }
    .eyebrow { display:block; color:var(--orange); font-weight:900; font-size:13px; text-transform:uppercase; letter-spacing:.08em; }
    h2 { font-size:34px; line-height:1.1; margin: 4px 0 0; letter-spacing:0; }
    .section-head p { max-width: 560px; margin:0; color:#55565c; font-weight:650; }
    .item-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:16px; }
    .digest-card { background:var(--soft); border-radius:8px; padding:24px; min-height: 214px; }
    .card-title { display:flex; gap:12px; align-items:flex-start; font-size:18px; line-height:1.35; font-weight:900; margin-bottom:10px; }
    .card-rank { flex:0 0 auto; min-width:30px; height:30px; padding:0 8px; border-radius:7px; display:inline-flex; align-items:center; justify-content:center; background:#e7e7ed; color:var(--orange); font-size:13px; }
    .signal { color:#6b6b73; font-size:13px; font-weight:750; margin-bottom:14px; }
    .card-copy p { margin: 10px 0 0; color:#3f4046; }
    .card-copy b { display:block; color:#111; font-size:13px; margin-bottom:2px; }
    .empty { min-height: 360px; display:grid; place-content:center; text-align:center; }
    code { background:#e2e8f0; padding:2px 5px; border-radius:4px; }
    @media (max-width: 860px) {
      main { padding: 20px 14px 48px; }
      header { align-items:flex-start; flex-direction:column; }
      .hero { grid-template-columns: 1fr; gap:24px; }
      .brand { font-size:36px; }
      .hero p { font-size:17px; }
      .brand-mark { width:150px; height:150px; border-radius:44px; margin:0; }
      .mark-large { width:160px; height:122px; left:-36px; }
      .mark-small { width:50px; height:50px; left:34px; bottom:26px; }
      .highlights, .item-grid { grid-template-columns: 1fr; }
      .section-head { display:block; }
      .section-head p { margin-top:10px; }
      h2 { font-size:28px; }
      .tab-list { overflow-x:auto; flex-wrap:nowrap; }
      .tab { flex:0 0 auto; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="dates">历史：${dates.slice(0, 8).map((date) => `<a href="/daily/${date}">${date}</a>`).join(" · ")}</div>
    </header>
    ${body}
  </main>
  <script>
    const tabs = [...document.querySelectorAll("[data-tab]")];
    const panels = [...document.querySelectorAll("[data-panel]")];
    for (const tab of tabs) {
      tab.addEventListener("click", () => {
        const key = tab.dataset.tab;
        for (const item of tabs) {
          const active = item.dataset.tab === key;
          item.classList.toggle("active", active);
          item.setAttribute("aria-selected", active ? "true" : "false");
        }
        for (const panel of panels) panel.classList.toggle("active", panel.dataset.panel === key);
      });
    }
  </script>
</body>
</html>`;
}

function rssXml(digest) {
  const title = digest ? `每日 AI/产品/开源动态 - ${digest.date}` : "每日 AI/产品/开源动态";
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeHtml(title)}</title>
    <link>http://localhost:${port}/</link>
    <description>每日 AI、产品、GitHub、模型技术与新闻观点聚合</description>
    ${
      digest
        ? `<item><title>${escapeHtml(title)}</title><link>http://localhost:${port}/daily/${digest.date}</link><guid>${digest.date}</guid><description><![CDATA[${digest.markdown}]]></description></item>`
        : ""
    }
  </channel>
</rss>`;
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === "/healthz") {
      return sendJson(res, { ok: true, service: "ai-digest-aggregator" });
    }
    if (url.pathname === "/api/jobs/run") {
      if (process.env.CRON_SECRET) {
        const provided = url.searchParams.get("secret") ?? req.headers["x-cron-secret"];
        if (provided !== process.env.CRON_SECRET) return sendJson(res, { error: "Unauthorized" }, 401);
      }
      const date = url.searchParams.get("date") ?? undefined;
      const result = await runDailyJob({ date, store });
      return sendJson(res, { date: result.date, status: result.status, digest: result.digest });
    }
    if (url.pathname === "/api/public/daily") {
      const digest = await store.latestDigest();
      return digest ? sendJson(res, digest) : sendJson(res, { error: "No digest generated yet" }, 404);
    }
    const dailyMatch = url.pathname.match(/^\/api\/public\/daily\/(\d{4}-\d{2}-\d{2})$/);
    if (dailyMatch) {
      const digest = await store.digest(dailyMatch[1]);
      return digest ? sendJson(res, digest) : sendJson(res, { error: "Digest not found" }, 404);
    }
    if (url.pathname === "/api/public/items") {
      const date = url.searchParams.get("date");
      return sendJson(res, date ? await store.items(date) : { error: "date is required" }, date ? 200 : 400);
    }
    if (url.pathname === "/api/admin/source-status") {
      return sendJson(res, await store.sourceStatus());
    }
    if (url.pathname === "/api/public/rss") {
      const digest = await store.latestDigest();
      res.writeHead(200, { "content-type": "application/rss+xml; charset=utf-8" });
      return res.end(rssXml(digest));
    }
    const pageMatch = url.pathname.match(/^\/daily\/(\d{4}-\d{2}-\d{2})$/);
    if (pageMatch) {
      const digest = await store.digest(pageMatch[1]);
      const dates = await store.digestDates();
      res.writeHead(digest ? 200 : 404, { "content-type": "text/html; charset=utf-8" });
      return res.end(pageHtml(digest, dates));
    }
    if (url.pathname === "/") {
      const digest = await store.latestDigest();
      const dates = await store.digestDates();
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(pageHtml(digest, dates));
    }
    sendJson(res, { error: "Not found" }, 404);
  } catch (error) {
    sendJson(res, { error: error.message }, 500);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = http.createServer((req, res) => {
    handle(req, res);
  });

  server.listen(port, () => {
    console.log(`Daily AI digest server listening on http://localhost:${port}`);
  });
}
