# Welcome landing page: spec

Written 7 Nov 2026 from an interview with Jona. Inspiration: https://www.zeggo.com.sg/ and Jona's sketch (`random.pdf`, one page).

## Goal

A separate landing page at `/welcome` that shows, in one glance, a site of 12 pumps with a light at each, and lets a visitor click a pump to see what is wrong with it. It sits in the same Next.js app as the worker screens and does not replace Today.

Built in parts. Each part is shown to Jona before the next starts.

## Decisions

| Topic | Decision |
|---|---|
| Route | `/welcome` in the same app and deploy. Today stays at `/` |
| Branch | New branch `welcome-landing` from `one-home-screen` (PR 7), because the lights must use PR 7's fixed evening shift. Its PR targets `dashboard` and merges after PR 7 |
| Look | Business Turku colours on a calm grey background. Navy `#003266` for text and line work, blue `#2E60FF` as the accent. Grey background from the app's `--deck` / `--panel` tokens |
| Logo | No Business Turku logo anywhere. Colours only. The name top left is Retrofit Assist |
| Hero | Short heading, one sentence and one button, drafted by Claude in the app's plain style, edited by Jona |
| Hero art | One 3D centrifugal pump in three.js, built from primitives and drawn as line work (edges only, no shading). In the hero it is pulled apart along the shaft, as in the sketch, and it comes together as you scroll |
| Scroll | Scroll scrubs the animation. The pump zooms in and turns as you scroll, then glides into the right column while the map slides in on the left. Scrolling back reverses it. No cut, the same pump all the way |
| Map | Left side. A flat schematic of one fictional site, labelled as fictional, in four zones by system. No pump drawings, only a name and a light per pump, joined by thin pipe lines |
| Pumps on the map | 12. Pumps 1 to 9 are live. Pumps 10, 11 and 12 are the hidden test pumps and show dimmed, marked "No data yet", with no light colour |
| Lights | Same rule as Today at `SHIFT_HOUR`: red = Needs you today, orange = Check the reading, green = Can wait or no alert. Computed with `groupByPump` from `lib/today.ts`, so map and Today never disagree |
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

## Parts

1. **Hero and scroll.** Built on 7 Nov, branch `welcome-landing`. `/welcome` with the line-work pump, the heading and button, and the scroll zoom, turn and glide to the right. The left column is an empty placeholder where the map will go. No pump data used.
2. **Map.** Zones, labels, pipe lines and lights from real alerts at `SHIFT_HOUR`. Test pumps dimmed. Clicks do nothing yet.
3. **Click and dashboard.** Pump shrinks, card slides in with the problem, what to do and the sensor list. Links to the full job card.
4. **Later, not agreed yet.** The "estimate" in the dashboard, the phone layout, and any link into the video.

## 3D pump

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
