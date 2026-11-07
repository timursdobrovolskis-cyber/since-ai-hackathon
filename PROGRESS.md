# Progress: welcome-landing

Spec: `.plans/welcome-landing-spec.md`. Built in parts, each shown to Jona before the next.

## Done

- Part 1: `/welcome`, styled after meuze.ai: ink and white, one accent blue, Geist and JetBrains Mono, no logo and no headline.
- The page fades from ink to white as the pump glides right, and the pump's lines flip from white to ink at the fade's middle.
- The pump is the team's downloaded model, turned into line work by `tools/build_pump_edges.mjs`. Scrolling zooms in, turns it half way round, then moves it into the right column.
- Part 2: the site map. 12 pumps in four zones of one fictional site, with test pumps dimmed. Scrolling runs the clock from hour 0 to the evening shift, and the lights, alert count and plant alarm count change with it.
- The lights come from `lib/sitemap.ts`, which reuses Today's grouping. Tests check the map agrees with Today at the shift and never sees a later alert.
- `/welcome` has its own header and footer. Every other page is unchanged.

## In progress

Nothing. Waiting for Jona's look at part 2.

## Next

- Part 3: click a pump on the map to shrink the 3D pump and slide in its small dashboard.
- Later parts: step list with drawing signal charts, results counter, payback and sensor cards. See the spec.

## Blockers

- The pump model's source and licence are unknown. Confirm them before this branch is pushed or shown publicly.
- This branch starts from PR 7 (`one-home-screen`), so PR 7 must merge into `dashboard` first.
- Phone layout is not designed yet, by choice.
