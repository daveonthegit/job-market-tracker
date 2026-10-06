import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { it } from "node:test";
import { createFetchJson, USER_AGENT } from "../src/http.ts";
import { fixture } from "./helpers.ts";

const NOW = Date.parse("2026-10-06T12:00:00Z");

for (const status of [429, 503]) {
  for (const header of ["2", "Tue, 06 Oct 2026 12:00:02 GMT"]) {
    it(`honors ${status} Retry-After ${header} before retrying`, async (t) => {
      t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: NOW });
      let calls = 0;
      const payload = fixture("remotive.json");
      t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
        assert.deepEqual(init.headers, { "User-Agent": USER_AGENT, Accept: "application/json" });
        calls++;
        return calls === 1
          ? new Response(null, { status, headers: { "Retry-After": header } })
          : Response.json(payload);
      });
      const pending = createFetchJson({ baseDelayMs: 0 })("https://feed.test/jobs");
      await setImmediate();
      t.mock.timers.tick(1999);
      await setImmediate();
      assert.equal(calls, 1);
      t.mock.timers.tick(1);
      await setImmediate();
      t.mock.timers.tick(0);
      assert.deepEqual(await pending, payload);
      assert.equal(calls, 2);
    });
  }
}

for (const header of ["120", "Tue, 06 Oct 2026 12:02:00 GMT"]) {
  it(`fails rather than retrying early when Retry-After exceeds budget: ${header}`, async (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: NOW });
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
      calls++;
      return new Response(null, { status: 429, headers: { "Retry-After": header } });
    });
    await assert.rejects(createFetchJson({ baseDelayMs: 0 })("https://feed.test/jobs"), /Retry-After exceeds 60s/);
    t.mock.timers.tick(120_000);
    assert.equal(calls, 1);
  });
}
