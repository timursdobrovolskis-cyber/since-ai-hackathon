"use client";

// Draws the line-work pump and moves it with the scroll position of `track`.
// Progress p runs from 0 (top of the section) to 1 (section fully scrolled). It is also written to
// the CSS variable --p on `track`, so text can fade with plain CSS and React never re-renders.
//
//   0.00-0.50  the pulled-apart pump comes together, zooms in and turns
//   0.55-0.90  the assembled pump glides into the right column, and the left column appears
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildPump, PUMP_LENGTH, PUMP_LENGTH_APART } from "./pumpModel";

const FOV = 30;
const CAMERA_Z = 16;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** 0 before a, 1 after b, smooth in between. */
const ease = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function PumpStage({ track }: { track: React.RefObject<HTMLElement | null> }) {
  const holder = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const css = getComputedStyle(document.documentElement);
    const pump = buildPump({
      line: css.getPropertyValue("--bt-navy").trim() || "#003266",
      accent: css.getPropertyValue("--bt-blue").trim() || "#2e60ff",
    });
    const scene = new THREE.Scene();
    scene.add(pump.root);
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    camera.position.set(0, 0, CAMERA_Z);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Half the visible width and height at the pump's depth, in world units.
    let halfH = 1;
    let halfW = 1;
    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      halfH = CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      halfW = halfH * camera.aspect;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let onScreen = true;
    const io = new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting));
    io.observe(el);

    const start = performance.now();
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const section = track.current;
      if (!section || !onScreen || document.hidden) return;

      const rect = section.getBoundingClientRect();
      const travel = Math.max(rect.height - window.innerHeight, 1);
      const p = clamp01(-rect.top / travel);
      section.style.setProperty("--p", p.toFixed(4));

      const t = (performance.now() - start) / 1000;
      const zoom = ease(0, 0.5, p);
      const assemble = ease(0.08, 0.5, p);
      const glide = ease(0.55, 0.9, p);

      // Size: fit the pump to the screen, so it reads the same on a laptop and a wide monitor.
      // The hero pump is pulled apart, so it is fitted by its pulled-apart length instead.
      const fitWidth = (share: number, length = PUMP_LENGTH) => (share * 2 * halfW) / length;
      const heroScale = Math.min(fitWidth(0.5, PUMP_LENGTH_APART), (halfH * 1.1) / 3.6);
      const zoomScale = Math.min(fitWidth(0.85), (halfH * 1.5) / 3.6);
      const endScale = Math.min(fitWidth(0.4), (halfH * 1.2) / 3.6);
      const scale = lerp(lerp(heroScale, zoomScale, zoom), endScale, glide);
      pump.root.scale.setScalar(scale);

      // Place: right of the hero text, then centre, then the middle of the right column.
      const x = lerp(lerp(halfW * 0.35, 0, zoom), halfW * 0.5, glide);
      const y = lerp(lerp(-halfH * 0.05, 0, zoom), -halfH * 0.04, glide);
      pump.root.position.set(x, y, 0);

      // Turn: the scroll turns the pump half way round. A slow sway keeps the hero alive.
      const sway = reduced ? 0 : Math.sin(t * 0.35) * 0.22 * (1 - ease(0, 0.12, p));
      const turn = reduced ? 0 : Math.PI * ease(0, 0.6, p);
      pump.root.rotation.y = -0.62 + turn + sway;
      pump.root.rotation.x = lerp(lerp(0.38, 0.18, zoom), 0.32, glide);

      // Pull apart in the hero, then come together.
      const apart = 1 - assemble;
      for (const part of pump.parts) part.group.position.copy(part.explode).multiplyScalar(apart);

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      pump.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [track]);

  return (
    <div ref={holder} className="absolute inset-0 [&>canvas]:block [&>canvas]:size-full">
      {failed && (
        <p className="absolute bottom-6 right-6 max-w-xs text-sm text-bt-navy/70">
          This browser cannot draw the 3D pump. Everything else on the page still works.
        </p>
      )}
    </div>
  );
}
