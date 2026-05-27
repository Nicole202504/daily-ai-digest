const FEEDS = [
  {
    name: "Hacker News AI",
    url: "https://hnrss.org/newest?q=AI+OR+LLM+OR+agent&points=30",
    source: "hackernews",
    category: "news"
  },
  {
    name: "Lobsters AI",
    url: "https://lobste.rs/t/ai.rss",
    source: "lobsters",
    category: "technical"
  },
  {
    name: "Simon Willison",
    url: "https://simonwillison.net/atom/everything/",
    source: "blog",
    category: "technical",
    author: "Simon Willison"
  }
];

function stripTags(value) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssItems(xml) {
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  return items.map((block) => {
    const tag = (name) => stripTags(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] ?? "");
    const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();
    return { title: tag("title"), link: tag("link"), description: tag("description"), pubDate };
  });
}

function parseAtomEntries(xml) {
  const entries = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((m) => m[1]);
  return entries.map((block) => {
    const title = stripTags(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const link = block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "";
    const summary = stripTags(block.match(/<(?:summary|content)[^>]*>([\s\S]*?)<\/(?:summary|content)>/i)?.[1] ?? "");
    const published = block.match(/<(?:published|updated)[^>]*>([\s\S]*?)<\/(?:published|updated)>/i)?.[1]?.trim();
    return { title, link, description: summary, pubDate: published };
  });
}

function isRecent(dateStr, hoursAgo = 48) {
  if (!dateStr) return true;
  const ts = Date.parse(dateStr);
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts < hoursAgo * 60 * 60 * 1000;
}

export async function collectBuilderFeeds({ fetcher = fetch, limit = 15 } = {}) {
  const items = [];
  const errors = [];

  for (const feed of FEEDS) {
    try {
      const response = await fetcher(feed.url, {
        headers: { "User-Agent": "Mozilla/5.0 daily-ai-digest/0.1", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" }
      });
      if (!response.ok) {
        errors.push(`${feed.name}: HTTP ${response.status}`);
        continue;
      }
      const xml = await response.text();
      const isAtom = xml.includes("<feed") && xml.includes("<entry");
      const parsed = isAtom ? parseAtomEntries(xml) : parseRssItems(xml);

      for (const entry of parsed.filter((e) => isRecent(e.pubDate, 48)).slice(0, limit)) {
        items.push({
          source: `builder_${feed.source}`,
          sourceItemId: `builder_${feed.source}:${entry.link || entry.title}`,
          title: entry.title,
          summary: entry.description?.slice(0, 500),
          body: entry.description?.slice(0, 800),
          url: entry.link,
          authorName: feed.author,
          sourceName: feed.name,
          sourceCategory: feed.category,
          publishedAt: entry.pubDate ? new Date(entry.pubDate).toISOString() : new Date().toISOString(),
          metrics: {},
          metadata: { feedSource: feed.name }
        });
      }
    } catch (error) {
      errors.push(`${feed.name}: ${error.message}`);
    }
  }

  return {
    source: "builder_feeds",
    fetchedAt: new Date().toISOString(),
    items,
    errors
  };
}
