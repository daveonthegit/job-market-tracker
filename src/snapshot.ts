import { seenKeys, takeNew } from "./dedupe.ts";
import { isRecent, matchesCriteria } from "./filter.ts";
import type { SourceFetch } from "./sources/index.ts";
import type { Criteria, Snapshot } from "./types.ts";

/**
 * Turn raw source results into today's snapshot: filter by criteria and age, then keep
 * only postings not seen earlier today (another source) or on any earlier day.
 */
export function buildSnapshot(
  fetched: SourceFetch[],
  history: Snapshot[],
  criteria: Criteria,
  date: string,
  now: Date,
): Snapshot {
  const seen = seenKeys(history.filter((s) => s.date < date).flatMap((s) => s.postings));
  const snapshot: Snapshot = { date, generatedAt: now.toISOString(), sources: [], postings: [] };
  for (const { source, postings } of fetched) {
    const matched = postings.filter(
      (p) => matchesCriteria(p, criteria) && isRecent(p, date, criteria.maxAgeDays),
    );
    const fresh = takeNew(matched, seen);
    snapshot.sources.push({ source, fetched: postings.length, matched: matched.length, new: fresh.length });
    snapshot.postings.push(...fresh);
  }
  return snapshot;
}
