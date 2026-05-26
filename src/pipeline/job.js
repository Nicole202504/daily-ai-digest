import { getTodayWindow, isoHoursAgo } from "../core/date.js";
import { runCollectors } from "../collectors/index.js";
import { JsonStore } from "../store/jsonStore.js";
import { buildDigestWithOptionalLlm } from "./llmEditor.js";
import { normalizeCollectorResults, sourceStatusFromResults } from "./normalize.js";
import { summarizeSourceItems } from "./sourceSummarizer.js";

export async function runDailyJob({
  date,
  now = new Date(),
  store = new JsonStore(),
  dryRun = false,
  onProgress
} = {}) {
  const today = date ? { date } : getTodayWindow("Asia/Shanghai", now);
  onProgress?.({ stage: "start", date: today.date, dryRun });

  onProgress?.({ stage: "collect", status: "start" });
  const results = await runCollectors({
    aihot: { since: isoHoursAgo(24, now), take: 100 },
    productHunt: { now },
    githubTrending: { limit: 20 },
    onProgress
  });
  onProgress?.({ stage: "collect", status: "done", sourceCount: results.length });

  onProgress?.({ stage: "normalize", status: "start" });
  const items = summarizeSourceItems(normalizeCollectorResults(results));
  onProgress?.({ stage: "normalize", status: "done", itemCount: items.length });

  onProgress?.({ stage: "edit", status: "start" });
  const digest = await buildDigestWithOptionalLlm({ date: today.date, items });
  onProgress?.({
    stage: "edit",
    status: "done",
    editor: digest.editor,
    warning: digest.editorWarning
  });

  onProgress?.({ stage: "status", status: "start" });
  const status = sourceStatusFromResults(results);
  onProgress?.({ stage: "status", status: "done" });

  if (!dryRun) {
    onProgress?.({ stage: "save", status: "start" });
    await store.saveRaw(today.date, results);
    await store.saveItems(today.date, items);
    await store.saveDigest(today.date, digest);
    await store.saveStatus(status);
    onProgress?.({ stage: "save", status: "done" });
  }

  onProgress?.({ stage: "finish", date: today.date });
  return { date: today.date, results, status, items, digest };
}
