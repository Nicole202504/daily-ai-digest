import { runDailyJob } from "./pipeline/job.js";
import { loadDotEnv } from "./core/env.js";
import { getTodayWindow } from "./core/date.js";
import { JsonStore } from "./store/jsonStore.js";

const command = process.argv[2] ?? "help";

await loadDotEnv();

function logProgress(event) {
  const at = new Date().toISOString().slice(11, 19);
  if (event.stage === "start") {
    console.error(`[${at}] start daily job date=${event.date}${event.dryRun ? " dry-run" : ""}`);
    return;
  }
  if (event.stage === "finish") {
    console.error(`[${at}] finish daily job date=${event.date}`);
    return;
  }
  if (event.stage === "collect" && event.source) {
    if (event.status === "start") console.error(`[${at}] collecting ${event.source}...`);
    if (event.status === "done") {
      console.error(`[${at}] collected ${event.source}: ${event.itemCount} items in ${event.durationMs}ms`);
    }
    if (event.status === "error") {
      console.error(`[${at}] ${event.source} failed in ${event.durationMs}ms: ${event.error}`);
    }
    return;
  }
  if (event.stage === "edit" && event.status === "done") {
    const warning = event.warning ? ` warning=${event.warning}` : "";
    console.error(`[${at}] edit done: editor=${event.editor}${warning}`);
    return;
  }
  if (event.status) {
    console.error(`[${at}] ${event.stage} ${event.status}`);
  }
}

if (command === "run") {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const dateArg = process.argv.find((arg) => arg.startsWith("--date="));
  const date = dateArg?.split("=")[1];

  if (!force && !dryRun && !date) {
    const store = new JsonStore();
    const today = getTodayWindow("Asia/Shanghai");
    const existing = await store.digest(today.date);
    if (existing) {
      console.error(`[skip] digest for ${today.date} already exists. Use --force to regenerate.`);
      process.exit(0);
    }
  }

  const result = await runDailyJob({ date, dryRun, onProgress: logProgress });
  console.log(result.digest.markdown);
  if (result.status.some((source) => source.errors?.length)) {
    console.error("\nSource warnings/errors:");
    for (const source of result.status.filter((entry) => entry.errors?.length)) {
      console.error(`- ${source.source}: ${source.errors.join("; ")}`);
    }
  }
} else {
  console.log(`Usage:
  npm run job
  node src/cli.js run --dry-run
  node src/cli.js run --date=2026-05-26
`);
}
