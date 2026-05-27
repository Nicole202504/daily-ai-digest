export default {
  async scheduled(event, env, ctx) {
    const targets = JSON.parse(env.TARGETS || "[]");
    const token = env.GITHUB_TOKEN;
    if (!token) {
      console.error("GITHUB_TOKEN not set");
      return;
    }

    for (const target of targets) {
      const url = `https://api.github.com/repos/${target.repo}/actions/workflows/${target.workflow}/dispatches`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "daily-digest-cron-worker",
          "X-GitHub-Api-Version": "2022-11-28"
        },
        body: JSON.stringify({ ref: target.ref || "main" })
      });

      if (res.status === 204) {
        console.log(`Triggered ${target.repo}/${target.workflow}`);
      } else {
        const body = await res.text();
        console.error(`Failed ${target.repo}: HTTP ${res.status} — ${body.slice(0, 200)}`);
      }
    }
  },

  async fetch(request, env) {
    return new Response("daily-digest-cron-worker is running. Triggers are via cron only.", {
      headers: { "Content-Type": "text/plain" }
    });
  }
};
