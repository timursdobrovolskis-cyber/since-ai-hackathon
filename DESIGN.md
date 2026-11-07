---
name: Retrosense
description: Dark, precise, technical operator dashboard for old cooling-water pumps. Advice only.
colors:
  deck: "#0a0a0a"        # page background
  panel: "#171717"       # cards, sidebar, header
  raised: "#1e1e1e"      # chart wells, hover, selected rows
  ink: "#f2f2f2"         # primary text, data lines, replay cursor
  ink-2: "#b0b0b0"       # secondary text
  ink-3: "#8f8f8f"       # labels, hints, axis text
  line: "#333333"        # hairline borders
  line-soft: "#262626"   # table row rules, chart grid
  run: "#3d3d3d"         # pump running
  stop: "#737373"        # pump stopped, fault active
  band: "#363636"        # expected range in charts
  machine: "#ff5a1f"     # lifeboat orange: machine problem
  accent: "#ff5a1f"      # same orange: the one primary action
  sensor: "#7cc7ff"      # ice blue: sensor or data problem
  unknown: "#8a8a8a"     # cause unclear
  cursor: "#f2f2f2"
typography:
  display: { family: "Clash Display", weights: [600, 700], use: "headings, big figures, wordmark" }
  body: { family: "Satoshi", weights: [400, 500, 700], size: "15px", line-height: 1.45 }
  mono: { family: "JetBrains Mono", weights: [400, 500, 600], use: "IDs, timestamps, values, tags, indices" }
  scale: { label: 11px, small: 13px, body: 15px, h3: 18px, h2: 20px, h1: 30px, figure: 36px }
rounded: { sm: 2px, md: 4px, lg: 6px }
spacing: [4, 8, 12, 16, 24, 32, 48, 64]
motion:
  ease: "cubic-bezier(.2,.7,.2,1)"
  duration: { fast: 150ms, base: 220ms, slow: 300ms }
  stagger: 40ms
components:
  card: { bg: panel, border: "1px line", radius: md, padding: "12px 16px" }
  button-primary: { bg: accent, text: deck, radius: sm, min-height: 40px }
  button-secondary: { bg: transparent, border: "1px line", text: ink, radius: sm }
  toggle-selected: { bg: ink, text: deck }
  badge: { font: mono 11px uppercase, border: 1px, radius: sm, padding: "1px 6px" }
  nav-item: { index: mono 11px "01", active: "raised bg + 2px accent tick" }
---

# Retrosense design system

## Overview

Retrosense helps a duty engineer spot a developing pump problem and decide what to check. It never controls
a machine. The look is a dark instrument panel: near-black greys, hairlines, tight grotesk headings,
mono for anything measured. Colour is rare, so when it appears it means something.

Tokens live in `app/globals.css`. Token **names never change**; restyle by changing values.

## Colors

- 3 surfaces only: `deck` (page) < `panel` (cards, chrome) < `raised` (wells, hover, selected).
- Normal and stopped states are grey. No green anywhere.
- **Orange `#ff5a1f`** means "look here": a machine problem, or the single primary action on a screen
  (Approve inspection request). Max 1 orange button per screen. Never decorative.
- **Ice blue `#7cc7ff`** means the sensor or data is wrong, not the machine.
- Watching = orange outline at 50% opacity with ink text. Not a new hue.
- Unknown cause = `unknown` grey, hollow circle.
- Text on orange is `deck` (6.35:1). Never white on orange (3.12:1, fails).

Contrast (WCAG 2.1), worst case is on `raised`:

| Foreground | on deck | on panel | on raised | Need |
|---|---|---|---|---|
| ink | 17.68 | 16.01 | 14.89 | 4.5 |
| ink-2 | 9.13 | 8.27 | 7.69 | 4.5 |
| ink-3 | 6.12 | 5.54 | 5.15 | 4.5 |
| machine / accent | 6.35 | 5.75 | 5.35 | 4.5 |
| sensor | 10.81 | 9.79 | 9.11 | 4.5 |
| unknown | 5.73 | 5.19 | 4.83 | 3 (marks) |
| stop | 4.18 | 3.78 | 3.52 | 3 (marks) |

`line`, `line-soft`, `run` and `band` are below 3:1 on purpose: they are structure, never the only carrier of meaning.
Orange and ice blue differ in hue but only 1.70:1 in lightness, so they are always paired with a shape
(triangle vs diamond) or a word.

## Typography

- `font-display` (Clash Display 600): page h1 30px, section h2 20px, card title 18px, stat figures 36px.
  Letter-spacing -0.01em. Uppercase only for labels of 1–2 words and the wordmark (+0.04em).
