# RETROFIT AI operator app: UI spec

Since AI Hackathon 2026, Turku. Challenge owner: Business Turku. Technical sparring: Elomatic.
**Submission deadline: Sunday 8 Nov 2026, 10:00, through sinceai.app.**
Working name: "Retrofit Assist" (placeholder).

## 1. Summary

A web app, with a phone view, that helps one **duty engineer** look after old cooling pumps. It replays a pump's week. An alert appears before a conventional limit is reached. The engineer sees the evidence and the possible causes, tests a fix in the simulator, and approves, rejects or keeps watching. The app is advice only and has no way to control a machine.

It is an **alert triage tool, not a wall of charts**. The main screen answers: what needs my attention, why do you think so, how sure are you, and what should I check?

Our teammates build the detector. This app shows its output. Until their alerts are ready, it runs on the baseline alert files in the same format.

## 2. Decisions made

| Topic | Decision |
|---|---|
| Main user | Duty engineer: one person who triages alerts and plans the fix. Realistic for small ferry crews and SMEs |
| Form | Web app for laptop, plus a phone layout. Can be added to a phone home screen. No push notifications |
| Look | Calm industrial: muted greys, colour only for things that need attention (ISA-101 style) |
| Uncertainty | Ranked possible causes, always including "could it be the sensor?", plus what would settle it |
| Human decision | Approve creates a draft work order. Reject needs a reason. Keep watching sets a follow-up time. All go in a decision log |
| Real answers | Hidden during replay. Shown only in the Review view |
| Extras | What-if sandbox, sensor level comparison, payback calculator, AI explanation |
| Voice | ElevenLabs shift handover briefing and voice questions |
| Language | English only |
| Company test | Explore the pumps from a link, and load an alert CSV in the official format |
| Hosting | Public link for judges, plus a documented offline mode |
| API keys | The team has ElevenLabs and Anthropic keys. Ask before spending paid credits |

## 2a. Worker-first decisions (7 Nov)

These replace the fleet-first layout in section 6 where they differ.

| Topic | Decision |
|---|---|
| Who it is for | A mechanic with no data background, at a laptop at shift start and with a phone at the pump |
| Main screen | Today: what needs me, what do I do, can it wait. Stats, chart, board and strips move to Week overview |
| Grouping | Needs you today, Check the reading, Can wait. Newest first, not a claim about true urgency |
| Wording | Hand-written per fault type in `lib/plain.ts`. Engineering terms stay behind "Why does it think this?" |
| Buttons | I'll check it, Remind me later, Not a problem |
| Voice | A small optional extra, tucked away and at most 10 seconds of the video. Spoken shift handover first, stored and offline. Ask at the pump second, using an ElevenLabs Agent, behind an access code |
| Voice rules | That pump's data only, "points to" not "it is", checks not commands, and plant procedure for emergencies |
| Goal of every screen | Someone on shift decides in 10 seconds and knows how far to trust it |
| Trust | Each line shows the cause's past results in plain words, from all 9 labelled pumps. The totals include the replayed alerts and stand in for a real site history. Weak causes lose "the pump may be fine" and add "Check the pump as well" |
| One line per pump | The most reliable concern leads, and the others show as "Plus N more on this pump" |
| Job card | Steps, what you'd expect to find, what to do if not, estimated time stopped, and last done on this pump. Steps and hours need a check from Joonas at Elomatic |
| Next stop | Read from the operating context, which reads ahead on purpose and stands in for a published timetable |
| Finding | After "I'll check it", record Found it, Found something else or Nothing wrong |
| Trend | "Getting worse", "Steady" or "Easing" only where the alert names a signal |
| Work done since | Corrective work after the latest alert moves the pump to Can wait and says what was done. A new alert brings it back. Routine work clears nothing |

## 3. How the judging maps to the app

