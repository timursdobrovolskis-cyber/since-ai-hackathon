# Agent Rules

Rules for long-running coding agents (Claude Code, OpenCode, etc.) working in this repo.
The event rules in `CLAUDE.md` also apply to every agent. Read them first.

## Workflow

1. **One task per worktree.** Each agent works on exactly one task in its own Paradev workspace (git worktree + branch), branched from `dashboard`. Don't touch other worktrees or pick up unrelated work. Stay inside the files your task names where you can, so parallel branches merge cleanly.
2. **Commit small and often.** Make a commit after each working step with a clear message. Never leave large uncommitted changes.
3. **Run checks before finishing.** Run `npm test` and `npm run build`, and check the screen you changed in a browser (`playwright-cli`). If any fail, fix them or report them honestly.
4. **Write progress to `PROGRESS.md`.** Keep it current in your worktree: what's done, what's in progress, what's next, and any blockers. Update it with each commit.
5. **Stop and ask if blocked.** If requirements are unclear, a decision belongs to a human, or you'd need credentials, installs, or destructive actions, stop, write the blocker to `PROGRESS.md`, and ask. Don't guess.
6. **Finish with a PR into `dashboard`.** Never push to `main` or `foundation`.

## The app

- Next.js + React + Tailwind, charts with uPlot. `npm run dev` serves on port 3000, or the next free port if another workspace already uses it.
- The UI reads pre-built JSON from `public/data`. Rebuilding it needs the organizer data pack: set `RETROFIT_DATA_ROOT=~/Documents/BusinessTurku_SinceAI2026_FINAL_BUILDER_PUBLISH/RETROFIT_AI_PARTICIPANTS_2026` (see README).
- Spec: `docs/spec.md`.

## Secrets

- API keys live in `.env` (gitignored). See `.env.example` for the variable names.
- Never print, log, or commit secrets. Never commit `.env`.
- New workspaces get `.env` copied from the main checkout and run `npm install`.

## OpenCode (Featherless)

- `opencode.json` has two providers: `featherless` (`FEATHERLESS_API_KEY`) and `featherless-2` (`FEATHERLESS_API_KEY_2`). Pick one per agent in the model list, so parallel agents spread load across both keys.
- OpenCode reuses a background `opencode serve` process that keeps the env it started with. If you get "You must be signed in", run `pkill -f "opencode serve"`, then `set -a; source .env; set +a`, and start again.

## Skills

The agent skills used during the build (impeccable, agentation, bklit-ui, playwright-cli) were removed from the repo before submission. Install them in your own agent if you need them.
