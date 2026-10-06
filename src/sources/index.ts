import { sleep, type FetchJson } from "../http.ts";
import type { Criteria, Posting, SourceName } from "../types.ts";
import { fetchArbeitnow } from "./arbeitnow.ts";
import { fetchGreenhouse } from "./greenhouse.ts";
import { fetchHn } from "./hn.ts";
import { fetchLever } from "./lever.ts";
import { fetchRemotive } from "./remotive.ts";

export interface SourceFetch {
  source: SourceName;
  postings: Posting[];
}

export class SourceError extends Error {}

/**
 * Fetch every enabled source, sequentially and politely (a pause between
 * requests to the same host). ATS boards come first so that when the same job
 * appears on an aggregator too, the employer's own posting is the one kept.
 * Any source failure fails the whole run: a partial day would silently skew
 * the dataset, so we would rather record nothing.
 */
export async function fetchAll(http: FetchJson, criteria: Criteria, pauseMs = 500): Promise<SourceFetch[]> {
  const s = criteria.sources;
  const tasks: [SourceName, () => Promise<Posting[]>][] = [];
  const boards = (fetchBoard: (h: FetchJson, b: string) => Promise<Posting[]>, list: string[]) => async () => {
    const out: Posting[] = [];
    for (const [i, board] of list.entries()) {
      if (i > 0) await sleep(pauseMs);
      out.push(...(await fetchBoard(http, board)));
    }
    return out;
  };
  if (s.greenhouse.enabled) tasks.push(["greenhouse", boards(fetchGreenhouse, s.greenhouse.boards)]);
  if (s.lever.enabled) tasks.push(["lever", boards(fetchLever, s.lever.boards)]);
  if (s.remotive.enabled) tasks.push(["remotive", () => fetchRemotive(http, s.remotive.category)]);
  if (s.arbeitnow.enabled) tasks.push(["arbeitnow", () => fetchArbeitnow(http, s.arbeitnow.maxPages, pauseMs * 2)]);
  if (s.hn.enabled) tasks.push(["hn", () => fetchHn(http)]);

  const results: SourceFetch[] = [];
  const errors: string[] = [];
  for (const [source, run] of tasks) {
    try {
      const postings = await run();
      if (postings.length === 0) throw new Error("returned no postings at all (feed empty or schema changed?)");
      results.push({ source, postings });
    } catch (err) {
      errors.push(`${source}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (errors.length > 0) throw new SourceError(`source fetch failed:\n  ${errors.join("\n  ")}`);
  return results;
}
