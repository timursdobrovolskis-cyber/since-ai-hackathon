// A seawater cooling pump room on a ferry, for the opening of the landing page, drawn as line work.
// Every surface gets a line weight instead of paint: RoomStage renders the room's surface directions and depth, and an
// edge shader turns outlines and folds into white lines, so lines hidden behind things disappear on their own.
// Equipment draws bright, and the hull, deck and deckhead draw faint.
// Units are the pump model's: it spans x -1 to 1 along the shaft, y -0.42 to 0.42, and z -0.33 to 0.33. The pump the
// camera walks to, Pump 8, stands at the origin unrotated, so its pose matches the line-work pump exactly.
//
// Measured on the model: the discharge flange sits on top of the casing at (0.59, 0.39, 0.15), and the suction
// branch leaves the end of the casing at (1.0, 0.084, 0).
//
// Pipe colours follow ISO 14726: seawater green, fresh water blue, fuel brown. In the data, Pump 7 and Pump 8 are
// seawater cooling pumps No. 1 and No. 2 on Vessel B, so this room holds both, plus a fire and general service pump.
import * as THREE from "three";

const FLOOR = -0.62;
const CEIL = 3.4;
const X0 = -5.5;
const X1 = 6.6;
const Z0 = -6.2;
const Z1 = 5.8;
const HEADER_Y = 2.3;
const DISCHARGE = new THREE.Vector3(0.59, 0.39, 0.15);
const SUCTION = new THREE.Vector3(1.0, 0.084, 0);
const STRAINER_X = 1.62;
const MAIN_X = 2.1;
const MAIN_Y = -0.33;

type PumpSpot = { z: number; plate: string[]; paint: "blue" | "red" };
const PUMPS: PumpSpot[] = [
  { z: 0, plate: ["SW COOLING PUMP No. 2"], paint: "blue" },
  { z: -2.05, plate: ["SW COOLING PUMP No. 1"], paint: "blue" },
  { z: -4.1, plate: ["FIRE & GS PUMP"], paint: "red" },
];

export type Anchor = { key: string; label: string; detail: string; at: THREE.Vector3 };

