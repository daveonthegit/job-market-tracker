import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadCriteria } from "./config.ts";
import { createFetchJson } from "./http.ts";
import { buildSnapshot } from "./snapshot.ts";
import { fetchAll } from "./sources/index.ts";
import { loadSnapshots, writeSnapshot } from "./store.ts";
import { renderReadmeBlock, renderSummary, spliceReadme } from "./summary.ts";

const USAGE = `Usage: npm run snapshot -- [options]

Fetch today's postings from every enabled source, keep the new ones, and write
data/YYYY/MM/YYYY-MM-DD.json, SUMMARY.md and the README snapshot block.

  --root <dir>      directory holding data/, SUMMARY.md, README.md (default: cwd)
  --config <file>   criteria file (default: config/criteria.json)
  --date <date>     snapshot date, YYYY-MM-DD (default: today, UTC)
  --dry-run         fetch and print the snapshot as JSON; write nothing
  -h, --help        show this help`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      root: { type: "string", default: "." },
      config: { type: "string", default: "config/criteria.json" },
      date: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }
  const now = new Date();
  const date = values.date ?? now.toISOString().slice(0, 10);
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== date) {
    throw new Error(`--date must be a real UTC calendar date in YYYY-MM-DD format, got "${date}"`);
  }

  const root = resolve(values.root);
  const dataDir = join(root, "data");
  const criteria = await loadCriteria(values.config);
  const history = await loadSnapshots(dataDir);

  const fetched = await fetchAll(createFetchJson(), criteria);
  const snapshot = buildSnapshot(fetched, history, criteria, date, now);
  for (const s of snapshot.sources) {
    console.error(`${s.source.padEnd(10)} fetched=${s.fetched} matched=${s.matched} new=${s.new}`);
  }
  console.error(`${date}: ${snapshot.postings.length} new postings`);

  if (values["dry-run"]) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  const path = await writeSnapshot(dataDir, snapshot);
  const all = [...history.filter((s) => s.date !== date), snapshot].sort((a, b) => a.date.localeCompare(b.date));
  await writeFile(join(root, "SUMMARY.md"), renderSummary(all, date, criteria.skills));
  const readmePath = join(root, "README.md");
  const readme = await readFile(readmePath, "utf8").catch(() => null);
  if (readme !== null) await writeFile(readmePath, spliceReadme(readme, renderReadmeBlock(all, date, criteria.skills)));
  console.error(`wrote ${path}`);

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `date=${date}\nnew_count=${snapshot.postings.length}\n`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
