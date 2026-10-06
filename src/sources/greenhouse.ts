import type { FetchJson } from "../http.ts";
import type { Posting } from "../types.ts";
import { expectArray, isObj, isoDate, str } from "./shape.ts";

export const greenhouseUrl = (board: string) =>
  `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs`;

/** Parse a public Greenhouse job-board response (`GET /v1/boards/{board}/jobs`). */
export function parseGreenhouse(raw: unknown, board: string): Posting[] {
  if (!isObj(raw)) throw new Error(`greenhouse/${board}: expected an object`);
  return expectArray(raw.jobs, `greenhouse/${board}.jobs`)
    .filter(isObj)
    .map((j): Posting => {
      const location = isObj(j.location) ? str(j.location.name) : "";
      return {
        id: `greenhouse:${board}:${String(j.id)}`,
        source: "greenhouse",
        company: str(j.company_name) || board,
        title: str(j.title),
        location,
        remote: /\bremote\b/i.test(location),
        url: str(j.absolute_url),
        postedAt: isoDate(j.first_published) ?? isoDate(j.updated_at),
        tags: [],
      };
    })
    .filter((p) => p.title && p.url);
}

export async function fetchGreenhouse(http: FetchJson, board: string): Promise<Posting[]> {
  return parseGreenhouse(await http(greenhouseUrl(board)), board);
}
