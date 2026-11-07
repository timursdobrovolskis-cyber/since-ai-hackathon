# Progress: welcome-landing

Spec: `.plans/welcome-landing-spec.md`. Built in parts, each shown to Jona before the next.

## Done

- Part 1: `/welcome` drawn as a blueprint: white line work on a blue grid, a frame and a title block, no logo and no headline.
- The pump is the team's downloaded model, turned into line work by `tools/build_pump_edges.mjs`. Scrolling zooms in, turns it half way round, then moves it into the right column.
- The left column holds a labelled placeholder for the site map.
- `/welcome` has its own header and footer. Every other page is unchanged.

## In progress

Nothing. Waiting for Jona's look at part 1.

## Next

- Part 2: the site map with 12 pumps in four zones, lights from Today's groups at `SHIFT_HOUR`, test pumps dimmed.
- Part 3: click a pump to shrink the 3D pump and slide in a small dashboard.

## Blockers

- The pump model's source and licence are unknown. Confirm them before this branch is pushed or shown publicly.

- This branch starts from PR 7 (`one-home-screen`), so PR 7 must merge into `dashboard` first.
- Phone layout is not designed yet, by choice.
