const app = document.querySelector("#app");
const dateList = document.querySelector("#date-list");
const toc = document.querySelector("#toc");

const sectionMeta = {
  product: { icon: "✦", label: "产品上新" },
  github: { icon: "⌘", label: "开源热门" },
  company: { icon: "◆", label: "公司动态" },
  technical: { icon: "◈", label: "技术前沿" },
  news: { icon: "✺", label: "行业观点" }
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isStaleDigest(digest) {
  if (!digest?.generatedAt) return false;
  const generated = new Date(digest.generatedAt).getTime();
  return Date.now() - generated > 36 * 60 * 60 * 1000;
}

function renderStaleWarning(digest) {
  if (!isStaleDigest(digest)) return "";
  return `<div class="stale-banner">数据已超过 36 小时未更新，可能是定时任务未触发。</div>`;
}

function renderSourceWarnings(digest) {
  if (!digest?.sourceWarnings?.length) return "";
  return `<div class="source-warnings">部分数据源异常：${digest.sourceWarnings.map((w) => escapeHtml(w)).join("；")}</div>`;
}

function renderHighlights(highlights = []) {
  if (!highlights.length) return "";
  return `<div class="highlights">
    ${highlights.slice(0, 3).map((item, i) => `<a class="highlight" href="${escapeHtml(item.url)}" target="_blank">
      <span class="highlight-index">0${i + 1}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.reason ?? "")}</span>
    </a>`).join("")}
  </div>`;
}

function renderCard(item) {
  const image = item.image || item.metadata?.image;
  const sourceLabel = item.sourceLabel || item.sources?.join(", ") || "";
  const metricsText = item.metricsText || "";
  const what = item.what ?? item.lead ?? item.summary ?? item.oneLiner ?? "";
  const secondary = item.context ?? item.why ?? item.takeaway ?? item.insight ?? item.whyItMatters ?? "";
  const tags = item.tags ?? [];

  return `<article class="digest-card">
    <div class="card-header">
      ${image ? `<img class="card-image" src="${escapeHtml(image)}" alt="" loading="lazy" onerror="this.style.display='none'" />` : ""}
      <div>
        <a class="card-title" href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.title)}</a>
        <div class="card-meta">
          ${sourceLabel ? `<span class="card-source">${escapeHtml(sourceLabel)}</span>` : ""}
          ${metricsText ? `<span class="card-metrics">${escapeHtml(metricsText)}</span>` : ""}
        </div>
      </div>
    </div>
    <div class="card-copy">
      ${what ? `<p>${escapeHtml(what)}</p>` : ""}
      ${secondary ? `<p>${escapeHtml(secondary)}</p>` : ""}
    </div>
    ${tags.length ? `<div class="card-tags">${tags.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>` : ""}
  </article>`;
}

function renderSection(section) {
  const meta = sectionMeta[section.key] ?? { icon: "•", label: section.key };
  const items = section.items ?? [];
  return `<section class="digest-section" id="section-${escapeHtml(section.key)}">
    <div class="section-head">
      <h2><span class="section-icon">${meta.icon}</span>${escapeHtml(section.title || meta.label)}</h2>
      ${section.description ? `<p class="section-desc">${escapeHtml(section.description)}</p>` : ""}
    </div>
    ${items.length
      ? `<div class="item-grid">${items.map(renderCard).join("")}</div>`
      : `<div class="empty-strip">暂无内容</div>`}
  </section>`;
}

function renderDates(index, currentDate) {
  const dates = index.dates ?? [];
  dateList.innerHTML = dates
    .map((date) => {
      const label = date.replace(/^\d{4}-/, "");
      const active = date === currentDate;
      return `<a href="#" data-date="${escapeHtml(date)}" class="${active ? "active" : ""}">${escapeHtml(label)}</a>`;
    })
    .join("");
  for (const link of dateList.querySelectorAll("[data-date]")) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      loadDigest(link.dataset.date);
    });
  }
}

function renderToc(sections) {
  toc.innerHTML = `<div class="toc-title">目录</div>
    ${sections.map((section) => {
      const meta = sectionMeta[section.key] ?? { icon: "•", label: section.key };
      const count = section.items?.length ?? 0;
      return `<a href="#section-${escapeHtml(section.key)}" data-toc="${escapeHtml(section.key)}">
        <span class="toc-icon">${meta.icon}</span>
        ${escapeHtml(section.title || meta.label)}
        <small>(${count})</small>
      </a>`;
    }).join("")}
    <a href="#" class="back-top" onclick="window.scrollTo({top:0,behavior:'smooth'});return false;">↑ 回到顶部</a>`;

  setupTocHighlight(sections);
}

function setupTocHighlight(sections) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const key = entry.target.id.replace("section-", "");
          for (const link of toc.querySelectorAll("[data-toc]")) {
            link.classList.toggle("active", link.dataset.toc === key);
          }
        }
      }
    },
    { rootMargin: "-20% 0px -60% 0px" }
  );
  for (const section of sections) {
    const el = document.getElementById(`section-${section.key}`);
    if (el) observer.observe(el);
  }
}

function renderDigest(digest) {
  if (!digest) {
    app.innerHTML = `<div class="loading">今天的日报还没有生成，稍后再来看看。</div>`;
    return;
  }

  document.title = `AI Daily Digest - ${digest.date}`;
  const sections = digest.sections ?? [];

  app.innerHTML = `
    ${renderStaleWarning(digest)}
    ${renderSourceWarnings(digest)}
    <div class="digest-hero">
      <div class="digest-date">${escapeHtml(digest.date)}</div>
      <div class="digest-summary">${escapeHtml(digest.digestSummary ?? "")}</div>
    </div>
    ${renderHighlights(digest.highlights)}
    ${sections.map(renderSection).join("")}
  `;

  renderToc(sections);
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

let currentIndex = null;

async function loadDigest(date) {
  app.innerHTML = `<div class="loading">正在加载...</div>`;
  try {
    const digest = await fetchJson(date ? `./data/${date}.json` : "./data/latest.json");
    renderDigest(digest);
    if (currentIndex) {
      renderDates(currentIndex, digest.date);
    }
  } catch {
    app.innerHTML = `<div class="loading">加载失败，请稍后重试。</div>`;
  }
}

async function boot() {
  try {
    const index = await fetchJson("./data/index.json");
    currentIndex = index;
    renderDates(index, index.latest);
    await loadDigest(index.latest ? null : undefined);
  } catch {
    app.innerHTML = `<div class="loading">暂无数据。</div>`;
  }
}

boot();
