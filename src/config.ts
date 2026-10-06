import { readFile } from "node:fs/promises";
import type { Criteria } from "./types.ts";

function assertStringArray(value: unknown, name: string): asserts value is string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    throw new Error(`config: "${name}" must be an array of strings`);
  }
}

/** Validate a parsed criteria object; throws with a readable message on bad shape. */
export function parseCriteria(raw: unknown): Criteria {
  if (typeof raw !== "object" || raw === null) throw new Error("config: expected an object");
  const c = raw as Record<string, unknown>;
  for (const key of ["keywords", "excludeKeywords", "locations", "remoteRegions", "skills"]) {
    assertStringArray(c[key], key);
  }
  if (!Number.isInteger(c.maxAgeDays) || (c.maxAgeDays as number) < 1) {
    throw new Error('config: "maxAgeDays" must be a positive integer');
  }
  const s = c.sources as Criteria["sources"] | undefined;
  if (!s || typeof s !== "object") throw new Error('config: "sources" is required');
  for (const key of ["remotive", "arbeitnow", "hn", "greenhouse", "lever"] as const) {
    if (typeof s[key]?.enabled !== "boolean") throw new Error(`config: sources.${key}.enabled must be a boolean`);
  }
  assertStringArray(s.greenhouse.boards, "sources.greenhouse.boards");
  assertStringArray(s.lever.boards, "sources.lever.boards");
  if (!Number.isInteger(s.arbeitnow.maxPages) || s.arbeitnow.maxPages < 1) {
    throw new Error("config: sources.arbeitnow.maxPages must be a positive integer");
  }
  return raw as Criteria;
}

export async function loadCriteria(path: string): Promise<Criteria> {
  return parseCriteria(JSON.parse(await readFile(path, "utf8")));
}
