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
- Part 4: what needs you. All 7 concerns at the evening shift, pinned on wide screens with one per scroll step, each with its reading drawn against its expected band and its alerts marked.
- Part 5: results as counting figures, and four cards for detection, early warning, sensor levels and payback, with bklit-ui charts. Every figure comes from the app's data.
- The pump card names and lights up the area of the 3D pump the concern is about, and shows the last 12 hours of the reading.
- A blue call to action into Today, the first job card and Review. Header links jump to each section.
- Phones: one column, pump above the map, pump card as a bottom sheet, step list as a plain list.
- The pump dashboard replaced the step list: every pump, and one report at a time with what's wrong, evidence, how sure, what to do and Acknowledge, Dismiss or Escalate. Results, cards and closing are set aside for now.
- The pump turn is shorter: a quarter turn at the same pace.
- The site map is now an alarm panel: one window per pump in number order, lit red or amber with an icon, saying which pump, for how long and what is wrong. The other alternatives and the switch are removed.
- Results are back after the pump dashboard, restyled, with a link to Review.
- The alarm panel shows the evening shift as it stands, with no clock running, and the scroll section is shorter.
- Clicking a pump flickers the 3D pump away and shows its card in its place, built from data only: state now, what's wrong, evidence and chart, every reading now against its band, how sure, the detector's recommended action and next stop, latest work from the log, and what it cannot measure. The wrong "14 kinds of reading" count and the area glow are gone.
- Every figure on the page traced to its source. Results now compare alerts with plant alarms on four checked figures (faults caught, warned before the limit, right cause, false alerts), in three layouts to compare. `lib/keynumbers.test.ts` ties each to the organizers' scorer.
- The duplicate pump dashboard is gone. Its Acknowledge, Dismiss and Escalate moved into the pump card, and the panel shows the decision on the pump's window.
- The panel heading no longer claims a real site or clock: it names hour 66 of each pump's simulated test week.
- The old app (Today, job cards, My decisions, Week overview, Review, Sensor levels, Payback, the voice route) is removed. The landing page is now the whole site, at `/`, and `/welcome` redirects there.
- The product name is gone from the page for now. It was a placeholder from our own spec, not from the data.
- Results stay as one table. Every other page is unchanged.
- Results rows open the faults behind them: each of the 35 faults, or the 11 that reached a limit, or the 4 false alerts, with what the alerts and the plant alarms did. Marked as a review of past faults with known answers. `lib/pastFaults.test.ts` checks each list adds up to its row.
- After Acknowledge the card asks what the worker found: the named fault, something else (pick it), nothing wrong, or not sure. Saved on this device and shown on the pump's window. It does not change the results, which stay the organizers' scoring.
- The evidence chart can show any reading: point at one under "Readings now", click to keep it. "Replay the warning" sweeps through the hours up to the shift and says when the reading left its band and how long before the shift the first alert came. Charts now always end on the reading the card lists as now.
- The room's labels sit on their own ink plates, so the drawing never runs through the words. A label near the screen edge flips side, and phones show only the name.
- The top bar is a solid bar: ink over the engine room, white from the fade on. It marks the section you are in, and on wider screens says how many pumps need you, with a jump to the panel.
- The pump turn is a third shorter: 90 viewport heights of scrolling instead of 135, and the scroll section is 440vh.
- Scroll progress: a rail on the right edge with a point per section, and the stage frame traced round in the accent. The bar and nav versions are gone.
- Every shape is square: buttons, filter, cards, panel windows, tags, legend keys, the chart's tooltip ring and alert markers. Buttons give press feedback on pointer-down.
- The alarm panel has a filter: all, needs you, check the reading, not reviewed, reviewed. Pumps that do not match are dimmed, so every pump keeps its place.

## In progress

Nothing. Next: Jona's answers on more interactivity.

## Next

- The team's detector alerts, then rebuild the data and check the evening shift still tells the story.

## Blockers

- Merging this branch removes the old app from `dashboard` too. Agree that with the team first. README, the video script and the technical note still describe the old app.

- The pump model's source and licence are unknown. The branch was pushed on Jona's instruction, and the README marks the licence as unconfirmed.
- This branch starts from PR 7 (`one-home-screen`), so PR 7 must merge into `dashboard` first.
