import { dedupeItems, inferSystemCategory } from "../core/dedupe.js";

export function normalizeCollectorResults(results, { historicalUrls = new Set() } = {}) {
  const items = [];
  for (const result of results) {
    for (const item of result.items ?? []) {
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
  return dedupeItems(items, { historicalUrls });
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
