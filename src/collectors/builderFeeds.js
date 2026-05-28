const FEEDS = [
  // AI Company Blogs
  {
    name: "OpenAI Blog",
    url: "https://openai.com/blog/rss.xml",
    source: "openai",
    category: "news",
    author: "OpenAI"
  },
  {
    name: "Anthropic News",
    url: "https://rsshub.rssforever.com/anthropic/news",
    source: "anthropic",
    category: "news",
    author: "Anthropic"
  },
  {
    name: "DeepMind Blog",
    url: "https://deepmind.google/blog/rss.xml",
    source: "deepmind",
    category: "technical",
    author: "DeepMind"
  },
  // AI Practitioners & Researchers
  {
    name: "Simon Willison",
    url: "https://simonwillison.net/atom/everything/",
    source: "blog",
    category: "technical",
    author: "Simon Willison"
  },
  {
    name: "Gary Marcus",
    url: "https://garymarcus.substack.com/feed",
    source: "blog",
    category: "news",
    author: "Gary Marcus"
  },
  {
    name: "Gwern",
    url: "https://gwern.substack.com/feed",
    source: "blog",
    category: "technical",
    author: "Gwern"
  },
  {
    name: "Max Woolf",
    url: "https://minimaxir.com/index.xml",
    source: "blog",
    category: "technical",
    author: "Max Woolf"
  },
  {
    name: "George Hotz",
    url: "https://geohot.github.io/blog/feed.xml",
    source: "blog",
    category: "technical",
    author: "George Hotz"
  },
  {
    name: "Dwarkesh Patel",
    url: "https://www.dwarkeshpatel.com/feed",
    source: "blog",
    category: "news",
    author: "Dwarkesh Patel"
  },
  {
    name: "Xe Iaso",
    url: "https://xeiaso.net/blog.rss",
    source: "blog",
    category: "technical",
    author: "Xe Iaso"
  },
  {
    name: "Geoffrey Litt",
    url: "https://www.geoffreylitt.com/feed.xml",
    source: "blog",
    category: "technical",
    author: "Geoffrey Litt"
  },
  // AI Communities
  {
    name: "Hacker News AI",
    url: "https://hnrss.org/newest?q=AI+OR+LLM+OR+GPT+OR+Claude&points=30",
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
    name: "HuggingFace Papers",
    url: "https://rsshub.rssforever.com/huggingface/daily-papers",
    source: "huggingface",
    category: "technical"
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

function extractImage(block) {
  const mediaThumbnail = block.match(/<media:thumbnail[^>]*url="([^"]+)"/i)?.[1];
  if (mediaThumbnail) return mediaThumbnail;
  const mediaContent = block.match(/<media:content[^>]*url="([^"]+)"/i)?.[1];
  if (mediaContent) return mediaContent;
  const enclosure = block.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image[^"]*"/i)?.[1];
  if (enclosure) return enclosure;
  const imgInContent = block.match(/<img[^>]*src="([^"]+)"/i)?.[1];
  if (imgInContent && !imgInContent.includes("tracking") && !imgInContent.includes("pixel")) return imgInContent;
  return undefined;
}

function parseRssItems(xml) {
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  return items.map((block) => {
    const tag = (name) => stripTags(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] ?? "");
    const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();
    const image = extractImage(block);
    return { title: tag("title"), link: tag("link"), description: tag("description"), pubDate, image };
  });
}

function parseAtomEntries(xml) {
  const entries = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((m) => m[1]);
  return entries.map((block) => {
    const title = stripTags(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const link = block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "";
    const summary = stripTags(block.match(/<(?:summary|content)[^>]*>([\s\S]*?)<\/(?:summary|content)>/i)?.[1] ?? "");
    const published = block.match(/<(?:published|updated)[^>]*>([\s\S]*?)<\/(?:published|updated)>/i)?.[1]?.trim();
    const image = extractImage(block);
    return { title, link, description: summary, pubDate: published, image };
  });
}

function isRecent(dateStr, hoursAgo = 72) {
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
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const response = await fetcher(feed.url, {
        headers: { "User-Agent": "Mozilla/5.0 daily-ai-digest/0.1", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!response.ok) {
        errors.push(`${feed.name}: HTTP ${response.status}`);
        continue;
      }
      const xml = await response.text();
      const isAtom = xml.includes("<feed") && xml.includes("<entry");
      const parsed = isAtom ? parseAtomEntries(xml) : parseRssItems(xml);

      for (const entry of parsed.filter((e) => isRecent(e.pubDate, 72)).slice(0, limit)) {
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
          metadata: { feedSource: feed.name, image: entry.image }
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
