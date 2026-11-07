# Welcome landing page: spec

Written 7 Nov 2026 from an interview with Jona. Inspiration: https://www.zeggo.com.sg/, https://www.meuze.ai (from 7 Nov afternoon) and Jona's sketch (`random.pdf`, one page).

## Goal

An interactive dashboard you scroll through. A separate landing page at `/welcome` that shows, in one glance, a site of 12 pumps with a light at each, and lets a visitor click a pump to see what is wrong with it. It sits in the same Next.js app as the worker screens and does not replace Today.

Built in parts. Each part is shown to Jona before the next starts.

## Decisions

| Topic | Decision |
|---|---|
| Route | `/welcome` in the same app and deploy. Today stays at `/` |
| Branch | New branch `welcome-landing` from `one-home-screen` (PR 7), because the lights must use PR 7's fixed evening shift. Its PR targets `dashboard` and merges after PR 7 |
| Look | Meuze's palette: ink `#0B1014`, white, panel `#F6F6F8`, line `#E6E7EC`, muted `#6E7180`, one accent blue `#2C63FF`. Sections alternate dark, white, white, dark, white. A faint grid behind dark sections only. The lights, red, orange and green, are the only other colours |
| Logo | No Business Turku logo anywhere. The name top left is Retrofit Assist |
| Fonts | Geist for text and big numbers, JetBrains Mono for labels and readings. Both SIL Open Font License. Loaded only on `/welcome` |
| Hero | No headline or text for now, by Jona's choice. Only the pump, the header and a Scroll cue |
| Hero art | A downloaded pump model (`pump.obj`, 3ds Max, one object), turned into line work by `tools/build_pump_edges.mjs`. It is one piece, so it does not pull apart. Source and licence still to confirm |
| Scroll | Scroll scrubs the animation. The pump zooms in and turns, then glides into the right column. Meanwhile the background fades from ink to white and the pump's lines turn from white to ink. Scrolling back reverses it |
| Map | Left side. A flat schematic of one fictional site, labelled as fictional, in four zones by system. No pump drawings, only a name and a light per pump, joined by thin pipe lines |
| Pumps on the map | 12. Pumps 1 to 9 are live. Pumps 10, 11 and 12 are the hidden test pumps and show dimmed, marked "No data yet", with no light colour |
| Lights | Same rule as Today: red = Needs you today, orange = Check the reading, green = Can wait or no alert. Computed with `groupByPump` from `lib/today.ts` at the hour shown |
| Time | The map section pins, and scrolling runs the clock from hour 0 to `SHIFT_HOUR`. Lights change as alerts arrive, and a clock and counters tick. At the shift the map unpins and pumps become clickable. Never shows data past `SHIFT_HOUR` |
| Alerts | No separate alert list. The light is the alert. Clicking a pump shows its alerts |
| Click | The 3D pump shrinks and moves up in the right column, and a small dashboard card slides in under it. The map does not change except the selected pump is marked. A close button restores the pump |
| 14 sensors | The 14 kinds of reading across the fleet show in the clicked pump's dashboard: which it has, which it cannot measure, and which one the alert is about. Nothing about sensors on the map |
| Phone | Desktop first. The phone layout is a later part |
| Video | Out of scope for now |

## Map zones

From `profile` in the organizer `assets.csv`. Site names stay fictional.

| Zone | Pumps |
|---|---|
| Seawater cooling | 1, 2, 7, 8, 10 |
| Fresh-water cooling | 3 |
| Cooling-water circulation | 4, 5, 9, 11 |
| Process water | 6, 12 |

## Sections, top to bottom

| # | Section | Background | What it does |
|---|---|---|---|
| 1 | Engine room, then pump | Ink, fading to white | Opens wide in a ferry engine room. Scrolling flies in to one pump, which zooms, turns and glides right. Two versions to compare: 3D line work, and a halftone photo |
| 2 | Site map | White | Pinned. Scroll runs time to the evening shift, lights change. Then click a pump for its dashboard, with the pump shrinking above it |
| 3 | Step list | White | Pinned. Today's red and orange pumps listed on the left, highlighting one by one as you scroll. On the right, that pump's real signal draws in, leaving its grey normal band, with the alert marked |
| 4 | Results counter | Ink | Big counting numbers: faults caught against plant alarms, median warning. Baseline figures, labelled |
| 5 | Payback and sensors | White | A row of four cards lighting up one by one, each with a mini chart |

