// The Vahti logo, redrawn as a vector from the team's artwork: a ring of six segments with the right-hand one in the
// accent blue, and the wordmark "vahti" with a square blue dot on the i. Ink parts use currentColor, so the logo works
// on both the ink and the white top bar. Coordinates follow the artwork's own layout.
const CX = 348;
const CY = 266;
const R_OUT = 91;
const R_IN = 63;
const R_IN_ACCENT = 45; // the blue segment is thicker, pointing in toward the centre
const GAP = 6; // degrees between segments

const pt = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(CX + r * Math.cos(a)).toFixed(2)} ${(CY - r * Math.sin(a)).toFixed(2)}`;
};

/** An annular segment from `from` to `to` degrees, counter-clockwise from the right. */
const segment = (from: number, to: number, rIn: number) =>
  `M${pt(R_OUT, from)} A${R_OUT} ${R_OUT} 0 0 0 ${pt(R_OUT, to)} L${pt(rIn, to)} A${rIn} ${rIn} 0 0 1 ${pt(rIn, from)} Z`;

// Six segments of 60 degrees each, the first centred on the right.
const RING = Array.from({ length: 6 }, (_, i) => {
  const mid = i * 60;
  return { d: segment(mid - 30 + GAP / 2, mid + 30 - GAP / 2, i === 0 ? R_IN_ACCENT : R_IN), accent: i === 0 };
});

const WORD = [
  // v
  "M500 224H539L555 283L571 224H610L577 348H534Z",
  // a: the bowl with its counter cut out (evenodd), then the stem
  "M628 286A62 62 0 1 0 752 286A62 62 0 1 0 628 286ZM662 286A28 28 0 1 1 718 286A28 28 0 1 1 662 286Z",
  "M719 224H752V348H719Z",
  // h
  "M772 174H806V227.9A56 56 0 0 1 885 279V348H851V279A22.5 22.5 0 0 0 806 279V348H772Z",
  // t
  "M921 188H955V224H976V254H955V348H921V254H901V224H921Z",
  // i
  "M990 224H1024V348H990Z",
];

export function Logo({ className, mark = false }: { className?: string; mark?: boolean }) {
  return (
    <svg viewBox={mark ? "254 172 190 190" : "254 172 772 186"} className={className} role="img" aria-label="Vahti" fill="currentColor">
      {RING.map((s, i) => (
        <path key={i} d={s.d} fill={s.accent ? "var(--mz-accent, #2c63ff)" : undefined} />
      ))}
      {!mark && (
        <>
          {WORD.map((d, i) => (
            <path key={i} d={d} fillRule="evenodd" />
          ))}
          <rect x="990" y="174" width="34" height="34" fill="var(--mz-accent, #2c63ff)" />
        </>
      )}
    </svg>
  );
}
