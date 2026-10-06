import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRecent, matchesCriteria, remoteRegionAllowed } from "../src/filter.ts";
import { containsTerm } from "../src/text.ts";
import { criteria, posting } from "./helpers.ts";

describe("containsTerm", () => {
  it("matches whole terms, including punctuated ones", () => {
    assert.ok(containsTerm("Senior Node.js Engineer", "node"));
    assert.ok(containsTerm("C# developer", "c#"));
    assert.ok(!containsTerm("Internal Tools Engineer", "intern"));
    assert.ok(!containsTerm("Reactor physicist", "react"));
  });
});

describe("matchesCriteria", () => {
  it("accepts a matching US onsite role", () => {
    assert.ok(matchesCriteria(posting(), criteria));
  });

  it("requires a keyword in the title or tags", () => {
    assert.ok(!matchesCriteria(posting({ title: "Data Analyst" }), criteria));
    assert.ok(matchesCriteria(posting({ title: "Engineer II", tags: ["typescript"] }), criteria));
  });

  it("rejects excluded titles", () => {
    assert.ok(!matchesCriteria(posting({ title: "Software Engineer Intern" }), criteria));
    assert.ok(!matchesCriteria(posting({ title: "Engineering Manager, Frontend" }), criteria));
  });

  it("rejects onsite roles outside the configured locations", () => {
    assert.ok(!matchesCriteria(posting({ location: "Berlin, Germany" }), criteria));
  });

  it("accepts remote roles open to the US or unrestricted, rejects other regions", () => {
    assert.ok(remoteRegionAllowed("Remote", criteria));
    assert.ok(remoteRegionAllowed("Remote - United States", criteria));
    assert.ok(remoteRegionAllowed("REMOTE (Worldwide)", criteria));
    assert.ok(remoteRegionAllowed("", criteria));
    assert.ok(!remoteRegionAllowed("Remote - Germany", criteria));
    assert.ok(!matchesCriteria(posting({ remote: true, location: "Remote, EMEA" }), criteria));
  });
});

describe("isRecent", () => {
  it("drops postings older than maxAgeDays, keeps undated ones", () => {
    assert.ok(isRecent(posting({ postedAt: "2026-09-10T00:00:00Z" }), "2026-10-06", 30));
    assert.ok(!isRecent(posting({ postedAt: "2020-01-01T00:00:00Z" }), "2026-10-06", 30));
    assert.ok(isRecent(posting({ postedAt: null }), "2026-10-06", 30));
  });
});
