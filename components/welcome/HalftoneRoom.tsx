"use client";

// The halftone opening: a real ferry pump room photo drawn as white dots on ink, like meuze.ai's photos. Each dot's
// size follows the photo's brightness. Over the room phase the view zooms towards the pumps and the dots fade out, while
// PumpStage fades the line-work pump in over them.
//
// Photo: "Engine room, ferry Bastø IV 08" by Ulflarsen, Wikimedia Commons, CC BY-SA 4.0. The dotted version is shared
// under the same licence. The credit is shown on the page.
import { useEffect, useRef } from "react";
import type { Phases } from "./useScrollPhases";

const SRC = "/images/engine-room-basto-iv.jpg";
/** Dot spacing in CSS pixels. */
const CELL = 6;
/** Where to zoom in the photo, as a share of its width and height: the pumps along the pipework. */
const FOCUS = { x: 0.42, y: 0.6 };
const ZOOM = 0.45;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function HalftoneRoom({ phases }: { phases: React.RefObject<Phases> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const sample = document.createElement("canvas");
    const sctx = sample.getContext("2d", { willReadFrequently: true });
    if (!sctx) return;

    const img = new Image();
    img.src = SRC;
    let ready = false;
    img.onload = () => {
      ready = true;
      drawn = -1;
    };

    let width = 0;
    let height = 0;
    let drawn = -1;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawn = -1;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (room: number) => {
      const cols = Math.ceil(width / CELL);
      const rows = Math.ceil(height / CELL);
      sample.width = cols;
      sample.height = rows;
      // Cover the screen with the photo, zoomed towards the focus point.
      const zoom = 1 + ZOOM * ease(0, 1, room);
      const cover = Math.max(cols / img.width, rows / img.height) * zoom;
      const w = img.width * cover;
      const h = img.height * cover;
      const fx = FOCUS.x * w;
      const fy = FOCUS.y * h;
      const ox = Math.min(0, Math.max(cols - w, cols / 2 - fx));
      const oy = Math.min(0, Math.max(rows - h, rows / 2 - fy));
      sctx.drawImage(img, ox, oy, w, h);
      const px = sctx.getImageData(0, 0, cols, rows).data;

      ctx.clearRect(0, 0, width, height);
      const fade = 1 - ease(0.45, 0.9, room);
      if (fade <= 0) return;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.82 * fade})`;
      ctx.beginPath();
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          // Brightness, with the levels pulled apart so pumps and pipes stand out from the walls.
          const lum = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
          const level = clamp01((lum - 0.18) / 0.62);
          // Fewer dots near the top and bottom edges, so the header and the credit stay readable.
          const edge = ease(0, 0.16, y / rows) * ease(0, 0.16, 1 - y / rows);
          const r = (CELL / 2) * Math.pow(level, 1.5) * 0.98 * edge;
          if (r < 0.35) continue;
          const cx = x * CELL + CELL / 2;
          const cy = y * CELL + CELL / 2;
          ctx.moveTo(cx + r, cy);
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    };

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!ready || document.hidden) return;
      const room = phases.current.room;
      // Redraw only when the scroll has moved it, or after a resize.
      const key = Math.round(room * 500);
      if (key === drawn) return;
      drawn = key;
      draw(room);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [phases]);

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 block size-full" />;
}