| Criterion | Weight | What the app does |
|---|---|---|
| Operational value | 25 % | Actionable alerts, draft work orders, payback calculator |
| Technical validity | 25 % | Mostly the detector. The Review view shows measured results against the baselines |
| Reliability and safety | 20 % | Ranked causes, `UNKNOWN` as a normal outcome, sensor vs machine, data gaps, human review |
| Retrofit feasibility | 20 % | Sensor level comparison, cost figures, offline mode, read-only design |
| Prototype and communication | 10 % | End-to-end flow, clear limitations |

Required by the brief: show normal operation, developing faults, evidence, uncertainty and safe human-reviewable actions. A chatbot alone is not enough, so AI and voice are add-ons to the core flow.

## 4. Facts from the data that shape the design

1. **No shared calendar.** Each pump has its own 7-day window, months apart (PUMP-08 is September 2025, PUMP-03 is March 2026). A real "fleet right now" view is impossible. The fleet view aligns all pumps to **Day 1 00:00** and says so. Real UTC times appear in alert details.
2. **Baseline confidence cannot be trusted.** Most PUMP-09 B1 alerts say 0.99, and a real communication loss says 0.05. Do not show these as percentages.
3. **Baseline evidence is one line** (`suction_pressure_kpa z=-6.7`). The evidence screen needs the richer format in section 8.
4. **Baseline alert files cover only validation and test pumps.** PUMP-03, 04 and 06 are training pumps, so we must generate their alerts ourselves (section 9).
5. **Pumps differ in sensors.** Some have 4 channels, some 14, and T1 vibration updates only every 5 minutes. Every screen must cope with missing channels and say what is not measured.
6. **Operator notes are sometimes wrong.** Show them labelled "as recorded".
7. **Plant alarms are rare.** 51 alarms in total, on 5 of 12 pumps, 47 of them on the two hot process pumps (PUMP-06 and PUMP-12).

## 5. Demo stories

| Pump | Split | Sensors | Story | Numbers to show |
|---|---|---|---|---|
| **PUMP-08** (lead) | validation | T1 | Clogged strainer on a ferry, with a wrong operator suspicion | Baseline alert 10 Sep 12:38, limit reached 11 Sep 04:53, so **16 h early**. No plant alarm on the clog. Note says "suspected cavitation" |
| **PUMP-03** | train | T0 | Same symptom, two causes, using only legacy sensors | Valve restriction: pressure up, current down. Calibration shift: pressure up, current unchanged |
| PUMP-06 | train | T1 | Clog worsens into cavitation | Back-up story, but avoid it on baseline alerts: plant alarms catch 5 of 7 faults and B1 catches 2, because B1 misses the cavitation episodes |
| PUMP-04 | train | T2 | Bearing wear with no vibration alarm | Back-up story |

Lead times above use baseline B1. The app must calculate them from the loaded alerts, so they update when the detector changes.

### Video outline (about 2 minutes, on YouTube, public or unlisted)

1. Fleet is calm, then the spoken shift handover.
2. PUMP-08 alert: evidence, ranked causes, wrong operator note.
3. What-if: cleaning the strainer. Then an unsafe idea rejected with reasons.
4. Approve: draft work order, not sent anywhere.
5. PUMP-03: a sensor problem caught, so a needless repair is avoided.
6. Review view: old alarms vs our alerts vs what really happened.
7. Sensor comparison and payback, then honest limitations.

## 6. Screens

### Persistent elements

- Status strip: **Advisory only · Read-only · Simulated data**.
- Replay controls: play, pause, speed, scrub, current Day and hour.
- Footer attribution, required by CC BY 4.0: "RETROFIT AI 2026 synthetic pump benchmark, Since AI Hackathon 2026".

### 6.1 Fleet

- One row per pump: name, site, sensor level, state, open cases, data health.
- States: Normal, Watching, Needs review, Data problem, Stopped.
- Sorted by attention needed. A calm fleet must look calm.

### 6.2 Case inbox

