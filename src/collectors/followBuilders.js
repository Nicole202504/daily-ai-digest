import { fetchJson } from "../core/http.js";

const FEEDS = {
  x: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json",
  podcasts: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-podcasts.json",
  blogs: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-blogs.json"
};

function staleWarning(generatedAt, hours = 48) {
  if (!generatedAt) return ["feed generatedAt missing"];
  const age = Date.now() - new Date(generatedAt).getTime();
  return age > hours * 60 * 60 * 1000 ? [`feed may be stale: generatedAt=${generatedAt}`] : [];
}

export async function collectFollowBuildersX() {
  const feed = await fetchJson(FEEDS.x);
  const items = [];
  for (const builder of feed.x ?? []) {
    for (const tweet of builder.tweets ?? []) {
      items.push({
        source: "follow_builders_x",
        sourceItemId: `x:${tweet.id}`,
        title: `${builder.name}: ${String(tweet.text ?? "").slice(0, 100)}`,
        summary: null,
        body: tweet.text,
        url: tweet.url,
        authorName: builder.name,
        authorHandle: builder.handle,
        authorBio: builder.bio,
        publishedAt: tweet.createdAt,
        metrics: {
          likes: tweet.likes,
          retweets: tweet.retweets,
          replies: tweet.replies
        },
        metadata: {
          isQuote: tweet.isQuote,
          quotedTweetId: tweet.quotedTweetId
        },
        rawJson: { builder, tweet }
      });
    }
  }
  return {
    source: "follow_builders_x",
    fetchedAt: new Date().toISOString(),
    sourceGeneratedAt: feed.generatedAt,
    items,
    errors: staleWarning(feed.generatedAt)
  };
}

export async function collectFollowBuildersPodcasts() {
  const feed = await fetchJson(FEEDS.podcasts);
  const items = (feed.podcasts ?? []).map((episode) => ({
    source: "follow_builders_podcast",
    sourceItemId: `podcast:${episode.guid ?? episode.url ?? episode.title}`,
    title: episode.title,
    summary: null,
    body: episode.transcript,
    url: episode.url,
    authorName: episode.name,
    publishedAt: episode.publishedAt,
    metadata: {
      contentType: "podcast_transcript",
      transcriptLength: episode.transcript?.length ?? 0
    },
    rawJson: episode
  }));
  return {
    source: "follow_builders_podcast",
    fetchedAt: new Date().toISOString(),
    sourceGeneratedAt: feed.generatedAt,
    items,
    errors: [...(feed.errors ?? []), ...staleWarning(feed.generatedAt)]
  };
}

export async function collectFollowBuildersBlogs() {
  const feed = await fetchJson(FEEDS.blogs);
  const items = (feed.blogs ?? []).flatMap((blog) => {
    if (blog.posts) {
      return blog.posts.map((post) => ({
        source: "follow_builders_blog",
        sourceItemId: `blog:${post.url ?? post.id ?? post.title}`,
        title: post.title,
        summary: post.summary,
        body: post.content ?? post.summary,
        url: post.url,
        authorName: post.author ?? blog.name,
        sourceName: blog.name,
        publishedAt: post.publishedAt ?? post.date,
        rawJson: { blog, post }
      }));
    }
    return [];
  });
  return {
    source: "follow_builders_blog",
    fetchedAt: new Date().toISOString(),
    sourceGeneratedAt: feed.generatedAt,
    items,
    errors: staleWarning(feed.generatedAt)
  };
}
