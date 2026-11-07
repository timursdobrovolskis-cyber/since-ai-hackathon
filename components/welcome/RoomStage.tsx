"use client";

// The opening: a seawater pump room on a ferry, drawn as hidden-line work (lineRender.ts). Over the room phase the
// camera walks in from the corner of the room to Pump 8. Then everything but Pump 8 fades away, leaving Pump 8 drawn
// exactly as the moving pump above draws it, in the same pose, so the two canvases cross-fade with no jump.
//
//   room 0.00-0.80  walk in, with labels on the pumps, the strainer and the header from 0.04 to 0.6
//   room 0.55-0.85  the room dims away around Pump 8
//   room 0.86-0.97  this canvas fades out (CSS, --r), and the moving pump fades in above it
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FOV, halfSize, heroCamera } from "./heroPose";
import { createLineRenderer, parsePumpMesh } from "./lineRender";
import { buildRealRoom, type Anchor } from "./realRoom";
import type { Phases } from "./useScrollPhases";

const MESH_URL = "/models/pump-mesh.bin";
const NEAR = 0.05;
const FAR = 40;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The walk, in the pump's units: from the forward corner of the room, past the strainers, to Pump 8. */
const WALK = [
  { at: new THREE.Vector3(6.0, 2.45, 5.3), look: new THREE.Vector3(-0.8, 0.35, -2.4) },
  { at: new THREE.Vector3(4.6, 1.9, 4.1), look: new THREE.Vector3(-0.3, 0.3, -1.6) },
  { at: new THREE.Vector3(3.1, 1.4, 3.0), look: new THREE.Vector3(0.1, 0.1, -0.3) },
];

export function RoomStage({ phases }: { phases: React.RefObject<Phases> }) {
  const holder = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [anchors, setAnchors] = useState<Anchor[]>([]);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    } catch {
      return; // The line-work pump still shows, so the page works without the room.
    }
    // The edge shader works per pixel, so a sharper buffer gives finer lines.
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, NEAR, FAR);
    const lines = createLineRenderer(renderer, { clearBackground: false, near: NEAR, far: FAR });
    // Far lines fade towards the ink, so the room has depth.
    lines.uniforms.fade.value.set(4.5, 17);

    let room: ReturnType<typeof buildRealRoom> | null = null;
    let pumpGeometry: THREE.BufferGeometry | null = null;
    const controller = new AbortController();
    const get = (url: string) =>
      fetch(url, { signal: controller.signal }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      });
    get(MESH_URL)
      .then((mesh) => {
        pumpGeometry = parsePumpMesh(mesh);
        room = buildRealRoom(pumpGeometry);
        scene.add(room.group);
        setAnchors(room.anchors);
      })
      .catch(() => {});

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // The walk's last point is the line-work pump's first view, worked out for this screen's shape.
    let curve = new THREE.CatmullRomCurve3();
    let turns: THREE.Quaternion[] = [];
    let width = 1;
    let height = 1;
    const resize = () => {
      width = el.clientWidth;
      height = el.clientHeight;
      renderer.setSize(width, height, false);
      lines.setSize(width, height, pixelRatio);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      const { halfW, halfH } = halfSize(camera.aspect);
      const hero = heroCamera(halfW, halfH);
      curve = new THREE.CatmullRomCurve3([...WALK.map((w) => w.at), hero.position], false, "centripetal");
      // A camera, because cameras look down -z when turned with lookAt, while other objects face +z.
      const look = new THREE.PerspectiveCamera();
      turns = WALK.map((w) => {
        look.position.copy(w.at);
        look.lookAt(w.look);
        return look.quaternion.clone();
      });
      turns.push(hero.quaternion.clone());
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let onScreen = true;
    const io = new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting));
    io.observe(el);

    const projected = new THREE.Vector3();
    const start = performance.now();
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const r = phases.current.room;
      if (!onScreen || document.hidden || r >= 0.985) return;
      const t = (performance.now() - start) / 1000;

      // Walk: position along the spline, and the view turned towards each stop in turn.
      const u = ease(0, 0.8, r);
      camera.position.copy(curve.getPoint(u));
      const seg = Math.min(turns.length - 2, Math.floor(u * (turns.length - 1)));
      const k = u * (turns.length - 1) - seg;
      camera.quaternion.slerpQuaternions(turns[seg], turns[seg + 1], k * k * (3 - 2 * k));
      // A slight handheld drift, gone by the hand-off so the line work lines up.
      if (!reduced) {
        const drift = 1 - u;
        camera.position.x += Math.sin(t * 0.55) * 0.012 * drift;
        camera.position.y += Math.sin(t * 0.8 + 1) * 0.008 * drift;
      }
      camera.updateMatrixWorld();

      // Hand-off: everything but Pump 8 dims away.
      lines.uniforms.strength.value = lerp(1, 0, ease(0.55, 0.85, r));
      if (room) {

        const show = ease(0.04, 0.16, r) * (1 - ease(0.5, 0.62, r));
        for (const a of room.anchors) {
          const node = labelRefs.current[a.key];
          if (!node) continue;
          projected.copy(a.at).project(camera);
          const visible = projected.z < 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05;
          node.style.opacity = visible ? String(show) : "0";
          const x = ((projected.x + 1) / 2) * width;
          // A tag that would run off the right edge flips to the left of its point, and stays inside the screen.
          const tag = node.lastElementChild as HTMLElement | null;
          if (tag) {
            const w = tag.offsetWidth;
            const flip = x + 40 + w > width - 12 && x - 40 - w >= 12;
            node.dataset.flip = String(flip);
            const left = flip ? -40 - w : Math.min(40, width - 12 - w - x);
            tag.style.left = `${left}px`;
          }
          node.style.transform = `translate(${x}px, ${((1 - projected.y) / 2) * height}px)`;
        }
      }

      lines.render(scene, camera);
    };
    tick();

    return () => {
      controller.abort();
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      room?.dispose();
      pumpGeometry?.dispose();
      lines.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [phases]);

  return (
    <div ref={holder} className="welcome-room absolute inset-0 [&>canvas]:block [&>canvas]:size-full">
      {anchors.map((a) => (
        <div
          key={a.key}
          ref={(node) => {
            labelRefs.current[a.key] = node;
          }}
          aria-hidden
          className="group pointer-events-none absolute top-0 left-0 opacity-0"
        >
          {/* The tag sits on its own ink plate with a hairline edge, so the drawing's lines never run through the words. */}
          <span className="absolute -top-1 -left-1 size-2 bg-mz-accent" />
          <span className="absolute top-0 left-0 h-px w-10 bg-white/70 group-data-[flip=true]:-left-10" />
          <span className="absolute top-0 left-10 flex -translate-y-1/2 items-baseline gap-2 whitespace-nowrap bg-mz-ink/95 px-2.5 py-1.5 text-[13px] leading-none text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.28)]">
            <span className="font-medium">{a.label}</span>
            <span className="hidden text-white/60 sm:inline">{a.detail}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
