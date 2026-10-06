import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Snapshot } from "./types.ts";

const DATE_FILE = /^(\d{4})-(\d{2})-\d{2}\.json$/;

export function snapshotPath(dataDir: string, date: string): string {
  const [yyyy, mm] = date.split("-");
  return join(dataDir, yyyy!, mm!, `${date}.json`);
}

/** All snapshots under `dataDir` (data/YYYY/MM/YYYY-MM-DD.json), oldest first. */
export async function loadSnapshots(dataDir: string): Promise<Snapshot[]> {
  let entries: string[];
  try {
    entries = await readdir(dataDir, { recursive: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const files = entries
    .filter((e) => DATE_FILE.test(e.split(/[\\/]/).pop() ?? ""))
    .sort((a, b) => (a.split(/[\\/]/).pop()! < b.split(/[\\/]/).pop()! ? -1 : 1));
  const snapshots: Snapshot[] = [];
  for (const f of files) snapshots.push(JSON.parse(await readFile(join(dataDir, f), "utf8")) as Snapshot);
  return snapshots;
}

export async function writeSnapshot(dataDir: string, snapshot: Snapshot): Promise<string> {
  const path = snapshotPath(dataDir, snapshot.date);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`);
  return path;
}