- Repeat alerts for the same pump and fault merge into one **case** with an update count. This keeps alert load low, which the scoring and the business case both reward.
- Each card: pump, likely cause, machine or sensor, certainty, age, next step.
- Sensor problems look different from machine problems at a glance.
- `UNKNOWN` is shown as "Something is wrong, cause unclear", not as a failure.

### 6.3 Case detail (the main screen)

1. **Answer first:** likely cause and recommended check, in plain language.
2. **Possible causes:** ranked with High, Medium or Low, plus "what would settle it".
3. **Evidence chart:** deviating signals against their expected band, with the alert moment marked and data gaps shown as gaps.
4. **Sensor or machine check:** did related signals move as well? For example, "Pressure rose but motor current did not".
5. **Blind spots:** what this pump cannot measure.
6. **Context:** operating state, plant alarms, and maintenance notes dated at or before the replay time, labelled "as recorded, may be wrong".
7. **Decision:** Approve, Reject with reason, or Keep watching.

Wording rule: buttons describe a human request, such as "Approve inspection request". Never use wording that sounds like a machine command.

### 6.4 Draft work order

Pump, suspected cause, evidence summary, requested check, urgency and decision time. Marked **Draft: not sent anywhere**.

### 6.5 Decision log

Every decision with time, reason and the alert it refers to. Stored in the browser, exportable as CSV, with a demo reset button.

### 6.6 Review view

Available only when the user leaves replay and opens it.

- One timeline per pump: true faults, our alerts, baseline alerts, plant alarms, work orders and stops (like `figures/fig06_operator_timeline_PUMP-08.png`).
- Lead time per fault and the misses as well as the hits.
- Scores for train and validation together, showing the number of events, because validation has only 9 scored events.
- Test pumps have no real answers, so show "Scored by the organizers".

### 6.7 Phone view

Same app, simpler layout:

- Inbox, case detail, decision, briefing and voice.
- One small trend chart instead of the full evidence chart.
- Fleet table becomes a list. Review and the comparison tools can show a "best on a larger screen" note.

## 7. Extras, in build order

### 7.1 What-if sandbox

- From a case, choose an action and an assumed severity, for example mild, moderate or severe clogging.
- Show current vs proposed: flow, cooling satisfied, NPSH margin, power, energy cost, risk.
- Show rejected actions with their reasons. These are a safety feature, so feature them.
- Show the assumption and the simulator's caveats. Label it: **Simulation only. Nothing is sent to any machine.**
- Implementation: pre-compute results with `what_if()` for the hero cases and store them as JSON, so hosted and offline modes both work. A live Python service is optional, and only if time allows.

### 7.2 Sensor level comparison

- Toggle T0, T1 and T2. Show which fault types stay visible and the hardware cost.
- Baseline version: a visibility table built from `RETROFIT_FEASIBILITY.md` section 1 and the label field `evidence_channels`. Mark it "documented".
- Better version: teammates run the detector with channels removed. Mark those results "measured". Do not use B1 for this: `tools/build_sensor_compare.py --detector` shows why its figures mislead.
- Use PUMP-05 as an honest blind spot: its bearing wear cannot be seen with T0 sensors.
- Costs: option B about EUR 2.1-2.4 k, option A about EUR 2.8-3.1 k, before cabling and installation. Mark them as assumptions.

### 7.3 Payback calculator

- Port `evaluate()` from `examples/business_case.py` to the app.
- Default recall and false-alert rate come from our measured results. Editable sliders for the assumptions.
- Show the redundant-pump case and the sensitivity to false alerts. At 0.5 false alerts per pump-day, the example net result is EUR -14,332 per year.
- Label: **Illustrative only, not a realised or expected saving.**

### 7.4 AI explanation

- Turns one structured alert into a 2-3 sentence plain-language explanation.
- Input: only the alert, its evidence and the pump sheet, limited to data at or before the replay time. Never labels.
- The key stays on the server. Store results for hero alerts so they work offline.
- Choose the model at build time with the `claude-api` skill.

