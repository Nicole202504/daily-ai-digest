const SECTION_ORDER = ["product", "github", "company", "technical", "news"];

export const SECTION_TITLES = {
  product: "产品上新",
  github: "开源热门",
  company: "公司动态",
  technical: "技术前沿",
  news: "行业观点"
};

function bullet(label, value) {
  if (!value) return "";
  return `   - ${label}：${value}\n`;
}

function compactList(values) {
  return (values ?? []).filter(Boolean).join("；");
}

function secondaryLabel(sectionKey) {
  if (sectionKey === "technical") return "影响与背景";
  if (sectionKey === "news") return "影响与背景";
  return "为什么需要";
}

function secondaryValue(section, item) {
  if (section.key === "technical" || section.key === "news") {
    return item.context ?? item.takeaway ?? item.insight ?? item.whyItMatters;
  }
  return item.why ?? item.takeaway ?? item.insight ?? item.whyItMatters;
}

export function renderDigestMarkdown(digest) {
  const lines = [`# 每日 AI/产品/开源动态 - ${digest.date}`, ""];
  if (digest.digestSummary) {
    lines.push(`> ${digest.digestSummary}`, "");
  }
  if (digest.highlights?.length) {
    lines.push("## 今日先看", "");
    digest.highlights.slice(0, 5).forEach((item, index) => {
      lines.push(`${index + 1}. [${item.title}](${item.url})`);
      lines.push(`   - 理由：${item.reason}`);
    });
    lines.push("");
  }
  const sections = digest.sections ?? [];
  const ordered = [
    ...SECTION_ORDER.map((key) => sections.find((section) => section.key === key)).filter(Boolean),
    ...sections.filter((section) => !SECTION_ORDER.includes(section.key))
  ];

  for (const section of ordered) {
    lines.push(`## ${section.title ?? SECTION_TITLES[section.key] ?? section.key}`, "");
    if (section.description) lines.push(`${section.description}`, "");
    if (!section.items?.length) {
      lines.push("暂无值得单列的条目。", "");
      continue;
    }
    section.items.forEach((item, index) => {
      lines.push(`${index + 1}. [${item.title}](${item.url})`);
      for (const rendered of [
        bullet("信号", [item.sourceLabel || item.sources?.join(", "), item.metricsText].filter(Boolean).join(" · ")),
        bullet("做什么", item.what ?? item.lead ?? item.summary ?? item.oneLiner),
        bullet(secondaryLabel(section.key), secondaryValue(section, item))
      ]) {
        if (rendered.trim()) lines.push(rendered.trimEnd());
      }
      lines.push("");
    });
  }

  return lines.filter((line, index, arr) => !(line === "" && arr[index - 1] === "")).join("\n").trim() + "\n";
}
