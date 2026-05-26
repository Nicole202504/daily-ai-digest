import { getDayWindow, getPreviousDayWindow } from "../core/date.js";

const ENDPOINT = "https://api.producthunt.com/v2/api/graphql";

const QUERY = `
query DailyPosts($postedAfter: DateTime!, $postedBefore: DateTime!, $first: Int!) {
  posts(postedAfter: $postedAfter, postedBefore: $postedBefore, first: $first, order: VOTES) {
    edges {
      node {
        id
        name
        slug
        tagline
        description
        url
        website
        votesCount
        commentsCount
        dailyRank
        latestScore
        featuredAt
        createdAt
        topics(first: 5) { edges { node { name slug } } }
      }
    }
  }
}`;

export async function collectProductHuntTop10({
  token = process.env.PRODUCT_HUNT_TOKEN,
  date,
  now = new Date(),
  limit = 10
} = {}) {
  if (!token) {
    return {
      source: "product_hunt",
      fetchedAt: new Date().toISOString(),
      items: [],
      errors: ["PRODUCT_HUNT_TOKEN is not configured"]
    };
  }

  const window = date ? getDayWindow(date, "America/Los_Angeles") : getPreviousDayWindow("America/Los_Angeles", now);
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "daily-ai-digest/0.1"
    },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        postedAfter: window.startUtc,
        postedBefore: window.endUtc,
        first: limit
      }
    })
  });
  if (!response.ok) {
    throw new Error(`Product Hunt API failed: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  const data = await response.json();
  if (data.errors?.length) throw new Error(`Product Hunt API errors: ${JSON.stringify(data.errors)}`);

  const items = (data.data?.posts?.edges ?? []).map(({ node }, index) => ({
    source: "product_hunt",
    sourceItemId: `ph:${node.id}`,
    title: node.name,
    summary: node.tagline,
    body: node.description,
    url: node.url,
    externalUrl: node.website,
    publishedAt: node.featuredAt ?? node.createdAt,
    metrics: {
      votes: node.votesCount,
      comments: node.commentsCount,
      rank: node.dailyRank ?? index + 1,
      score: node.latestScore
    },
    metadata: {
      slug: node.slug,
      topics: (node.topics?.edges ?? []).map((edge) => edge.node.name)
    },
    rawJson: node
  }));

  return {
    source: "product_hunt",
    fetchedAt: new Date().toISOString(),
    sourceGeneratedAt: window.date,
    items,
    errors: []
  };
}
