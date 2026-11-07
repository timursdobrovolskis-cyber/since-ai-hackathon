# Progress: welcome-landing

Spec: `.plans/welcome-landing-spec.md`. Built in parts, each shown to Jona before the next.

## Done

- Part 1: `/welcome`, styled after meuze.ai: ink and white, one accent blue, Geist and JetBrains Mono, no logo and no headline.
- The page fades from ink to white as the pump glides right, and the pump's lines flip from white to ink at the fade's middle.
- The pump is the team's downloaded model, turned into line work by `tools/build_pump_edges.mjs`. Scrolling zooms in, turns it half way round, then moves it into the right column.
- Part 2: the site map. 12 pumps in four zones of one fictional site, with test pumps dimmed. Scrolling runs the clock from hour 0 to the evening shift, and the lights, alert count and plant alarm count change with it.
- The lights come from `lib/sitemap.ts`, which reuses Today's grouping. Tests check the map agrees with Today at the shift and never sees a later alert.
- Part 3: click or press Enter on a pump on the map. The 3D pump shrinks to the top of the right column, and a card slides in with the problem, how sure it is, the trend, the next stop, the 14 kinds of reading, and a link to the job card. Escape or the close button closes it and returns focus to the pump.
- The page now opens in a detailed seawater pump room on a ferry, drawn as a technical line drawing by an edge shader: outlines and folds in white on ink, hidden lines removed. Scrolling walks in to Pump 8, the room dims away around it, and the same hidden-line Pump 8 zooms, turns and moves beside the map. The see-through drawing is gone.
- `/welcome` has its own header and footer. Every other page is unchanged.

## In progress

Nothing. Waiting for Jona's look at the line-work engine room.

## Next

- Part 4: the step list, with each problem pump's signal chart drawing in.
- Later parts: results counter, payback and sensor cards. See the spec.

## Blockers

- The pump model's source and licence are unknown. The branch was pushed on Jona's instruction, and the README marks the licence as unconfirmed.
- This branch starts from PR 7 (`one-home-screen`), so PR 7 must merge into `dashboard` first.
- Phone layout is not designed yet, by choice.
