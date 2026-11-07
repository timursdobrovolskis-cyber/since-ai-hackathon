# Progress: welcome-landing

Spec: `.plans/welcome-landing-spec.md`. Built in parts, each shown to Jona before the next.

## Done

- Part 1: `/welcome`, styled after meuze.ai: ink and white, one accent blue, Geist and JetBrains Mono, no logo and no headline.
- The page fades from ink to white as the pump glides right, and the pump's lines flip from white to ink at the fade's middle.
- The pump is the team's downloaded model, turned into line work by `tools/build_pump_edges.mjs`. Scrolling zooms in, turns it half way round, then moves it into the right column.
- The left column holds a labelled placeholder for the site map.
- `/welcome` has its own header and footer. Every other page is unchanged.

## In progress

Nothing. Waiting for Jona's look at part 1.

## Next

- Part 2: the site map with 12 pumps in four zones, pinned while scrolling runs the clock to `SHIFT_HOUR`. Lights from Today's groups. Test pumps dimmed.
- Later parts: click dashboard, step list with drawing signal charts, results counter, payback and sensor cards. See the spec.
- Part 3: click a pump to shrink the 3D pump and slide in a small dashboard.

## Blockers

- The pump model's source and licence are unknown. Confirm them before this branch is pushed or shown publicly.

- This branch starts from PR 7 (`one-home-screen`), so PR 7 must merge into `dashboard` first.
- Phone layout is not designed yet, by choice.
