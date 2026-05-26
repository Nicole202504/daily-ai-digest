import { fetchJson } from "../core/http.js";
import { isoHoursAgo } from "../core/date.js";

const BASE = "https://aihot.virxact.com";

export async function collectAihotItems({ since = isoHoursAgo(24), take = 100 } = {}) {
  const url = `${BASE}/api/public/items?mode=selected&since=${encodeURIComponent(since)}&take=${take}`;
  const data = await fetchJson(url);
  const items = (data.items ?? []).map((item) => ({
    source: "aihot",
    sourceItemId: `aihot:${item.id ?? item.url}`,
    title: item.title,
    summary: item.summary,
    body: item.summary,
    url: item.url,
    sourceName: item.source,
    sourceCategory: item.category,
    publishedAt: item.publishedAt,
    rawJson: item
  }));
  return {
    source: "aihot",
    fetchedAt: new Date().toISOString(),
    sourceGeneratedAt: data.generatedAt,
    items,
    errors: []
  };
}
