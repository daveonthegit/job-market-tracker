import type { Posting } from "./types.ts";

const TRACKING_PARAM = /^(utm_.*|ref|referrer|source|src|gh_src|lever-source.*)$/i;

/** Canonical form of a posting URL: lowercase host, no fragment, no tracking params, no trailing slash. */
export function normalizeUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return raw.trim().toLowerCase();
  }
  u.hash = "";
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) u.searchParams.delete(key);
  }
  u.searchParams.sort();
  const path = u.pathname.replace(/\/+$/, "");
  return `${u.host.toLowerCase().replace(/^www\./, "")}${path}${u.search}`;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Same company + title + location counts as the same posting, whatever the source or URL. */
export const fingerprint = (p: Posting) => `${norm(p.company)}|${norm(p.title)}|${norm(p.location)}`;

export function dedupeKeys(p: Posting): string[] {
  return [`id:${p.id}`, `url:${normalizeUrl(p.url)}`, `fp:${fingerprint(p)}`];
}

/**
 * Keep only postings none of whose keys are in `seen`; record the keys of every
 * kept posting so later duplicates (same day, other source) are dropped too.
 * Mutates `seen`.
 */
export function takeNew(postings: Posting[], seen: Set<string>): Posting[] {
  const fresh: Posting[] = [];
  for (const p of postings) {
    const keys = dedupeKeys(p);
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    fresh.push(p);
  }
  return fresh;
}

export function seenKeys(postings: Iterable<Posting>): Set<string> {
  const seen = new Set<string>();
  for (const p of postings) dedupeKeys(p).forEach((k) => seen.add(k));
  return seen;
}
