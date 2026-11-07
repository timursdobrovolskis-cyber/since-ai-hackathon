import assert from "node:assert/strict";
import { test } from "node:test";
import { describeDrift } from "./drift.ts";
import type { SignalRow } from "./signal.ts";

const row = (hour: number, value: number, lo = 450, hi = 468): SignalRow => ({ date: new Date(hour * 3600e3), hour, value, lo, hi, label: `h${hour}` });
// A little noise, as in every real reading. A perfectly flat line reads as a stuck sensor.
const noise = (h: number) => Math.sin(h * 3) * 0.8;
const series = (fn: (h: number) => number, from = 0, to = 24, step = 0.5, jitter = true) => {
  const rows: SignalRow[] = [];
  for (let h = from; h <= to; h += step) rows.push(row(h, fn(h) + (jitter ? noise(h) : 0)));
  return rows;
};

test("a step up that stays says when it left the band and that it has stayed", () => {
  const d = describeDrift(series((h) => (h < 12 ? 459 : 484)), "Discharge pressure", "kPa")!;
  assert.equal(d.leftAt, "h12");
  assert.equal(d.trend, "steady");
  assert.equal(d.sentence, "Discharge pressure went above its normal band at h12. It is 25 kPa above normal now, holding steady.");
});

test("a reading still falling says so", () => {
  const d = describeDrift(series((h) => (h < 12 ? 459 : 459 - (h - 12) * 4)), "Suction pressure", "kPa")!;
  assert.equal(d.trend, "away");
  assert.match(d.sentence, /went below its normal band at h[\d.]+\. It is \d+ kPa below normal now, still falling\./);
});

test("a reading back inside its band says it is back", () => {
  const d = describeDrift(series((h) => (h > 8 && h < 12 ? 480 : 459)), "Motor current", "A")!;
  assert.match(d.sentence, /went outside its normal band at h8\.5 and is back inside it now/);
});

test("a flat reading reads as not moving", () => {
  const d = describeDrift(series((h) => (h < 18 ? 459 + Math.sin(h) * 3 : 455 - noise(h)), 0, 24, 0.5), "Bearing temperature", "°C")!;
  assert.match(d.sentence, /has not moved from 455 °C since h/);
});

test("out of band from the first row says since at least", () => {
  const d = describeDrift(series(() => 490), "Discharge pressure", "kPa")!;
  assert.match(d.sentence, /has been above its normal band since at least h0\. It is 31 kPa above normal now/);
});

test("short noise back inside the band does not end the run", () => {
  const d = describeDrift(series((h) => (h < 10 ? 459 : h === 15 ? 462 : 484)), "Discharge pressure", "kPa")!;
  assert.equal(d.leftAt, "h10");
});

test("a reading that only just left its band gets no trend", () => {
  const d = describeDrift(series((h) => (h < 23 ? 459 : 440)), "Suction pressure", "kPa")!;
  assert.match(d.sentence, /It is \d+ kPa below normal now\.$/);
});
