// Textures for the engine room, drawn in code so the page downloads no images: chequer plate for the deck, paint
// grime for bulkheads, engraved name plates and a pressure gauge face.
import * as THREE from "three";

function canvas(w: number, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas");
  return { c, ctx };
}

/** A small seeded random, so the room looks the same on every visit. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Turns a height map into a tangent-space normal map. */
function heightToNormal(height: ImageData, strength: number) {
  const { width: w, height: h, data } = height;
  const { c, ctx } = canvas(w, h);
  const out = ctx.createImageData(w, h);
  const at = (x: number, y: number) => data[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

function repeatTexture(c: HTMLCanvasElement, repeat: [number, number], color = false) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

/**
 * Steel chequer plate: raised lozenges in pairs at right angles, as on ship floor plates, with plate seams every tile.
 * Returns a colour map with wear, a normal map and a roughness map.
 */
export function chequerPlate(repeat: [number, number]) {
  const S = 512;
  const height = canvas(S);
  const h = height.ctx;
  h.fillStyle = "#000";
  h.fillRect(0, 0, S, S);
  const step = S / 8;
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 8; gx++) {
      const cx = gx * step + step / 2;
      const cy = gy * step + step / 2;
      const turn = (gx + gy) % 2 === 0 ? Math.PI / 4 : -Math.PI / 4;
      h.save();
      h.translate(cx, cy);
      h.rotate(turn);
      const g = h.createRadialGradient(0, 0, 1, 0, 0, step * 0.34);
      g.addColorStop(0, "#fff");
      g.addColorStop(1, "#000");
      h.fillStyle = g;
      h.beginPath();
      h.ellipse(0, 0, step * 0.36, step * 0.085, 0, 0, Math.PI * 2);
      h.fill();
      h.restore();
    }
  }
  // Plate seam around the tile.
  h.strokeStyle = "#000";
  h.lineWidth = 6;
  h.strokeRect(0, 0, S, S);
  const normal = heightToNormal(h.getImageData(0, 0, S, S), 4);

  // Colour: worn steel, brighter where boots polish the raised lozenges.
  const colour = canvas(S);
  const c = colour.ctx;
  c.fillStyle = "#6f7478";
  c.fillRect(0, 0, S, S);
  const r = rng(7);
  for (let i = 0; i < 900; i++) {
    c.fillStyle = `rgba(${r() > 0.5 ? "40,34,28" : "150,150,150"},${r() * 0.06})`;
    c.beginPath();
    c.arc(r() * S, r() * S, 4 + r() * 40, 0, Math.PI * 2);
    c.fill();
  }
  c.globalCompositeOperation = "lighter";
  c.globalAlpha = 0.25;
  c.drawImage(height.c, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = "source-over";
  c.strokeStyle = "rgba(20,22,24,0.9)";
  c.lineWidth = 3;
  c.strokeRect(0, 0, S, S);

  // Roughness: polished tips, duller plate between them.
  const rough = canvas(S);
  rough.ctx.fillStyle = "#b8b8b8";
  rough.ctx.fillRect(0, 0, S, S);
  rough.ctx.globalCompositeOperation = "difference";
  rough.ctx.globalAlpha = 0.5;
  rough.ctx.drawImage(height.c, 0, 0);

  return {
    map: repeatTexture(colour.c, repeat, true),
    normalMap: repeatTexture(normal, repeat),
    roughnessMap: repeatTexture(rough.c, repeat),
  };
}

/** Bulkhead paint: a cream base with soft grime, drip streaks below welds, and darker paint near the deck. */
export function paintedSteel(base: string, repeat: [number, number], seed = 3) {
  const W = 512;
  const { c, ctx } = canvas(W);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, W);
  const r = rng(seed);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(60,50,38,${r() * 0.05})`;
    ctx.beginPath();
    ctx.arc(r() * W, r() * W, 10 + r() * 70, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 70; i++) {
    const x = r() * W;
    const y = r() * W * 0.7;
    const g = ctx.createLinearGradient(0, y, 0, y + 60 + r() * 160);
    g.addColorStop(0, `rgba(70,55,40,${0.08 + r() * 0.1})`);
    g.addColorStop(1, "rgba(70,55,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, 1 + r() * 2.5, 220);
  }
  const foot = ctx.createLinearGradient(0, W * 0.8, 0, W);
  foot.addColorStop(0, "rgba(40,36,30,0)");
  foot.addColorStop(1, "rgba(40,36,30,0.22)");
  ctx.fillStyle = foot;
  ctx.fillRect(0, 0, W, W);
  return repeatTexture(c, repeat, true);
}

/** An engraved name plate, like the ones riveted to plinths and starter panels. */
export function namePlate(lines: string[], opts: { bg?: string; fg?: string; width?: number } = {}) {
  const W = opts.width ?? 512;
  const H = Math.round(W * 0.28);
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = opts.bg ?? "#e9e5d6";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  for (const [x, y] of [[22, 22], [W - 22, 22], [22, H - 22], [W - 22, H - 22]]) {
    ctx.fillStyle = "#8a8a80";
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = opts.fg ?? "#16181a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // As large as the plate allows, shrunk until the longest line fits inside the border.
  let size = Math.round(H / (lines.length + 1.4));
  const font = (s: number) => `600 ${s}px "Helvetica Neue", Arial, sans-serif`;
  ctx.font = font(size);
  while (size > 8 && Math.max(...lines.map((l) => ctx.measureText(l).width)) > W - 64) ctx.font = font(--size);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * size * 1.15));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A pressure gauge face in bar, with its needle drawn at `value`. */
export function gaugeFace(value: number, max = 6) {
  const S = 256;
  const { c, ctx } = canvas(S);
  ctx.fillStyle = "#f2f0ea";
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 8;
  ctx.stroke();
  const a0 = Math.PI * 0.75;
  const a1 = Math.PI * 2.25;
  ctx.lineWidth = 3;
  for (let i = 0; i <= max * 5; i++) {
    const a = a0 + ((a1 - a0) * i) / (max * 5);
    const r1 = S * (i % 5 === 0 ? 0.33 : 0.37);
    ctx.beginPath();
    ctx.moveTo(S / 2 + Math.cos(a) * r1, S / 2 + Math.sin(a) * r1);
    ctx.lineTo(S / 2 + Math.cos(a) * S * 0.41, S / 2 + Math.sin(a) * S * 0.41);
    ctx.stroke();
  }
  // Green working band.
  ctx.strokeStyle = "#2f8a4a";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.44, a0 + (a1 - a0) * 0.25, a0 + (a1 - a0) * 0.55);
  ctx.stroke();
  ctx.fillStyle = "#222";
  ctx.font = `600 ${S * 0.09}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText("bar", S / 2, S * 0.7);
  const a = a0 + ((a1 - a0) * value) / max;
  ctx.strokeStyle = "#b3261e";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(S / 2, S / 2);
  ctx.lineTo(S / 2 + Math.cos(a) * S * 0.36, S / 2 + Math.sin(a) * S * 0.36);
  ctx.stroke();
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 10, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A soft round dot for dust in the light. */
export function dustSprite() {
  const S = 64;
  const { c, ctx } = canvas(S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
