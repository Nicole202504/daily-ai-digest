import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadDotEnv } from "./core/env.js";
import { JsonStore } from "./store/jsonStore.js";
import { pageHtml } from "./server.js";

await loadDotEnv();

const outDir = process.env.STATIC_DIR ?? "public";
const store = new JsonStore();
const digest = await store.latestDigest();
const dates = await store.digestDates();

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "index.html"), pageHtml(digest, dates), "utf8");

if (digest) {
  const dailyPath = join(outDir, "daily", digest.date, "index.html");
  await mkdir(dirname(dailyPath), { recursive: true });
  await writeFile(dailyPath, pageHtml(digest, dates), "utf8");
}

console.log(`Static site exported to ${outDir}`);