### 7.5 Shift handover briefing (ElevenLabs)

- About 30 seconds: what changed, what needs attention, what can wait, data problems.
- Text is generated from data up to the replay moment, then turned into audio in advance and stored with the app.
- A transcript is always visible, so it works without sound.
- Generate one or two briefings for the hero stories first.

### 7.6 Voice questions

- Push to talk, with a text box always available as a backup.
- Flow: speech to text, then Claude answers from app data only, then ElevenLabs reads the answer.
- Context is limited to alerts, evidence, pump sheet and glossary at or before the replay time.
- Answers point to the evidence they rely on.
- It says "I don't know" when the data does not support an answer.
- It recommends human checks only, and never gives machine commands or claims certainty.
- Rehearse about three questions and store their answers as a fallback for the video.
- Offline, voice questions are turned off with a clear message, and stored briefings still play.

## 8. Alert format for the detector team

**Agree this with teammates today.** Everything except the first block is optional, and the app falls back gracefully.

```json
{
  "asset_id": "PUMP-08",
  "alert_time_utc": "2025-09-10T12:38:00Z",
  "event_class": "MACHINE",
  "fault_type": "SUCTION_STRAINER_CLOGGING",
  "confidence": 0.72,
  "recommended_action": "Inspect and clean the suction strainer at the next opportunity",

  "alert_id": "PUMP-08-A0001",
  "detector_version": "v3",
  "confidence_calibrated": true,
  "hypotheses": [
    { "event_class": "MACHINE", "fault_type": "SUCTION_STRAINER_CLOGGING", "probability": 0.72 },
    { "event_class": "SENSOR", "fault_type": "SENSOR_DRIFT", "probability": 0.18 }
  ],
  "evidence": {
    "summary": "Suction pressure is falling while speed rises",
    "channels": [
      { "channel": "suction_pressure_kpa", "observed": 33.1, "expected": 41.8, "z": -6.7 }
    ],
    "sensor_check": "Related signals moved too, so a single bad sensor is unlikely",
    "blind_spots": ["flow_m3_h"]
  },
  "what_would_settle_it": "Compare with the local gauge at the pump",
  "time_to_limit_h": 16
}
```

Rules for the detector team:

- Every alert uses only data at or before `alert_time_utc`.
- **B1 cannot use wireless channels, so fix this in the detector.** Wireless vibration reports every 5 minutes, but B1 needs 15 minutes in a row of deviation. On PUMP-06 and PUMP-08, acceleration was over the limit for 633 and 774 minutes, yet the longest run was 1 minute. Count persistence in readings, or hold the last reading between reports. This likely explains B1 missing the PUMP-06 cavitation.
- **Scoring counts any alert inside a fault's window as a catch.** A long bearing fault can be "caught" by an unrelated alert, so check the named cause as well as the catch count.
- **Make the detector repeatable.** B1's diagnosis loops over a Python `set`, so the same alert can name a different cause from one run to the next. Avoid iterating sets when naming a cause, or fix `PYTHONHASHSEED`. Our tools fix it to 0.
- **Do not copy baseline B1's learning period as it is.** B1 learns normal from the first 24 hours of each pump, yet it raises alerts inside those 24 hours (PUMP-04 at hours 0.6 and 22.5, PUMP-09 at hour 12.8). Those alerts rely on later data. A detector built the same way could fail the organizers' truncation check, so stay silent until the learning data exists, or learn only from data before the alert.
- The submission CSV takes the top cause only. **Never write alternative causes as extra rows**: the scorer treats alerts within 5 minutes as one burst, and a burst naming more than one fault type earns no fault-type credit.
- `hypotheses` probabilities should be calibrated, or set `confidence_calibrated` to false.
- `UNKNOWN` is allowed and earns detection credit.
- Do not tune on, or hand-label, the test pumps.

App fallbacks:

