import { readFileSync } from "fs";
import { resolve } from "path";

const dataDir = process.env.DATA_DIR || "./data";
const latestPath = resolve(dataDir, "digests", "latest.json");

const REQUIRED_SECTIONS = ["product", "github", "company", "technical", "news"];
const MIN_TOTAL_ITEMS = 10;

function fail(msg) {
  console.error(`❌ 验证失败: ${msg}`);
  process.exit(1);
}

let digest;
try {
  digest = JSON.parse(readFileSync(latestPath, "utf-8"));
} catch (e) {
  fail(`无法读取 ${latestPath}: ${e.message}`);
}

if (!digest.date) fail("digest 缺少 date 字段");
if (!digest.generatedAt) fail("digest 缺少 generatedAt 字段");
if (!Array.isArray(digest.sections)) fail("digest.sections 不是数组");

const sectionKeys = digest.sections.map((s) => s.key);
const missing = REQUIRED_SECTIONS.filter((k) => !sectionKeys.includes(k));
if (missing.length) fail(`缺少分类: ${missing.join(", ")}`);

const coreSections = ["product", "github", "technical", "news"];
const emptyCore = digest.sections.filter((s) => coreSections.includes(s.key) && !s.items?.length);
if (emptyCore.length > 1) {
  fail(`核心分类无内容: ${emptyCore.map((s) => s.key).join(", ")}`);
}

const totalItems = digest.sections.reduce((sum, s) => sum + (s.items?.length ?? 0), 0);
if (totalItems < MIN_TOTAL_ITEMS) {
  fail(`总条目数 ${totalItems} 低于最小阈值 ${MIN_TOTAL_ITEMS}`);
}

console.log(`✅ 验证通过: ${digest.date}, ${digest.sections.length} 个分类, ${totalItems} 条内容`);
for (const s of digest.sections) {
  console.log(`   ${s.key}: ${s.items?.length ?? 0} 条`);
}
