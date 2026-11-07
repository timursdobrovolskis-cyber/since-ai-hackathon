"use client";

// The opening: a seawater pump room on a ferry, drawn as line work. Over the room phase the camera walks in from the
// corner of the room to Pump 8. Then the room dims and Pump 8 turns into its see-through line work, in exactly the pose
// where the line-work canvas above takes over.
//
// How the lines are drawn: the room is rendered once into a buffer, storing each pixel's surface direction, the line
// weight of its part (equipment bright, structure faint) and its depth. An edge shader then draws a white line wherever
// the depth jumps (outlines) or the surface folds (creases). Lines hidden behind other parts never appear, and lines
// fade with distance. Pump 8's see-through line work is drawn on top for the hand-off.
//
//   room 0.00-0.80  walk in, with labels on the pumps, the strainer and the header from 0.04 to 0.6
//   room 0.60-0.86  x-ray: the room dims and Pump 8's see-through line work appears
//   room 0.86-0.97  this canvas fades out (CSS, --r), and the line-work pump fades in above it
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FOV, halfSize, heroCamera } from "./heroPose";
import { buildRealRoom, type Anchor } from "./realRoom";
import type { Phases } from "./useScrollPhases";

const MESH_URL = "/models/pump-mesh.bin";
const EDGES_URL = "/models/pump-edges.bin";
// The page's ink, #0b1014, as display values. The edge shader writes straight to the screen with no colour conversion,
// so it takes the colour as is, and it matches the page background behind the canvas exactly.
const INK = new THREE.Vector3(11 / 255, 16 / 255, 20 / 255);
const INK_CLEAR = new THREE.Color().setRGB(INK.x, INK.y, INK.z, THREE.SRGBColorSpace);
const NEAR = 0.05;
const FAR = 40;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Reads "PMSH" from tools/build_pump_edges.mjs and gives the mesh creased normals, so its folds draw as lines. */
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

/** Turns surface directions, weights and depth into white lines on ink. */
const edgeShader = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      tNormal: { value: null },
      tDepth: { value: null },
      texel: { value: new THREE.Vector2() },
      cameraNear: { value: NEAR },
      cameraFar: { value: FAR },
      ink: { value: INK.clone() },
      strength: { value: 1 },
      fade: { value: new THREE.Vector2(4.5, 17) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      #include <packing>
      uniform sampler2D tNormal;
      uniform sampler2D tDepth;
      uniform vec2 texel;
      uniform float cameraNear;
      uniform float cameraFar;
      uniform vec3 ink;
      uniform float strength;
      uniform vec2 fade;
      varying vec2 vUv;

      float viewDepth(vec2 uv) {
        float z = texture2D(tDepth, uv).x;
        return -perspectiveDepthToViewZ(z, cameraNear, cameraFar);
      }

      void main() {
        vec4 c = texture2D(tNormal, vUv);
        float d = viewDepth(vUv);
        vec3 n = c.xyz * 2.0 - 1.0;
        float depthEdge = 0.0;
        float foldEdge = 0.0;
        float weight = c.a;
        vec2 offs[4];
        offs[0] = vec2(texel.x, 0.0);
        offs[1] = vec2(-texel.x, 0.0);
        offs[2] = vec2(0.0, texel.y);
        offs[3] = vec2(0.0, -texel.y);
        for (int i = 0; i < 4; i++) {
          vec2 uv = vUv + offs[i];
          vec4 ci = texture2D(tNormal, uv);
          float di = viewDepth(uv);
          // Outlines: a jump in depth, relative to how far away the surface is.
          depthEdge = max(depthEdge, smoothstep(0.012, 0.035, abs(di - d) / min(d, di)));
          // Folds: neighbours facing different ways on the same surface.
          if (ci.a > 0.0 && c.a > 0.0) foldEdge = max(foldEdge, smoothstep(0.18, 0.45, 1.0 - dot(n, ci.xyz * 2.0 - 1.0)));
          // The nearer part of an outline decides how bright it draws.
          weight = (di < d || c.a == 0.0) ? max(weight, ci.a) : weight;
        }
        float edge = max(depthEdge, foldEdge) * weight;
        // Far lines fade towards the ink, so the room has depth.
        float near = 1.0 - smoothstep(fade.x, fade.y, min(d, cameraFar));
        float line = edge * mix(0.3, 1.0, near) * strength;
        gl_FragColor = vec4(mix(ink, vec3(1.0), clamp(line, 0.0, 1.0)), 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });

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
    renderer.autoClear = false;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, NEAR, FAR);

    // Buffer for the first pass: surface direction and line weight in colour, depth alongside.
    const buffer = new THREE.WebGLRenderTarget(1, 1, {
      depthTexture: new THREE.DepthTexture(1, 1),
      magFilter: THREE.NearestFilter,
      minFilter: THREE.NearestFilter,
    });
    const edges = edgeShader();
    edges.uniforms.tNormal.value = buffer.texture;
    edges.uniforms.tDepth.value = buffer.depthTexture;
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), edges);
    quad.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(quad);
    const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

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
      buffer.setSize(Math.round(width * pixelRatio), Math.round(height * pixelRatio));
      edges.uniforms.texel.value.set(1 / (width * pixelRatio), 1 / (height * pixelRatio));
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

      // X-ray: the room dims, and Pump 8 swaps its outline for its see-through line work.
      edges.uniforms.strength.value = lerp(1, 0.22, ease(0.6, 0.86, r));
      if (room) {
        room.target.visible = r < 0.74;
        room.edgeMaterial.opacity = 0.88 * ease(0.6, 0.8, r);

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

      // Pass 1: surface directions, weights and depth. Pass 2: edges to the screen. Pass 3: Pump 8's line work.
      camera.layers.set(0);
      renderer.setRenderTarget(buffer);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.setClearColor(INK_CLEAR, 1);
      renderer.clear();
      renderer.render(quadScene, quadCamera);
      camera.layers.set(1);
      renderer.render(scene, camera);
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
      buffer.depthTexture?.dispose();
      buffer.dispose();
      edges.dispose();
      quad.geometry.dispose();
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
          className="pointer-events-none absolute top-0 left-0 opacity-0"
        >
          <span className="absolute -top-1 -left-1 size-2 bg-mz-accent" />
          <span className="absolute top-0 left-0 h-px w-10 bg-white/70" />
          <span className="absolute -top-5 left-11 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.14em] text-white">
            {a.label}
            <span className="ml-2 text-white/55">{a.detail}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