| Missing | App shows |
|---|---|
| `hypotheses` | One cause, with no comparison |
| Calibrated confidence | "Certainty not calibrated" instead of High, Medium or Low |
| `evidence.channels` | Parsed text only, and the chart from our expected bands |
| `what_would_settle_it` | Recommended action only |

Display bands for calibrated values: High 0.7 or above, Medium 0.4-0.7, Low below 0.4. These are provisional, so agree them with the detector team.

## 9. Technical design

### Stack

- Next.js, TypeScript and Tailwind.
- uPlot for time-series charts, because scrubbing thousands of points must stay fast.
- Python scripts in `tools/` to prepare data. Secrets in `.env`, never in the browser.

### Repository

Copy `/Users/jona/Documents/since-ai-hackathon/hackathon-starter`, commit the template first, then create a private team GitHub repo. Keep it separate from the organizer package. The starter's `CLAUDE.md` event rules apply, and its `scripts/make-submission-zip.sh` makes the required source zip. Do not commit the 345 MB organizer data: point the tools at it with a path in `.env`, and commit only the generated JSON the app needs.

```
app/                     Next.js app
public/data/             generated JSON per pump
public/audio/            stored briefings
tools/build_ui_data.py   telemetry features and bands to JSON
tools/build_train_alerts.py   baseline alerts for training pumps
tools/build_what_if.py   pre-computed sandbox results
```

### Data preparation

- Input: `features_1min.parquet`, assets, alarms, maintenance, context, events and alert files.
- Output per pump: 1-minute series, thinned for the overview, plus expected bands and all alert data.
- Expected bands: reuse the first-24-hours regime logic in `src/retrofit_sim/baselines.py`. A fault that already exists at window start (such as PUMP-08 bearing wear) sits inside that baseline, so treat bands as a guide.
- The organizer package is tested on **Python 3.10-3.13**. This Mac defaults to 3.14 without pandas, but Python 3.12, `uv` and Node are installed, so use a Python 3.12 environment.
- Keep the 1-second data and vibration waveforms out of the browser. A static PUMP-04 spectrum image is a stretch goal.

### Replay rule

Live screens render only data at or before the replay time, including alerts, alarms, notes, AI context and briefings. Labels load only in the Review view.

### Which pumps appear

- During development, use train and validation pumps only.
- Add test pumps only after the submission file is frozen, showing alerts and telemetry with no real answers.

### Load an alert CSV

- Runs in the browser, so the file is not uploaded anywhere.
- Validate columns and vocabulary to match `src/retrofit_sim/scoring.py`, with clear error messages.
- Alerts appear in cases and timelines. Scoring stays in the Python scorer unless time allows.

### Hosting and modes

| Feature | Public link | Offline mode |
|---|---|---|
| Replay, cases, decisions, what-if, comparison, payback | Yes | Yes |
| AI explanation | Live, plus stored | Stored only |
| Handover audio | Stored | Stored |
| Voice questions | Live | Off, with a message |

### Public link protection

Live AI and voice on a public link can spend real money. Keep keys on the server, set spending limits on both accounts, limit requests per session, and protect live voice with an access code.

## 10. Safety and honesty rules

- No control features of any kind. No buttons that imply one.
- Never claim certified safety, class approval, guaranteed fault identification or proven savings.
- Always say the data is synthetic and results are not evidence of field performance.
- Mark every cost as list price or assumption.
- Show misses and false alerts as well as wins.
- Use a stock ElevenLabs voice. Do not clone any real person's voice.
- Limitations to state: seal leaks and electrical faults are not in the data, faults are compressed into 7 days, and the simulator is not a validated digital twin.

## 11. Plan to Sunday 10:00

This spec was written on Friday at 21:20, about 37 hours before the deadline.

