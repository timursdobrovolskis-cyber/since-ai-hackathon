# Retrofit Assist: technical note

Nov 7, 2026 · @Flinck

## Summary

Retrofit Assist tells the person on shift, in plain words, what needs them on existing cooling-water pumps, what to do, and how far to trust it. It never touches the machine. On the 35 scored faults across the 9 labelled pumps, the placeholder B1 baseline catches 26, while the plant's own alarms catch 7.

Those figures use the organizers' B1 baseline, not the team's final detector. All data is synthetic, so results show the method works on a physically coherent benchmark, not that it works on real pumps.

## How it works

Workers start on one main page with the pumps that need them and the key results, and everything else is one click away. Each step shows only what was known at that moment.

1. **One shift.** The app opens on one evening shift from a simulated test week. Pump windows come from different months, so they are aligned to start together.
2. **Alerts become cases.** Repeat alerts for one pump and fault merge into one case, and Today shows one line per pump, which keeps the alert load low.
3. **Evidence.** Each signal is drawn against its normal band, learned from that pump's first 24 hours by speed regime.
4. **Uncertainty.** The case names possible causes, whether it may be the sensor, and what the pump cannot measure. Baseline confidence is shown as "not calibrated" rather than as a percentage.
5. **What-if.** The organizers' sandbox tests a fix under an assumed severity, and blocks unsafe actions with reasons. Results are simulation only.
6. **Human decision.** The worker chooses I'll check it, Not a problem with a reason, or Remind me later. I'll check it creates a draft work order that is not sent anywhere, and the worker then records what they found.
7. **Review.** Labelled faults load only in this separate view, which compares alerts, plant alarms and what really happened.

Each line says how far to trust it, because the baseline named the right cause in only 30 of 60 alerts. A clogged strainer was right in 8 of 9 past cases, and a reading that looks wrong in only 5 of 20. Weak causes no longer suggest the pump may be fine, and add a check of the pump itself.

The job card gives the steps, what you would expect to find, what to do if not, the estimated time stopped, the next chance to stop, and when that work was last done on the pump. Corrective work logged after the latest alert moves the pump to Can wait, and a new alert brings it back.

Voice is a small extra. A recorded 30-second handover covers the shift, built from the same rules as the Today list. At the pump, a worker can hold a button or type to ask about that pump, and the answer always appears as text too.

## Measured results

The baseline scores 63.4 against 26.6 for the plant's alarms, and warns a median 15.1 hours before a conventional limit. All figures come from the organizers' scorer, on the labelled train and validation pumps.

| All 35 scored faults | Plant alarms today | B1 baseline (placeholder) |
| --- | --- | --- |
| Faults caught | 7 of 35 | 26 of 35 |
| Warned before the limit, where one was reached | 25 % | 83 % |
| Median warning before the limit | 0.0 h | 15.1 h |
| Faults with the exact cause named | 6 % | 31 % |
| False and excess alerts per pump per day | 0.11 | 0.11 |
| Benchmark score, 0 to 100 | 26.6 | 63.4 |

By split, plant alarms against B1 score 27.6 and 58.2 on the 7 training pumps, and 23.1 and 78.0 on the 2 validation pumps. Validation has only 9 scored faults, so we report all pumps together. Our rebuild reproduces the organizers' published scores, and the data build stops if it does not.

Three weaknesses in the baseline matter when reading these results:

- **Named cause.** The exact cause is right for only 31 % of faults.
- **Wireless vibration.** B1 needs 15 minutes in a row of deviation, but wireless sensors report every 5 minutes. On PUMP-06 and PUMP-08, the longest run it saw was 1 minute.
- **Scoring credit.** Any alert inside a fault's window counts as a catch, so a long fault can be credited to an unrelated alert.

The baseline is not always better. On PUMP-06, plant alarms catch 5 of 7 faults and B1 catches 2, because B1 misses the cavitation episodes.

## Retrofit costs

A low-cost retrofit shows evidence for all 13 fault types, while legacy sensors show none of the bearing, misalignment or imbalance faults. Hardware for one pump ranges from about EUR 500 to about EUR 5,400, before installation.

