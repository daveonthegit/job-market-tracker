import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { it } from "node:test";
import type { Snapshot } from "../src/types.ts";
import { criteria } from "./helpers.ts";

it("CLI persists new postings, rebuilds same-day data, records zero-new days, and writes nothing on source failure", async () => {
  const root = await mkdtemp(join(process.cwd(), ".cli-lifecycle-"));
  const transcript: string[] = [];
  try {
    const config = structuredClone(criteria);
    for (const source of Object.values(config.sources)) source.enabled = false;
    config.sources.greenhouse = { enabled: true, boards: ["acme"] };
    config.sources.remotive.enabled = true;
    const configPath = join(root, "criteria.json");
    await writeFile(configPath, JSON.stringify(config));
    await writeFile(join(root, "README.md"), "# Offline demo\n<!-- snapshot:start -->\nNo snapshots recorded yet.\n<!-- snapshot:end -->\n");
    const run = (date: string, mode = "ok", dryRun = false) => {
      const result = spawnSync(process.execPath, [
        "--import", new URL("./fixtures/cli-fetch.ts", import.meta.url).href,
        "src/cli.ts", "--root", root, "--config", configPath, "--date", date,
        ...(dryRun ? ["--dry-run"] : []),
      ], { encoding: "utf8", env: { ...process.env, JMT_TEST_FEED: mode, GITHUB_OUTPUT: join(root, "github-output") } });
      transcript.push(`$ node src/cli.ts --root <isolated-demo> --config <synthetic-criteria> --date ${date}${dryRun ? " --dry-run" : ""} [feed=${mode}]\nexit=${result.status}\n${result.stderr}${result.stdout}`);
      assert.equal(result.error, undefined);
      return result;
    };
    const snapshotPath = (date: string) => join(root, "data", date.slice(0, 4), date.slice(5, 7), `${date}.json`);
    const readSnapshot = async (date: string): Promise<Snapshot> => JSON.parse(await readFile(snapshotPath(date), "utf8"));

    const before = await readdir(root);
    const dry = run("2026-10-06", "ok", true);
    assert.equal(dry.status, 0);
    const preview: Snapshot = JSON.parse(dry.stdout);
    assert.ok(preview.postings.length > 0);
    assert.deepEqual(await readdir(root), before, "dry run must not create data, summary or workflow output");
    assert.equal(run("2026-10-06").status, 0);
    const baseline = await readSnapshot("2026-10-06");
    assert.deepEqual(baseline.postings, preview.postings);
    assert.deepEqual(baseline.sources, preview.sources);
    assert.equal(baseline.postings[0]!.source, "greenhouse");
    assert.ok(baseline.sources.every((s) => s.fetched > 0));
    assert.equal(run("2026-10-06").status, 0);
    assert.deepEqual((await readSnapshot("2026-10-06")).postings, baseline.postings);
    const baselineSummary = await readFile(join(root, "SUMMARY.md"), "utf8");
    assert.match(baselineSummary, new RegExp(`\\*\\*${baseline.postings.length} new postings\\*\\* today`));
    assert.match(await readFile(join(root, "README.md"), "utf8"), /2026-10-06/);
    assert.match(await readFile(join(root, "github-output"), "utf8"), new RegExp(`date=2026-10-06\\nnew_count=${baseline.postings.length}\\n`));

    // An error or an empty enabled source must preserve every prior public output.
    const stableFiles = [snapshotPath("2026-10-06"), join(root, "SUMMARY.md"), join(root, "README.md"), join(root, "github-output")];
    const stableBytes = await Promise.all(stableFiles.map((path) => readFile(path, "utf8")));
    for (const mode of ["error", "empty"]) {
      const failed = run("2026-10-07", mode);
      assert.equal(failed.status, 1);
      assert.match(failed.stderr, mode === "error" ? /remotive: .*HTTP 403/ : /remotive: returned no postings/);
      assert.deepEqual(await Promise.all(stableFiles.map((path) => readFile(path, "utf8"))), stableBytes);
      await assert.rejects(readFile(snapshotPath("2026-10-07")), { code: "ENOENT" });
    }
    assert.equal(run("2026-10-08").status, 0);
    const quiet = await readSnapshot("2026-10-08");
    assert.deepEqual(quiet.postings, []);
    assert.ok(quiet.sources.every((s) => s.fetched > 0 && s.new === 0));
    const summary = await readFile(join(root, "SUMMARY.md"), "utf8");
    assert.match(summary, /\*\*0 new postings\*\*/);
    assert.match(summary, /\| 2026-10-07 \| — \| — \| — \|/);
    assert.match(summary, /\| 2026-10-08 \| 0 \| — \| — \|/);
    assert.match(await readFile(join(root, "github-output"), "utf8"), /date=2026-10-08\nnew_count=0\n$/);

    const evidence = process.env.JMT_TEST_EVIDENCE_DIR;
    if (evidence) {
      await mkdir(evidence, { recursive: true });
      await writeFile(join(evidence, "offline-cli-transcript.log"), "Offline end-to-end demonstration using synthetic public-API fixtures; no live network.\n\n" + transcript.join("\n"));
      await writeFile(join(evidence, "baseline-snapshot.json"), JSON.stringify(baseline, null, 2));
      await writeFile(join(evidence, "baseline-SUMMARY.md"), baselineSummary);
      await writeFile(join(evidence, "zero-new-snapshot.json"), JSON.stringify(quiet, null, 2));
      await writeFile(join(evidence, "SUMMARY.md"), summary);
      await writeFile(join(evidence, "README.md"), await readFile(join(root, "README.md"), "utf8"));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