| When | Goal |
|---|---|
| Friday night | Agree the alert format. Create the repo. Build data scripts. Run the app skeleton with replay on PUMP-08. Message Elomatic with the questions in section 13 |
| Saturday 12:00 | **Core flow works end to end** on baseline alerts, including the phone inbox and deployed link |
| Saturday 18:00 | What-if, sensor comparison and payback working. Review view with real numbers |
| Saturday 22:00 | AI explanation and briefing done, voice questions if on track. **Feature freeze.** Swap in the detector's alerts |
| Sunday 08:00 | Bugs fixed, video recorded, PDF and technical note drafted |
| Sunday 09:00 | **Submit.** Keep the last hour as buffer |

### Priority if time runs short

1. **Must ship:** replay, fleet, cases, evidence, decision, draft work order, phone inbox, Review view.
2. **Should ship:** what-if, sensor comparison, payback.
3. **Could ship:** AI explanation, shift handover briefing.
4. **First to cut:** voice questions, CSV loading.

All four extras plus two voice features is a lot for this deadline. Voice questions are last because they depend on the AI explanation and have the most ways to fail on camera. If they are not stable by the Saturday freeze, use stored answers in the video and label them as such.

### Suggested split between the two UI builders

| Builder A: core | Builder B: extras |
|---|---|
| App shell and visual system | What-if |
| Replay, fleet, cases | Sensor comparison |
| Case detail and charts | Payback calculator |
| Decisions and work orders | AI explanation and voice |
| Phone layout | Data scripts for extras |

Builder A sets the visual system first. Shared types live in one file, changed only by agreement. Both share the Review view and the video.

### Skills to use

| Stage | Skill |
|---|---|
| Visual system and screens | `ui-ux-pro-max`, `frontend-design` |
| Charts | `dataviz` |
| Alert wording and explanations | `jmo-workflow:ste` |
| Motion, used sparingly | `jmo-workflow:animate` |
| Feedback on the running UI | `jmo-workflow:agentation` |
| Final polish | `jmo-workflow:better-ui` |
| Claude API work | `claude-api` |

## 12. Definition of done

- [ ] A new visitor can open the link and reach the PUMP-08 alert in under a minute, without instructions.
- [ ] Before the first alert, the fleet clearly reads as normal.
- [ ] No future data or label appears on a live screen at any replay time.
- [ ] A pump with T0 sensors displays correctly and names what it cannot measure.
- [ ] A data gap appears as a gap and as a data problem, never as a machine fault.
- [ ] Repeat alerts merge into one case.
- [ ] Every case can be approved, rejected with a reason, or kept on watch, and appears in the log.
- [ ] Swapping the alert file updates cases, lead times and payback with no code change.
- [ ] What-if displays at least one accepted and one rejected action with reasons.
- [ ] The phone flow works from inbox to decision on a real phone.
- [ ] The app works with no internet, using stored AI text and audio.
- [ ] No API key reaches the browser.
- [ ] A bad CSV gives a clear error and does not break the app.

Submission pack, with owners to confirm: prototype link, repo and run instructions, narrated YouTube video of about two minutes, PDF or slides, baseline comparison, technical note on cost, deployment, safety and limits, the test-pump alert CSV, source zip, project name and tagline, and AI tool answers. Every team member must accept the IP terms in sinceai.app.

## 13. Open questions

**For the detector team, today**

1. Can they output `hypotheses` and calibrated confidence?
2. When will the first real alert file exist? Please aim for Saturday morning.
3. Will they generate alerts for training pumps as well? If not, we use baseline B1 for those.
4. Can they run the detector with channels removed, for measured sensor level results?

**For Joonas Riekkinen, Elomatic (listed as onsite Friday, availability after that may vary, so ask early)**

1. Is "duty engineer" the right user for a ferry or small plant?
2. What would make them trust or ignore an alert?
3. What must a draft work order contain to be useful?
4. Does the Calm industrial direction feel right for a control room?

**For the organizers, through the Since AI Discord**

1. Must the jury be able to open the prototype, or is the video enough?

**For the UI team**

1. Who is Builder A and who is Builder B?
2. Final product name.
