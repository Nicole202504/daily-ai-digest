import { SECTION_TITLES, renderDigestMarkdown } from "../core/render.js";

const CATEGORY_KEYS = ["product", "github", "technical", "news"];

function firstSentence(text, fallback = "") {
  const value = String(text ?? fallback ?? "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  return value.split(/(?<=[.!?。！？])\s+/)[0].slice(0, 180);
}

function metricsText(item) {
  const m = item.metrics ?? {};
  if (item.source === "product_hunt") return `${m.votes ?? 0} votes / ${m.comments ?? 0} comments`;
  if (item.source === "github_trending") {
    const bits = [];
    if (m.stars) bits.push(`${m.stars.toLocaleString("en-US")} stars`);
    if (m.forks) bits.push(`${m.forks.toLocaleString("en-US")} forks`);
    return bits.join(" / ");
  }
  if (item.source === "follow_builders_x") {
    const bits = [];
    if (m.likes != null) bits.push(`${m.likes} likes`);
    if (m.retweets != null) bits.push(`${m.retweets} retweets`);
    return bits.join(" / ");
  }
  return "";
}

function targetUsers(item) {
  const text = `${item.title} ${item.summary ?? ""} ${item.body ?? ""}`.toLowerCase();
  if (item.source === "github_trending") return "开发者、开源项目维护者、技术团队。";
  if (/fallback|model|llm|claude|openai|anthropic|provider/.test(text)) return "AI app 开发者、agent builder、需要稳定模型调用链的技术团队。";
  if (/music|audio|video|image|creative|ads|shorts|social content/.test(text)) return "内容创作者、设计师、视频/音乐制作团队。";
  if (item.source === "product_hunt" && /usb-c|cable|charging|charger/.test(text)) return "MacBook/USB-C 设备用户、硬件爱好者、经常采购线材的团队。";
  if (item.source === "product_hunt" && /dock|macos|menu bar|desktop|mac app/.test(text)) return "Mac 高级用户、开发者、设计师和重度桌面工作流用户。";
  if (item.source === "product_hunt" && /ui|figma|screen|canvas|web|mobile/.test(text)) return "产品经理、设计师、前端开发者、原型设计团队。";
  if (/resume|cv|hiring|career/.test(text)) return "求职者、开发者、学生和自由职业者。";
  if (/dashboard|data|analytics|business|revenue/.test(text)) return "创始人、运营、增长、销售和数据资源紧张的业务团队。";
  if (/agent|mcp|llm|api|developer|code|github/.test(text)) return "开发者、AI 工具重度用户、agent builder 和技术团队。";
  if (item.source === "product_hunt") return "创作者、创业者、独立开发者和早期产品团队。";
  return "AI 行业观察者、产品经理、创业者和开发者。";
}

function userNeed(item) {
  const text = `${item.title} ${item.summary ?? ""} ${item.body ?? ""}`.toLowerCase();
  if (/fallback|model|llm|claude|openai|anthropic|provider/.test(text)) return "降低模型选择、调用失败和多供应商容灾的复杂度。";
  if (/music|audio|video|image|creative|ads|shorts|social content/.test(text)) return "更可控地生成和编辑多媒体内容，减少黑盒式生成的返工。";
  if (item.source === "product_hunt" && /usb-c|cable|charging|charger/.test(text)) return "弄清线材真实能力，避免充电慢、传输慢、显示输出不支持等隐性问题。";
  if (item.source === "product_hunt" && /dock|macos|menu bar|desktop|mac app/.test(text)) return "把本地桌面工作流自动化，减少重复切换和手动设置。";
  if (item.source === "product_hunt" && /ui|figma|screen|canvas|web|mobile/.test(text)) return "更快从文字想法生成可迭代的 UI 原型，并衔接设计/开发工具。";
  if (/context|memory/.test(text)) return "减少重复补充上下文，让 AI 或团队工具更持续地理解工作背景。";
  if (/dashboard|analytics|data/.test(text)) return "把分散数据集中起来，降低查数、分析和做报表的成本。";
  if (/github|code|repo|developer/.test(text)) return "提升代码理解、开发自动化或工程协作效率。";
  if (/personal website|link|social/.test(text)) return "更快建立可展示、可转化、可分析的个人主页。";
  return "降低信息获取、工具搭建或重复工作的成本。";
}

function features(item) {
  const text = firstSentence(item.body, item.summary);
  if (text) return text;
  if (item.source === "github_trending") return `${item.summary ?? "开源项目"}${item.metadata?.language ? `，主要语言 ${item.metadata.language}` : ""}。`;
  return item.summary ?? "源数据未提供更详细功能描述。";
}

function whyItMatters(item) {
  if (item.source === "product_hunt") return "Product Hunt 前一天高票产品，适合作为新产品和需求趋势信号。";
  if (item.source === "github_trending") return "本周 GitHub Trending 项目，能反映开发者正在关注的工具和技术方向。";
  if (item.source?.startsWith("follow_builders")) return "来自 builder 一线观点，适合捕捉还没进入正式新闻的早期信号。";
  if (item.source === "aihot") return "AI HOT 精选条目，适合快速了解中文 AI 圈当天重点。";
  return "该条目在多个源中出现或具备明确行业信号。";
}

function toDigestItem(item) {
  const summary = firstSentence(item.summary, item.body);
  const keyPoints = [features(item)].filter(Boolean);
  const audience = targetUsers(item);
  const pain = userNeed(item);
  const insight = whyItMatters(item);
  return {
    title: item.title,
    url: item.canonicalUrl || item.url,
    sources: item.sources ?? [item.source],
    metricsText: metricsText(item),
    sourceLabel: item.sourceName || item.source,
    tags: [item.sourceCategory, item.metadata?.language].filter(Boolean).slice(0, 3),
    summary,
    keyPoints,
    audience,
    pain,
    insight,
    oneLiner: summary,
    features: keyPoints.join("；"),
    targetUsers: audience,
    userNeed: pain,
    whyItMatters: insight
  };
}

function rankItems(items) {
  return [...items].sort((a, b) => {
    const ar = a.metrics?.rank ?? 999;
    const br = b.metrics?.rank ?? 999;
    const av = a.metrics?.votes ?? a.metrics?.stars ?? a.metrics?.likes ?? 0;
    const bv = b.metrics?.votes ?? b.metrics?.stars ?? b.metrics?.likes ?? 0;
    return ar - br || bv - av;
  });
}

export function buildDigest({ date, items, limits = {} }) {
  const sections = CATEGORY_KEYS.map((key) => {
    const max = limits[key] ?? (key === "news" ? 8 : 10);
    return {
      key,
      title: SECTION_TITLES[key],
      items: rankItems(items.filter((item) => item.systemCategory === key))
        .slice(0, max)
        .map(toDigestItem)
    };
  });
  const digest = {
    date,
    generatedAt: new Date().toISOString(),
    sections
  };
  return {
    ...digest,
    markdown: renderDigestMarkdown(digest)
  };
}
