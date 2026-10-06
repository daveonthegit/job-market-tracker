import { containsTerm } from "./text.ts";
import type { Criteria, Posting } from "./types.ts";

function anyTerm(haystack: string, terms: string[]): boolean {
  return terms.some((t) => t.trim() !== "" && containsTerm(haystack, t));
}

/** True when a remote posting's region restriction (if any) is acceptable. */
export function remoteRegionAllowed(location: string, criteria: Criteria): boolean {
  const residue = location
    .toLowerCase()
    .replace(/\b(fully |100% )?remote\b/g, " ")
    .replace(/[^a-z0-9.#]+/g, " ")
    .trim();
  if (residue === "") return true;
  return anyTerm(residue, criteria.remoteRegions) || anyTerm(residue, criteria.locations);
}

/** False when the posting's source date is more than `maxAgeDays` before `date`. Undated postings pass. */
export function isRecent(p: Posting, date: string, maxAgeDays: number): boolean {
  if (!p.postedAt) return true;
  const cutoff = new Date(`${date}T00:00:00Z`).getTime() - maxAgeDays * 86_400_000;
  return new Date(p.postedAt).getTime() >= cutoff;
}

/** Apply keyword, exclusion and location criteria to a normalized posting. */
export function matchesCriteria(p: Posting, criteria: Criteria): boolean {
  if (anyTerm(p.title, criteria.excludeKeywords)) return false;
  const searchable = `${p.title} ${p.tags.join(" ")}`;
  if (!anyTerm(searchable, criteria.keywords)) return false;
  if (p.remote) return remoteRegionAllowed(p.location, criteria);
  return anyTerm(p.location, criteria.locations);
}
