import type { FetchJson } from "../http.ts";
import type { Posting } from "../types.ts";
import { expectArray, isObj, isoDate, lowerTags, str } from "./shape.ts";

export const remotiveUrl = (category: string) =>
  `https://remotive.com/api/remote-jobs?category=${encodeURIComponent(category)}`;

/** Remotive timestamps ("2026-10-05T05:15:43") carry no zone; they are UTC. */
const assumeUtc = (s: string) => (s && !/(z|[+-]\d\d:?\d\d)$/i.test(s) ? `${s}Z` : s);

/** Parse the Remotive public API response. Every Remotive job is remote. */
export function parseRemotive(raw: unknown): Posting[] {
  if (!isObj(raw)) throw new Error("remotive: expected an object");
  return expectArray(raw.jobs, "remotive.jobs")
    .filter(isObj)
    .map((j): Posting => ({
      id: `remotive:${String(j.id)}`,
      source: "remotive",
      company: str(j.company_name),
      title: str(j.title),
      location: str(j.candidate_required_location),
      remote: true,
      url: str(j.url),
      postedAt: isoDate(assumeUtc(str(j.publication_date))),
      tags: lowerTags(j.tags),
    }))
    .filter((p) => p.title && p.url);
}

export async function fetchRemotive(http: FetchJson, category: string): Promise<Posting[]> {
  return parseRemotive(await http(remotiveUrl(category)));
}