const Y = new THREE.Vector3(0, 1, 0);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function buildRealRoom(pumpGeometry: THREE.BufferGeometry, pumpEdges: THREE.BufferGeometry) {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);

  /** A surface that draws its outline at `weight`, from 0 (none) to 1 (full white). Stored as the normal pass's alpha. */
  const weighted = (weight: number) =>
    keep(new THREE.MeshNormalMaterial({ opacity: weight, blending: THREE.NoBlending, side: THREE.DoubleSide }));

  // Line weights: equipment bright, structure faint.
  const floorMat = weighted(0.26);
  const wallMat = weighted(0.2);
  const frameMat = weighted(0.34);
  const deckheadMat = weighted(0.3);
  const seawater = weighted(0.9);
  const freshwater = weighted(0.55);
  const fuel = weighted(0.5);
  const cladding = weighted(0.45);
  const steel = weighted(0.78);
  const bolts = weighted(0.7);
  const handwheel = weighted(0.95);
  const yellow = weighted(0.62);
  const plinthMat = weighted(0.6);
  const panelMat = weighted(0.55);
  const cable = weighted(0.32);
  const pumpPaint = { blue: weighted(0.92), red: weighted(0.92) };
  const tube = weighted(0.6);
  const lampGreen = weighted(0.7);
  const lampAmber = weighted(0.7);
  const gaugeMat = weighted(0.85);
  const plateMat = weighted(0.6);

  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, cast = true, receive = true) => {
    keep(geometry);
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    group.add(m);
    return m;
  };
  const box = (w: number, h: number, d: number, at: THREE.Vector3, material: THREE.Material, cast = true) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(at.x, at.y, at.z);
    return add(g, material, cast);
  };
  const cylinderAlong = (r: number, from: THREE.Vector3, to: THREE.Vector3, material: THREE.Material, seg = 28, cast = true) => {
    const dir = new THREE.Vector3().subVectors(to, from);
    const g = new THREE.CylinderGeometry(r, r, dir.length(), seg, 1);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir.clone().normalize()));
    g.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    return add(g, material, cast);
  };

  // Bolts are many and identical, so they are one instanced mesh, filled in as flanges are placed.
  const boltSpots: THREE.Matrix4[] = [];
  const flange = (r: number, at: THREE.Vector3, axis: THREE.Vector3, material: THREE.Material, count = 8) => {
    const n = axis.clone().normalize();
    cylinderAlong(r * 1.65, at.clone().addScaledVector(n, -0.022), at.clone().addScaledVector(n, 0.022), material, 32);
    const q = new THREE.Quaternion().setFromUnitVectors(Y, n);
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const up = new THREE.Vector3().crossVectors(n, side);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const p = at.clone().addScaledVector(side, Math.cos(a) * r * 1.38).addScaledVector(up, Math.sin(a) * r * 1.38);
      boltSpots.push(new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)));
    }
  };
  const pipe = (r: number, points: THREE.Vector3[], material: THREE.Material, flanges: number[] = []) => {
    for (let i = 0; i < points.length - 1; i++) cylinderAlong(r, points[i], points[i + 1], material);
    // Welded bends at the corners.
    for (let i = 1; i < points.length - 1; i++) {
      const g = new THREE.SphereGeometry(r, 24, 16);
      g.translate(points[i].x, points[i].y, points[i].z);
      add(g, material);
    }
    for (const f of flanges) {
      const seg = Math.floor(f);
      const a = points[seg];
      const b = points[seg + 1];
      flange(r, a.clone().lerp(b, f - seg), new THREE.Vector3().subVectors(b, a), material);
    }
  };
  /** A handwheel with spokes, its axis along `axis`. */
  const wheel = (at: THREE.Vector3, axis: THREE.Vector3, r = 0.13) => {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.clone().normalize());
    const rim = new THREE.TorusGeometry(r, 0.016, 10, 40);
    rim.applyQuaternion(q);
    rim.translate(at.x, at.y, at.z);
    add(rim, handwheel);
    for (let i = 0; i < 3; i++) {
      const s = new THREE.BoxGeometry(r * 2, 0.014, 0.014);
      s.rotateZ((i / 3) * Math.PI);
      s.applyQuaternion(q);
      s.translate(at.x, at.y, at.z);
      add(s, handwheel);
    }
  };
  /** A pressure gauge on a short stub, facing `facing`. */
  const gauge = (at: THREE.Vector3, facing: THREE.Vector3, value: number) => {
    const n = facing.clone().normalize();
    cylinderAlong(0.012, at.clone().addScaledVector(n, -0.12), at.clone().addScaledVector(n, -0.03), steel, 10);
    cylinderAlong(0.075, at.clone().addScaledVector(n, -0.03), at, steel, 32);
    void value;
    const face = new THREE.CircleGeometry(0.066, 32);
    face.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n));
    face.translate(at.x + n.x * 0.002, at.y + n.y * 0.002, at.z + n.z * 0.002);
    add(face, gaugeMat, false);
  };
  // Name plates draw as plates. Their words are shown by the HTML labels instead.
  const plate = (_lines: string[], at: THREE.Vector3, facing: THREE.Vector3, width: number, _opts?: unknown) => {
    const g = new THREE.PlaneGeometry(width, width * 0.28);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), facing.clone().normalize()));
    g.translate(at.x, at.y, at.z);
    add(g, plateMat, false);
  };

  // Deck, bulkheads, deckhead.
  {
    // Floor plates with small gaps, so their seams draw as lines.
    const PLATE = 1.3;
    for (let x = X0; x < X1 - 1e-6; x += PLATE) {
      for (let z = Z0; z < Z1 - 1e-6; z += PLATE) {
        const w = Math.min(PLATE, X1 - x) - 0.025;
        const d = Math.min(PLATE, Z1 - z) - 0.025;
        box(w, 0.03, d, v(x + w / 2 + 0.0125, FLOOR - 0.015, z + d / 2 + 0.0125), floorMat, false);
      }
    }
    const wall = (w: number, h: number, at: THREE.Vector3, rotY: number, repeat: number) => {
      const g = new THREE.PlaneGeometry(w, h);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * repeat);
      g.rotateY(rotY);
      g.translate(at.x, at.y, at.z);
      add(g, wallMat, false);
    };
    const H = CEIL - FLOOR;
    wall(X1 - X0, H, v((X0 + X1) / 2, FLOOR + H / 2, Z0), 0, 1);
    wall(Z1 - Z0, H, v(X0, FLOOR + H / 2, (Z0 + Z1) / 2), Math.PI / 2, 1);
    wall(Z1 - Z0, H, v(X1, FLOOR + H / 2, (Z0 + Z1) / 2), -Math.PI / 2, 1);
    wall(X1 - X0, H, v((X0 + X1) / 2, FLOOR + H / 2, Z1), Math.PI, 1);
    const ceiling = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0);
    ceiling.rotateX(Math.PI / 2);
    ceiling.translate((X0 + X1) / 2, CEIL, (Z0 + Z1) / 2);
    add(ceiling, deckheadMat, false);

    // Web frames on the ship's side, as I-beams, and stiffeners on the aft bulkhead.
    for (let z = Z0 + 0.6; z < Z1; z += 1.0) {
      box(0.34, H, 0.045, v(X0 + 0.17, FLOOR + H / 2, z), frameMat);
      box(0.045, H, 0.24, v(X0 + 0.34, FLOOR + H / 2, z), frameMat);
    }
    box(0.3, 0.05, Z1 - Z0, v(X0 + 0.15, 1.5, (Z0 + Z1) / 2), frameMat);
    for (let x = X0 + 0.5; x < X1; x += 0.8) box(0.05, H, 0.18, v(x, FLOOR + H / 2, Z0 + 0.09), frameMat);
    // Deckhead beams across, and a girder along the room.
    for (let z = Z0 + 0.5; z < Z1; z += 1.0) {
      box(X1 - X0, 0.3, 0.045, v((X0 + X1) / 2, CEIL - 0.15, z), deckheadMat);
      box(X1 - X0, 0.04, 0.18, v((X0 + X1) / 2, CEIL - 0.3, z), deckheadMat);
    }
    box(0.05, 0.45, Z1 - Z0, v(0.5, CEIL - 0.225, (Z0 + Z1) / 2), deckheadMat);
    box(0.22, 0.04, Z1 - Z0, v(0.5, CEIL - 0.45, (Z0 + Z1) / 2), deckheadMat);
  }

  // Pumps, each on a plinth with a painted margin, a name plate, a discharge drop and a suction branch.
  const targetMaterial = weighted(1);
  let target: THREE.Mesh | null = null;
  for (const spot of PUMPS) {
    const { z } = spot;
    box(1.55, 0.2, 0.92, v(-0.21, FLOOR + 0.1, z), plinthMat);
    for (const [w, d, x, dz] of [[1.75, 0.06, -0.21, 0.53], [1.75, 0.06, -0.21, -0.53], [0.06, 1.12, 0.66, 0], [0.06, 1.12, -1.08, 0]] as const) {
      box(w, 0.006, d, v(x, FLOOR + 0.003, z + dz), yellow, false);
    }
    const mesh = new THREE.Mesh(pumpGeometry, z === 0 ? targetMaterial : pumpPaint[spot.paint]);
    mesh.position.z = z;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    if (z === 0) target = mesh;
    plate(spot.plate, v(-0.21, FLOOR + 0.1, z + 0.462), v(0, 0, 1), 0.62);

    // Discharge: non-return valve, butterfly valve with gearbox and handwheel, and a gauge, up to the header.
    const d0 = DISCHARGE.clone().setZ(z + DISCHARGE.z);
    const top = v(d0.x, HEADER_Y, d0.z);
    pipe(0.07, [d0, top], seawater, [0.02, 0.2, 0.33, 0.5, 0.56]);
    cylinderAlong(0.1, v(d0.x, 0.68, d0.z), v(d0.x, 0.82, d0.z), steel);
    cylinderAlong(0.125, v(d0.x, 1.12, d0.z), v(d0.x, 1.2, d0.z), steel);
    box(0.14, 0.12, 0.12, v(d0.x + 0.17, 1.16, d0.z), steel);
    wheel(v(d0.x + 0.3, 1.16, d0.z), v(1, 0, 0));
    gauge(v(d0.x + 0.06, 0.6, d0.z + 0.12), v(0.6, 0, 1), 2.4 + z * 0.05);

    // Suction: from the casing end through a basket strainer and a valve, down to the suction main.
    const s0 = SUCTION.clone().setZ(z);
    pipe(0.085, [s0, v(STRAINER_X - 0.2, s0.y, z)], seawater, [0.03]);
    cylinderAlong(0.21, v(STRAINER_X, FLOOR + 0.05, z), v(STRAINER_X, 0.12, z), seawater);
    cylinderAlong(0.245, v(STRAINER_X, 0.12, z), v(STRAINER_X, 0.17, z), steel);
    flange(0.16, v(STRAINER_X, 0.14, z), v(0, 1, 0), steel, 10);
    box(0.24, 0.03, 0.03, v(STRAINER_X, 0.24, z), steel);
    cylinderAlong(0.012, v(STRAINER_X, 0.17, z), v(STRAINER_X, 0.24, z), steel, 8);
    pipe(0.09, [v(STRAINER_X + 0.2, MAIN_Y, z), v(MAIN_X, MAIN_Y, z)], seawater, [0.5]);
    cylinderAlong(0.012, v(MAIN_X - 0.22, MAIN_Y, z), v(MAIN_X - 0.22, -0.02, z), steel, 8);
    wheel(v(MAIN_X - 0.22, -0.02, z), v(0, 1, 0), 0.1);
  }

  // Seawater header overhead, rising into the deckhead at the forward end, with hangers.
  pipe(0.13, [v(DISCHARGE.x, HEADER_Y, Z0 + 0.05), v(DISCHARGE.x, HEADER_Y, 1.4), v(DISCHARGE.x, CEIL, 1.4)], seawater, [0.08, 0.35, 0.62, 0.9, 1.5]);
  for (const z of [-5.0, -3.1, -1.0, 0.9]) {
    cylinderAlong(0.012, v(DISCHARGE.x - 0.16, HEADER_Y, z), v(DISCHARGE.x - 0.16, CEIL - 0.3, z), steel, 8);
    cylinderAlong(0.012, v(DISCHARGE.x + 0.16, HEADER_Y, z), v(DISCHARGE.x + 0.16, CEIL - 0.3, z), steel, 8);
    box(0.4, 0.03, 0.05, v(DISCHARGE.x, HEADER_Y - 0.15, z), steel);
  }
  // Suction main along the deck, from the sea chest in the aft bulkhead, on stands.
  pipe(0.15, [v(MAIN_X, MAIN_Y, Z0 + 0.05), v(MAIN_X, MAIN_Y, 1.0)], seawater, [0.06, 0.3, 0.55, 0.85]);
  {
    const cap = new THREE.SphereGeometry(0.15, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.rotateX(Math.PI / 2);
    cap.translate(MAIN_X, MAIN_Y, 1.0);
    add(cap, seawater);
  }
  for (const z of [-5.4, -3.1, -1.0, 0.7]) box(0.08, MAIN_Y - FLOOR - 0.15, 0.08, v(MAIN_X, (FLOOR + MAIN_Y - 0.15) / 2, z), steel);

  // Overhead services: lagged pipes in aluminium cladding, fresh water, fuel, and cable trays.
  for (const [z, r, y] of [[-1.05, 0.2, 2.95], [-3.25, 0.16, 3.0]] as const) {
    cylinderAlong(r, v(X0, y, z), v(X1, y, z), cladding, 36);
    for (let x = X0 + 0.4; x < X1; x += 0.7) cylinderAlong(r + 0.006, v(x - 0.01, y, z), v(x + 0.01, y, z), steel, 36, false);
  }
  pipe(0.065, [v(-2.4, 2.72, Z0 + 0.05), v(-2.4, 2.72, Z1 - 0.05)], freshwater, [0.15, 0.4, 0.65, 0.9]);
  pipe(0.05, [v(X0 + 0.05, 2.5, -5.7), v(X1 - 0.05, 2.5, -5.7)], fuel, [0.2, 0.5, 0.8]);
  for (const [axis, at, len] of [["z", v(-3.6, 3.02, (Z0 + Z1) / 2), Z1 - Z0], ["x", v((X0 + X1) / 2, 3.0, -5.85), X1 - X0]] as const) {
    const along = axis === "z";
    for (const off of [-0.24, 0.24]) {
      box(along ? 0.025 : len, 0.08, along ? len : 0.025, v(at.x + (along ? off : 0), at.y, at.z + (along ? 0 : off)), steel);
    }
    for (let s = -len / 2; s < len / 2; s += 0.32) box(along ? 0.48 : 0.02, 0.02, along ? 0.02 : 0.48, v(at.x + (along ? 0 : s), at.y - 0.03, at.z + (along ? s : 0)), steel, false);
    for (let k = 0; k < 7; k++) {
      const o = -0.18 + k * 0.06;
      const from = along ? v(at.x + o, at.y + 0.0, at.z - len / 2) : v(at.x - len / 2, at.y, at.z + o);
      const to = along ? v(at.x + o, at.y, at.z + len / 2) : v(at.x + len / 2, at.y, at.z + o);
      cylinderAlong(0.022, from, to, cable, 8);
    }
  }

  // Light fittings: housings with their tubes.
  for (const x of [-2.3, 1.7]) {
    for (const z of [4.6, 1.9, -1.1, -4.1]) {
      box(0.26, 0.08, 1.45, v(x, CEIL - 0.42, z), panelMat, false);
      for (const dx of [-0.06, 0.06]) cylinderAlong(0.022, v(x + dx, CEIL - 0.48, z - 0.66), v(x + dx, CEIL - 0.48, z + 0.66), tube, 12, false);
    }
  }

  // Starter panels on the aft bulkhead, with lamps, an ammeter and plates.
  ["SW PUMP 1", "SW PUMP 2", "FIRE & GS"].forEach((name, i) => {
    const x = -3.9 + i * 0.82;
    box(0.74, 1.95, 0.42, v(x, FLOOR + 0.975, Z0 + 0.4), panelMat);
    box(0.005, 1.7, 0.005, v(x, FLOOR + 0.98, Z0 + 0.612), steel, false);
    plate([name, "STARTER"], v(x, FLOOR + 1.62, Z0 + 0.613), v(0, 0, 1), 0.42);
    gauge(v(x - 0.16, FLOOR + 1.3, Z0 + 0.7), v(0, 0, 1), 3.4 + i * 0.3);
    for (const [dx, m] of [[0.06, lampGreen], [0.18, i === 1 ? lampAmber : lampGreen]] as const) {
      const g = new THREE.SphereGeometry(0.03, 16, 10);
      g.translate(x + dx, FLOOR + 1.3, Z0 + 0.625);
      add(g, m, false);
    }
  });
  plate(["SEAWATER COOLING PUMPS"], v(0.6, 2.85, Z0 + 0.2), v(0, 0, 1), 1.7, { bg: "#1f5a35", fg: "#f4f1e6", width: 768 });

  // Ladder up the aft bulkhead, handrail along the walkway, fire extinguisher on the ship's side.
  for (const dx of [-0.22, 0.22]) box(0.05, CEIL - FLOOR, 0.05, v(4.2 + dx, (FLOOR + CEIL) / 2, Z0 + 0.3), steel);
  for (let y = FLOOR + 0.3; y < CEIL; y += 0.3) cylinderAlong(0.016, v(3.98, y, Z0 + 0.3), v(4.42, y, Z0 + 0.3), steel, 8);
  for (let x = -2.6; x <= 1.0; x += 1.2) box(0.04, 1.05, 0.04, v(x, FLOOR + 0.525, 1.72), yellow);
  for (const y of [FLOOR + 0.55, FLOOR + 1.05]) cylinderAlong(0.022, v(-2.6, y, 1.72), v(1.0, y, 1.72), yellow, 12);
  cylinderAlong(0.085, v(X0 + 0.5, FLOOR + 0.6, 2.4), v(X0 + 0.5, FLOOR + 1.12, 2.4), weighted(0.8));
  // Walkway lines on the deck.
  for (const z of [1.25, 3.6]) box(X1 - X0 - 1, 0.006, 0.07, v((X0 + X1) / 2, FLOOR + 0.003, z), yellow, false);

  // All flange bolts as one instanced mesh.
  {
    const g = keep(new THREE.CylinderGeometry(0.011, 0.011, 0.07, 8));
    const bolt = new THREE.InstancedMesh(g, bolts, boltSpots.length);
    boltSpots.forEach((m, i) => bolt.setMatrixAt(i, m));
    bolt.castShadow = true;
    group.add(bolt);
  }


  // Line work over Pump 8, for the hand-off to the drawing. Drawn on top, like the line-work pump that follows.
  const edgeMat = keep(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false }));
  const edges = new THREE.LineSegments(pumpEdges, edgeMat);
  edges.renderOrder = 10;
  edges.layers.set(1);
  group.add(edges);

  const anchors: Anchor[] = [
    { key: "p8", label: "Pump 8", detail: "SW cooling pump No. 2", at: v(-0.45, 0.85, 0) },
    { key: "p7", label: "Pump 7", detail: "SW cooling pump No. 1", at: v(-0.45, 0.85, -2.05) },
    { key: "strainer", label: "Suction strainer", detail: "Pump 8", at: v(STRAINER_X, 0.35, 0) },
    { key: "header", label: "Seawater header", detail: "To the coolers", at: v(DISCHARGE.x, HEADER_Y + 0.25, -2.8) },
  ];

  /** Nothing moves in the drawing itself; kept so the stage can call it. */
  const update = (_t: number, _still: boolean) => {};

  return {
    group,
    target: target as THREE.Mesh,
    targetMaterial,
    edgeMaterial: edgeMat,
    anchors,
    update,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
