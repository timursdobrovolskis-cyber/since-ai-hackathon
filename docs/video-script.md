# Retrofit Assist: demo video script

Nov 7, 2026 · @Flinck

A two-minute walkthrough for the Since AI submission, using the live app. Update the numbers if the team's detector replaces the baseline.

## Script

The story follows one worker: a calm start, a short spoken handover, a plain to-do list, a job card, a human decision, an honest doubt, and proof. Spoken words total about 245, which fits two minutes at a calm pace.

| Time | On screen | Say |
| --- | --- | --- |
| 0:00 | The main page: "3 pumps need you today." | Old pumps often give no warning until a fixed alarm limit is crossed. Retrofit Assist tells the person on shift what needs them, in plain words. It only advises, and it never touches the machine. |
| 0:15 | Press play on the handover row. | (Let the handover play for about eight seconds. This is the only voice in the video.) |
| 0:25 | The Today list. | No dashboard to decode. One line per pump: what needs me, what do I do, and can it wait. |
| 0:34 | Point at the small line under Pump 8. | Each line says how far to trust it. This cause was right in 8 of 9 past cases, and a cause that's often wrong says so. |
| 0:42 | Open Pump 8. Scroll down the job card. | The job card gives the steps, what to expect, the time stopped, and the next chance to stop. The plant's alarms have stayed silent. |
| 0:56 | Open Why does it think this? Show the line leaving the grey band, then Raise speed to 90 % being blocked. | The evidence is one tap away. The simulator tests a fix, and blocks unsafe ideas with the reason. |
| 1:10 | Press I'll check it, then Found it. Show the draft work order. | A person decides. Nothing is sent to the machine. What they found builds a track record for this site. |
| 1:20 | Back on the main page, open Pump 7 under Check the reading. | Not every alert is a pump fault. This one points to the reading, so compare it with a local gauge. This kind of alert is often wrong, so it says to check the pump as well. |
| 1:37 | Back on the main page, press 26 of 35 faults under How well it works, and open PUMP-08. Point at the alert ahead of the limit, then the table. | Compared with what really happened, this came 16 hours before the limit. Across 35 faults, alarms caught 7, and the baseline alerts caught 26. |
| 1:49 | Under More detail, open Sensor levels, then Payback. | A low-cost retrofit shows evidence for all 13 fault types. The business case is illustrative, and false alerts decide whether it pays. |
| 1:58 | Back to Today. | This is simulated data, not proof on real pumps. But it shows the path: early warning, plain advice, and a human in charge. |

## Before recording

Record only after the final alerts are in, because every number above comes from the placeholder baseline.

- [ ] Swap in the team's alerts, and update the 16 hours, 7 and 26, 8 of 9, and the wording "baseline alerts"
- [ ] Deploy this version, then press Clear my decisions on My decisions, so no earlier decisions show
- [ ] Confirm the evening shift still shows Pump 8's strainer and Pump 7's reading. If not, change SHIFT\_HOUR in lib/labels.ts
- [ ] Regenerate the handovers with npm run handover after swapping alerts
- [ ] Upload to YouTube as public or unlisted, and paste the link into sinceai.app

Direct links for each scene, so nobody has to scrub:

- [Pump 8 job card](https://since-ai-hackathon.vercel.app/cases/PUMP-08-A0001)
- [Pump 7 reading](https://since-ai-hackathon.vercel.app/cases/PUMP-07-A0001)
- [Review](https://since-ai-hackathon.vercel.app/review?pump=PUMP-08)
- [Sensor levels](https://since-ai-hackathon.vercel.app/sensors)
- [Payback](https://since-ai-hackathon.vercel.app/payback)
