# Agent Rules

Rules for long-running coding agents (Claude Code, OpenCode, etc.) working in this repo.

## Workflow

1. **One task per worktree.** Each agent works on exactly one task in its own git worktree and branch. Don't touch other worktrees or pick up unrelated work.
2. **Commit small and often.** Make a commit after each working step with a clear message. Never leave large uncommitted changes.
3. **Run checks before finishing.** Run the project's lint, typecheck, tests, and build (whichever exist) before you say a task is done. If any fail, fix them or report them honestly.
4. **Write progress to `PROGRESS.md`.** Keep it current in your worktree: what's done, what's in progress, what's next, and any blockers. Update it with each commit.
5. **Stop and ask if blocked.** If requirements are unclear, a decision belongs to a human, or you'd need credentials, installs, or destructive actions, stop, write the blocker to `PROGRESS.md`, and ask. Don't guess.

## Secrets

- API keys live in `.env` (gitignored). See `.env.example` for the variable names.
- Never print, log, or commit secrets. Never commit `.env`.

## Skills

Project skills are in `.claude/skills/` (mirrored in `.agents/skills/`): `impeccable` (UI design/polish), `agentation` (visual feedback toolbar), `bklit-ui` (charts).
