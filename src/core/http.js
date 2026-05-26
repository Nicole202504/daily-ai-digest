const DEFAULT_FETCH_TIMEOUT_MS = 10000;

async function fetchWithTimeout(url, options = {}) {
  const timeoutMs = Number(options.timeoutMs ?? process.env.SOURCE_FETCH_TIMEOUT_MS ?? DEFAULT_FETCH_TIMEOUT_MS);
  const controller = typeof AbortController === "undefined" ? null : new AbortController();
  const timer =
    controller && timeoutMs > 0
      ? setTimeout(() => controller.abort(new Error(`Fetch timed out after ${timeoutMs}ms`)), timeoutMs)
      : null;

  try {
    const { timeoutMs: _timeoutMs, ...fetchOptions } = options;
    return await fetch(url, controller ? { ...fetchOptions, signal: controller.signal } : fetchOptions);
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`GET ${url} timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function fetchJson(url, options = {}) {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      "User-Agent": process.env.AIHOT_USER_AGENT ?? "Mozilla/5.0 daily-ai-digest/0.1",
      Accept: "application/json",
      ...(options.headers ?? {})
    }
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GET ${url} failed: HTTP ${response.status} ${body.slice(0, 200)}`);
  }
  return response.json();
}

export async function fetchText(url, options = {}) {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      "User-Agent": process.env.AIHOT_USER_AGENT ?? "Mozilla/5.0 daily-ai-digest/0.1",
      Accept: "text/plain, application/xml, text/xml, */*",
      ...(options.headers ?? {})
    }
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GET ${url} failed: HTTP ${response.status} ${body.slice(0, 200)}`);
  }
  return response.text();
}
