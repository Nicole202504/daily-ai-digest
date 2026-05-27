function stripTags(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function matchTag(xml, tag) {
  return xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] ?? "";
}

function numberAfter(text, label) {
  const match = text.match(new RegExp(`${label}:\\s*([\\d,]+)`, "i"));
  return match ? Number(match[1].replace(/,/g, "")) : undefined;
}

function conciseSummary(text) {
  const cleaned = String(text ?? "")
    .replace(/\s*Language:\s*.+$/i, "")
    .replace(/\s*Stars:\s*[\d,]+.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = cleaned.split(/(?<=[.!?。！？])\s+/)[0] || cleaned;
  return sentence.length > 260 ? `${sentence.slice(0, 257)}...` : sentence;
}

export function parseGithubTrendingRss(xml, variant = "rsshub") {
  const itemBlocks = [...String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
  return itemBlocks.map((block, index) => {
    const title = stripTags(matchTag(block, "title"));
    const url = stripTags(matchTag(block, "link"));
    const rawDescription = stripTags(matchTag(block, "description"));
    const language = rawDescription.match(/Language:\s*([^]+?)\s+Stars:/i)?.[1]?.trim();
    const stars = numberAfter(rawDescription, "Stars");
    const forks = numberAfter(rawDescription, "Forks");
    const summary = conciseSummary(rawDescription);
    return {
      source: "github_trending",
      sourceItemId: `github:${title}`,
      title,
      summary,
      url,
      publishedAt: new Date().toISOString(),
      metrics: { stars, forks, rank: index + 1 },
      metadata: { language, period: "weekly", variant }
    };
  });
}

export async function collectGithubTrendingWeekly({ fetcher = fetch, limit = 20 } = {}) {
  const sources = [
    { url: "https://mshibanami.github.io/GitHubTrendingRSS/monthly/all.xml", variant: "github_trending_rss" },
    { url: "https://rsshub.rssforever.com/github/trending/monthly/any", variant: "rsshub" }
  ];
  const errors = [];

  for (const source of sources) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const response = await fetcher(source.url, { headers: { "User-Agent": "Mozilla/5.0 daily-ai-digest/0.1" }, signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = await response.text();
      const items = parseGithubTrendingRss(xml, source.variant).slice(0, limit);
      if (items.length) {
        return { source: "github_trending", fetchedAt: new Date().toISOString(), items, errors };
      }
      errors.push(`${source.url}: no items`);
    } catch (error) {
      errors.push(`${source.url}: ${error.message}`);
    }
  }

  return { source: "github_trending", fetchedAt: new Date().toISOString(), items: [], errors };
}
