"use client";

// Draws Pump 8 as hidden-line work (lineRender.ts), the same way the engine room draws it, and moves it with the pump
// phase from useScrollPhases (0 to 1). The canvas is transparent, so the page's ink, and later its white, show behind
// the lines.
//
//   room 0.86-0.97  fades in as the engine room (RoomStage) fades out, in the same pose
//   pump 0.00-0.50  the pump zooms in and turns
//   pump 0.55-0.90  it glides into the right column while the page fades from ink to white, and the left column appears
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CAMERA_Z, FOV, fitPump, halfSize, heroStart } from "./heroPose";
import { createLineRenderer, parsePumpMesh, weighted } from "./lineRender";
import type { Phases } from "./useScrollPhases";

const MODEL_URL = "/models/pump-mesh.bin";
const NEAR = 0.1;
const FAR = 100;
/** Line colour on ink, and on white once the page has faded, as display values. */
const LINE_ON_INK = new THREE.Vector3(1, 1, 1);
const LINE_ON_WHITE = new THREE.Vector3(11 / 255, 16 / 255, 20 / 255);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** 0 before a, 1 after b, smooth in between. */
const ease = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Props = {
  phases: React.RefObject<Phases>;
  /** True while a pump card is open: the pump eases to about half size above the card. */
  selected?: boolean;
  /** The area of the pump the open card is about, along the shaft in model units. It glows in the accent blue. */
  highlight?: [number, number] | null;
  /** Phones: the pump ends centred at the top, above the site map, instead of in the right column. */
  compact?: boolean;
};

export function PumpStage({ phases, selected = false, highlight = null, compact = false }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const live = useRef({ selected, highlight, compact });
  useEffect(() => {
    live.current = { selected, highlight, compact };
  }, [selected, highlight, compact]);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, premultipliedAlpha: true });
    } catch {
      setProblem("This browser cannot draw the 3D pump. Everything else on the page still works.");
      return;
    }
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.localClippingEnabled = true;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, NEAR, FAR);
    camera.position.set(0, 0, CAMERA_Z);
    const pump = new THREE.Group();
    scene.add(pump);
    // Weight 1, as Pump 8 has in the engine room, so it draws exactly as it did there.
    const material = weighted(1);
    const lines = createLineRenderer(renderer, { clearBackground: true, near: NEAR, far: FAR });
    let geometry: THREE.BufferGeometry | null = null;

    // The highlighted area: the same pump in translucent blue on layer 1, cut to a slice of the shaft by two clipping
    // planes that follow the pump as it moves. Drawn after the line work, so the lines show through it.
    const sliceStart = new THREE.Plane();
    const sliceEnd = new THREE.Plane();
    const glow = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#2c63ff"),
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      side: THREE.FrontSide,
      clippingPlanes: [sliceStart, sliceEnd],
    });
    let glowMesh: THREE.Mesh | null = null;
    let glowLevel = 0;

    const controller = new AbortController();
    fetch(MODEL_URL, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => {
        geometry = parsePumpMesh(buf);
        pump.add(new THREE.Mesh(geometry, material));
        glowMesh = new THREE.Mesh(geometry, glow);
        glowMesh.layers.set(1);
        pump.add(glowMesh);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setProblem("The pump drawing did not load. Everything else on the page still works.");
      });

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Half the visible width and height at the pump's depth, in world units.
    let halfH = 1;
    let halfW = 1;
    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      lines.setSize(w, h, pixelRatio);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      ({ halfH, halfW } = halfSize(camera.aspect));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let onScreen = true;
    const io = new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting));
    io.observe(el);

    const start = performance.now();
    let last = start;
    let shrink = 0;
    let cleared = false;
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!onScreen || document.hidden) return;
      const { room: rp, pump: p } = phases.current;
      // Nothing to draw until the engine room hands over. Clear once, in case the reader scrolled back up.
      if (rp < 0.86) {
        if (!cleared) {
          renderer.setRenderTarget(null);
          renderer.setClearColor(0x000000, 0);
          renderer.clear();
          cleared = true;
        }
        return;
      }
      cleared = false;

      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // Ease towards the selected size, about 0.3 s to settle. Reduced motion jumps straight there.
      const { selected: isSelected, highlight: area, compact: small } = live.current;
      const target = isSelected ? 1 : 0;
      shrink = reduced ? target : shrink + (target - shrink) * (1 - Math.exp(-dt * 9));
      const zoom = ease(0, 0.5, p);
      const glide = ease(0.55, 0.9, p);
      // --g in globals.css fades the background over p 0.6 to 0.72. The lines flip at its middle, so they never
      // sit grey on grey for long.
      const g = clamp01((p - 0.6) / 0.12);
      lines.uniforms.lineColor.value.lerpVectors(LINE_ON_INK, LINE_ON_WHITE, ease(0.45, 0.55, g));
      // Fades in at the same rate as the engine room canvas fades out (.welcome-room in globals.css).
      lines.uniforms.opacity.value = clamp01((rp - 0.86) * 9);

      // Size: the hand-off pose first (heroPose.ts), then the zoom, then the right column.
      const hero = heroStart(halfW, halfH);
      const fit = (share: number, heightShare: number) => fitPump(halfW, halfH, share, heightShare);
      // Phones end centred near the top, above the site map. Wide screens end in the middle of the right column.
      const endScale = small ? fit(0.86, 0.34) : fit(0.47, 0.64);
      const endX = small ? 0 : halfW * 0.48;
      const endY = small ? halfH * 0.56 : -halfH * 0.04;
      const pumpScale = lerp(lerp(hero.scale, fit(1.55, 1.45), zoom), endScale, glide);
      pump.scale.setScalar(pumpScale * lerp(1, small ? 0.8 : 0.46, shrink));
      pump.position.set(lerp(0, endX, glide), lerp(hero.y, endY, glide) + (small ? 0 : halfH * 0.66 * shrink), 0);
      // Turn: a little over a quarter of the way round, at the same pace per scroll as before, the other way round so
      // it ends at a three-quarter view of the far side rather than end-on.
      const turn = reduced ? 0 : -0.55 * Math.PI * ease(0, 0.6, p);
      pump.rotation.set(lerp(lerp(hero.rotation.x, 0.18, zoom), 0.32, glide), hero.rotation.y + turn, 0);

      lines.render(scene, camera);

      // The highlighted area fades in with the card and pulses gently while it is open.
      glowLevel += ((area && isSelected ? 1 : 0) - glowLevel) * (1 - Math.exp(-dt * 6));
      if (glowMesh && area && glowLevel > 0.01) {
        pump.updateMatrixWorld();
        sliceStart.set(new THREE.Vector3(1, 0, 0), -area[0]).applyMatrix4(pump.matrixWorld);
        sliceEnd.set(new THREE.Vector3(-1, 0, 0), area[1]).applyMatrix4(pump.matrixWorld);
        const pulse = reduced ? 1 : 0.85 + 0.15 * Math.sin(now / 420);
        glow.opacity = 0.42 * glowLevel * pulse;
        camera.layers.set(1);
        renderer.render(scene, camera);
        camera.layers.set(0);
      }
    };
    tick();

    return () => {
      controller.abort();
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      geometry?.dispose();
      material.dispose();
      glow.dispose();
      lines.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [phases]);

  return (
    <div ref={holder} className="absolute inset-0 [&>canvas]:block [&>canvas]:size-full">
      {problem && <p className="absolute bottom-24 left-1/2 max-w-xs -translate-x-1/2 text-center text-sm text-white/75">{problem}</p>}
    </div>
  );
}
