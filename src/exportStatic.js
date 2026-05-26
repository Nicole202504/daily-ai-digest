import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "./core/env.js";
import { JsonStore } from "./store/jsonStore.js";

await loadDotEnv();

const outDir = process.env.STATIC_DIR ?? "public";
const staticDir = fileURLToPath(new URL("./static/", import.meta.url));
const store = new JsonStore();
const digest = await store.latestDigest();
const dates = await store.digestDates();

async function copyStaticAsset(from, to) {
  const target = join(outDir, to);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(staticDir, from), target);
}

async function writeJson(path, value) {
  const target = join(outDir, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

await mkdir(outDir, { recursive: true });
await copyStaticAsset("index.html", "index.html");
await copyStaticAsset("app.js", "assets/app.js");
await copyStaticAsset("style.css", "assets/style.css");

await writeJson("data/index.json", { latest: digest?.date ?? null, dates });
await writeJson("data/latest.json", digest ?? null);

for (const date of dates) {
  const dailyDigest = date === digest?.date ? digest : await store.digest(date);
  if (dailyDigest) {
    await writeJson(`data/${date}.json`, dailyDigest);
  }
}

console.log(`Static app exported to ${outDir}`);
