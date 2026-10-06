import { readFileSync } from "node:fs";
import type { Criteria, Posting } from "../src/types.ts";
import { parseCriteria } from "../src/config.ts";

export function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

/** The real config, so tests catch a criteria file that no longer parses. */
export const criteria: Criteria = parseCriteria(
  JSON.parse(readFileSync(new URL("../config/criteria.json", import.meta.url), "utf8")),
);

export function posting(overrides: Partial<Posting> = {}): Posting {
  return {
    id: "greenhouse:acme:1",
    source: "greenhouse",
    company: "Acme",
    title: "Full Stack Engineer",
    location: "New York, NY",
    remote: false,
    url: "https://job-boards.greenhouse.io/acme/jobs/1",
    postedAt: "2026-10-01T00:00:00.000Z",
    tags: [],
    ...overrides,
  };
}

// Tests must never touch the network: fail loudly if anything calls fetch.
globalThis.fetch = () => Promise.reject(new Error("network access is disabled in tests"));
