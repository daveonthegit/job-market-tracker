import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fingerprint, normalizeUrl, seenKeys, takeNew } from "../src/dedupe.ts";
import { posting } from "./helpers.ts";

describe("normalizeUrl", () => {
  it("drops tracking params, fragments, trailing slashes and www, keeps meaningful params", () => {
    assert.equal(
      normalizeUrl("https://WWW.Example.com/jobs/1/?utm_source=hn&gh_jid=42#apply"),
      "example.com/jobs/1?gh_jid=42",
    );
    assert.equal(normalizeUrl("https://news.ycombinator.com/item?id=5"), "news.ycombinator.com/item?id=5");
  });
});

describe("takeNew", () => {
  it("drops cross-source duplicates by company + title + location", () => {
    const gh = posting();
    const aggregator = posting({ id: "remotive:9", source: "remotive", company: "ACME", url: "https://remotive.com/x" });
    const seen = new Set<string>();
    assert.deepEqual(takeNew([gh], seen), [gh]);
    assert.deepEqual(takeNew([aggregator], seen), []);
  });

  it("drops the same URL reached through a different id", () => {
    const a = posting();
    const b = posting({ id: "greenhouse:acme:other", title: "Renamed", url: `${a.url}?utm_campaign=x` });
    assert.deepEqual(takeNew([a, b], new Set()), [a]);
  });

  it("drops postings already recorded on earlier days", () => {
    const yesterday = posting();
    const seen = seenKeys([yesterday]);
    const fresh = posting({ id: "greenhouse:acme:2", title: "Backend Engineer", url: "https://x.test/2" });
    assert.deepEqual(takeNew([yesterday, fresh], seen), [fresh]);
  });

  it("remembers every key of dropped duplicates for later aliases", () => {
    const employer = posting();
    const alias = posting({ id: "remotive:alias", source: "remotive", url: "https://r.test/alias" });
    const seen = seenKeys([employer]);
    assert.deepEqual(takeNew([alias], seen), []);
    for (const key of ["id", "url", "fingerprint"]) {
      const renamed = posting({
        id: key === "id" ? alias.id : `lever:${key}`,
        source: "lever",
        url: key === "url" ? alias.url : `https://l.test/${key}`,
        title: key === "fingerprint" ? alias.title : "Renamed Engineer",
      });
      assert.deepEqual(takeNew([renamed], seen), []);
    }
    assert.deepEqual(takeNew([employer, alias,
      posting({ id: "lever:renamed", title: "Renamed", url: alias.url })], new Set()), [employer]);
  });

  it("fingerprint ignores case and punctuation", () => {
    assert.equal(
      fingerprint(posting({ company: "Acme, Inc.", title: "Full-Stack Engineer" })),
      fingerprint(posting({ company: "acme inc", title: "full stack engineer" })),
    );
  });
});
