const SYSTEM_CATEGORIES = {
  product: "product",
  github: "github",
  technical: "technical",
  news: "news"
};

export function canonicalUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (
        key.toLowerCase().startsWith("utm_") ||
        ["ref", "source", "fbclid", "gclid"].includes(key.toLowerCase())
      ) {
        url.searchParams.delete(key);
      }
    }
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\?$/, "");
  } catch {
    return String(value).trim();
  }
}

export function inferSystemCategory(item) {
  if (item.systemCategory) return item.systemCategory;
  if (item.source === "product_hunt") return SYSTEM_CATEGORIES.product;
  if (item.source === "github_trending") return SYSTEM_CATEGORIES.github;
  if (item.source === "aihot") {
    if (item.sourceCategory === "ai-products") return SYSTEM_CATEGORIES.product;
    if (["ai-models", "paper"].includes(item.sourceCategory)) return SYSTEM_CATEGORIES.technical;
    return SYSTEM_CATEGORIES.news;
  }
  if (item.source === "follow_builders_podcast") return SYSTEM_CATEGORIES.news;
  if (item.source === "follow_builders_x") {
    const text = `${item.title ?? ""} ${item.body ?? ""}`.toLowerCase();
    if (/(github|open source|repo|code|developer|agent|mcp|api|model|llm|benchmark|codex|claude|devin|automation)/.test(text)) {
      return SYSTEM_CATEGORIES.technical;
    }
    if (/(launch|released|shipping|new product|startup)/.test(text)) return SYSTEM_CATEGORIES.news;
  }
  return SYSTEM_CATEGORIES.news;
}

function titleKey(title) {
  return String(title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .trim();
}

function dedupeKey(item) {
  const url = canonicalUrl(item.url);
  if (url) return `url:${url}`;
  if (item.metadata?.repo) return `repo:${String(item.metadata.repo).toLowerCase()}`;
  return `title:${titleKey(item.title)}`;
}

export function dedupeItems(items, { historicalUrls = new Set() } = {}) {
  const map = new Map();
  for (const item of items) {
    const key = dedupeKey(item);
    const canonical = canonicalUrl(item.url);
    if (canonical && historicalUrls.has(canonical)) continue;
    const existing = map.get(key);
    const normalized = {
      ...item,
      canonicalUrl: canonical,
      systemCategory: inferSystemCategory(item),
      sources: item.sources ? [...item.sources] : [item.source].filter(Boolean),
      sourceLinks: item.sourceLinks ?? [{ source: item.source, url: item.url }]
    };
    if (!existing) {
      map.set(key, normalized);
      continue;
    }
    existing.sources = [...new Set([...existing.sources, ...normalized.sources])];
    existing.sourceLinks = [...(existing.sourceLinks ?? []), ...(normalized.sourceLinks ?? [])];
    existing.summary ||= normalized.summary;
    existing.body ||= normalized.body;
    existing.metrics = { ...(normalized.metrics ?? {}), ...(existing.metrics ?? {}) };
    existing.metadata = { ...(normalized.metadata ?? {}), ...(existing.metadata ?? {}) };
  }
  return [...map.values()];
}
