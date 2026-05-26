import assert from "node:assert/strict";
import test from "node:test";

import { canonicalUrl, dedupeItems, inferSystemCategory } from "../src/core/dedupe.js";
import { getPreviousDayWindow, getTodayWindow } from "../src/core/date.js";
import { renderDigestMarkdown } from "../src/core/render.js";
import { parseGithubTrendingRss } from "../src/collectors/githubTrending.js";
import { summarizeSourceItems } from "../src/pipeline/sourceSummarizer.js";
import { buildDigestWithOptionalLlm } from "../src/pipeline/llmEditor.js";

test("getTodayWindow returns a timezone-aware day window", () => {
  const now = new Date("2026-05-26T03:00:00.000Z");
  const window = getTodayWindow("Asia/Shanghai", now);
  assert.equal(window.date, "2026-05-26");
  assert.equal(window.startUtc, "2026-05-25T16:00:00.000Z");
  assert.equal(window.endUtc, "2026-05-26T16:00:00.000Z");
});

test("getPreviousDayWindow uses the selected timezone", () => {
  const now = new Date("2026-05-26T03:00:00.000Z");
  const window = getPreviousDayWindow("America/Los_Angeles", now);
  assert.equal(window.date, "2026-05-24");
  assert.equal(window.startUtc, "2026-05-24T07:00:00.000Z");
  assert.equal(window.endUtc, "2026-05-25T07:00:00.000Z");
});

test("canonicalUrl normalizes tracking params and trailing slashes", () => {
  assert.equal(
    canonicalUrl("https://www.producthunt.com/products/unabyss?utm_source=x&utm_medium=y/"),
    "https://www.producthunt.com/products/unabyss"
  );
});

test("inferSystemCategory maps known source categories", () => {
  assert.equal(inferSystemCategory({ source: "product_hunt" }), "product");
  assert.equal(inferSystemCategory({ source: "github_trending" }), "github");
  assert.equal(inferSystemCategory({ source: "aihot", sourceCategory: "ai-models" }), "technical");
  assert.equal(inferSystemCategory({ source: "aihot", sourceCategory: "industry" }), "news");
});

test("dedupeItems merges duplicated canonical URLs", () => {
  const result = dedupeItems([
    { id: "1", title: "A", url: "https://example.com/x?utm_source=a", source: "aihot" },
    { id: "2", title: "A again", url: "https://example.com/x", source: "follow_builders_x" }
  ]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].sources.sort(), ["aihot", "follow_builders_x"]);
});

test("parseGithubTrendingRss extracts repo fields from RSSHub XML", () => {
  const xml = `<?xml version="1.0"?><rss><channel><item>
    <title>owner/repo</title>
    <link>https://github.com/owner/repo</link>
    <description><![CDATA[&lt;img src="x"&gt;&lt;br&gt;Useful thing&lt;br&gt;&lt;br&gt; Language: TypeScript Stars: 1234 Forks: 56]]></description>
  </item></channel></rss>`;
  const items = parseGithubTrendingRss(xml, "rsshub");
  assert.equal(items[0].title, "owner/repo");
  assert.equal(items[0].summary, "Useful thing");
  assert.equal(items[0].metadata.language, "TypeScript");
  assert.equal(items[0].metrics.stars, 1234);
  assert.equal(items[0].metrics.forks, 56);
});

