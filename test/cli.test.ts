import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { it } from "node:test";
import { criteria } from "./helpers.ts";

it("rejects invalid dates and disabled sources without writing output", async () => {
  const root = await mkdtemp(join(process.cwd(), ".cli-test-"));
  try {
    const config = structuredClone(criteria);
    for (const source of Object.values(config.sources)) source.enabled = false;
    const configPath = join(root, "criteria.json");
    await writeFile(configPath, JSON.stringify(config));
    const run = (date: string, path = configPath) => spawnSync(process.execPath, [
      "--import", new URL("./helpers.ts", import.meta.url).href,
      "src/cli.ts", "--root", root, "--config", path, "--date", date,
    ], { encoding: "utf8", env: { ...process.env, GITHUB_OUTPUT: join(root, "github-output") } });
    for (const date of ["2026-99-99", "2026-02-30", "2025-02-29", "2026-04-31", "not-a-date"]) {
      const result = run(date, join(root, "missing.json"));
      assert.equal(result.status, 1);
      assert.match(result.stderr, /--date must be a real UTC calendar date/);
    }
    for (const date of ["2024-02-29", "2026-10-06"]) {
      const result = run(date);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /no sources enabled/);
      assert.doesNotMatch(result.stderr, /network access/);
    }
    assert.deepEqual(await readdir(root), ["criteria.json"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