- `font-sans` / `font-body` (Satoshi): all running text, 15px body, 13px secondary. Min 11px anywhere.
- `font-mono` (JetBrains Mono): pump IDs, timestamps, measured values, units, tags, chart axes, nav indices.
- `label-mono` utility: mono 11px, uppercase, +0.08em, `ink-3`. Use for eyebrows and spec labels.
- Numbers are always tabular (`font-variant-numeric: tabular-nums` is on `body`).
- Numbered labels: `01`–`09` for nav, `{01}` for figure cards.
- Legacy `font-cond` maps to the display face; prefer `font-display` in new code.

## Layout

- Spacing only from 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px (Tailwind 1, 2, 3, 4, 6, 8, 12, 16).
- Shell: 208px sidebar from 1024px up, 52px sticky header, sticky replay bar below it, footer.
- Content padding 16px phone, 24–32px desktop. Max text measure 72ch.
- Card grids gap 12px. Sections 32px apart.
- Touch targets ≥ 40px tall (36px allowed for dense toolbar buttons on desktop).

## Elevation & Depth

- No shadows. Depth comes from the 3 surface steps plus 1px `line` borders.
- Sticky chrome sits on `panel` with a bottom hairline. Overlays dim with `deck` at 70%.

## Shapes

- Radius: 2px buttons, badges, nav items; 4px cards and inputs; 6px max. Never pills, never `rounded-full`
  except true circles (dots, LEDs).
- Borders: 1px. Status edge on case rows: 4px left border in the status colour.
- Case marks: triangle = machine, diamond = sensor, hollow circle = unclear. Shape + colour always together.

## Components

- **Card** (`components/ui/card.tsx`): panel, 1px line, 4px radius. Title in display 18px.
- **Stat figure**: `label-mono` with `{0n}` index + icon on top, 36px display numeral, 13px `ink-3` hint.
  Numeral takes `text-machine` / `text-sensor` only when the count is above 0.
- **StateBadge**: mono 11px uppercase. Needs review = orange; Data problem = ice; Watching = 50% orange
  outline; Normal / Stopped = grey.
- **Buttons**: primary = `bg-accent text-deck`; secondary = 1px `line` outline; selected toggle = `bg-ink text-deck`.
- **Nav**: `01` mono index, 16px Lucide icon, label. Active = `raised` background + 2px orange tick on the left.
- **Charts (uPlot)**: data line `ink` 2px, expected band `band`, grid `line-soft`, axes mono 12px `ink-3`,
  out-of-band points and alert lines in the case colour, replay cursor 1px `cursor`. Read colours from
  CSS variables at mount; canvas cannot read `var()` so resolve fonts with `getComputedStyle`.
- **Isometric case board**: `theme="dark"`, colours mapped in `.case-board`. Active key LED is ink, not orange.

## Iconography

- Lucide only (`lucide-react`). 16px in nav and cards, 20px in the header.
- Stroke 1.5–2px (use `strokeWidth={1.75}` in new code). Icons are `aria-hidden` next to a text label.
- Icons inherit text colour; they turn orange or blue only alongside a matching status.

## Motion

- Easing `cubic-bezier(.2,.7,.2,1)` for everything. Durations 150ms (press, colour), 220ms (hover lift),
  300ms (entering).
- Max 3 elements moving at once. Never move text someone is reading; replay updates swap values in place.
- `.lift`: card hover rises 2px and the border brightens to `ink-3`. Only for clickable cards.
- Buttons scale to 0.97 on press.
- `.reveal`: children fade up 6px, 40ms apart, capped at 8 steps. Only for lists that mount once, never for
  the live case list.
- Focus ring: 2px `ink` outline, offset eases 2px → 3px.
- Lenis smooth scrolling for wheel input (`components/SmoothScroll.tsx`); touch scrolling stays native.
- `prefers-reduced-motion: reduce` turns off Lenis, every transition and every animation.

## Do's and Don'ts

- Do keep a screen's orange to its status marks plus 1 primary action.
- Do pair every colour with a shape or a word.
- Do set every measured number in mono with its unit, e.g. `33.28 kPa`.
- Do label mock or illustrative values as such. Never invent numbers.
- Don't add new hues, gradients, glows or shadows.
- Don't use radius above 6px or pill buttons.
- Don't use white text on orange.
- Don't write copy that implies the app acts on a machine. It records decisions only.
- Don't hard-code hex in components; use the token utilities (`bg-panel`, `text-ink-2`, `border-line`,
  `text-machine`, `text-sensor`, `bg-accent`, `font-display`, `font-mono`).
