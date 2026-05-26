import { dedupeItems, inferSystemCategory } from "../core/dedupe.js";

function isLowSignalFollowBuilderItem(item) {
  if (item.source !== "follow_builders_x") return false;
  const text = String(item.body ?? item.title ?? "").trim();
  const compact = text.toLowerCase();
  if (text.length < 35) return true;
  if (/^https?:\/\/\S+$/i.test(text)) return true;
  if (/(bjj|join the cult|having the time of my life|wdyt\?|also available on:|spotify:|apple:|newsletter:)/i.test(text)) {
    return true;
  }
  if ((item.metrics?.likes ?? 0) < 10 && !/(agent|model|llm|ai|startup|product|github|codex|claude|openai)/i.test(compact)) {
    return true;
  }
  return false;
}

export function normalizeCollectorResults(results) {
  const items = [];
  for (const result of results) {
    for (const item of result.items ?? []) {
      if (isLowSignalFollowBuilderItem(item)) continue;
      items.push({
        id: `${item.source}:${item.sourceItemId}`,
        source: item.source,
        sourceItemId: item.sourceItemId,
        title: item.title,
        summary: item.summary,
        body: item.body,
        url: item.url,
        externalUrl: item.externalUrl,
        sourceName: item.sourceName,
        sourceCategory: item.sourceCategory,
        authorName: item.authorName,
        authorHandle: item.authorHandle,
        authorBio: item.authorBio,
        publishedAt: item.publishedAt,
        metrics: item.metrics ?? {},
        metadata: item.metadata ?? {},
        rawJson: item.rawJson,
        systemCategory: inferSystemCategory(item)
      });
    }
  }
  return dedupeItems(items);
}

export function sourceStatusFromResults(results) {
  return results.map((result) => ({
    source: result.source,
    fetchedAt: result.fetchedAt,
    sourceGeneratedAt: result.sourceGeneratedAt,
    itemCount: result.items?.length ?? 0,
    errors: result.errors ?? []
  }));
}