## Machine room opening (7 Nov, evening)

Like Meuze, which opens inside a restaurant, the page opens inside a ship's engine room, because 6 of the 12 pumps are ferry pumps and Pump 8 is the main demo. A simple line-work room and a halftone photo were tried first and rejected as not realistic enough. A realistic render came next, and Jona then asked for it as line work. The opening is now that detailed room, drawn as a technical line drawing:

- **Room:** a seawater cooling pump room on Vessel B. Chequer-plate deck, cream bulkheads with hull frames, deckhead beams, lagged pipes, fresh-water and fuel lines in ISO 14726 colours, cable trays, light fittings, starter panels with lamps and ammeters, a sign, a ladder, a handrail and a fire extinguisher.
- **Pumps:** Pump 8 and Pump 7 (Vessel B's seawater cooling pumps No. 2 and No. 1), plus a fire and general service pump, all from the team's pump model as painted solid meshes. Each has a discharge drop with check valve, valve, handwheel and gauge to the seawater header, and a suction branch through a basket strainer from the suction main.
- **Rendering:** each part has a line weight instead of paint. The room is drawn once as surface directions, weights and depth, and an edge shader turns outlines and folds into white lines on ink. Hidden lines disappear on their own, equipment draws bright, structure faint, and far lines fade. Runs at 60 frames per second on the development laptop.
- **Scroll:** the camera walks in from the forward corner of the room to Pump 8, with labels on Pump 8, Pump 7, the strainer and the header. Then everything but Pump 8 dims away, in exactly the pose where the moving pump takes over (`heroPose.ts`).
- **One style throughout:** the moving pump is drawn by the same hidden-line renderer (`lineRender.ts`), not as see-through line work, so it looks the same from the room to the site map. Jona rejected the see-through look on 7 Nov.

## Parts

1. **Hero and scroll.** Built on 7 Nov. Restyled the same day: Meuze colours and fonts, bigger pump, ink-to-white fade.
2. **Map with time.** Built on 7 Nov: lights come from `lib/sitemap.ts`, tested to agree with Today at the shift and to see nothing later. Zones, labels, pipe lines and lights, with scroll running the clock to `SHIFT_HOUR`. Test pumps dimmed.
3. **Click and dashboard.** Built on 7 Nov. Pumps on the map are buttons, keyboard included. The card shows the same hour as the map, the plain wording from Today, first noticed, how sure, trend, next stop, the 14 kinds of reading, and a link to the job card. Pump shrinks, card slides in with the problem, what to do and the sensor list.
4. **Step list** with drawing signal charts.
5. **Results counter and cards.**
6. **Later, not agreed yet.** The "estimate" in the dashboard and the phone layout.

## 3D pump (first version, replaced by the downloaded model)

Built in code so each part is its own object and line work stays clean. A downloaded mesh shown as edges turns into a dense mess of triangles.

- Parts: motor (finned cylinder), coupling, shaft, bearing housing, volute casing (spiral), impeller (curved blades), suction and discharge flanges, base frame.
- Drawn with `EdgesGeometry` and `LineSegments` in navy, with a small angle threshold so only real edges show.
- Turns slowly by itself in the hero. Scroll takes over the turn and zoom.
- Transparent background over the grey page.
- `prefers-reduced-motion`: no idle turn, and scroll moves the pump straight to its final place without the turn.
- If WebGL is not available, show a static note and keep the page usable.

## Technical notes

- New dependency: `three` (MIT). Record it in the README technology table.
- Scroll progress comes from the section's position, read in a `requestAnimationFrame` loop, with a sticky pinned stage. No GSAP or Lenis, to keep the dependency list short.
- The three.js scene is a client component loaded only on `/welcome`, so it adds nothing to the worker screens.
- Rendering pauses when the tab is hidden or the canvas is off screen.

## Rules that still apply

- Live data only up to `SHIFT_HOUR`. Labels never load on `/welcome`.
- Test pumps show no alerts and no telemetry until the submission file is frozen.
- The fictional site layout is labelled as fictional.
- Check `npm test`, `npm run build` and the page in `playwright-cli` before each part's PR.

## Open questions

- What the "estimate" in the dashboard should be: track record, time stopped, trend, or cost.
- The final hero wording.
- Whether `/welcome` later becomes the root page.
