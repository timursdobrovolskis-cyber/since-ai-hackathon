# Since AI Hackathon project

Event rules that apply to all work in this repo:

- Never read, quote or send anything in `data/restricted/`. It may be confidential challenge data.
  If a task seems to need it, stop and ask. Use synthetic or approved sample data in `data/sample/`.
- Personal or confidential data must not go to any external AI provider without permission.
- Secrets stay in `.env`. Never commit keys or put them in browser or mobile code.
  Call keyed APIs such as Pruna only from the backend.
- Check any new dependency's licence and record it in the README technology table.
- Keep pre-existing code and assets separate from what is built at the event, and list them in the README.
- Mock data and prototypes are fine, but label them. Never invent numbers or results.
- Prioritise a working demo. The team must be able to explain every decision, so explain non-obvious changes.
- Use `playwright-cli` for browser testing and for checking the app in a browser. Install it with `npm install -g @playwright/cli@latest`. Its skill is in `.claude/skills/playwright-cli`.
- Test the live link after every deploy, because a local run cannot catch deployment problems such as missing data files.

Submission closes Sunday 8 November at 10:00 EET on sinceai.app.

Agent workflow rules (worktrees, commits, checks, PROGRESS.md) are in @AGENTS.md.
