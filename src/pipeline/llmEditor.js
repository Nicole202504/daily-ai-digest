import { renderDigestMarkdown } from "../core/render.js";
import { buildDigest } from "./editor.js";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-5.4-mini";
const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-6";
const DEFAULT_TIMEOUT_MS = 30000;
const SECTION_CONFIG = {
  product: {
    title: "产品动态",
    limit: 10,
    guide:
      "产品条目只解释两点：1）做什么/功能是什么；2）为什么做/谁有这个问题。不要写产品判断，不要散列过多功能。"
  },
  github: {
    title: "GitHub 动态",
    limit: 10,
    guide:
      "GitHub 条目只解释两点：1）这个项目做什么/核心机制；2）为什么需要它/解决哪个工程问题。不要写采用判断。"
  },
  technical: {
    title: "模型/技术发展动态",
    limit: 8,
    guide:
      "技术条目不要写“为什么需要”。只解释两点：1）发生了什么/能力变化；2）影响与背景。内容要比产品更具体，必须保留关键数字、限制或不确定性。"
  },
  news: {
    title: "新闻/观点",
    limit: 8,
    guide:
      "新闻观点条目不要写“为什么需要”。只解释两点：1）事件/观点是什么；2）影响与背景。builder 观点的标题必须提炼观点，不准写“某某的 builder 观点”。观点不能写成事实。"
  }
};

