// A ship's engine room in line work, built around the front pump for the opening of the landing page.
// Units are the pump model's: it spans x -1 to 1 along the shaft, y about -0.42 to 0.42, z about -0.33 to 0.33.
// The room is a child of the pump's group, so it moves with the pump and the camera can fly in to that pump.
import * as THREE from "three";

const FLOOR = -0.43;
const CEILING = 2.2;
const X0 = -2.4;
const X1 = 2.6;
const Z0 = -5.2;
const Z1 = 1.4;
/** Where the copies of the pump stand, behind the front one at z = 0. */
const ROW = [-1.35, -2.7, -4.05];
const HEADER_X = 0.2;
const HEADER_Y = 1.05;

/** The room's centre, which the camera frames at the start. */
export const ROOM_CENTRE = new THREE.Vector3((X0 + X1) / 2, 0.7, (Z0 + Z1) / 2);
/** Rough size of the room, used to fit it to the screen. */
export const ROOM_SIZE = { width: 7.4, height: 5.2 };

function edges(g: THREE.BufferGeometry, m: THREE.LineBasicMaterial) {
  const e = new THREE.EdgesGeometry(g, 15);
  g.dispose();
  return new THREE.LineSegments(e, m);
}

/** Straight segments from a flat list of [x1, y1, z1, x2, y2, z2] values. */
function segments(points: number[], m: THREE.LineBasicMaterial) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(g, m);
}

function pipe(r: number, from: THREE.Vector3, to: THREE.Vector3, m: THREE.LineBasicMaterial) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const g = new THREE.CylinderGeometry(r, r, dir.length(), 20, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
  g.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
  return edges(g, m);
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.LineBasicMaterial) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return edges(g, m);
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function buildEngineRoom(pumpEdges: THREE.BufferGeometry, line: THREE.LineBasicMaterial, soft: THREE.LineBasicMaterial) {
  const room = new THREE.Group();

  // Deck plates on the floor.
  const deck: number[] = [];
  for (let x = X0; x <= X1 + 1e-6; x += 0.55) deck.push(x, FLOOR, Z0, x, FLOOR, Z1);
  for (let z = Z0; z <= Z1 + 1e-6; z += 0.55) deck.push(X0, FLOOR, z, X1, FLOOR, z);
  room.add(segments(deck, soft));

  // Hull ribs and stringers on the back wall and the left wall.
  const walls: number[] = [];
  for (let x = X0; x <= X1 + 1e-6; x += 0.7) walls.push(x, FLOOR, Z0, x, CEILING, Z0);
  for (const y of [0.9, 1.6, CEILING]) walls.push(X0, y, Z0, X1, y, Z0, X0, y, Z0, X0, y, Z1);
  for (let z = Z0; z <= Z1 + 1e-6; z += 0.7) walls.push(X0, FLOOR, z, X0, CEILING, z);
  room.add(segments(walls, soft));

  // The other pumps in the row, sharing the front pump's line work.
  for (const z of ROW) {
    const copy = new THREE.LineSegments(pumpEdges, line);
    copy.position.z = z;
    room.add(copy);
  }

  // Seawater header overhead, with a drop and a valve down to every pump, front one included.
  room.add(pipe(0.09, v(HEADER_X, HEADER_Y, Z0 + 0.6), v(HEADER_X, HEADER_Y, Z1 - 0.5), line));
  for (const z of [0, ...ROW]) {
    room.add(pipe(0.05, v(HEADER_X, 0.42, z), v(HEADER_X, HEADER_Y, z), line));
    room.add(pipe(0.12, v(HEADER_X, 0.72, z), v(HEADER_X, 0.77, z), line));
  }
  // Suction main along the floor on the other side.
  room.add(pipe(0.1, v(1.35, -0.12, Z0 + 0.6), v(1.35, -0.12, Z1 - 0.5), soft));
  for (const z of [0, ...ROW]) room.add(pipe(0.05, v(0.95, -0.12, z), v(1.35, -0.12, z), soft));

  // Overhead runs of pipe and cable tray.
  room.add(pipe(0.12, v(-1.6, 1.75, Z0), v(-1.6, 1.75, Z1), soft));
  room.add(pipe(0.07, v(-0.9, 1.9, Z0), v(-0.9, 1.9, Z1), soft));
  room.add(pipe(0.1, v(X0, 1.95, Z0 + 0.4), v(X1, 1.95, Z0 + 0.4), soft));

  // Switchboard against the back wall, and a ladder up the left wall.
  room.add(box(1.0, 1.5, 0.35, 1.9, FLOOR + 0.75, Z0 + 0.25, line));
  room.add(box(0.5, 0.3, 0.02, 1.9, FLOOR + 1.15, Z0 + 0.43, soft));
  const ladder: number[] = [X0 + 0.05, FLOOR, -3.0, X0 + 0.05, CEILING, -3.0, X0 + 0.05, FLOOR, -2.6, X0 + 0.05, CEILING, -2.6];
  for (let y = FLOOR + 0.25; y < CEILING; y += 0.25) ladder.push(X0 + 0.05, y, -3.0, X0 + 0.05, y, -2.6);
  room.add(segments(ladder, soft));

  const dispose = () =>
    room.traverse((o) => {
      // The pump copies share the front pump's geometry, which its owner disposes.
      if (o instanceof THREE.LineSegments && o.geometry !== pumpEdges) o.geometry.dispose();
    });
  return { room, dispose };
}
