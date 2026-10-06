# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Checks: `npm run lint`, `npm run typecheck`, `npm test` (Node's built-in runner; TS runs via Node type stripping, so imports use `.ts` extensions and only erasable TS syntax is allowed).
- Tests must stay offline: `test/helpers.ts` replaces `fetch` with a rejecting stub. Source parsers are pure (`parseX(raw)`) and tested against synthetic fixtures in `test/fixtures/`; network goes through the injected `FetchJson` from `src/http.ts`.
- Run semantics are a public promise in README.md: any source error or empty feed fails the run and writes nothing; a successful 0-new day is still recorded. Keep code, README and `.github/workflows/daily.yml` in agreement when changing this.
- Never commit live data from local runs into `data/` (it seeds dedupe and the trend table); use `npm run snapshot -- --root <tmpdir>` or `--dry-run`. Only the scheduled workflow writes `data/`.
- README.md must keep the `<!-- snapshot:start -->`/`<!-- snapshot:end -->` markers (a test enforces it).
- Before adding a Greenhouse/Lever board slug, confirm its public API returns 200; a dead board fails the whole daily run.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