| Sensor level | What it adds | Fault types with evidence | Hardware for one pump | Basis |
| --- | --- | --- | --- | --- |
| Legacy | Edge computer only, reading existing signals | 10 of 13 | about EUR 500-600 | List price |
| Low-cost retrofit | Suction pressure transmitter, wireless vibration and temperature point, gateway, edge computer | 13 of 13 | about EUR 1.9-5.4 k | Our sum, mostly assumptions |
| Full | Option B wired package plus indicative clamp-on flow | 13 of 13 | about EUR 2.3-2.8 k | Assumption built from list prices |

Hardware figures come from the organizers' feasibility document, with list prices seen on 30 Oct 2026. They exclude cabling, enclosure, installation, class or flag approvals and software. Wireless platforms publish no prices, so the retrofit range is wide and needs real quotes.

A fault counts as visible at a level when that level has a channel that carried the fault's earliest evidence in the labels. This describes the sensors, not any detector. It is a cautious count, because only the earliest evidence is listed.

Full sensors add no fault types in this count. Their value, per the feasibility document, is the pump's operating point and efficiency, earlier warning of fast faults, and better separation of sensor and machine problems.

## Business case

On all labelled pumps, the illustrative case pays back in 3.4 years, and it stops paying above 0.14 false alerts per pump per day. The baseline runs at 0.11, so false alerts decide the result.

| Starting point | Share of faults caught | False alerts per pump per day | Net effect per year | Simple payback |
| --- | --- | --- | --- | --- |
| All labelled pumps | 74 % | 0.11 | EUR 1,343 | 3.4 years |
| Validation pumps only, the organizers' example | 89 % | 0.07 | EUR 4,458 | 1.0 years |
| Ship pump with a healthy standby | 74 % | 0.11 | -EUR 4,452 | Never |

This is illustrative only, not a realised or expected saving. Other inputs are the organizers' assumptions: 0.6 developing faults per year, EUR 1,500 per hour of downtime, EUR 9,000 unplanned and EUR 4,000 planned repair, EUR 120 to check a false alert, EUR 4,500 installed and EUR 700 per year to operate. The standby case instead assumes no downtime cost and 0.3 faults per year.

We default to all labelled pumps because validation holds only 2 pumps and 9 scored faults. The calculator's maths is tested against every figure the organizers published.

The case is strongest for critical pumps with no spare. Where a healthy standby exists, avoided downtime pays for little, and the case rests on repair costs, energy and crew time, which this model does not fully count.

## Deployment assumptions

A real installation would listen to existing signals through a read-only link, run on a small edge computer, and send advisory alerts one way. This is the design from the organizers' feasibility document. The prototype only replays stored data.

```text
Read-only deployment: from the machine side to the duty engineer

  MACHINE SIDE (existing, unchanged)      MONITORING ZONE (new)               PEOPLE
 ┌──────────────────────────────┐        ┌──────────────────────────────┐    ┌──────────────────────┐
 │ Pump, motor, drive           │        │ Small edge computer          │    │ Duty engineer        │
 │ Existing sensors             │ read   │  per-regime normal bands     │    │  laptop at shift     │
 │ PLC, alarms, trips           │ only   │  detector                    │ ad-│  start               │
 │ Safety system                │ ─────▶ │  Retrofit Assist             │vice│  phone at the pump   │
 │                              │ one    │                              │───▶│                      │
 │ Optional retrofit point:     │ way    │ Own IEC 62443 zone           │one │ Decides, checks,     │
 │ wireless vibration and temp  │        │ No write path to the machine │way │ records what they    │
 └──────────────────────────────┘        └──────────────────────────────┘    │ found                │
          ▲                                                                   └──────────────────────┘
          │  nothing comes back: no command, no setpoint, no acknowledgement to the PLC
          ✕
```

The monitoring layer sits in its own zone, follows IEC 62443 zone and conduit practice, and cannot write to the PLC, drive, valves or safety system. On ships it would stay outside the IACS UR E26 zones or be made one-way, and be recorded in the asset inventory.

