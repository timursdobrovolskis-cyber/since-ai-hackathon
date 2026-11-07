# Progress: design-system

Rebrand to Retrosense: dark, precise, technical. Branched from `dashboard`.

## Done

- `app/globals.css`: same token names, dark values. Added `--accent`, `--font-display`, `--font-body`, `--font-mono`,
  motion tokens, `label-mono` utility, `.lift`, `.reveal`, button press, eased focus ring, Lenis CSS, reduced-motion off-switch.
  Tailwind utilities available: `bg-deck bg-panel bg-raised text-ink text-ink-2 text-ink-3 border-line text-machine text-sensor text-accent bg-accent font-display font-mono`.
- Fonts: Clash Display and Satoshi self-hosted in `app/fonts` via `next/font/local`; JetBrains Mono via `next/font/google`.
- Lenis smooth scrolling (`components/SmoothScroll.tsx`), off for reduced motion, touch stays native.
- Shell: RETROSENSE wordmark, mono numbered nav, orange tick on the current page, mono facts and footer.
- Approve inspection request is the one orange button. Badges are mono, square-cornered.
- Charts: axis font resolved for canvas (the old `var()` font string was silently ignored). Isometric board on its dark theme.
- Title, theme colour and favicon updated. README tech table records licences.
- `DESIGN.md` written.
- `npm test` and `npm run build` pass. All routes return 200 on `npm run start`; headless Chrome screenshots checked.

## In progress

Nothing.

## Next

- Teammates: use the token utilities and `DESIGN.md`; avoid hex in components.
- Check on a real phone: headless Chrome would not render a 390px-wide window, so the phone layout is unverified.
- Test the live link after the next deploy.

## Blockers

- None. Note: the ITF Free Font License allows free commercial use; we ship the font files unchanged inside the app.
  If the team wants zero doubt about redistributing font files in a public repo, swap to the Fontshare CSS link.