test("renderDigestMarkdown includes section titles and links", () => {
  const markdown = renderDigestMarkdown({
    date: "2026-05-26",
    digestSummary: "今天重点是新产品、开源工具和模型更新。",
    highlights: [{ title: "Unabyss", url: "https://example.com", reason: "Product Hunt 今日第一" }],
    sections: [
      {
        key: "product",
        title: "产品动态",
        description: "Product Hunt 新品集中在 AI 工作流。",
        items: [
          {
            title: "Unabyss",
            url: "https://example.com",
            sources: ["product_hunt"],
            sourceLabel: "Product Hunt",
            metricsText: "520 votes / 118 comments",
            tags: ["MCP", "Context"],
            summary: "AI context layer",
            keyPoints: ["Connects apps", "Shares context through MCP"],
            audience: "AI power users.",
            pain: "Avoid re-explaining context.",
            insight: "Makes agents more persistent."
          }
        ]
      }
    ]
  });
  assert.match(markdown, /## 产品动态/);
  assert.match(markdown, /## 今日先看/);
  assert.match(markdown, /\[Unabyss\]\(https:\/\/example.com\)/);
  assert.match(markdown, /做什么/);
  assert.match(markdown, /为什么需要/);
});

test("summarizeSourceItems groups Follow Builders tweets by author", () => {
  const items = summarizeSourceItems([
    {
      source: "follow_builders_x",
      sourceItemId: "x:1",
      title: "Builder: first",
      body: "AI agents should be onboarded like employees.",
      url: "https://x.com/a/status/1",
      authorName: "Builder",
      metrics: { likes: 10, retweets: 2 },
      systemCategory: "technical",
      sources: ["follow_builders_x"]
    },
    {
      source: "follow_builders_x",
      sourceItemId: "x:2",
      title: "Builder: second",
      body: "Documentation and skills make agents more useful.",
      url: "https://x.com/a/status/2",
      authorName: "Builder",
      metrics: { likes: 30, retweets: 4 },
      systemCategory: "technical",
      sources: ["follow_builders_x"]
    },
    {
      source: "github_trending",
      title: "owner/repo",
      url: "https://github.com/owner/repo",
      systemCategory: "github"
    }
  ]);
  const fb = items.filter((item) => item.source === "follow_builders_x_summary");
  assert.equal(fb.length, 1);
  assert.equal(fb[0].authorName, "Builder");
  assert.match(fb[0].summary, /2 条动态/);
  assert.equal(fb[0].metrics.likes, 40);
  assert.equal(items.some((item) => item.source === "github_trending"), true);
});

test("buildDigestWithOptionalLlm falls back without API key", async () => {
  const digest = await buildDigestWithOptionalLlm({
    date: "2026-05-26",
    items: [
      {
        source: "github_trending",
        title: "owner/repo",
        summary: "Useful repo",
        url: "https://github.com/owner/repo",
        systemCategory: "github",
        metrics: { stars: 10 }
      }
    ],
    apiKey: ""
  });
  assert.equal(digest.sections.find((section) => section.key === "github").items[0].title, "owner/repo");
  assert.match(digest.markdown, /GitHub 动态/);
});

test("buildDigestWithOptionalLlm accepts OpenAI-compatible JSON output", async () => {
  const digest = await buildDigestWithOptionalLlm({
    date: "2026-05-26",
    items: [
      {
        source: "product_hunt",
        title: "Demo",
        summary: "Demo product",
        url: "https://example.com",
        systemCategory: "product"
      }
    ],
    apiKey: "test",
    model: "gpt-test",
    fetcher: async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                sections: [
                  {
                    key: "product",
                    title: "产品动态",
                    items: [
                      {
                        title: "Demo",
                        url: "https://example.com",
                        sources: ["product_hunt"],
                        oneLiner: "Demo product",
                        features: "Does demo work.",
                        targetUsers: "Demo users.",
                        userNeed: "Demo need.",
                        whyItMatters: "Demo signal."
                      }
                    ]
                  },
                  { key: "github", title: "GitHub 动态", items: [] },
                  { key: "technical", title: "模型/技术发展动态", items: [] },
                  { key: "news", title: "新闻/观点", items: [] }
                ]
              })
            }
          }
        ]
      })
    })
  });
  assert.equal(digest.sections[0].items[0].features, "Does demo work.");
  assert.match(digest.markdown, /Demo signal/);
});

test("buildDigestWithOptionalLlm removes duplicated LLM output across sections", async () => {
  const duplicated = {
    title: "Same Story",
    url: "https://example.com/same",
    sources: ["aihot"],
    sourceLabel: "AI HOT",
    summary: "Same event",
    keyPoints: ["Same fact"],
    audience: "Builders",
    pain: "Need clarity",
    insight: "Only appears once"
  };
  const digest = await buildDigestWithOptionalLlm({
    date: "2026-05-26",
    items: [
      {
        source: "aihot",
        title: "Same Story",
        summary: "Same event",
        url: "https://example.com/same",
        systemCategory: "technical"
      }
    ],
    apiKey: "test",
    model: "gpt-test",
    fetcher: async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                digestSummary: "Test summary",
                highlights: [],
                sections: [
                  { key: "product", title: "产品动态", items: [] },
                  { key: "github", title: "GitHub 动态", items: [] },
                  { key: "technical", title: "模型/技术发展动态", items: [duplicated] },
                  { key: "news", title: "新闻/观点", items: [duplicated] }
                ]
              })
            }
          }
        ]
      })
    })
  });
  assert.equal(digest.sections.find((section) => section.key === "technical").items.length, 1);
  assert.equal(digest.sections.find((section) => section.key === "news").items.length, 0);
});

test("buildDigestWithOptionalLlm accepts Anthropic-compatible JSON output", async () => {
  const digest = await buildDigestWithOptionalLlm({
    date: "2026-05-26",
    items: [
      {
        source: "product_hunt",
        title: "Demo Anthropic",
        summary: "Demo product",
        url: "https://example.com/a",
        systemCategory: "product"
      }
    ],
    provider: "anthropic",
    apiKey: "test",
    baseUrl: "https://anthropic.example",
    model: "claude-opus-4-6",
    fetcher: async (url, init) => {
      assert.equal(url, "https://anthropic.example/v1/messages");
      assert.equal(init.headers["x-api-key"], "test");
      return {
        ok: true,
        json: async () => ({
          content: [
            {
              type: "text",
              text: "```json\n" + JSON.stringify({
                sections: [
                  {
                    key: "product",
                    title: "产品动态",
                    items: [
                      {
                        title: "Demo Anthropic",
                        url: "https://example.com/a",
                        sources: ["product_hunt"],
                        oneLiner: "Demo product",
                        features: "Anthropic output works.",
                        targetUsers: "Demo users.",
                        userNeed: "Demo need.",
                        whyItMatters: "Demo signal."
                      }
                    ]
                  },
                  { key: "github", title: "GitHub 动态", items: [] },
                  { key: "technical", title: "模型/技术发展动态", items: [] },
                  { key: "news", title: "新闻/观点", items: [] }
                ]
              }) + "\n```"
            }
          ]
        })
      };
    }
  });
  assert.equal(digest.editor, "llm");
  assert.equal(digest.sections[0].items[0].features, "Anthropic output works.");
});
