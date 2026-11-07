// A centrifugal pump built from simple shapes and drawn as line work only.
// Each part is its own group, so it can be pulled apart along the shaft for the hero.
// Units are loose: the shaft runs along X, and 1 unit is roughly the motor's radius.
import * as THREE from "three";

export type PumpPart = { group: THREE.Group; explode: THREE.Vector3 };
export type Pump = { root: THREE.Group; parts: PumpPart[]; dispose: () => void };

type Colors = { line: string; accent: string };

const SEG = 48;
const EDGE_ANGLE = 15; // degrees: hides the seams between a cylinder's side faces, keeps real edges

function lines(geometry: THREE.BufferGeometry, material: THREE.LineBasicMaterial) {
  const edges = new THREE.EdgesGeometry(geometry, EDGE_ANGLE);
  geometry.dispose();
  return new THREE.LineSegments(edges, material);
}

/** Cylinder with its axis along X. */
function cylX(r: number, len: number, x: number, y = 0, z = 0) {
  const g = new THREE.CylinderGeometry(r, r, len, SEG, 1);
  g.rotateZ(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

/** Cylinder with its axis along Y. */
function cylY(r: number, len: number, x: number, y: number, z: number) {
  const g = new THREE.CylinderGeometry(r, r, len, SEG, 1);
  g.translate(x, y, z);
  return g;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

/** Circle outline facing along X. */
function ringX(r: number, x: number) {
  const g = new THREE.CircleGeometry(r, SEG);
  g.rotateY(Math.PI / 2);
  g.translate(x, 0, 0);
  return g;
}

/**
 * Shapes drawn in the volute plane (u, v) are extruded along their own Z, then turned so that
 * Z points along the shaft. After rotateY(PI/2), a point (u, v, w) lands at world (w, v, -u).
 */
function toShaftPlane(g: THREE.BufferGeometry, depth: number, x: number) {
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);
  g.translate(x, 0, 0);
  return g;
}

function voluteShape() {
  // Spiral casing: radius grows from the cutwater (tongue) round to the discharge throat,
  // then the discharge nozzle runs straight up, tangent to the spiral.
  const r0 = 0.92;
  const r1 = 1.45;
  const top = 1.85;
  const s = new THREE.Shape();
  s.moveTo(r0, 0);
  const steps = 72;
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = r0 + (r1 - r0) * (i / steps);
    s.lineTo(r * Math.cos(t), r * Math.sin(t));
  }
  s.lineTo(r1, top);
  s.lineTo(r0 + 0.06, top);
  s.lineTo(r0 + 0.06, 0.04);
  s.closePath();
  const eye = new THREE.Path();
  eye.absarc(0, 0, 0.42, 0, Math.PI * 2, true);
  s.holes.push(eye);
  return s;
}

function bladeShape(phase: number) {
  // Backward-curved vane from the hub to the impeller's rim.
  const rIn = 0.22;
  const rOut = 0.74;
  const sweep = 1.15;
  const thick = 0.07;
  const n = 14;
  const s = new THREE.Shape();
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const r = rIn + (rOut - rIn) * k;
    const a = phase + sweep * k;
    if (i === 0) s.moveTo(r * Math.cos(a), r * Math.sin(a));
    else s.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  for (let i = n; i >= 0; i--) {
    const k = i / n;
    const r = rIn + (rOut - rIn) * k;
    const a = phase + sweep * k + thick;
    s.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  s.closePath();
  return s;
}

export function buildPump({ line, accent }: Colors): Pump {
  const mats: THREE.LineBasicMaterial[] = [];
  const mat = (color: string, opacity: number) => {
    const m = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
    mats.push(m);
    return m;
  };
  const strong = mat(line, 1);
  const soft = mat(line, 0.55);
  const faint = mat(line, 0.32);
  const heart = mat(accent, 1);

  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  const parts: PumpPart[] = [];
  const part = (explode: [number, number, number], ...objects: THREE.Object3D[]) => {
    const group = new THREE.Group();
    group.add(...objects);
    inner.add(group);
    parts.push({ group, explode: new THREE.Vector3(...explode) });
    return group;
  };

  // Motor, with cooling fins, fan cowl, terminal box and feet.
  const motorX = -2.0;
  const motor = [
    lines(cylX(0.85, 2.4, motorX), strong),
    lines(cylX(0.78, 0.55, -3.47), soft),
    lines(ringX(0.55, -3.75), faint),
    lines(ringX(0.3, -3.75), faint),
    lines(box(0.7, 0.42, 0.62, -1.75, 1.02, 0), soft),
    lines(box(0.5, 0.55, 1.5, -2.85, -1.15, 0), faint),
    lines(box(0.5, 0.55, 1.5, -1.15, -1.15, 0), faint),
  ];
  for (let i = 0; i < 9; i++) motor.push(lines(cylX(0.92, 0.035, -3.0 + i * 0.25), faint));
  part([-1.7, 0.15, 0], ...motor);

  // Coupling: two half hubs facing each other.
  part([-0.95, 0, 0], lines(cylX(0.34, 0.2, -0.62), soft));
  part([-0.45, 0, 0], lines(cylX(0.34, 0.2, -0.36), soft));

  // Bearing housing with its end rings and foot.
  part(
    [0, 0, 0],
    lines(cylX(0.42, 1.1, 0.35), strong),
    lines(cylX(0.5, 0.08, -0.2), soft),
    lines(cylX(0.5, 0.08, 0.9), soft),
    lines(box(0.9, 0.95, 1.2, 0.35, -0.95, 0), faint),
  );

  // Shaft, running from the motor through the bearings into the impeller.
  part([0.35, 0, 0], lines(cylX(0.1, 3.0, 0.2), soft));

  // Impeller: hub, back shroud, front shroud ring and six curved vanes. Drawn in the accent colour.
  const impX = 1.48;
  const vanes: THREE.Object3D[] = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.ExtrudeGeometry(bladeShape((i / 6) * Math.PI * 2), { depth: 0.26, bevelEnabled: false });
    vanes.push(lines(toShaftPlane(g, 0.26, impX), heart));
  }
  part(
    [1.45, 0, 0],
    lines(cylX(0.2, 0.42, impX), heart),
    lines(cylX(0.78, 0.04, impX - 0.15), heart),
    lines(ringX(0.78, impX + 0.14), heart),
    lines(ringX(0.36, impX + 0.14), heart),
    ...vanes,
  );

  // Volute casing with its suction nozzle, flanges, bolt circle and foot.
  const casX = 1.62;
  const depth = 0.72;
  const volute = new THREE.ExtrudeGeometry(voluteShape(), { depth, bevelEnabled: false, curveSegments: 48 });
  const casing: THREE.Object3D[] = [
    lines(toShaftPlane(volute, depth, casX), strong),
    lines(cylX(0.42, 0.9, casX + 0.81), strong),
    lines(cylX(0.68, 0.09, casX + 1.3), strong),
    lines(cylY(0.42, 0.09, casX, 1.9, -1.2), strong),
    lines(box(0.7, 0.2, 1.3, casX, -1.4, 0), faint),
  ];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    casing.push(lines(cylX(0.045, 0.1, casX + 1.3, 0.56 * Math.cos(a), 0.56 * Math.sin(a)), soft));
  }
  part([2.6, 0.1, 0], ...casing);

  // Base frame.
  part([0, -0.75, 0], lines(box(7.0, 0.16, 1.9, -0.6, -1.58, 0), faint));

  // Centre the assembled pump on the origin, so it turns about its middle.
  inner.position.set(0.55, 0.05, 0);

  const dispose = () => {
    root.traverse((o) => {
      if (o instanceof THREE.LineSegments) o.geometry.dispose();
    });
    mats.forEach((m) => m.dispose());
  };

  return { root, parts, dispose };
}

/** Length of the assembled pump along the shaft, used to fit it to the screen. */
export const PUMP_LENGTH = 7.0;
/** Length when pulled apart: the motor moves 1.7 one way and the casing 2.6 the other. */
export const PUMP_LENGTH_APART = PUMP_LENGTH + 1.7 + 2.6;
