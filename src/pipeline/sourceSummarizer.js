function firstLine(text, max = 180) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentence = clean.split(/(?<=[.!?。！？])\s+/)[0] || clean;
  return sentence.length > max ? `${sentence.slice(0, max - 3)}...` : sentence;
}

function aggregateMetrics(items) {
  return items.reduce(
    (acc, item) => {
      acc.likes += item.metrics?.likes ?? 0;
      acc.retweets += item.metrics?.retweets ?? 0;
      acc.replies += item.metrics?.replies ?? 0;
      return acc;
    },
    { likes: 0, retweets: 0, replies: 0 }
  );
}

function summarizeTweetGroup(items) {
  const sorted = [...items].sort((a, b) => (b.metrics?.likes ?? 0) - (a.metrics?.likes ?? 0));
  const top = sorted.slice(0, 3);
  const authorName = top[0].authorName ?? "Unknown builder";
  const category = top[0].systemCategory ?? "news";
  const keyPoints = top.map((item) => firstLine(item.body, 160)).filter(Boolean);
  const links = top.map((item) => item.url).filter(Boolean);
  const viewpoint = firstLine(keyPoints[0], 70)
    .replace(/^["“”']+|["“”']+$/g, "")
    .replace(/\s*https?:\/\/\S+/g, "")
    .trim();
  return {
    ...top[0],
    source: "follow_builders_x_summary",
    sourceItemId: `follow_builders_x_summary:${authorName}:${category}`,
    title: viewpoint ? `${authorName}：${viewpoint}` : `${authorName} 的 builder 观点`,
    summary: `${authorName} 过去 24 小时有 ${items.length} 条动态：${keyPoints.join("；")}`,
    body: keyPoints.join("；"),
    url: links[0] ?? top[0].url,
    sourceLinks: top.map((item) => ({ source: item.source, url: item.url })),
    sources: ["follow_builders_x"],
    authorName,
    metrics: aggregateMetrics(items),
    metadata: {
      ...(top[0].metadata ?? {}),
      summarizedFrom: items.map((item) => item.sourceItemId),
      links
    },
    systemCategory: category
  };
}

function summarizePodcast(item) {
  if (item.source !== "follow_builders_podcast") return item;
  const transcript = String(item.body ?? "");
  const intro = firstLine(transcript.replace(/Speaker \d+\s*\|\s*\d+:\d+\s*-\s*\d+:\d+/g, " "), 500);
  return {
    ...item,
    summary: item.summary ?? intro,
    body: intro,
    metadata: {
      ...(item.metadata ?? {}),
      summarized: true,
      originalTranscriptLength: transcript.length
    }
  };
}

export function summarizeSourceItems(items) {
  const groups = new Map();
  const passthrough = [];

  for (const item of items) {
    if (item.source === "follow_builders_x") {
      const key = `${item.authorName ?? "unknown"}::${item.systemCategory ?? "news"}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
      continue;
    }
    passthrough.push(summarizePodcast(item));
  }

  return [...passthrough, ...[...groups.values()].map(summarizeTweetGroup)];
}
