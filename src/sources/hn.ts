import type { FetchJson } from "../http.ts";
import type { Posting } from "../types.ts";
import { decodeEntities } from "../text.ts";
import { expectArray, isObj, isoDate, str } from "./shape.ts";

export const HN_SEARCH_URL =
  "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=10";
export const hnItemUrl = (id: string) => `https://hn.algolia.com/api/v1/items/${encodeURIComponent(id)}`;

/** Pick the newest "Ask HN: Who is hiring?" story id from an Algolia search response. */
export function findHiringThread(raw: unknown): string {
  if (!isObj(raw)) throw new Error("hn search: expected an object");
  const hit = expectArray(raw.hits, "hn search.hits")
    .filter(isObj)
    .filter((h) => /^ask hn: who is hiring\?/i.test(str(h.title)))
    .sort((a, b) => Number(b.created_at_i ?? 0) - Number(a.created_at_i ?? 0))[0];
  if (!hit) throw new Error('hn search: no "Who is hiring?" thread found');
  return str(hit.objectID);
}

const ROLE_RE =
  /\b(engineers?|developers?|swe|sde|programmers?|architects?|scientists?|designers?|devops|sre|cto|founding|full[- ]?stack|front[- ]?end|back[- ]?end|roles|positions|hiring)\b/i;
const LOCATION_RE =
  /\b(remote|onsite|on-site|in[- ]office|hybrid|usa?|united states|uk|eu|europe|canada|germany|london|berlin|new york|nyc|san francisco|sf|bay area|seattle|boston|austin|toronto)\b|,\s*[A-Z]{2}\b/i;
const NON_LOCATION_RE = /\b(full[- ]?time|part[- ]?time|contract|visa|equity|salary|\$|€|£|\d+k)\b/i;

/** Drop inline URLs and run-on prose when a comment has no line break after its header. */
function cleanTitle(s: string): string {
  const t = s.replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
  return t.length > 120 ? `${t.slice(0, 117).trimEnd()}…` : t;
}

/** Split the first line of a "Who is hiring" comment into company / title / location. */
export function parseHnHeader(header: string): { company: string; title: string; location: string; remote: boolean } {
  const segments = header
    .split(/\s+[|—–]\s+|\s*\|\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const [first = "", ...rest] = segments;
  const paren = first.match(/\(([^)]*)\)/)?.[1]?.trim() ?? "";
  const company = first
    .replace(/\([^)]*\)/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const title = rest.find((s) => ROLE_RE.test(s) && !LOCATION_RE.test(s.replace(ROLE_RE, ""))) ??
    rest.find((s) => ROLE_RE.test(s)) ??
    "";
  const locations = rest.filter((s) => s !== title && LOCATION_RE.test(s) && !NON_LOCATION_RE.test(s));
  if (paren && LOCATION_RE.test(paren)) locations.unshift(paren);
  return {
    company,
    title: cleanTitle(title),
    location: locations.join(" / "),
    remote: /\bremote\b/i.test(header) && !/\bno remote\b/i.test(header),
  };
}

/** Parse the Algolia item tree of a "Who is hiring?" thread into postings (top-level comments only). */
export function parseHnThread(raw: unknown): Posting[] {
  if (!isObj(raw)) throw new Error("hn item: expected an object");
  return expectArray(raw.children, "hn item.children")
    .filter(isObj)
    .flatMap((c): Posting[] => {
      const html = str(c.text);
      if (!html) return []; // deleted / dead comments
      const header = decodeEntities(html.split(/<p>/i)[0]!.replace(/<[^>]*>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
      const { company, title, location, remote } = parseHnHeader(header);
      if (!company || !title) return [];
      const id = String(c.id);
      return [
        {
          id: `hn:${id}`,
          source: "hn",
          company,
          title,
          location,
          remote,
          url: `https://news.ycombinator.com/item?id=${id}`,
          postedAt: isoDate(c.created_at),
          tags: [],
        },
      ];
    });
}

export async function fetchHn(http: FetchJson): Promise<Posting[]> {
  const threadId = findHiringThread(await http(HN_SEARCH_URL));
  return parseHnThread(await http(hnItemUrl(threadId)));
}
