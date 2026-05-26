import { collectAihotItems } from "./aihot.js";
import {
  collectFollowBuildersBlogs,
  collectFollowBuildersPodcasts,
  collectFollowBuildersX
} from "./followBuilders.js";
import { collectGithubTrendingWeekly } from "./githubTrending.js";
import { collectProductHuntTop10 } from "./productHunt.js";

export async function runCollectors(options = {}) {
  const collectors = [
    ["aihot", () => collectAihotItems(options.aihot)],
    ["product_hunt", () => collectProductHuntTop10(options.productHunt)],
    ["github_trending", () => collectGithubTrendingWeekly(options.githubTrending)],
    ["follow_builders_x", () => collectFollowBuildersX()],
    ["follow_builders_podcast", () => collectFollowBuildersPodcasts()],
    ["follow_builders_blog", () => collectFollowBuildersBlogs()]
  ];

  const results = [];
  for (const [source, collect] of collectors) {
    options.onProgress?.({ stage: "collect", status: "start", source });
    const startedAt = Date.now();
    try {
      const result = await collect();
      results.push(result);
      options.onProgress?.({
        stage: "collect",
        status: "done",
        source,
        itemCount: result.items?.length ?? 0,
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      options.onProgress?.({
        stage: "collect",
        status: "error",
        source,
        error: error.message,
        durationMs: Date.now() - startedAt
      });
      results.push({
        source,
        fetchedAt: new Date().toISOString(),
        items: [],
        errors: [error.message]
      });
    }
  }
  return results;
}
