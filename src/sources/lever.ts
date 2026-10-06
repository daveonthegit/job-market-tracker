import type { FetchJson } from "../http.ts";
import type { Posting } from "../types.ts";
import { expectArray, isObj, isoDate, lowerTags, str } from "./shape.ts";

export const leverUrl = (board: string) =>
  `https://api.lever.co/v0/postings/${encodeURIComponent(board)}?mode=json`;

/** Lever slugs are lowercase; show "Spotify" rather than "spotify". */
const displayName = (board: string) => board.charAt(0).toUpperCase() + board.slice(1);

/** Parse a public Lever postings response (`GET /v0/postings/{board}?mode=json`). */
export function parseLever(raw: unknown, board: string): Posting[] {
  return expectArray(raw, `lever/${board}`)
    .filter(isObj)
    .map((j): Posting => {
      const cat = isObj(j.categories) ? j.categories : {};
      const location = str(cat.location);
      return {
        id: `lever:${board}:${str(j.id)}`,
        source: "lever",
        company: displayName(board),
        title: str(j.text),
        location,
        remote: str(j.workplaceType).toLowerCase() === "remote" || /\bremote\b/i.test(location),
        url: str(j.hostedUrl),
        postedAt: isoDate(j.createdAt),
        tags: lowerTags([cat.team, cat.department]),
      };
    })
    .filter((p) => p.title && p.url);
}

export async function fetchLever(http: FetchJson, board: string): Promise<Posting[]> {
  return parseLever(await http(leverUrl(board)), board);
}
