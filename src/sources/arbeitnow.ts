import { sleep, type FetchJson } from "../http.ts";
import type { Posting } from "../types.ts";
import { expectArray, isObj, isoDate, lowerTags, str } from "./shape.ts";

export const ARBEITNOW_URL = "https://www.arbeitnow.com/api/job-board-api";

export interface ArbeitnowPage {
  postings: Posting[];
  next: string | null;
}

/** Parse one page of the Arbeitnow job-board API. */
export function parseArbeitnow(raw: unknown): ArbeitnowPage {
  if (!isObj(raw)) throw new Error("arbeitnow: expected an object");
  const postings = expectArray(raw.data, "arbeitnow.data")
    .filter(isObj)
    .map((j): Posting => ({
      id: `arbeitnow:${str(j.slug)}`,
      source: "arbeitnow",
      company: str(j.company_name),
      title: str(j.title),
      location: str(j.location),
      remote: j.remote === true,
      url: str(j.url),
      // created_at is a unix timestamp in seconds.
      postedAt: typeof j.created_at === "number" ? isoDate(j.created_at * 1000) : null,
      tags: lowerTags(j.tags),
    }))
    .filter((p) => p.title && p.url);
  const links = isObj(raw.links) ? raw.links : {};
  return { postings, next: str(links.next) || null };
}

/** Fetch up to `maxPages` pages (newest first), pausing between pages. */
export async function fetchArbeitnow(http: FetchJson, maxPages: number, pauseMs = 1000): Promise<Posting[]> {
  const out: Posting[] = [];
  let url: string | null = ARBEITNOW_URL;
  for (let page = 0; url && page < maxPages; page++) {
    if (page > 0) await sleep(pauseMs);
    const parsed = parseArbeitnow(await http(url));
    out.push(...parsed.postings);
    url = parsed.next;
  }
  return out;
}
