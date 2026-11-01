#!/usr/bin/env node
// Converts the owner's die model (assets/models/dice_model_normal.glb, glTF 2.0 by trimesh) into
// src/ui/dice-model.js, an ES module the single-file build can inline. Regenerate after the model
// changes, from the repo root:
//   node scripts/model-to-js.mjs
// The rounded body (~120k triangles) is decimated by vertex clustering on a grid that is coarse
// over the flat part of each face and fine across the rounded band; the pips are kept as they
// are. Positions are stored as Int16 scaled by the largest coordinate, indices as Uint16, both
// little-endian and base64-encoded. Which value each face shows is read from the pips (a face
// with n pip discs shows n), so a re-exported model with other face values still lines up.
import { readFileSync, writeFileSync } from 'node:fs';
import { OPPOSITE } from '../src/ui/dice3d-math.js';

const SRC = 'assets/models/dice_model_normal.glb';
const OUT = 'src/ui/dice-model.js';
const FLAT_CELLS = 4; // cells per half face over the flat part
const BAND_CELLS = 8; // cells across the rounded band

function readGlb(file) {
  const b = readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67 || b.readUInt32LE(4) !== 2) throw new Error(`${file} is not a glTF 2.0 binary`);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString('utf8'));
  const bin = b.subarray(20 + jsonLen + 8);
  const read = (index) => {
    const a = json.accessors[index];
    const view = json.bufferViews[a.bufferView];
    if (view.byteStride) throw new Error('interleaved buffer views are not supported');
    const Type = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[a.componentType];
    if (!Type) throw new Error(`unsupported component type ${a.componentType}`);
    const n = a.count * (a.type === 'VEC3' ? 3 : 1);
    const start = view.byteOffset + (a.byteOffset || 0);
    return new Type(bin.buffer.slice(bin.byteOffset + start, bin.byteOffset + start + n * Type.BYTES_PER_ELEMENT));
  };
  if (json.nodes.some((n) => n.matrix || n.translation || n.rotation || n.scale)) throw new Error('node transforms are not supported');
  const mesh = (name) => {
    const m = json.meshes.find((x) => x.name === name);
    if (!m || m.primitives.length !== 1 || (m.primitives[0].mode ?? 4) !== 4) throw new Error(`mesh ${name} missing or not a single triangle list`);
    const p = m.primitives[0];
    return { positions: read(p.attributes.POSITION), indices: read(p.indices) };
  };
  return { body: mesh('D6_RoundedBody'), pips: mesh('D6_Pips') };
}

function decimate({ positions, indices }) {
  // Where the rounded band starts: the extent of the flat +z face, less a fine cell of margin.
  let flat = 0;
  for (let k = 0; k < positions.length; k += 3) {
    if (positions[k + 2] > 0.9999) flat = Math.max(flat, Math.abs(positions[k]), Math.abs(positions[k + 1]));
  }
  const bandStart = flat - (1 - flat) / BAND_CELLS;
  const axisCell = (c) => {
    const a = Math.abs(c);
    const i = a < bandStart ? Math.floor((a / bandStart) * FLAT_CELLS) : FLAT_CELLS + Math.min(BAND_CELLS - 1, Math.floor(((a - bandStart) / (1 - bandStart)) * BAND_CELLS));
    return c < 0 ? -1 - i : i;
  };
  // Every vertex goes to its cell; the cell's vertex is the mean of its members.
  const cells = new Map();
  const sums = [];
  const remap = new Uint32Array(positions.length / 3);
  for (let v = 0; v < remap.length; v++) {
    const [x, y, z] = positions.subarray(v * 3, v * 3 + 3);
    const key = `${axisCell(x)},${axisCell(y)},${axisCell(z)}`;
    if (!cells.has(key)) { cells.set(key, sums.length); sums.push([0, 0, 0, 0]); }
    const s = sums[cells.get(key)];
    s[0] += x; s[1] += y; s[2] += z; s[3]++;
    remap[v] = cells.get(key);
  }
  const verts = sums.map(([x, y, z, n]) => [x / n, y / n, z / n]);
  // Drop collapsed and repeated triangles; the body is convex, so every face must point away from the centre.
  const seen = new Set();
  const tris = [];
  let flipped = 0;
  for (let t = 0; t < indices.length; t += 3) {
    let [a, b, c] = [remap[indices[t]], remap[indices[t + 1]], remap[indices[t + 2]]];
    if (a === b || b === c || a === c) continue;
    const key = [a, b, c].sort((p, q) => p - q).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const [A, B, C] = [verts[a], verts[b], verts[c]];
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    if (n[0] * (A[0] + B[0] + C[0]) + n[1] * (A[1] + B[1] + C[1]) + n[2] * (A[2] + B[2] + C[2]) < 0) { [b, c] = [c, b]; flipped++; }
    tris.push(a, b, c);
  }
  // Keep only the cells some triangle still uses.
  const used = new Map();
  const outIndices = tris.map((v) => { if (!used.has(v)) used.set(v, used.size); return used.get(v); });
  const outPositions = new Float32Array(used.size * 3);
  for (const [v, k] of used) outPositions.set(verts[v], k * 3);
  return { positions: outPositions, indices: Uint32Array.from(outIndices), flipped };
}

