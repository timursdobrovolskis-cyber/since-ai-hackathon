# Pump card readability: spec

Interview with Jona, 7 Nov 2026 (night). Applies to `components/welcome/PumpCard.tsx` and the parts it uses
(`Evidence.tsx`, `SignalChart.tsx`, `PumpReview.tsx`). Keep the section headings Jona likes. Restructure what is
under them so the card reads quickly.

## Goal

A worker opening a pump card knows what is wrong, what to do and how to answer it without scrolling. Everything
below that top part is the proof, laid out so it can be read rather than decoded.

## Readers

Both groups count:

- **Engineer on watch:** knows the pump and terms like discharge pressure. Wants the cause, the proof and the action fast.
- **Judges at the demo:** seeing it for the first time. Need plain words and a clear story.

The card serves both in layers. A plain line under the cause serves the judges. The numbers and the detector's own
words sit lower, for the engineer.

## Order, top to bottom

1. **Header**
2. **What's wrong**, part of the top part
3. **What to do**, part of the top part
4. **Your review**, part of the top part
5. **State now**
6. **Evidence**
7. **Readings now**
8. **How sure**
9. **Latest work**

The headings stay as they are. The top part holds 2 to 4 and is kept lean, with no numbers in it. All sections stay
open, with nothing folded.

### Header

- **Line one:** "Pump 3", with a square light and "Needs you today".
- **Line two:** the system and pump number, for example "LT fresh-water central cooling, pump No. 1".
- **Line three:** the vessel and the shift, for example "Vessel A, RoPax. Day 3, 18:00".
- "Fictional" moves off the card. The footer already says the vessel and plant names are fictional.

### What's wrong (top part)

- The cause as the headline, with its Machine or Sensor tag.
- **One plain line under the cause,** always visible. It says what the fault means, for example: "Something after the
  pump is blocking the flow, such as a partly closed valve or a fouled cooler."
  - Written once per fault type in `lib/plain.ts`, as a new `means` field beside the existing `what`, `check` and `steps`.
  - Labelled in code as our explanation, not the detector's.
  - For UNKNOWN: "The detector sees something wrong but cannot name the cause."
- When it started: "First alert 18 hours ago." Keep the alert count and other concerns on this pump as they are.

### What to do (top part)

- The detector's recommended check, in one line.
- The next chance to stop, when the voyage data has one.
- "Advice only. Nothing is sent to the pump." stays, in small print.

### Your review (top part)

- Acknowledge, Dismiss and Escalate, then the finding step after Acknowledge, unchanged in behaviour.

### State now

- Running state, plus how many readings are outside their normal band, as now.

### Evidence

- **One sentence worked out from the readings up to the shift.** It says when the reading left its band, how far out it
  is now, and whether it is still moving or has settled.
  - Example: "Discharge pressure rose 25 kPa above normal at Day 3, 12:00 and has stayed there."
  - Computed in a pure helper in `lib/`, with tests. Our wording, built only from recorded data.
  - Below the charts, in small print: the detector's own summary, labelled as the detector's words.
- **One small chart per reading the alert names.** Two named readings, such as discharge pressure and motor current,
  give two charts stacked on one shared time axis.
- **Each chart has:**
  - the unit on the axis
  - the grey band labelled "Normal"
  - the last value labelled "Now 484"
  - square alert markers, as now
- The grey mono line repeating the reading goes.
- **Replay the warning** sweeps every stacked chart together, with one readout.
- **Pointing at or picking a reading** under Readings now adds it as an extra chart below, on the same time axis. A
  close button removes it.

### Readings now

- **A range bar for each reading:** the normal band sits in the middle third, and a square marks the value.
  - A value beyond the bar's ends pins to the edge with an arrow, and the exact number sits beside it.
  - Every bar uses the same scale rule, so they compare at a glance.
- Off-band readings come first, then normal ones.
- The state is in words (Above normal, Below normal, Normal), never colour alone.
- **Readings with no normal band:** shown last, with the value only and "No normal range". No bar.
- "This pump cannot measure ..." stays at the end.

### How sure

- **Leads with the past record:** a fraction ("8 of 9 past cases right") and a short square bar.
- **The raw score in one small line:** "Detector score 0.56 (not a probability)".
- UNKNOWN keeps "The detector could not name a cause."

### Latest work

- As now: the related last job first, then the newest log entry.

## Phone

- **The bottom sheet has two stops.** It opens to the top part (header, What's wrong, What to do, Your review), with
  the alarm panel still visible above.
- Pulling up or scrolling expands it to full height. Closing works as now.
- Everything stays square, with no rounded corners.

## Rules that still apply

- Only data up to the shift.
- No invented numbers. Every figure comes from the pump data, the alert or the scorer.
- Our own wording, meaning the plain line and the evidence sentence, is built from data or written once per fault type.
- Square shapes only.
- Colour is never the only signal.
- Reduced motion is respected.
- Check with playwright at 1440×900 and on the iPhone 15 preset.

## Built (7 Nov, night)

- **`means` lines:** drafted for all 14 fault types in `lib/plain.ts`. Jona or someone who works on these pumps should
  read them.
- **Trend words:** "holding steady", "still rising" or "still falling", and "but coming back". They compare the last
  3 hours with the 3 before, against the band's width, where under 15 % counts as steady.
  - A reading that left its band less than 3 hours ago gets no trend.
  - A reading that has not moved for 6 hours reads as not moving.
  - Checked on all 7 lit pumps, and tested in `lib/drift.test.ts`.
- **Phone sheet:** on a short phone the top part fills most of the sheet, so the collapsed stop leaves a strip of the
  alarm panel visible above. The review help line is hidden on phones to keep it short.
