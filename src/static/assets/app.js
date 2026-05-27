const app = document.querySelector("#app");
const dateList = document.querySelector("#date-list");

const sectionMeta = {
  product: { icon: "✦", eyebrow: "Product Hunt" },
  github: { icon: "⌘", eyebrow: "Open Source" },
  technical: { icon: "◈", eyebrow: "Models & Tech" },
  news: { icon: "✺", eyebrow: "News & Takes" }
};

const emptyDigest = {
  date: "等待生成",
  digestSummary: "今天的日报还没有生成；页面结构已经就绪，生成任务完成后会自动展示最新内容。",
  highlights: [],
  sections: [
    { key: "product", title: "产品动态", description: "Product Hunt 前一天高票产品。", items: [] },
    { key: "github", title: "GitHub 动态", description: "最近一周值得关注的开源项目。", items: [] },
    { key: "technical", title: "模型/技术发展", description: "模型、框架、研究和工程实践更新。", items: [] },
    { key: "news", title: "新闻/观点", description: "AI builders、行业新闻和观点线索。", items: [] }
  ]
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function secondaryLabel(key) {
  return key === "technical" || key === "news" ? "影响与背景" : "为什么需要";
}

function secondaryValue(section, item) {
  if (section.key === "technical" || section.key === "news") {
    return item.context ?? item.takeaway ?? item.insight ?? item.whyItMatters;
  }
  return item.why ?? item.takeaway ?? item.insight ?? item.whyItMatters;
}

function isStaleDigest(digest) {
  if (!digest?.generatedAt) return false;
  const generated = new Date(digest.generatedAt).getTime();
  const now = Date.now();
  return now - generated > 36 * 60 * 60 * 1000;
}

function renderStaleWarning(digest) {
  if (!isStaleDigest(digest)) return "";
  return `<div class="stale-banner">数据已超过 36 小时未更新，可能是定时任务未触发。</div>`;
}

function renderSourceWarnings(digest) {
  if (!digest?.sourceWarnings?.length) return "";
  return `<div class="source-warnings">
    <span>部分数据源异常：</span>${digest.sourceWarnings.map((w) => escapeHtml(w)).join("；")}
  </div>`;
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

function renderSection(section, active) {
  const meta = sectionMeta[section.key] ?? { icon: "•", eyebrow: section.key };
  const items = section.items ?? [];
  return `<section class="tab-panel${active ? " active" : ""}" id="panel-${escapeHtml(section.key)}" data-panel="${escapeHtml(section.key)}">
    <div class="section-head">
      <div>
        <span class="eyebrow">${escapeHtml(meta.eyebrow)}</span>
        <h2>${escapeHtml(section.title)}</h2>
      </div>
      <p>${escapeHtml(section.description ?? "")}</p>
    </div>
    ${
      items.length
        ? `<div class="item-grid">
          ${items
            .map((item, index) => {
              const signal = publicSignalText(item);
              const secondary = secondaryValue(section, item);
              return `<article class="digest-card">
                <a class="card-title" href="${escapeHtml(item.url)}">
                  <span class="card-rank">${index + 1}</span>
                  <span>${escapeHtml(item.title)}</span>
                </a>
                ${signal ? `<div class="signal">${escapeHtml(signal)}</div>` : ""}
                <div class="card-copy">
                  <p><b>做什么</b>${escapeHtml(item.what ?? item.lead ?? item.summary ?? item.oneLiner ?? "")}</p>
                  ${secondary ? `<p><b>${secondaryLabel(section.key)}</b>${escapeHtml(secondary)}</p>` : ""}
                </div>
              </article>`;
            })
            .join("")}
        </div>`
        : `<div class="empty-strip">暂无内容</div>`
    }
  </section>`;
}

function renderDates(index) {
  const dates = index.dates ?? [];
  dateList.innerHTML = dates.length
    ? `历史：${dates
        .slice(0, 8)
        .map((date) => `<button type="button" data-date="${escapeHtml(date)}">${escapeHtml(date)}</button>`)
        .join(" · ")}`
    : "";
  for (const button of dateList.querySelectorAll("[data-date]")) {
    button.addEventListener("click", () => loadDigest(button.dataset.date));
  }
}

function renderDigest(digest) {
  if (!digest) {
    renderDigest(emptyDigest);
    return;
  }

  document.title = `每日 AI/产品/开源动态 - ${digest.date}`;
  const sections = digest.sections ?? [];
  const firstKey = sections[0]?.key ?? "product";
  app.innerHTML = `
    ${renderStaleWarning(digest)}
    ${renderSourceWarnings(digest)}
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
            const meta = sectionMeta[section.key] ?? { icon: "•", eyebrow: section.key };
            const active = section.key === firstKey;
            return `<button class="tab${active ? " active" : ""}" type="button" data-tab="${escapeHtml(section.key)}" role="tab" aria-selected="${active ? "true" : "false"}">
              <span>${escapeHtml(meta.icon)}</span>
              ${escapeHtml(section.title)}
              <em>${section.items?.length ?? 0}</em>
            </button>`;
          })
          .join("")}
      </div>
      ${sections.map((section) => renderSection(section, section.key === firstKey)).join("")}
    </section>`;

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
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function loadDigest(date) {
  app.innerHTML = `<section class="empty"><h1>每日 AI/产品/开源动态</h1><p>正在加载日报。</p></section>`;
  const digest = await fetchJson(date ? `./data/${date}.json` : "./data/latest.json");
  renderDigest(digest);
}

async function boot() {
  try {
    const index = await fetchJson("./data/index.json");
    renderDates(index);
    await loadDigest(index.latest);
  } catch (error) {
    renderDigest(emptyDigest);
  }
}

boot();