function extractJsonText(content) {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) return fenceMatch[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function parseLlmJson(content) {
  return JSON.parse(extractJsonText(content));
}

async function withTimeout(fetcher, url, init, timeoutMs) {
  const controller = typeof AbortController === "undefined" ? null : new AbortController();
  const timer =
    controller && timeoutMs > 0
      ? setTimeout(() => controller.abort(new Error(`LLM editor timed out after ${timeoutMs}ms`)), timeoutMs)
      : null;

  try {
    return await fetcher(url, controller ? { ...init, signal: controller.signal } : init);
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`LLM editor timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function compactItem(item) {
  return {
    title: item.title,
    url: item.canonicalUrl || item.url,
    source: item.source,
    sourceLabel: sourceLabel(item),
    sources: item.sources ?? [item.source],
    systemCategory: item.systemCategory,
    summary: item.summary?.slice(0, 500),
    body: item.body?.slice(0, 400),
    authorName: item.authorName,
    sourceName: item.sourceName,
    sourceCategory: item.sourceCategory,
    metrics: item.metrics,
    metadata: item.metadata
  };
}

function sourceLabel(item) {
  if (item.source === "product_hunt") return "Product Hunt";
  if (item.source === "github_trending") return "GitHub Trending";
  if (item.source === "aihot") return item.sourceName || "AI HOT";
  if (item.source?.startsWith("follow_builders")) return item.authorName ? `Follow Builders / ${item.authorName}` : "Follow Builders";
  return item.sourceName || item.source || "Unknown";
}

function metricsText(item) {
  const metrics = item.metrics ?? {};
  if (item.source === "product_hunt") {
    return `#${metrics.rank ?? "?"} · ${metrics.votes ?? 0} votes · ${metrics.comments ?? 0} comments`;
  }
  if (item.source === "github_trending") {
    const bits = [`#${metrics.rank ?? "?"}`];
    if (metrics.stars) bits.push(`${metrics.stars.toLocaleString("en-US")} stars`);
    if (metrics.forks) bits.push(`${metrics.forks.toLocaleString("en-US")} forks`);
    if (item.metadata?.language) bits.push(item.metadata.language);
    return bits.join(" · ");
  }
  if (item.source?.startsWith("follow_builders")) {
    const bits = [];
    if (metrics.likes != null) bits.push(`${metrics.likes} likes`);
    if (metrics.retweets != null) bits.push(`${metrics.retweets} retweets`);
    if (metrics.replies != null) bits.push(`${metrics.replies} replies`);
    return bits.join(" · ");
  }
  return "";
}

function rankSourceItems(items) {
  return [...items].sort((a, b) => {
    const ar = a.metrics?.rank ?? 999;
    const br = b.metrics?.rank ?? 999;
    const av = a.metrics?.votes ?? a.metrics?.stars ?? a.metrics?.likes ?? 0;
    const bv = b.metrics?.votes ?? b.metrics?.stars ?? b.metrics?.likes ?? 0;
    const at = Date.parse(a.publishedAt ?? "") || 0;
    const bt = Date.parse(b.publishedAt ?? "") || 0;
    return ar - br || bv - av || bt - at;
  });
}

function takeCandidates(items) {
  const reserved = new Set();
  const reserve = (item) => reserved.add(item.canonicalUrl || item.url || item.title);
  const isReserved = (item) => reserved.has(item.canonicalUrl || item.url || item.title);

  let product = rankSourceItems(items.filter((item) => item.source === "product_hunt")).slice(0, 10);
  if (!product.length) product = rankSourceItems(items.filter((item) => item.systemCategory === "product")).slice(0, 10);
  product.forEach(reserve);

  const github = rankSourceItems(items.filter((item) => item.source === "github_trending")).slice(0, 10);
  github.forEach(reserve);

  const technical = rankSourceItems(
    items.filter((item) => item.systemCategory === "technical" && !isReserved(item) && item.source !== "product_hunt")
  ).slice(0, 8);
  technical.forEach(reserve);

  const news = rankSourceItems(
    items.filter((item) => item.systemCategory === "news" && !isReserved(item) && item.source !== "product_hunt")
  ).slice(0, 8);

  return {
    product: product.map(compactItem),
    github: github.map(compactItem),
    technical: technical.map(compactItem),
    news: news.map(compactItem)
  };
}

export function promptFor(date, items) {
  const candidates = takeCandidates(items);
  return [
    {
      role: "system",
      content:
        "你是一个中文 AI/产品/开源日报主编，读者是产品经理、创业者、AI 工程师。只根据输入写作，不编造事实。输出必须是 JSON，不要 markdown。产品和 GitHub 讲清“做什么/为什么需要”；技术和新闻讲清“发生了什么/影响与背景”。"
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          date,
          requiredOutput:
            "必须返回单个 JSON object，顶层只能包含 digestSummary, highlights, sections 三个主要字段。sections 必须是数组，包含 product、github、technical、news 四个 section。不要只返回数组，不要返回空数组。",
          editorialRules: [
            "不要重新发明栏目。严格使用 candidates.product/github/technical/news 四个候选池。",
            "产品动态：优先并完整保留 Product Hunt Top 10，按 rank 顺序；不要把普通 AI 新闻放进产品动态。",
            "GitHub 动态：只写 GitHub Trending 候选，按 rank 顺序。",
            "技术发展：写模型、开源、工程、安全、研究进展；不要重复产品栏和 GitHub 栏条目。",
            "新闻/观点：写行业新闻、治理、安全、builder 观点和播客观点；不要重复其他栏目。",
            "产品和 GitHub：每条只写 what 和 why。what 讲功能闭环，不要只写定位；why 讲具体用户和原始问题，不要只写人群名。",
            "技术和新闻：每条只写 what 和 context，不要写 why。what 讲发生了什么；context 讲影响、背景、限制或不确定性。",
            "所有 builder 观点的 title 必须提炼观点本身，例如“Guillermo Rauch：伟大品牌来自产品、审美和分发的一致性”，不准输出“Guillermo Rauch 的 builder 观点”。",
            "避免万能句：不要写“降低信息获取成本”“值得关注”“反映趋势”这类空话，除非说明具体趋势。",
            "如果输入信息不足，明确写“信息有限”，不要补不存在的功能。"
          ],
          outputSchema: {
            digestSummary: "string，80字以内，概括今天最重要的2-3个信号",
            highlights: [
              {
                title: "string",
                url: "string",
                reason: "string，为什么今天最值得先看，35字以内"
              }
            ],
            sections: [
              {
                key: "product|github|technical|news",
                title: "栏目中文名",
                description: "一句话说明这个栏目今天的主线，可为空",
                items: [
                  {
                    title: "string",
                    url: "string",
                    sources: ["string"],
                    metricsText: "string",
                    sourceLabel: "string",
                    tags: ["string，最多3个"],
                    what: "做什么/功能是什么，45-80字",
                    why: "仅 product/github 使用：为什么做/谁有这个问题，60-110字",
                    context: "仅 technical/news 使用：影响、背景、限制或不确定性，60-120字"
                  }
                ]
              }
            ]
          },
          candidates
        },
        null,
        2
      )
    }
  ];
}

