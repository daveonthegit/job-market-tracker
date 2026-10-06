import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { lastDays, renderReadmeBlock, renderSummary, skillCounts, spliceReadme } from "../src/summary.ts";
import type { Snapshot } from "../src/types.ts";
import { posting } from "./helpers.ts";

const SKILLS = ["typescript", "react", "python"];

const day = (date: string, n: number, extra: Partial<Snapshot> = {}): Snapshot => ({
  date,
  generatedAt: `${date}T13:23:00.000Z`,
  sources: [{ source: "greenhouse", fetched: 100, matched: n, new: n }],
  postings: Array.from({ length: n }, (_, i) =>
    posting({
      id: `greenhouse:acme:${date}-${i}`,
      company: i % 2 ? "Acme" : "Globex",
      title: i % 2 ? "React Engineer" : "TypeScript Engineer",
      remote: i === 0,
      url: `https://x.test/${date}/${i}`,
    }),
  ),
  ...extra,
});

describe("summary", () => {
  const snapshots = [day("2026-08-01", 9), day("2026-10-04", 3), day("2026-10-06", 4)];
  const md = renderSummary(snapshots, "2026-10-06", SKILLS);

  it("lastDays counts back across month boundaries", () => {
    assert.deepEqual(lastDays("2026-03-01", 3), ["2026-03-01", "2026-02-28", "2026-02-27"]);
  });

  it("reports today's count, sources and top companies", () => {
    assert.match(md, /\*\*4 new postings\*\* today/);
    assert.match(md, /\| greenhouse \| 100 \| 4 \| 4 \|/);
    assert.match(md, /\| Acme \| 2 \|\n\| Globex \| 2 \|/);
  });

  it("builds a 30-day trend with gaps marked and older days excluded", () => {
    assert.match(md, /\| 2026-10-06 \| 4 \| 25% \| /);
    assert.match(md, /\| 2026-10-05 \| — \| — \| — \|/);
    assert.match(md, /\| 2026-10-04 \| 3 \| 33% \| /);
    assert.doesNotMatch(md, /2026-08-01/);
    assert.equal(md.match(/^\| 2026-\d\d-\d\d \|/gm)?.length, 30);
  });

  it("counts skills from titles and tags", () => {
    assert.deepEqual(skillCounts(snapshots[2]!.postings, SKILLS), [["react", 2], ["typescript", 2]]);
    assert.deepEqual(skillCounts([posting({ title: "Engineer", tags: ["python"] })], SKILLS), [["python", 1]]);
  });

  it("handles a day with zero new postings", () => {
    const md0 = renderSummary([day("2026-10-06", 0)], "2026-10-06", SKILLS);
    assert.match(md0, /\*\*0 new postings\*\*/);
    assert.match(md0, /_No new postings today._/);
    assert.match(md0, /\| 2026-10-06 \| 0 \| — \| — \|/);
  });

  it("escapes pipes in company names", () => {
    const s = day("2026-10-06", 1);
    s.postings[0]!.company = "A|B";
    assert.match(renderSummary([s], "2026-10-06", SKILLS), /\| A\\\|B \| 1 \|/);
  });

  it("splices the README block between markers and refuses when they are missing", () => {
    const block = renderReadmeBlock(snapshots, "2026-10-06", SKILLS);
    assert.match(block, /\*\*4\*\* new postings · \*\*7\*\* over the last 30 days \(2 snapshots\)/);
    const readme = "# T\n<!-- snapshot:start -->\nold\n<!-- snapshot:end -->\nrest\n";
    assert.equal(spliceReadme(readme, "new"), "# T\n<!-- snapshot:start -->\nnew\n<!-- snapshot:end -->\nrest\n");
    assert.throws(() => spliceReadme("# T\n", "x"), /missing/);
  });

  it("the real README carries the snapshot markers", () => {
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
    assert.doesNotThrow(() => spliceReadme(readme, "x"));
  });
});
