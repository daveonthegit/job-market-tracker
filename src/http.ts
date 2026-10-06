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
      const header = res.headers.get("retry-after");
      const retryAfterMs = header === null ? 0 : /^\d+$/.test(header.trim())
        ? Number(header) * 1000
        : Math.max(0, Date.parse(header) - Date.now());
      if (retryAfterMs > 60_000) {
        throw new Error(`GET ${url} -> HTTP ${res.status}: Retry-After exceeds 60s wait budget`);
      }
      if (attempt < retries && Number.isFinite(retryAfterMs) && retryAfterMs > 0) await sleep(retryAfterMs);
    }
    throw lastError;
  };
}