// Value per face in FACE_AXES order: each pip is a connected disc, a face with n discs shows n.
function faceValues({ positions, indices }) {
  const parent = Array.from({ length: positions.length / 3 }, (_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let t = 0; t < indices.length; t += 3) {
    parent[find(indices[t + 1])] = find(indices[t]);
    parent[find(indices[t + 2])] = find(indices[t]);
  }
  const counts = new Array(6).fill(0);
  const roots = new Set();
  for (let v = 0; v < parent.length; v++) {
    if (roots.has(find(v))) continue;
    roots.add(find(v));
    const p = positions.subarray(v * 3, v * 3 + 3);
    const axis = [0, 1, 2].reduce((m, k) => (Math.abs(p[k]) > Math.abs(p[m]) ? k : m), 0);
    counts[axis * 2 + (p[axis] < 0 ? 1 : 0)]++; // FACE_AXES order: +x, -x, +y, -y, +z, -z
  }
  return counts;
}

function encode({ positions, indices }, scale) {
  const pos = Buffer.alloc(positions.length * 2);
  positions.forEach((x, k) => pos.writeInt16LE(Math.round((x / scale) * 32767), k * 2));
  const idx = Buffer.alloc(indices.length * 2);
  indices.forEach((v, k) => idx.writeUInt16LE(v, k * 2));
  return { positions: pos.toString('base64'), indices: idx.toString('base64') };
}

function check(name, part, scale) {
  const vertexCount = part.positions.length / 3;
  if (vertexCount > 65535) throw new Error(`${name}: ${vertexCount} vertices do not fit Uint16 indices`);
  if (part.indices.length % 3 || part.indices.some((v) => v >= vertexCount)) throw new Error(`${name}: index out of range`);
  if (part.positions.some((x) => Math.abs(x) > scale)) throw new Error(`${name}: position outside the quantisation range`);
}

const model = readGlb(SRC);
const body = decimate(model.body);
const pips = { positions: model.pips.positions, indices: model.pips.indices };
const values = faceValues(pips);
if ([...values].sort().join() !== '1,2,3,4,5,6' || values.some((v, k) => v + values[OPPOSITE[k]] !== 7)) {
  throw new Error(`pip counts per face ${values} are not a standard die`);
}
const scale = Math.max(...body.positions.map(Math.abs), ...pips.positions.map(Math.abs));
if (scale > 1.01) throw new Error(`model spans ±${scale}, expected about ±1`);
check('body', body, scale);
check('pips', pips, scale);

const bodyTris = body.indices.length / 3;
const pipTris = pips.indices.length / 3;
const out = `// Generated by scripts/model-to-js.mjs from ${SRC}; do not edit by hand.
// Regenerate from the repo root: node scripts/model-to-js.mjs
// Body: ${model.body.indices.length / 3} triangles decimated to ${bodyTris} (${body.positions.length / 3} vertices); pips kept as modelled (${pipTris} triangles).
// Positions: little-endian Int16, coordinate = value * MODEL_SCALE / 32767; indices: little-endian Uint16; both base64.

// Value shown by each model face, in FACE_AXES order (+x, -x, +y, -y, +z, -z).
export const MODEL_FACE_VALUES = [${values.join(', ')}];
export const MODEL_SCALE = ${scale};
export const DIE_BODY = ${JSON.stringify(encode(body, scale))};
export const DIE_PIPS = ${JSON.stringify(encode(pips, scale))};

// { positions: Float32Array (x, y, z per vertex), indices: Uint16Array (three per triangle) }
export function decodePart(part) {
  const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
  return { positions: Float32Array.from(new Int16Array(bytes(part.positions)), (v) => (v * MODEL_SCALE) / 32767), indices: new Uint16Array(bytes(part.indices)) };
}
`;
writeFileSync(OUT, out);
console.log(`body ${model.body.indices.length / 3} -> ${bodyTris} triangles (${body.positions.length / 3} vertices, ${body.flipped} re-wound), pips ${pipTris} triangles, faces ${values.join(' ')}; wrote ${OUT} (${(out.length / 1024).toFixed(1)} KB)`);
