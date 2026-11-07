"use client";

// Draws the pump as line work and moves it with the pump phase from useScrollPhases (0 to 1).
// The line work comes from public/models/pump-edges.bin, built by tools/build_pump_edges.mjs.
//
//   room 0-1     the line-work engine room, flying in to the front pump (or, for halftone, the pump fading in)
//   pump 0.00-0.50  the pump zooms in and turns
//   pump 0.55-0.90  it glides into the right column while the page fades from ink to white, and the left column appears
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildEngineRoom, ROOM_CENTRE, ROOM_SIZE } from "./engineRoom";
import type { Phases } from "./useScrollPhases";

export type HeroVariant = "lines" | "halftone";

const FOV = 30;
const CAMERA_Z = 16;
const MODEL_URL = "/models/pump-edges.bin";
/** Longest side of the model after scaling. The build tool scales it to span -1 to 1. */
const MODEL_LENGTH = 2;
/** Line colour on ink, and on white once the page has faded. */
const LINE_ON_INK = new THREE.Color(0xffffff);
const LINE_ON_WHITE = new THREE.Color(0x0b1014);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** 0 before a, 1 after b, smooth in between. */
const ease = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Reads the file layout written by tools/build_pump_edges.mjs. */
function parseEdges(buf: ArrayBuffer) {
  const view = new DataView(buf);
  const tag = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (tag !== "PEDG") throw new Error("Not a pump edge file");
  const count = view.getUint32(4, true);
  const ints = new Int16Array(buf, 8, count * 6);
  const positions = new Float32Array(ints.length);
  for (let i = 0; i < ints.length; i++) positions[i] = ints[i] / 32767;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

/**
 * `variant` picks the opening. "lines" builds a line-work engine room around the pump and flies in to it. "halftone"
 * leaves the room to the photo behind the canvas, and fades the pump in as the photo's dots fade out.
 * `selected` is true while a pump card is open: the pump then eases to about half size at the top of the right column,
 * making room for the card below it.
 */
export function PumpStage({ phases, selected = false, variant = "lines" }: { phases: React.RefObject<Phases>; selected?: boolean; variant?: HeroVariant }) {
  const holder = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setProblem("This browser cannot draw the 3D pump. Everything else on the page still works.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    camera.position.set(0, 0, CAMERA_Z);
    const pump = new THREE.Group();
    scene.add(pump);
    const material = new THREE.LineBasicMaterial({ color: LINE_ON_INK, transparent: true, opacity: 0.88 });
    // The room has its own materials, so it can fade away around the front pump.
    const roomLine = new THREE.LineBasicMaterial({ color: LINE_ON_INK, transparent: true, opacity: 0.7 });
    const roomSoft = new THREE.LineBasicMaterial({ color: LINE_ON_INK, transparent: true, opacity: 0.28 });
    let room: THREE.Group | null = null;

    const controller = new AbortController();
    fetch(MODEL_URL, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => {
        const edges = parseEdges(buf);
        pump.add(new THREE.LineSegments(edges, material));
        if (variant === "lines") {
          room = buildEngineRoom(edges, roomLine, roomSoft).room;
          pump.add(room);
        }
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
    let last = start;
    let shrink = 0;
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!onScreen || document.hidden) return;
      const { room: rp, pump: p } = phases.current;

      const now = performance.now();
      const t = (now - start) / 1000;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // Ease towards the selected size, about 0.3 s to settle. Reduced motion jumps straight there.
      const target = selectedRef.current ? 1 : 0;
      shrink = reduced ? target : shrink + (target - shrink) * (1 - Math.exp(-dt * 9));
      const zoom = ease(0, 0.5, p);
      const glide = ease(0.55, 0.9, p);
      // --g in globals.css fades the background over p 0.6 to 0.72. The lines flip at its middle, so they never
      // sit grey on grey for long.
      const g = clamp01((p - 0.6) / 0.12);
      material.color.lerpColors(LINE_ON_INK, LINE_ON_WHITE, ease(0.45, 0.55, g));

      // Size: fit the pump to a share of the screen width, capped by the height.
      const fit = (share: number, heightShare: number) =>
        Math.min((share * 2 * halfW) / MODEL_LENGTH, (heightShare * 2 * halfH) / MODEL_LENGTH);
      const pumpScale = lerp(lerp(fit(1.25, 1.1), fit(1.55, 1.45), zoom), fit(0.47, 0.64), glide);
      const pumpY = lerp(-halfH * 0.02, -halfH * 0.04, glide) + halfH * 0.66 * shrink;

      // Turn: the scroll turns the pump half way round. A slow sway keeps the pump alive once the room has gone.
      const fly = ease(0, 1, rp);
      const sway = reduced ? 0 : Math.sin(t * 0.35) * 0.22 * (1 - ease(0, 0.12, p)) * ease(0.8, 1, rp);
      const turn = reduced ? 0 : Math.PI * ease(0, 0.6, p);
      const rotY = -0.62 + turn + sway;
      const rotX = lerp(lerp(0.38, 0.18, zoom), 0.32, glide);

      if (variant === "lines" && rp < 1) {
        // Fly in: from the whole room, framed on its centre, to the front pump. The zoom grows geometrically, which
        // reads as a steady camera move, and the framed point slides from the room's centre to the pump's.
        const wide = Math.min((1.7 * halfW) / ROOM_SIZE.width, (1.8 * halfH) / ROOM_SIZE.height);
        const scale = wide * Math.pow(pumpScale / wide, fly);
        pump.rotation.set(lerp(0.52, rotX, fly), lerp(-0.82, rotY, fly), 0);
        const anchor = ROOM_CENTRE.clone().multiplyScalar(1 - fly).applyEuler(pump.rotation).multiplyScalar(-scale);
        pump.scale.setScalar(scale);
        pump.position.set(anchor.x, anchor.y + pumpY * fly, 0);
      } else {
        // Halftone: the pump grows slightly as it fades in over the photo.
        const grow = variant === "halftone" ? lerp(0.82, 1, fly) : 1;
        pump.scale.setScalar(pumpScale * grow * lerp(1, 0.46, shrink));
        pump.position.set(lerp(0, halfW * 0.48, glide), pumpY, 0);
        pump.rotation.set(rotX, rotY, 0);
      }

      // The room fades away in the last part of the fly-in. In the halftone version the pump fades in instead.
      if (room) {
        room.visible = rp < 1;
        const keep = 1 - ease(0.55, 0.95, rp);
        roomLine.opacity = 0.7 * keep;
        roomSoft.opacity = 0.28 * keep;
      }
      material.opacity = variant === "halftone" ? 0.88 * ease(0.5, 0.95, rp) : 0.88;

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      controller.abort();
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      pump.traverse((o) => {
        if (o instanceof THREE.LineSegments) o.geometry.dispose();
      });
      material.dispose();
      roomLine.dispose();
      roomSoft.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [phases, variant]);

  return (
    <div ref={holder} className="absolute inset-0 [&>canvas]:block [&>canvas]:size-full">
      {problem && <p className="absolute bottom-24 left-1/2 max-w-xs -translate-x-1/2 text-center text-sm text-white/75">{problem}</p>}
    </div>
  );
}
