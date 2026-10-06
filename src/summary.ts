import { containsTerm } from "./text.ts";
import type { Posting, Snapshot } from "./types.ts";

export const README_START = "<!-- snapshot:start -->";
export const README_END = "<!-- snapshot:end -->";
const TREND_DAYS = 30;

/** The `days` calendar dates ending at `date` (inclusive), newest first. */
export function lastDays(date: string, days: number): string[] {
  const end = new Date(`${date}T00:00:00Z`).getTime();
  return Array.from({ length: days }, (_, i) => new Date(end - i * 86_400_000).toISOString().slice(0, 10));
}

function topCounts(values: string[], limit: number): [string, number][] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

/** How many postings mention each skill in their title or tags. */
export function skillCounts(postings: Posting[], skills: string[], limit = 10): [string, number][] {
  return topCounts(
    postings.flatMap((p) => {
      const text = `${p.title} ${p.tags.join(" ")}`;
      return skills.filter((s) => containsTerm(text, s));
    }),
    limit,
  );
}

const pct = (n: number, d: number) => (d === 0 ? "—" : `${Math.round((100 * n) / d)}%`);
const cell = (s: string) => s.replace(/\|/g, "\\|");

function table(header: string[], rows: (string | number)[][]): string {
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map((c) => cell(String(c))).join(" | ")} |`),
  ].join("\n");
}

function window(snapshots: Snapshot[], date: string): Snapshot[] {
  const days = new Set(lastDays(date, TREND_DAYS));
  return snapshots.filter((s) => days.has(s.date));
}

/** Full SUMMARY.md for the snapshot dated `date`, built only from snapshot files. */
export function renderSummary(snapshots: Snapshot[], date: string, skills: string[]): string {
  const today = snapshots.find((s) => s.date === date);
  if (!today) throw new Error(`no snapshot for ${date}`);
  const recent = window(snapshots, date);
  const recentPostings = recent.flatMap((s) => s.postings);
  const byDate = new Map(snapshots.map((s) => [s.date, s]));

  const out: string[] = [
    "# Job market summary",
    "",
    `_Generated automatically from \`data/\` for **${date}**. Do not edit by hand._`,
    "",
    `**${today.postings.length} new postings** today matched the search criteria in ` +
      "[`config/criteria.json`](config/criteria.json) and had not been seen on any earlier day.",
    "",
    "## Sources today",
    "",
    table(
      ["Source", "Fetched", "Matched criteria", "New"],
      today.sources.map((s) => [s.source, s.fetched, s.matched, s.new]),
    ),
    "",
    "## Top companies today",
    "",
    today.postings.length === 0
      ? "_No new postings today._"
      : table(["Company", "New postings"], topCounts(today.postings.map((p) => p.company), 10)),
    "",
    `## Top skills (last ${TREND_DAYS} days)`,
    "",
    "Mentions in posting titles and source tags (descriptions are not fetched).",
    "",
    recentPostings.length === 0
      ? "_No postings yet._"
      : table(["Skill", "Postings"], skillCounts(recentPostings, skills, 15)),
    "",
    `## Top companies (last ${TREND_DAYS} days)`,
    "",
    recentPostings.length === 0
      ? "_No postings yet._"
      : table(["Company", "New postings"], topCounts(recentPostings.map((p) => p.company), 10)),
    "",
    `## ${TREND_DAYS}-day trend`,
    "",
    "`—` means no snapshot was recorded that day (the job did not run or failed).",
    "",
    table(
      ["Date", "New postings", "Remote", "Top skill"],
      lastDays(date, TREND_DAYS).map((d) => {
        const s = byDate.get(d);
        if (!s) return [d, "—", "—", "—"];
        const remote = s.postings.filter((p) => p.remote).length;
        const top = skillCounts(s.postings, skills, 1)[0];
        return [d, s.postings.length, pct(remote, s.postings.length), top ? top[0] : "—"];
      }),
    ),
    "",
  ];
  return out.join("\n");
}

/** Short block spliced into README.md between the snapshot markers. */
export function renderReadmeBlock(snapshots: Snapshot[], date: string, skills: string[]): string {
  const today = snapshots.find((s) => s.date === date);
  if (!today) throw new Error(`no snapshot for ${date}`);
  const recent = window(snapshots, date);
  const total30 = recent.reduce((n, s) => n + s.postings.length, 0);
  const top = skillCounts(recent.flatMap((s) => s.postings), skills, 5).map(([s]) => s);
  return [
    `**Latest snapshot:** ${date} · **${today.postings.length}** new postings · ` +
      `**${total30}** over the last ${TREND_DAYS} days (${recent.length} snapshots)`,
    "",
    `Top skills (${TREND_DAYS} days): ${top.length ? top.join(", ") : "—"}. See [SUMMARY.md](SUMMARY.md) for the full breakdown.`,
  ].join("\n");
}

/** Replace the text between the README markers; throws if the markers are missing. */
export function spliceReadme(readme: string, block: string): string {
  const start = readme.indexOf(README_START);
  const end = readme.indexOf(README_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`README.md is missing the ${README_START} / ${README_END} markers`);
  }
  return `${readme.slice(0, start + README_START.length)}\n${block}\n${readme.slice(end)}`;
}
