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

function productWhat(item) {
  const text = `${item.title} ${item.summary ?? ""} ${item.body ?? ""}`.toLowerCase();
  if (/mcp|context|memory|re-explain|explain yourself/.test(text)) {
    return "连接日常使用的应用，自动抽取、结构化并更新个人或团队上下文，再通过 MCP 提供给不同 AI 工具使用。";
  }
  if (/personal website|link-in-bio|bento|creator|founder/.test(text)) {
    return "用 bento tiles 快速生成个人主页或 link-in-bio 页面，支持组件、集成、访客分析和受众增长入口。";
  }
  if (/learns how you work|repeated tasks|workflow|automation|internal tools|no-code/.test(text)) {
    return "观察文件、消息和工作流中的重复模式，把常见任务转成应用、自动化或轻量内部工具。";
  }
  if (/data analyst|dashboard|analytics|business|revenue|stripe|posthog/.test(text)) {
    return "用自然语言分析业务数据并生成 dashboard，把分散在产品、收入和运营工具里的指标集中到一个视图。";
  }
  if (/twitter|tweet|thread|markdown|x\/twitter/.test(text)) {
    return "把 X/Twitter 帖子和长 thread 转成干净 Markdown，方便保存、研究整理、喂给 LLM 或 agent。";
  }
  if (/resume|cv|career|hiring/.test(text)) {
    return "把 Markdown 简历生成一页 PDF 和公开链接，并支持按岗位快速维护不同版本。";
  }
  if (/coding agent|terminal|harness|prompt template|extension/.test(text)) {
    return "提供一个可扩展的 terminal coding-agent harness，支持 extensions、skills、prompt templates 和主题定制。";
  }
  if (/music|audio|stem|wav|instrument/.test(text)) {
    return "把 AI 音乐生成拆成可单独控制的 stems，允许局部重生成乐器、调声音并导出高质量音频。";
  }
  if (/fallback|provider|model|llm|json/.test(text)) {
    return "为 AI 应用提供模型选择和 fallback 层，在 provider 失败、过载或输出不合规时自动切换。";
  }
  return features(item);
}

function productWhy(item) {
  const text = `${item.title} ${item.summary ?? ""} ${item.body ?? ""}`.toLowerCase();
  if (/mcp|context|memory|re-explain|explain yourself/.test(text)) {
    return "面向重度 AI 工具用户、开发者和知识工作者，解决反复向不同 AI 解释项目背景、个人偏好和当前状态的问题。";
  }
  if (/personal website|link-in-bio|bento|creator|founder/.test(text)) {
    return "面向创作者、founder 和个人品牌经营者，解决传统链接页太单薄、个人网站又太重，且难追踪访问和转化的问题。";
  }
  if (/learns how you work|repeated tasks|workflow|automation|internal tools|no-code/.test(text)) {
    return "面向运营团队、创始人和重复流程很多的小团队，解决流程没人梳理、内部工具开发成本又偏高的问题。";
  }
  if (/data analyst|dashboard|analytics|business|revenue|stripe|posthog/.test(text)) {
    return "面向增长、运营、销售和创始人，解决不会 SQL、等数据团队排期太慢、业务问题无法及时自查的问题。";
  }
  if (/twitter|tweet|thread|markdown|x\/twitter/.test(text)) {
    return "面向研究员、内容创作者和 agent 开发者，解决社媒内容结构乱、thread 难归档、复制给模型容易丢上下文的问题。";
  }
  if (/resume|cv|career|hiring/.test(text)) {
    return "面向求职者、学生和自由职业者，解决简历过长、版本混乱、针对不同岗位改写成本高的问题。";
  }
  if (/coding agent|terminal|harness|prompt template|extension/.test(text)) {
    return "面向喜欢定制开发流的工程师和 agent hacker，解决现成 coding agent 太重、不够可改、难分发个人工作流的问题。";
  }
  if (/music|audio|stem|wav|instrument/.test(text)) {
    return "面向音乐制作人和视频/游戏/广告团队，解决 AI 音乐生成像黑盒、只想改某个乐器却要重做整首歌的问题。";
  }
  if (/fallback|provider|model|llm|json/.test(text)) {
    return "面向 AI app 开发者，解决模型选择、成本速度权衡、供应商故障和结构化输出不稳定带来的工程负担。";
  }
  return `${targetUsers(item)}${userNeed(item)}`;
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

function sourceLabel(item) {
  if (item.source === "product_hunt") return "Product Hunt";
  if (item.source === "github_trending") return "GitHub Trending";
  if (item.source === "aihot") return item.sourceName || "AI HOT";
  if (item.source?.startsWith("follow_builders")) return item.authorName ? `Follow Builders / ${item.authorName}` : "Follow Builders";
  return item.sourceName || item.source || "Unknown";
}

function toDigestItem(item) {
  const summary = firstSentence(item.summary, item.body);
  const keyPoints = [features(item)].filter(Boolean);
  const audience = targetUsers(item);
  const pain = userNeed(item);
  const insight = whyItMatters(item);
  const what = item.source === "product_hunt" ? productWhat(item) : summary;
  const why = item.source === "product_hunt" ? productWhy(item) : `${audience}${pain}`;
  return {
    title: item.title,
    url: item.canonicalUrl || item.url,
    sources: item.sources ?? [item.source],
    metricsText: metricsText(item),
    sourceLabel: sourceLabel(item),
    tags: [item.sourceCategory, item.metadata?.language].filter(Boolean).slice(0, 3),
    what,
    why,
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
