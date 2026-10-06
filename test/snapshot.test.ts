import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSnapshot } from "../src/snapshot.ts";
import { fetchAll, SourceError } from "../src/sources/index.ts";
import type { Criteria, Snapshot } from "../src/types.ts";
import { criteria, fixture, posting } from "./helpers.ts";

const NOW = new Date("2026-10-06T13:23:00Z");

describe("buildSnapshot", () => {
  it("filters, dedupes across sources and against earlier days, and reports per-source counts", () => {
    const old = posting({ id: "greenhouse:acme:old", title: "Backend Engineer", url: "https://x.test/old" });
    const history: Snapshot[] = [{ date: "2026-10-05", generatedAt: "", sources: [], postings: [old] }];
    const gh = posting();
    const snapshot = buildSnapshot(
      [
        { source: "greenhouse", postings: [gh, old, posting({ id: "g:3", title: "Recruiter", url: "https://x.test/3" })] },
        { source: "remotive", postings: [posting({ id: "remotive:1", source: "remotive", url: "https://r.test/1" })] },
      ],
      history,
      criteria,
      "2026-10-06",
      NOW,
    );
    assert.deepEqual(snapshot.postings, [gh]);
    assert.deepEqual(snapshot.sources, [
      { source: "greenhouse", fetched: 3, matched: 2, new: 1 },
      { source: "remotive", fetched: 1, matched: 1, new: 0 },
    ]);
    assert.equal(snapshot.generatedAt, NOW.toISOString());
  });

  it("ignores a same-day snapshot from an earlier run so reruns are idempotent", () => {
    const p = posting();
    const sameDay: Snapshot[] = [{ date: "2026-10-06", generatedAt: "", sources: [], postings: [p] }];
    const snapshot = buildSnapshot([{ source: "greenhouse", postings: [p] }], sameDay, criteria, "2026-10-06", NOW);
    assert.deepEqual(snapshot.postings, [p]);
  });
});

describe("fetchAll", () => {
  const only = (enable: Partial<Record<keyof Criteria["sources"], boolean>>): Criteria => ({
    ...criteria,
    sources: {
      remotive: { ...criteria.sources.remotive, enabled: !!enable.remotive },
      arbeitnow: { ...criteria.sources.arbeitnow, enabled: !!enable.arbeitnow },
      hn: { enabled: !!enable.hn },
      greenhouse: { enabled: !!enable.greenhouse, boards: ["acme"] },
      lever: { enabled: !!enable.lever, boards: ["initech"] },
    },
  });

  it("fetches enabled sources through the injected fetcher", async () => {
    const http = async (url: string) => (url.includes("greenhouse") ? fixture("greenhouse.json") : fixture("lever.json"));
    const results = await fetchAll(http, only({ greenhouse: true, lever: true }), 0);
    assert.deepEqual(results.map((r) => [r.source, r.postings.length]), [["greenhouse", 2], ["lever", 2]]);
  });

  it("fails the whole run if any source errors, naming every failure", async () => {
    const http = async (url: string) => {
      if (url.includes("lever")) throw new Error("HTTP 503");
      return fixture("greenhouse.json");
    };
    await assert.rejects(fetchAll(http, only({ greenhouse: true, lever: true }), 0), (err: Error) => {
      assert.ok(err instanceof SourceError);
      assert.match(err.message, /lever: HTTP 503/);
      return true;
    });
  });

  it("treats an empty feed as a failure rather than a quiet day", async () => {
    const http = async () => ({ jobs: [] });
    await assert.rejects(fetchAll(http, only({ remotive: true }), 0), /remotive: returned no postings/);
  });
});