The prototype runs in a browser on stored JSON. What-if results and the spoken handover are stored with the app, so visitors use no credits. Live questions are the exception: they need internet, an access code checked on the server, and are capped at 90 seconds each and 40 a day. It is hosted on a public link for the jury, with the same app able to run locally.

A real pilot would follow the organizers' sequence:

1. Connect read-only for 4-8 weeks and build per-regime baselines, with no alerts to operators.
2. Run in shadow mode, and compare logged alerts with operator logs, alarms and work orders.
3. Add one retrofit point where shadow mode shows a blind spot.
4. Run an advisory pilot, with alerts going to a named role and a feedback button.
5. Decide on scale-up from measured value, not model accuracy alone.

## Safety and human review

The prototype has no way to control a machine, and a person makes every decision. Plant alarms, trips and interlocks stay authoritative.

- **No write path.** The app reads stored data. It sends nothing to any device, and draft work orders are not sent anywhere.
- **Human decision.** Every case needs a person to choose I'll check it, Not a problem with a reason, or Remind me later. Decisions and findings are logged and can be exported.
- **No future data on live screens.** Screens draw only data up to the shift shown. Labelled faults load only in the Review view, and a test found none loaded on the main page or job card. The main page holds totals only.
- **Admitting uncertainty.** A case can say the cause is unclear, name what the pump cannot measure, and refuse to show uncalibrated confidence as a percentage.
- **Sensor or machine.** A signal that moves alone points to a sensor check, so a drifting gauge is less likely to trigger a needless repair.
- **Bounded simulation.** What-if results use an assumed severity, and the organizers' sandbox blocks unsafe actions with reasons. An inspection is never shown as blocked, because it does not change the pump.

The voice assistant has its own limits. It receives only that pump's facts up to the shift shown, never labels, and it must hedge causes and recommend human checks. In a typed test against the live agent, it refused machine commands, sent an emergency to plant procedure, stayed on topic and resisted "ignore your rules". That test also found one false answer about what the pump measures, which we fixed by giving it the latest readings.

The baseline itself breaks the no-future-data rule in one place. It learns normal from each pump's first 24 hours, yet raised 3 alerts inside those hours, on PUMP-04 and PUMP-09. The final detector must avoid this.

## Transfer to other rotating machines

The approach transfers by swapping the machine model and alert source, while the case, evidence and decision flow stay the same. The app already takes alerts from any detector, as a CSV or JSON file, with no code change.

For a new machine, start with what the drive or motor starter already knows. Add one vibration and temperature point for each critical bearing, and add process measurements only where they change a decision.

The parts specific to pumps are the signal names, normal-behaviour bands, fault list and what-if model. A fan, compressor or gearbox would need its own fault list and limits. We have not tested this on another machine class.

## Honest limits

This is a prototype on simulated data, and nothing here is evidence of field performance.

- **Placeholder alerts.** Results above use baseline B1. They must be replaced with the final detector's scores before submission.
- **Synthetic data.** The simulator is a reduced-order model, not a validated digital twin. Fault growth is compressed into 7 days, where real wear takes weeks to months.
- **Faults not modelled.** Mechanical seal leaks, electrical rotor or stator faults and rotor dynamics are not in the data.
- **Small samples.** There are 35 scored faults across 9 pumps, and only 9 on validation. Test-pump results are held by the organizers. The past-case counts come from the same 9 pumps, including the alerts the app shows, and stand in for a site history built from recorded findings.
- **Assumed inputs.** Business case inputs, what-if severity levels, most wireless prices and job card times are assumptions. Replace them with site data and quotes. An engineer has not yet reviewed the job card steps.
- **Not yet tested.** The app has not run on a real edge computer, on live plant signals, or with a real operator. Offline operation is designed but untested, and voice has not been tried in a loud engine room.
- **No approvals.** The prototype has no certified safety, class approval or proven savings. Independent engineering and regulatory review is needed before any operational use.
