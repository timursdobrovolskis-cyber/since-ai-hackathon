"use client";

// The opening: a realistic seawater pump room on a ferry. Over the room phase the camera walks in from the corner of the
// room to Pump 8, then the room darkens and Pump 8 dissolves into its line work, in exactly the pose where the
// line-work canvas above takes over.
//
//   room 0.00-0.80  walk in, with labels on the pumps, the strainer and the header from 0.04 to 0.6
//   room 0.60-0.86  x-ray: lights dim, Pump 8's paint fades and its line work appears
//   room 0.86-0.97  this canvas fades out (CSS, --r), and the line-work pump fades in above it
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FOV, halfSize, heroCamera } from "./heroPose";
import { buildRealRoom, type Anchor } from "./realRoom";
import type { Phases } from "./useScrollPhases";

const MESH_URL = "/models/pump-mesh.bin";
const EDGES_URL = "/models/pump-edges.bin";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Reads "PMSH" from tools/build_pump_edges.mjs and gives the mesh creased normals, so hard edges stay crisp. */
function parseMesh(buf: ArrayBuffer) {
  const view = new DataView(buf);
  const vertices = view.getUint32(4, true);
  const indexCount = view.getUint32(8, true);
  const ints = new Int16Array(buf, 12, vertices * 3);
  const pos = new Float32Array(ints.length);
  for (let i = 0; i < ints.length; i++) pos[i] = ints[i] / 32767;
  const start = 12 + vertices * 6;
  const index = vertices > 65535 ? new Uint32Array(buf, start, indexCount) : new Uint16Array(buf.slice(start, start + indexCount * 2));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  return toCreasedNormals(g, THREE.MathUtils.degToRad(35));
}

function parseEdges(buf: ArrayBuffer) {
  const count = new DataView(buf).getUint32(4, true);
  const ints = new Int16Array(buf, 8, count * 6);
  const pos = new Float32Array(ints.length);
  for (let i = 0; i < ints.length; i++) pos[i] = ints[i] / 32767;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return g;
}

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
    const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // Lights and objects never move against each other, so the shadow map is drawn once.
    renderer.shadowMap.autoUpdate = false;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0b1014");
    scene.fog = new THREE.Fog("#1a1c1e", 9, 24);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new RoomEnvironment();
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    scene.environmentIntensity = 0.35;

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 60);
    const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
    const composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    const ao = new GTAOPass(scene, camera, 1, 1);
    ao.blendIntensity = 0.85;
    ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.4, thickness: 1.2, scale: 1, samples: 16 });
    composer.addPass(ao);
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.6, 1.0);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    let room: ReturnType<typeof buildRealRoom> | null = null;
    let pumpGeometry: THREE.BufferGeometry | null = null;
    let edgeGeometry: THREE.BufferGeometry | null = null;
    const controller = new AbortController();
    const get = (url: string) =>
      fetch(url, { signal: controller.signal }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      });
    Promise.all([get(MESH_URL), get(EDGES_URL)])
      .then(([mesh, lines]) => {
        pumpGeometry = parseMesh(mesh);
        edgeGeometry = parseEdges(lines);
        room = buildRealRoom(pumpGeometry, edgeGeometry);
        scene.add(room.group);
        renderer.shadowMap.needsUpdate = true;
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
      composer.setSize(width, height);
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

      // X-ray: dim the room, fade Pump 8's paint, and bring up its line work.
      renderer.toneMappingExposure = lerp(1.05, 0.1, ease(0.6, 0.86, r));
      bloom.strength = lerp(0.55, 0.15, ease(0.6, 0.86, r));
      if (room) {
        room.update(t, reduced);
        room.targetMaterial.opacity = 1 - ease(0.66, 0.84, r);
        room.target.castShadow = room.targetMaterial.opacity > 0.99;
        room.edgeMaterial.opacity = 0.9 * ease(0.6, 0.8, r);

        // Labels follow their points on screen.
        const show = ease(0.04, 0.16, r) * (1 - ease(0.5, 0.62, r));
        for (const a of room.anchors) {
          const node = labelRefs.current[a.key];
          if (!node) continue;
          projected.copy(a.at).project(camera);
          const visible = projected.z < 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05;
          node.style.opacity = visible ? String(show) : "0";
          node.style.transform = `translate(${((projected.x + 1) / 2) * width}px, ${((1 - projected.y) / 2) * height}px)`;
        }
      }
      composer.render();
    };
    tick();

    return () => {
      controller.abort();
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      room?.dispose();
      pumpGeometry?.dispose();
      edgeGeometry?.dispose();
      composer.dispose();
      target.dispose();
      pmrem.dispose();
      scene.environment?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [phases]);

  return (
    <div ref={holder} className="welcome-room absolute inset-0 [&>canvas]:block [&>canvas]:size-full">
      {/* Soft shade at the top and bottom, so the header, the section label and the scroll cue stay readable. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-40 bg-gradient-to-b from-black/55 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-32 bg-gradient-to-t from-black/45 to-transparent" />
      {anchors.map((a) => (
        <div
          key={a.key}
          ref={(node) => {
            labelRefs.current[a.key] = node;
          }}
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 opacity-0"
        >
          <span className="absolute -top-1 -left-1 size-2 bg-white" />
          <span className="absolute top-0 left-0 h-px w-10 bg-white/70" />
          <span className="absolute -top-5 left-11 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.14em] text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.85)]">
            {a.label}
            <span className="ml-2 text-white/60">{a.detail}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
