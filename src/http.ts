export const USER_AGENT =
  "job-market-tracker/0.1 (+https://github.com/daveonthegit/job-market-tracker; daily job-market snapshot)";

export type FetchJson = (url: string) => Promise<unknown>;

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface HttpOptions {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}

/**
 * GET a JSON document with a descriptive User-Agent. Retries network errors,
 * 429 and 5xx with exponential backoff (honouring Retry-After); any other
 * non-2xx status fails immediately.
 */
export function createFetchJson(opts: HttpOptions = {}): FetchJson {
  const { retries = 3, baseDelayMs = 2000, timeoutMs = 30_000 } = opts;
  return async (url) => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await sleep(baseDelayMs * 2 ** (attempt - 1));
      let res: Response;
      try {
        res = await fetch(url, {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        lastError = new Error(`GET ${url} failed: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
      if (res.ok) return res.json();
      lastError = new Error(`GET ${url} -> HTTP ${res.status}`);
      if (res.status !== 429 && res.status < 500) break;
      const retryAfter = Number(res.headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) await sleep(Math.min(retryAfter, 60) * 1000);
    }
    throw lastError;
  };
}
