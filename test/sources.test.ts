import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchArbeitnow, parseArbeitnow } from "../src/sources/arbeitnow.ts";
import { parseGreenhouse } from "../src/sources/greenhouse.ts";
import { fetchHn, findHiringThread, parseHnHeader, parseHnThread } from "../src/sources/hn.ts";
import { parseLever } from "../src/sources/lever.ts";
import { parseRemotive } from "../src/sources/remotive.ts";
import { fixture } from "./helpers.ts";

describe("greenhouse", () => {
  const postings = parseGreenhouse(fixture("greenhouse.json"), "acme");

  it("normalizes jobs and drops ones without a URL", () => {
    assert.equal(postings.length, 2);
    assert.deepEqual(postings[0], {
      id: "greenhouse:acme:1001",
      source: "greenhouse",
      company: "Acme",
      title: "Senior Full Stack Engineer",
      location: "Remote - United States",
      remote: true,
      url: "https://job-boards.greenhouse.io/acme/jobs/1001",
      postedAt: "2026-09-20T16:00:00.000Z",
      tags: [],
    });
  });

  it("falls back to updated_at when first_published is missing", () => {
    assert.equal(postings[1]!.postedAt, "2026-09-25T14:00:00.000Z");
    assert.equal(postings[1]!.remote, false);
  });

  it("rejects an unexpected shape", () => {
    assert.throws(() => parseGreenhouse({ error: "nope" }, "acme"), /greenhouse\/acme\.jobs: expected an array/);
  });
});

describe("lever", () => {
  const postings = parseLever(fixture("lever.json"), "initech");

  it("normalizes postings", () => {
    assert.equal(postings.length, 2);
    assert.deepEqual(postings[0], {
      id: "lever:initech:aaaaaaaa-1111-2222-3333-444444444444",
      source: "lever",
      company: "Initech",
      title: "Software Engineer, Frontend",
      location: "New York, NY",
      remote: false,
      url: "https://jobs.lever.co/initech/aaaaaaaa-1111-2222-3333-444444444444",
      postedAt: new Date(1790000000000).toISOString(),
      tags: ["web platform", "engineering"],
    });
  });

  it("uses workplaceType for remote", () => {
    assert.equal(postings[1]!.remote, true);
  });

  it("rejects the not-found error object", () => {
    assert.throws(() => parseLever({ ok: false, error: "Document not found" }, "x"), /expected an array/);
  });
});

describe("remotive", () => {
  const postings = parseRemotive(fixture("remotive.json"));

  it("marks everything remote, treats zone-less timestamps as UTC, lowercases tags", () => {
    assert.equal(postings.length, 2);
    assert.deepEqual(postings[0], {
      id: "remotive:501",
      source: "remotive",
      company: "Globex",
      title: "TypeScript Developer",
      location: "USA",
      remote: true,
      url: "https://remotive.com/remote-jobs/software-development/typescript-developer-501",
      postedAt: "2026-10-05T05:15:43.000Z",
      tags: ["react", "typescript", "node.js"],
    });
  });
});

describe("arbeitnow", () => {
  it("parses a page and its next link", () => {
    const page = parseArbeitnow(fixture("arbeitnow-page1.json"));
    assert.equal(page.postings.length, 2);
    assert.equal(page.next, "https://www.arbeitnow.com/api/job-board-api?page=2");
    assert.deepEqual(page.postings[0], {
      id: "arbeitnow:senior-react-developer-berlin-1",
      source: "arbeitnow",
      company: "Umbrella GmbH",
      title: "Senior React Developer (m/w/d)",
      location: "Berlin",
      remote: true,
      url: "https://www.arbeitnow.com/jobs/companies/umbrella/senior-react-developer-berlin-1",
      postedAt: new Date(1791291662 * 1000).toISOString(),
      tags: ["software development"],
    });
  });

  it("follows pagination up to maxPages using an injected fetcher", async () => {
    const pages: Record<string, unknown> = {
      "https://www.arbeitnow.com/api/job-board-api": fixture("arbeitnow-page1.json"),
      "https://www.arbeitnow.com/api/job-board-api?page=2": fixture("arbeitnow-page2.json"),
    };
    const requested: string[] = [];
    const http = async (url: string) => {
      requested.push(url);
      return pages[url];
    };
    assert.equal((await fetchArbeitnow(http, 5, 0)).length, 3);
    assert.equal(requested.length, 2); // stops when next is null
    assert.equal((await fetchArbeitnow(http, 1, 0)).length, 2);
  });
});

describe("hn who is hiring", () => {
  it("picks the newest 'Who is hiring?' thread, not 'Who wants to be hired?'", () => {
    assert.equal(findHiringThread(fixture("hn-search.json")), "901");
    assert.throws(() => findHiringThread({ hits: [] }), /no "Who is hiring\?" thread/);
  });

  it("parses top-level comments only, skipping deleted and unstructured ones", () => {
    const postings = parseHnThread(fixture("hn-thread.json"));
    assert.deepEqual(
      postings.map((p) => [p.id, p.company, p.title, p.location, p.remote]),
      [
        ["hn:1", "Initrode", "Full-Stack Software Engineer", "Remote US", true],
        ["hn:2", "Massive Dynamic", "Senior Backend Engineer", "ONSITE / San Francisco, CA", false],
        ["hn:3", "Soylent", "Multiple Engineering Roles", "REMOTE (Germany)", true],
      ],
    );
    assert.equal(postings[0]!.url, "https://news.ycombinator.com/item?id=1");
    assert.equal(postings[0]!.postedAt, "2026-10-01T15:02:37.000Z");
  });

  it("handles common header shapes", () => {
    assert.deepEqual(parseHnHeader("Foo Inc | REMOTE (US/Canada) | Sr. Web Engineer | Full-time"), {
      company: "Foo Inc",
      title: "Sr. Web Engineer",
      location: "REMOTE (US/Canada)",
      remote: true,
    });
    assert.equal(parseHnHeader("Bar | Engineer | NYC | no remote").remote, false);
    assert.equal(parseHnHeader("Baz | Founding Engineer " + "x".repeat(200)).title.length, 118);
  });

  it("fetches the thread found by search", async () => {
    const http = async (url: string) =>
      url.includes("search_by_date") ? fixture("hn-search.json") : fixture("hn-thread.json");
    assert.equal((await fetchHn(http)).length, 3);
  });
});