function anthropicPromptFor(date, items) {
  const messages = promptFor(date, items);
  return {
    system: messages[0].content,
    user: messages[1].content
  };
}

function promptForSection(date, key, items) {
  const config = SECTION_CONFIG[key];
  return [
    {
      role: "system",
      content:
        "你是中文 AI/产品/开源日报的分栏目主编。只根据输入写作，不编造事实。输出必须是 JSON，不要 markdown。产品和 GitHub 讲清“做什么/为什么需要”；技术和新闻讲清“发生了什么/影响与背景”。"
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          date,
          section: { key, title: config.title, maxItems: config.limit },
          requiredOutput:
            "返回单个 JSON object：{section:{key,title,description,items:[...]}, highlights:[...] }。不要返回数组，不要返回空对象。",
          writingGuide: config.guide,
          itemSchema: {
            title: "编辑后的可读标题。产品可以保留产品名；GitHub 可以保留 repo 名。",
            url: "string",
            sources: ["string"],
            metricsText: "string",
            sourceLabel: "string",
            tags: ["最多3个"],
            what: "做什么/功能是什么，60-100字",
            why: "仅 product/github 使用：为什么做/谁有这个问题，60-110字",
            context: "仅 technical/news 使用：影响、背景、限制或不确定性，60-120字"
          },
          rules: [
            "严格使用输入 items，不要新增条目。",
            `最多输出 ${config.limit} 条。`,
            "product/github 只输出 what 和 why；technical/news 只输出 what 和 context，不要输出 details、lead、takeaway。",
            "what 要细一点，保留关键功能、指标、机制或证据，不要一句泛泛定位。",
            "why/context 要讲具体用户、原始问题、影响对象、限制或不确定性，不要只写人群名。",
            "所有 builder 观点的 title 必须提炼观点本身，不准输出“某某的 builder 观点”。",
            "JSON 字符串内部不要使用英文双引号；需要引用短语时用中文引号「」或直接改写。",
            "不要写空话，比如“降低信息获取成本”“值得关注”。",
            "信息有限就明确写信息有限，并说明缺什么。"
          ],
          items
        },
        null,
        2
      )
    }
  ];
}

