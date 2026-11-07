#!/usr/bin/env node
// Turns a pump model (.obj) into the line work the landing page draws, so the browser never loads the 15 MB mesh.
//
// Run:  node tools/build_pump_edges.mjs ~/Downloads/pump.obj [angle]
// Out:  public/models/pump-edges.bin
//
// It keeps only edges where the surface bends by more than `angle` degrees (default 30), which gives clean outlines
// instead of every triangle. The model is centred, its longest side is scaled to 2 units, and positions are stored as
// 16-bit integers. File layout: "PEDG", uint32 segment count, then count x 2 points x 3 int16 (x, y, z / 32767).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const [input, angleArg] = process.argv.slice(2);
if (!input) {
  console.error("Usage: node tools/build_pump_edges.mjs <model.obj> [angle]");
  process.exit(1);
}
const angle = Number(angleArg ?? 30);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(repo, "public", "models", "pump-edges.bin");

const object = new OBJLoader().parse(fs.readFileSync(input, "utf8"));
const geometries = [];
object.traverse((o) => {
  if (o.isMesh) {
    const g = o.geometry.clone();
    g.deleteAttribute("normal");
    g.deleteAttribute("uv");
    geometries.push(g);
  }
});
if (!geometries.length) {
  console.error("No mesh found in", input);
  process.exit(1);
}

const positions = [];
for (const g of geometries) {
  const edges = new THREE.EdgesGeometry(mergeVertices(g, 1e-3), angle);
  for (const v of edges.attributes.position.array) positions.push(v);
}

// Centre, and scale so the longest side spans -1 to 1.
const box = new THREE.Box3().setFromArray(positions);
const centre = box.getCenter(new THREE.Vector3());
const size = box.getSize(new THREE.Vector3());
const half = Math.max(size.x, size.y, size.z) / 2;

const count = positions.length / 6;
const buf = Buffer.alloc(8 + positions.length * 2);
buf.write("PEDG", 0, "ascii");
buf.writeUInt32LE(count, 4);
for (let i = 0; i < positions.length; i++) {
  const c = centre.getComponent(i % 3);
  const v = Math.round(((positions[i] - c) / half) * 32767);
  buf.writeInt16LE(Math.max(-32767, Math.min(32767, v)), 8 + i * 2);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, buf);

const r = (n) => (n / half).toFixed(3);
console.log(`${count} edges at ${angle}°, ${(buf.length / 1024).toFixed(0)} KB -> ${path.relative(repo, out)}`);
console.log(`size after scaling: x ${r(size.x)}, y ${r(size.y)}, z ${r(size.z)}`);