async function callOpenAiChat({ fetcher, baseUrl, apiKey, model, messages, timeoutMs }) {
  const response = await withTimeout(
    fetcher,
    `${baseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        ...(!/claude/i.test(model) ? { response_format: { type: "json_object" } } : {}),
        messages
      })
    },
    timeoutMs
  );
  if (!response.ok) throw new Error(`LLM editor HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM editor returned empty content");
  return parseLlmJson(content);
}

async function buildDigestSectionWise({ date, items, fetcher, baseUrl, apiKey, model, timeoutMs }) {
  const candidates = takeCandidates(items);
  const keys = ["product", "github", "technical", "news"];
  const parsedSections = await Promise.all(
    keys.map(async (key) => {
      const parsed = await callOpenAiChat({
        fetcher,
        baseUrl,
        apiKey,
        model,
        messages: promptForSection(date, key, candidates[key]),
        timeoutMs
      });
      const section = parsed.section ?? parsed;
      return {
        key,
        title: section.title ?? SECTION_CONFIG[key].title,
        description: section.description ?? "",
        items: Array.isArray(section.items) ? section.items : []
      };
    })
  );
  const highlights = parsedSections
    .flatMap((section) => section.items.slice(0, section.key === "product" ? 1 : 0))
    .concat(parsedSections.find((section) => section.key === "technical")?.items?.slice(0, 1) ?? [])
    .concat(parsedSections.find((section) => section.key === "news")?.items?.slice(0, 1) ?? [])
    .filter(Boolean)
    .slice(0, 3)
    .map((item) => ({
      title: item.title,
      url: item.url,
      reason: item.takeaway || item.lead?.slice(0, 35) || "今天最值得先看"
    }));
  return normalizeLlmDigest(date, {
    digestSummary: summarizeSectionDescriptions(parsedSections),
    highlights,
    sections: parsedSections
  });
}

function summarizeSectionDescriptions(sections) {
  const pick = (key) => sections.find((section) => section.key === key)?.description?.replace(/\s+/g, " ").trim();
  const product = pick("product");
  const github = pick("github");
  const technical = pick("technical");
  const news = pick("news");
  const summary = [
    product ? `产品：${product}` : "",
    github ? `GitHub：${github}` : "",
    technical || news ? `技术/观点：${[technical, news].filter(Boolean).join("；")}` : ""
  ]
    .filter(Boolean)
    .join("。");
  if (summary.length <= 150) return summary;
  return `${summary.slice(0, 147).replace(/[，、；:：][^，、；:：]*$/, "")}...`;
}

function normalizeLlmDigest(date, parsed) {
  const root =
    Array.isArray(parsed)
      ? { sections: parsed }
      : Array.isArray(parsed.sections)
      ? parsed
      : Array.isArray(parsed.digest?.sections)
        ? parsed.digest
        : Array.isArray(parsed.dailyDigest?.sections)
          ? parsed.dailyDigest
          : Array.isArray(parsed.output?.sections)
            ? parsed.output
            : parsed;
  const required = [
    ["product", "产品动态"],
    ["github", "GitHub 动态"],
    ["technical", "模型/技术发展动态"],
    ["news", "新闻/观点"]
  ];
  const sourceSections = Array.isArray(root.sections)
    ? root.sections
    : required
        .filter(([key]) => Array.isArray(root[key]))
        .map(([key, title]) => ({ key, title, items: root[key] }));
  if (!Array.isArray(sourceSections) || !sourceSections.length) {
    throw new Error(`LLM digest missing sections; top-level keys: ${Object.keys(parsed).join(", ")}`);
  }
  const limits = Object.fromEntries(Object.entries(SECTION_CONFIG).map(([key, value]) => [key, value.limit]));
  const seen = new Set();
  const sections = required.map(([key, title]) => {
    const section = sourceSections.find((candidate) => candidate.key === key);
    return {
      key,
      title: section?.title || title,
      description: section?.description ?? "",
      items: (section?.items ?? [])
        .filter((item) => item.title && item.url)
        .filter((item) => {
          const dedupeKey = String(item.url || item.title).toLowerCase().replace(/[?#].*$/, "");
          if (seen.has(dedupeKey)) return false;
          seen.add(dedupeKey);
          return true;
        })
        .slice(0, limits[key])
        .map((item) => ({
          title: item.title,
          url: item.url,
          sources: item.sources ?? [],
          metricsText: item.metricsText ?? "",
          sourceLabel: item.sourceLabel ?? "",
          tags: Array.isArray(item.tags) ? item.tags.slice(0, 3) : [],
          what: item.what ?? item.lead ?? item.summary ?? item.oneLiner ?? "",
          why: item.why ?? item.takeaway ?? item.insight ?? item.whyItMatters ?? "",
          context: item.context ?? "",
          lead: item.lead ?? item.what ?? item.summary ?? item.oneLiner ?? "",
          summary: item.what ?? item.lead ?? item.summary ?? item.oneLiner ?? "",
          details: Array.isArray(item.details)
            ? item.details
                .filter((detail) => detail?.label && detail?.value)
                .slice(0, 5)
                .map((detail) => ({ label: detail.label, value: detail.value }))
            : [],
          keyPoints: Array.isArray(item.keyPoints)
            ? item.keyPoints.slice(0, 4)
            : [item.features].filter(Boolean),
          audience: item.audience ?? item.targetUsers ?? "",
          pain: item.pain ?? item.userNeed ?? "",
          insight: item.context ?? item.why ?? item.takeaway ?? item.insight ?? item.whyItMatters ?? "",
          takeaway: item.context ?? item.why ?? item.takeaway ?? item.insight ?? item.whyItMatters ?? "",
          oneLiner: item.what ?? item.lead ?? item.summary ?? item.oneLiner ?? "",
          features: Array.isArray(item.keyPoints) ? item.keyPoints.join("；") : item.features ?? "",
          targetUsers: item.audience ?? item.targetUsers ?? "",
          userNeed: item.pain ?? item.userNeed ?? "",
          whyItMatters: item.insight ?? item.whyItMatters ?? ""
        }))
    };
  });
  const digest = {
    date,
    generatedAt: new Date().toISOString(),
    digestSummary: root.digestSummary ?? root.summary ?? parsed.digestSummary ?? "",
    highlights: Array.isArray(root.highlights)
      ? root.highlights.slice(0, 5)
      : Array.isArray(root.topStories)
        ? root.topStories.slice(0, 5)
        : [],
    sections,
    editor: "llm"
  };
  return { ...digest, markdown: renderDigestMarkdown(digest) };
}

export async function buildDigestWithOptionalLlm(options) {
  const hasExplicitApiKey = Object.prototype.hasOwnProperty.call(options, "apiKey");
  let {
    date,
    items,
    apiKey,
    provider,
    baseUrl,
    model,
    fetcher = fetch,
    timeoutMs = Number(process.env.AI_EDITOR_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  } = options;

  if (!hasExplicitApiKey) apiKey = process.env.OPENAI_API_KEY;

  provider =
    provider ??
    process.env.AI_EDITOR_PROVIDER ??
    (!apiKey && (process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY) ? "anthropic" : "openai");

  if (provider === "anthropic") {
    if (!hasExplicitApiKey) apiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
    baseUrl = baseUrl ?? process.env.ANTHROPIC_BASE_URL ?? DEFAULT_ANTHROPIC_BASE_URL;
    model = model ?? process.env.AI_EDITOR_MODEL ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
  } else {
    baseUrl = baseUrl ?? process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL;
    model = model ?? process.env.AI_EDITOR_MODEL ?? DEFAULT_MODEL;
  }
  if (!apiKey) return { ...buildDigest({ date, items }), editor: "rules" };

  try {
    if (provider === "anthropic") {
      const { system, user } = anthropicPromptFor(date, items);
      const response = await withTimeout(
        fetcher,
        `${baseUrl.replace(/\/$/, "")}/v1/messages`,
        {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            Authorization: `Bearer ${apiKey}`,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            max_tokens: 6000,
            temperature: 0.2,
            system,
            messages: [{ role: "user", content: user }]
          })
        },
        timeoutMs
      );
      if (!response.ok) throw new Error(`Anthropic editor HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
      const data = await response.json();
      const content = (data.content ?? [])
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
        .trim();
      if (!content) throw new Error("Anthropic editor returned empty content");
      return normalizeLlmDigest(date, parseLlmJson(content));
    }

    if (/claude/i.test(model)) {
      return await buildDigestSectionWise({ date, items, fetcher, baseUrl, apiKey, model, timeoutMs });
    }

    return await normalizeLlmDigest(
      date,
      await callOpenAiChat({
        fetcher,
        baseUrl,
        apiKey,
        model,
        messages: promptFor(date, items),
        timeoutMs
      })
    );
  } catch (error) {
    const fallback = buildDigest({ date, items });
    return {
      ...fallback,
      editor: "rules",
      editorWarning: error.message
    };
  }
}
