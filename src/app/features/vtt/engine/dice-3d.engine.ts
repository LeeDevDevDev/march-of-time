import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import {
  VttDiceAppearance,
  VttDiceMaterial,
} from '../../../core/settings/vtt-settings.store';
import {
  PhysicalDieMeshKind,
  VttDiceThrowPayload,
  VttPhysicalDieRoll,
} from './dice-roller.engine';

interface UvPoint {
  u: number;
  v: number;
}

interface PolyFaceDescriptor {
  faceIndex: number;
  vertexIndices: number[];
  normal: THREE.Vector3;
  uvs: UvPoint[];
  faceLabel: string;
  d4CornerLabels?: { label: string; u: number; v: number }[];
}

interface PolyOutcomeDescriptor {
  value: number;
  upVector: THREE.Vector3;
}

export interface PolyhedronTemplate {
  kind: PhysicalDieMeshKind;
  vertices: THREE.Vector3[];
  faces: PolyFaceDescriptor[];
  outcomes: PolyOutcomeDescriptor[];
  geometry: THREE.BufferGeometry;
  cannonShape: CANNON.ConvexPolyhedron;
}

interface ActiveDieActor {
  body: CANNON.Body;
  mesh: THREE.Mesh;
  symmetryQuat: THREE.Quaternion;
  finalPos: THREE.Vector3;
  finalQuat: THREE.Quaternion;
  dropped: boolean;
}

interface PreSimResult {
  settledStep: number;
  initialStates: {
    pos: CANNON.Vec3;
    vel: CANNON.Vec3;
    angVel: CANNON.Vec3;
    quat: CANNON.Quaternion;
  }[];
  finalStates: {
    pos: THREE.Vector3;
    quat: THREE.Quaternion;
    symmetryQuat: THREE.Quaternion;
  }[];
}

const FIXED_DT = 1 / 60;
const MAX_PRESIM_STEPS = 260;
const HOLD_DURATION_SEC = 1.35;
const FADE_DURATION_SEC = 0.45;
const DIE_RADIUS = 0.88;
const TEXTURE_CACHE_LIMIT = 240;

const templateCache = new Map<PhysicalDieMeshKind, PolyhedronTemplate>();
const materialCache = new Map<string, THREE.MeshPhysicalMaterial>();

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function parseHexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = (hex || '#C4491A').replace(/^#/, '');
  const full =
    clean.length === 3
      ? `${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) {
    return { r: 196, g: 73, b: 26 };
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function rgbCss(r: number, g: number, b: number, a = 1): string {
  if (a < 1) {
    return `rgba(${clampByte(r)}, ${clampByte(g)}, ${clampByte(b)}, ${a})`;
  }
  return `rgb(${clampByte(r)}, ${clampByte(g)}, ${clampByte(b)})`;
}

function hash2d(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2d(ix, iy);
  const b = hash2d(ix + 1, iy);
  const c = hash2d(ix, iy + 1);
  const d = hash2d(ix + 1, iy + 1);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbmNoise(x: number, y: number): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    val += amp * smoothNoise(x * freq, y * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return val;
}

function buildFaceFromIndices(
  faceIndex: number,
  rawIndices: number[],
  vertices: THREE.Vector3[],
  faceLabel: string,
  preferredUpVertexIdx?: number,
  d4VertexValues?: number[]
): PolyFaceDescriptor {
  const centroid = new THREE.Vector3();
  for (const idx of rawIndices) {
    centroid.add(vertices[idx]);
  }
  centroid.multiplyScalar(1 / rawIndices.length);

  const normal = centroid.clone().normalize();

  let tangentV = new THREE.Vector3();
  if (
    preferredUpVertexIdx !== undefined &&
    rawIndices.includes(preferredUpVertexIdx)
  ) {
    tangentV.subVectors(vertices[preferredUpVertexIdx], centroid);
  } else {
    tangentV.subVectors(vertices[rawIndices[0]], centroid);
  }
  tangentV.addScaledVector(normal, -tangentV.dot(normal));
  if (tangentV.lengthSq() < 1e-8) {
    const fallbackRef =
      Math.abs(normal.y) < 0.9
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0);
    tangentV.copy(fallbackRef).addScaledVector(normal, -fallbackRef.dot(normal));
  }
  tangentV.normalize();

  const tangentU = new THREE.Vector3().crossVectors(tangentV, normal).normalize();

  const projected = rawIndices.map((vIdx) => {
    const rel = new THREE.Vector3().subVectors(vertices[vIdx], centroid);
    const px = rel.dot(tangentU);
    const py = rel.dot(tangentV);
    const angle = Math.atan2(py, px);
    return { vIdx, px, py, angle };
  });

  projected.sort((a, b) => a.angle - b.angle);

  let maxR = 1e-5;
  for (const p of projected) {
    const dist = Math.hypot(p.px, p.py);
    if (dist > maxR) maxR = dist;
  }

  const uvScale = 0.43 / maxR;
  const orderedIndices = projected.map((p) => p.vIdx);
  const uvs: UvPoint[] = projected.map((p) => ({
    u: 0.5 + p.px * uvScale,
    v: 0.5 + p.py * uvScale,
  }));

  let d4CornerLabels: { label: string; u: number; v: number }[] | undefined;
  if (d4VertexValues) {
    d4CornerLabels = orderedIndices.map((vIdx, k) => ({
      label: String(d4VertexValues[vIdx]),
      u: uvs[k].u,
      v: uvs[k].v,
    }));
  }

  return {
    faceIndex,
    vertexIndices: orderedIndices,
    normal,
    uvs,
    faceLabel,
    d4CornerLabels,
  };
}

function finalizePolyhedronTemplate(
  kind: PhysicalDieMeshKind,
  vertices: THREE.Vector3[],
  faces: PolyFaceDescriptor[],
  outcomes: PolyOutcomeDescriptor[]
): PolyhedronTemplate {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvCoords: number[] = [];
  const geometry = new THREE.BufferGeometry();

  let groupStart = 0;
  for (let fIdx = 0; fIdx < faces.length; fIdx++) {
    const f = faces[fIdx];
    const count = f.vertexIndices.length;
    const triCount = count - 2;

    for (let t = 1; t < count - 1; t++) {
      const idxTri = [0, t, t + 1];
      for (const localIdx of idxTri) {
        const vert = vertices[f.vertexIndices[localIdx]];
        const uv = f.uvs[localIdx];
        positions.push(vert.x, vert.y, vert.z);
        normals.push(f.normal.x, f.normal.y, f.normal.z);
        uvCoords.push(uv.u, uv.v);
      }
    }

    geometry.addGroup(groupStart, triCount * 3, fIdx);
    groupStart += triCount * 3;
  }

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvCoords, 2));
  geometry.computeBoundingSphere();

  const cannonVerts = vertices.map((v) => new CANNON.Vec3(v.x, v.y, v.z));
  const cannonFaces = faces.map((f) => [...f.vertexIndices]);
  const cannonNormals = faces.map(
    (f) => new CANNON.Vec3(f.normal.x, f.normal.y, f.normal.z)
  );
  const cannonShape = new CANNON.ConvexPolyhedron({
    vertices: cannonVerts,
    faces: cannonFaces,
    normals: cannonNormals,
  });

  return {
    kind,
    vertices,
    faces,
    outcomes,
    geometry,
    cannonShape,
  };
}

function buildD4Template(): PolyhedronTemplate {
  const r = DIE_RADIUS * 1.16;
  const raw = [
    new THREE.Vector3(1, 1, 1),
    new THREE.Vector3(1, -1, -1),
    new THREE.Vector3(-1, 1, -1),
    new THREE.Vector3(-1, -1, 1),
  ].map((v) => v.normalize().multiplyScalar(r));

  const vertexValues = [1, 2, 3, 4];
  const faceTriples = [
    [1, 2, 3],
    [0, 2, 3],
    [0, 1, 3],
    [0, 1, 2],
  ];

  const faces = faceTriples.map((triple, idx) =>
    buildFaceFromIndices(idx, triple, raw, '', triple[0], vertexValues)
  );

  const outcomes: PolyOutcomeDescriptor[] = raw.map((v, idx) => ({
    value: vertexValues[idx],
    upVector: v.clone().normalize(),
  }));

  return finalizePolyhedronTemplate('d4', raw, faces, outcomes);
}

function buildD6Template(): PolyhedronTemplate {
  const h = DIE_RADIUS * 0.78;
  const vertices = [
    new THREE.Vector3(-h, -h, -h),
    new THREE.Vector3(h, -h, -h),
    new THREE.Vector3(h, h, -h),
    new THREE.Vector3(-h, h, -h),
    new THREE.Vector3(-h, -h, h),
    new THREE.Vector3(h, -h, h),
    new THREE.Vector3(h, h, h),
    new THREE.Vector3(-h, h, h),
  ];

  const defs: { indices: number[]; value: number; upRef: THREE.Vector3 }[] = [
    { indices: [3, 2, 6, 7], value: 1, upRef: new THREE.Vector3(0, 0, -1) },
    { indices: [0, 1, 5, 4], value: 6, upRef: new THREE.Vector3(0, 0, 1) },
    { indices: [1, 2, 6, 5], value: 2, upRef: new THREE.Vector3(0, 1, 0) },
    { indices: [0, 3, 7, 4], value: 5, upRef: new THREE.Vector3(0, 1, 0) },
    { indices: [4, 5, 6, 7], value: 3, upRef: new THREE.Vector3(0, 1, 0) },
    { indices: [0, 1, 2, 3], value: 4, upRef: new THREE.Vector3(0, 1, 0) },
  ];

  const faces: PolyFaceDescriptor[] = defs.map((def, fIdx) => {
    const centroid = new THREE.Vector3();
    for (const idx of def.indices) centroid.add(vertices[idx]);
    centroid.multiplyScalar(0.25);
    const normal = centroid.clone().normalize();
    const tangentV = def.upRef.clone().normalize();
    const tangentU = new THREE.Vector3()
      .crossVectors(tangentV, normal)
      .normalize();

    const projected = def.indices.map((vIdx) => {
      const rel = new THREE.Vector3().subVectors(vertices[vIdx], centroid);
      const px = rel.dot(tangentU);
      const py = rel.dot(tangentV);
      return { vIdx, px, py, angle: Math.atan2(py, px) };
    });
    projected.sort((a, b) => a.angle - b.angle);

    const scale = 0.44 / h;
    return {
      faceIndex: fIdx,
      vertexIndices: projected.map((p) => p.vIdx),
      normal,
      uvs: projected.map((p) => ({
        u: 0.5 + p.px * scale,
        v: 0.5 + p.py * scale,
      })),
      faceLabel: String(def.value),
    };
  });

  const outcomes: PolyOutcomeDescriptor[] = faces.map((f, idx) => ({
    value: defs[idx].value,
    upVector: f.normal.clone(),
  }));

  return finalizePolyhedronTemplate('d6', vertices, faces, outcomes);
}

function buildD8Template(): PolyhedronTemplate {
  const r = DIE_RADIUS * 1.08;
  const vertices = [
    new THREE.Vector3(r, 0, 0),
    new THREE.Vector3(-r, 0, 0),
    new THREE.Vector3(0, r, 0),
    new THREE.Vector3(0, -r, 0),
    new THREE.Vector3(0, 0, r),
    new THREE.Vector3(0, 0, -r),
  ];

  const defs: { indices: [number, number, number]; value: number; upIdx: number }[] = [
    { indices: [0, 2, 4], value: 1, upIdx: 2 },
    { indices: [1, 3, 5], value: 8, upIdx: 3 },
    { indices: [0, 2, 5], value: 2, upIdx: 2 },
    { indices: [1, 3, 4], value: 7, upIdx: 3 },
    { indices: [1, 2, 4], value: 3, upIdx: 2 },
    { indices: [0, 3, 5], value: 6, upIdx: 3 },
    { indices: [1, 2, 5], value: 4, upIdx: 2 },
    { indices: [0, 3, 4], value: 5, upIdx: 3 },
  ];

  const faces = defs.map((d, idx) =>
    buildFaceFromIndices(idx, d.indices, vertices, String(d.value), d.upIdx)
  );
  const outcomes = faces.map((f, idx) => ({
    value: defs[idx].value,
    upVector: f.normal.clone(),
  }));

  return finalizePolyhedronTemplate('d8', vertices, faces, outcomes);
}

function buildTrapezohedronTemplate(
  kind: 'd10' | 'd10_units' | 'd100'
): PolyhedronTemplate {
  const R = DIE_RADIUS * 1.02;
  const H = DIE_RADIUS * 1.02;
  const cos36 = Math.cos(Math.PI / 5);
  const h = H * ((1 - cos36) / (1 + cos36));

  const vertices: THREE.Vector3[] = [
    new THREE.Vector3(0, H, 0),
    new THREE.Vector3(0, -H, 0),
  ];

  for (let k = 0; k < 5; k++) {
    const theta = (2 * Math.PI * k) / 5;
    vertices.push(
      new THREE.Vector3(R * Math.cos(theta), h, R * Math.sin(theta))
    );
  }
  for (let k = 0; k < 5; k++) {
    const phi = ((2 * k + 1) * Math.PI) / 5;
    vertices.push(
      new THREE.Vector3(R * Math.cos(phi), -h, R * Math.sin(phi))
    );
  }

  const upperValues =
    kind === 'd100' ? [10, 30, 50, 70, 90] : [1, 3, 5, 7, 9];
  const lowerOppositeValues =
    kind === 'd100'
      ? [0, 80, 60, 40, 20]
      : kind === 'd10_units'
        ? [0, 8, 6, 4, 2]
        : [10, 8, 6, 4, 2];

  const lowerValuesByM = [0, 0, 0, 0, 0];
  for (let k = 0; k < 5; k++) {
    const m = (k + 2) % 5;
    lowerValuesByM[m] = lowerOppositeValues[k];
  }

  const formatVal = (v: number): string => {
    if (kind === 'd100') {
      return v === 0 ? '00' : String(v);
    }
    return String(v);
  };

  const faces: PolyFaceDescriptor[] = [];
  const outcomes: PolyOutcomeDescriptor[] = [];

  for (let k = 0; k < 5; k++) {
    const nextK = (k + 1) % 5;
    const rawIdx = [0, 2 + k, 7 + k, 2 + nextK];
    const val = upperValues[k];
    const f = buildFaceFromIndices(
      faces.length,
      rawIdx,
      vertices,
      formatVal(val),
      0
    );
    faces.push(f);
    outcomes.push({ value: val, upVector: f.normal.clone() });
  }

  for (let m = 0; m < 5; m++) {
    const nextM = (m + 1) % 5;
    const rawIdx = [1, 7 + m, 2 + nextM, 7 + nextM];
    const val = lowerValuesByM[m];
    const f = buildFaceFromIndices(
      faces.length,
      rawIdx,
      vertices,
      formatVal(val),
      1
    );
    faces.push(f);
    outcomes.push({ value: val, upVector: f.normal.clone() });
  }

  return finalizePolyhedronTemplate(kind, vertices, faces, outcomes);
}

function buildD12Template(): PolyhedronTemplate {
  const phi = (1 + Math.sqrt(5)) / 2;
  const invPhi = 1 / phi;
  const r = DIE_RADIUS * 0.98;

  const rawVerts: THREE.Vector3[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        rawVerts.push(new THREE.Vector3(sx, sy, sz));
      }
    }
  }
  for (const s1 of [-1, 1]) {
    for (const s2 of [-1, 1]) {
      rawVerts.push(new THREE.Vector3(0, s1 * invPhi, s2 * phi));
      rawVerts.push(new THREE.Vector3(s1 * invPhi, s2 * phi, 0));
      rawVerts.push(new THREE.Vector3(s2 * phi, 0, s1 * invPhi));
    }
  }
  const vertices = rawVerts.map((v) => v.normalize().multiplyScalar(r));

  const positiveDirs = [
    new THREE.Vector3(0, phi, 1),
    new THREE.Vector3(0, phi, -1),
    new THREE.Vector3(phi, 1, 0),
    new THREE.Vector3(phi, -1, 0),
    new THREE.Vector3(1, 0, phi),
    new THREE.Vector3(-1, 0, phi),
  ].map((d) => d.normalize());

  const dirPairs: { dir: THREE.Vector3; value: number }[] = [];
  for (let i = 0; i < 6; i++) {
    dirPairs.push({ dir: positiveDirs[i], value: i + 1 });
    dirPairs.push({ dir: positiveDirs[i].clone().negate(), value: 12 - i });
  }

  const faces: PolyFaceDescriptor[] = [];
  const outcomes: PolyOutcomeDescriptor[] = [];

  for (let i = 0; i < dirPairs.length; i++) {
    const { dir, value } = dirPairs[i];
    const ranked = vertices
      .map((v, vIdx) => ({ vIdx, dot: v.dot(dir) }))
      .sort((a, b) => b.dot - a.dot)
      .slice(0, 5)
      .map((item) => item.vIdx);

    const f = buildFaceFromIndices(i, ranked, vertices, String(value), ranked[0]);
    faces.push(f);
    outcomes.push({ value, upVector: f.normal.clone() });
  }

  return finalizePolyhedronTemplate('d12', vertices, faces, outcomes);
}

function buildD20Template(): PolyhedronTemplate {
  const phi = (1 + Math.sqrt(5)) / 2;
  const invPhi = 1 / phi;
  const r = DIE_RADIUS * 1.02;

  const rawVerts: THREE.Vector3[] = [];
  for (const s1 of [-1, 1]) {
    for (const s2 of [-1, 1]) {
      rawVerts.push(new THREE.Vector3(0, s1 * phi, s2 * 1));
      rawVerts.push(new THREE.Vector3(s1 * phi, s2 * 1, 0));
      rawVerts.push(new THREE.Vector3(s2 * 1, 0, s1 * phi));
    }
  }
  const vertices = rawVerts.map((v) => v.normalize().multiplyScalar(r));

  const positiveDirs: THREE.Vector3[] = [
    new THREE.Vector3(1, 1, 1),
    new THREE.Vector3(1, 1, -1),
    new THREE.Vector3(1, -1, 1),
    new THREE.Vector3(-1, 1, 1),
    new THREE.Vector3(0, invPhi, phi),
    new THREE.Vector3(0, -invPhi, phi),
    new THREE.Vector3(invPhi, phi, 0),
    new THREE.Vector3(-invPhi, phi, 0),
    new THREE.Vector3(phi, 0, invPhi),
    new THREE.Vector3(phi, 0, -invPhi),
  ].map((d) => d.normalize());

  const dirPairs: { dir: THREE.Vector3; value: number }[] = [];
  for (let i = 0; i < 10; i++) {
    dirPairs.push({ dir: positiveDirs[i], value: i + 1 });
    dirPairs.push({ dir: positiveDirs[i].clone().negate(), value: 20 - i });
  }

  const faces: PolyFaceDescriptor[] = [];
  const outcomes: PolyOutcomeDescriptor[] = [];

  for (let i = 0; i < dirPairs.length; i++) {
    const { dir, value } = dirPairs[i];
    const ranked = vertices
      .map((v, vIdx) => ({ vIdx, dot: v.dot(dir) }))
      .sort((a, b) => b.dot - a.dot)
      .slice(0, 3)
      .map((item) => item.vIdx);

    const f = buildFaceFromIndices(i, ranked, vertices, String(value), ranked[0]);
    faces.push(f);
    outcomes.push({ value, upVector: f.normal.clone() });
  }

  return finalizePolyhedronTemplate('d20', vertices, faces, outcomes);
}

export function getPolyhedronTemplate(kind: PhysicalDieMeshKind): PolyhedronTemplate {
  const cached = templateCache.get(kind);
  if (cached) return cached;

  let built: PolyhedronTemplate;
  if (kind === 'd4') {
    built = buildD4Template();
  } else if (kind === 'd6') {
    built = buildD6Template();
  } else if (kind === 'd8') {
    built = buildD8Template();
  } else if (kind === 'd10' || kind === 'd10_units' || kind === 'd100') {
    built = buildTrapezohedronTemplate(kind);
  } else if (kind === 'd12') {
    built = buildD12Template();
  } else {
    built = buildD20Template();
  }

  templateCache.set(kind, built);
  return built;
}

function makeUnitQuaternionBetween(
  from: THREE.Vector3,
  to: THREE.Vector3
): THREE.Quaternion {
  const dot = from.dot(to);
  if (dot < -0.99999) {
    const ortho =
      Math.abs(from.x) < 0.9
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 1, 0);
    const axis = new THREE.Vector3().crossVectors(from, ortho).normalize();
    return new THREE.Quaternion().setFromAxisAngle(axis, Math.PI);
  }
  return new THREE.Quaternion().setFromUnitVectors(from, to);
}

export function computeSymmetryOffsetQuaternion(
  vertices: THREE.Vector3[],
  targetUp: THREE.Vector3,
  landedUp: THREE.Vector3
): THREE.Quaternion {
  const qBase = makeUnitQuaternionBetween(targetUp, landedUp);

  let refVert: THREE.Vector3 | null = null;
  for (const v of vertices) {
    const cosAngle = Math.abs(v.clone().normalize().dot(targetUp));
    if (cosAngle < 0.96) {
      refVert = v;
      break;
    }
  }
  if (!refVert) {
    return qBase;
  }

  const targetDot = refVert.dot(targetUp);
  const refLenSq = refVert.lengthSq();
  const rotatedRef = refVert.clone().applyQuaternion(qBase);
  const projRotRef = rotatedRef
    .clone()
    .addScaledVector(landedUp, -rotatedRef.dot(landedUp));
  if (projRotRef.lengthSq() < 1e-8) {
    return qBase;
  }
  projRotRef.normalize();

  let bestQuat = qBase;
  let bestError = Number.POSITIVE_INFINITY;
  const temp = new THREE.Vector3();

  for (const candVert of vertices) {
    if (Math.abs(candVert.lengthSq() - refLenSq) > 1e-2) continue;
    if (Math.abs(candVert.dot(landedUp) - targetDot) > 1e-2) continue;

    const projCand = candVert
      .clone()
      .addScaledVector(landedUp, -candVert.dot(landedUp));
    if (projCand.lengthSq() < 1e-8) continue;
    projCand.normalize();

    const cross = new THREE.Vector3().crossVectors(projRotRef, projCand);
    const sinA = cross.dot(landedUp);
    const cosA = Math.max(-1, Math.min(1, projRotRef.dot(projCand)));
    const twistAngle = Math.atan2(sinA, cosA);

    const qTwist = new THREE.Quaternion().setFromAxisAngle(landedUp, twistAngle);
    const qCand = qTwist.multiply(qBase);

    let maxVertDistSq = 0;
    for (const v of vertices) {
      temp.copy(v).applyQuaternion(qCand);
      let minDistSq = Number.POSITIVE_INFINITY;
      for (const w of vertices) {
        const dSq = temp.distanceToSquared(w);
        if (dSq < minDistSq) minDistSq = dSq;
      }
      if (minDistSq > maxVertDistSq) {
        maxVertDistSq = minDistSq;
      }
      if (maxVertDistSq >= bestError) break;
    }

    if (maxVertDistSq < bestError) {
      bestError = maxVertDistSq;
      bestQuat = qCand.clone();
      if (bestError < 1e-6) {
        break;
      }
    }
  }

  return bestQuat;
}

function drawMaterialSurface(
  ctx: CanvasRenderingContext2D,
  bumpCtx: CanvasRenderingContext2D,
  size: number,
  material: VttDiceMaterial,
  bodyColor: string
): void {
  const { r, g, b } = parseHexToRgb(bodyColor);

  ctx.fillStyle = rgbCss(r, g, b);
  ctx.fillRect(0, 0, size, size);

  bumpCtx.fillStyle = 'rgb(128, 128, 128)';
  bumpCtx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const bumpImg = bumpCtx.getImageData(0, 0, size, size);
  const data = img.data;
  const bData = bumpImg.data;

  for (let y = 0; y < size; y++) {
    const ny = y / size;
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const idx = (y * size + x) * 4;
      let shade = 0;
      let bumpVal = 128;

      if (material === 'marble') {
        const turb = fbmNoise(nx * 5.5, ny * 5.5);
        const veinRaw = Math.abs(Math.sin((nx * 3.8 + ny * 2.4 + turb * 2.6) * Math.PI));
        const vein = Math.pow(1 - veinRaw, 4.5);
        const subtleCloud = (turb - 0.5) * 26;
        shade = subtleCloud + vein * 62;
        bumpVal = 128 + subtleCloud * 0.4 - vein * 26;
      } else if (material === 'wood') {
        const warp = fbmNoise(nx * 3.2, ny * 3.2) * 0.35;
        const rings = Math.sin((ny * 14 + warp * 8) * Math.PI);
        const fiber = (smoothNoise(nx * 42, ny * 6) - 0.5) * 18;
        shade = rings * 18 + fiber;
        bumpVal = 128 + rings * 14 + fiber * 1.1;
      } else if (material === 'metal') {
        const streak = (smoothNoise(nx * 4, ny * 78) - 0.5) * 24;
        const sheen = Math.sin((nx + ny) * Math.PI) * 14 - 5;
        shade = streak + sheen;
        bumpVal = 128 + streak * 0.9;
      } else if (material === 'gemstone') {
        const dx = nx - 0.5;
        const dy = ny - 0.5;
        const dist = Math.hypot(dx, dy);
        const sparkle = (fbmNoise(nx * 9, ny * 9) - 0.5) * 32;
        shade = (0.36 - dist) * 85 + sparkle;
        bumpVal = 128 + sparkle * 0.35;
      } else if (material === 'matte') {
        const grain = (hash2d(x * 0.7, y * 0.7) - 0.5) * 16;
        const mottle = (fbmNoise(nx * 6, ny * 6) - 0.5) * 18;
        shade = grain + mottle;
        bumpVal = 128 + grain * 1.3 + mottle * 0.6;
      } else {
        const dx = nx - 0.5;
        const dy = ny - 0.5;
        const dist = Math.hypot(dx, dy);
        shade = (0.32 - dist) * 36;
        bumpVal = 128;
      }

      data[idx] = clampByte(r + shade);
      data[idx + 1] = clampByte(g + shade);
      data[idx + 2] = clampByte(b + shade);
      data[idx + 3] = 255;

      const cb = clampByte(bumpVal);
      bData[idx] = cb;
      bData[idx + 1] = cb;
      bData[idx + 2] = cb;
      bData[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);
}

function drawPolygonBevel(
  ctx: CanvasRenderingContext2D,
  bumpCtx: CanvasRenderingContext2D,
  size: number,
  uvs: UvPoint[],
  bodyColor: string
): void {
  if (uvs.length < 3) return;
  const { r, g, b } = parseHexToRgb(bodyColor);

  const tracePoly = (c: CanvasRenderingContext2D) => {
    c.beginPath();
    for (let i = 0; i < uvs.length; i++) {
      const px = uvs[i].u * size;
      const py = (1 - uvs[i].v) * size;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
  };

  ctx.save();
  tracePoly(ctx);
  ctx.lineWidth = size * 0.045;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgbCss(r + 48, g + 48, b + 48, 0.34);
  ctx.stroke();

  tracePoly(ctx);
  ctx.lineWidth = size * 0.016;
  ctx.strokeStyle = rgbCss(r - 42, g - 42, b - 42, 0.45);
  ctx.stroke();
  ctx.restore();

  bumpCtx.save();
  tracePoly(bumpCtx);
  bumpCtx.lineWidth = size * 0.035;
  bumpCtx.lineJoin = 'round';
  bumpCtx.strokeStyle = 'rgb(168, 168, 168)';
  bumpCtx.stroke();
  bumpCtx.restore();
}

function drawEngravedLabel(
  ctx: CanvasRenderingContext2D,
  bumpCtx: CanvasRenderingContext2D,
  label: string,
  cx: number,
  cy: number,
  angleRad: number,
  fontSizePx: number,
  labelColor: string,
  showOrientationBar: boolean
): void {
  if (!label) return;
  const fontSpec = `700 ${Math.round(fontSizePx)}px Cinzel, Georgia, serif`;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angleRad);
  ctx.font = fontSpec;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.lineWidth = Math.max(2, fontSizePx * 0.11);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.strokeText(label, 0, fontSizePx * 0.03);

  ctx.fillStyle = labelColor;
  ctx.fillText(label, 0, 0);

  if (showOrientationBar) {
    const metrics = ctx.measureText(label);
    const barW = Math.max(fontSizePx * 0.36, metrics.width * 0.62);
    const barH = Math.max(2.5, fontSizePx * 0.085);
    const barY = fontSizePx * 0.46;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(-barW / 2, barY + 1.5, barW, barH);
    ctx.fillStyle = labelColor;
    ctx.fillRect(-barW / 2, barY, barW, barH);
  }
  ctx.restore();

  bumpCtx.save();
  bumpCtx.translate(cx, cy);
  bumpCtx.rotate(angleRad);
  bumpCtx.font = fontSpec;
  bumpCtx.textAlign = 'center';
  bumpCtx.textBaseline = 'middle';
  bumpCtx.fillStyle = 'rgb(72, 72, 72)';
  bumpCtx.fillText(label, 0, 0);
  if (showOrientationBar) {
    const barW = fontSizePx * 0.42;
    const barH = Math.max(2.5, fontSizePx * 0.085);
    bumpCtx.fillRect(-barW / 2, fontSizePx * 0.46, barW, barH);
  }
  bumpCtx.restore();
}

function getFaceMaterial(
  kind: PhysicalDieMeshKind,
  face: PolyFaceDescriptor,
  appearance: VttDiceAppearance,
  dropped: boolean
): THREE.MeshPhysicalMaterial {
  const key = `${kind}|${face.faceIndex}|${appearance.material}|${appearance.bodyColor}|${appearance.labelColor}|${dropped ? 1 : 0}`;
  const cached = materialCache.get(key);
  if (cached) return cached;

  if (materialCache.size >= TEXTURE_CACHE_LIMIT) {
    const oldestKey = materialCache.keys().next().value;
    if (oldestKey) {
      const oldMat = materialCache.get(oldestKey);
      oldMat?.map?.dispose();
      oldMat?.bumpMap?.dispose();
      oldMat?.dispose();
      materialCache.delete(oldestKey);
    }
  }

  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;

  const ctx = colorCanvas.getContext('2d');
  const bumpCtx = bumpCanvas.getContext('2d');

  if (ctx && bumpCtx) {
    drawMaterialSurface(
      ctx,
      bumpCtx,
      size,
      appearance.material,
      appearance.bodyColor
    );
    drawPolygonBevel(ctx, bumpCtx, size, face.uvs, appearance.bodyColor);

    if (face.d4CornerLabels && face.d4CornerLabels.length > 0) {
      const fontSize = size * 0.19;
      for (const item of face.d4CornerLabels) {
        const cornerX = item.u * size;
        const cornerY = (1 - item.v) * size;
        const dx = cornerX - size * 0.5;
        const dy = cornerY - size * 0.5;
        const labelX = size * 0.5 + dx * 0.56;
        const labelY = size * 0.5 + dy * 0.56;
        const angle = Math.atan2(dy, dx) + Math.PI / 2;
        drawEngravedLabel(
          ctx,
          bumpCtx,
          item.label,
          labelX,
          labelY,
          angle,
          fontSize,
          appearance.labelColor,
          false
        );
      }
    } else if (face.faceLabel) {
      const len = face.faceLabel.length;
      const baseScale =
        kind === 'd20'
          ? 0.25
          : kind === 'd12'
            ? 0.29
            : kind === 'd10' || kind === 'd10_units' || kind === 'd100'
              ? 0.27
              : kind === 'd8'
                ? 0.31
                : 0.38;
      const fontSize = size * (len >= 2 ? baseScale * 0.84 : baseScale);
      const needsUnderline =
        (face.faceLabel === '6' || face.faceLabel === '9') && kind !== 'd6';
      const yOffset =
        kind === 'd10' || kind === 'd10_units' || kind === 'd100'
          ? size * 0.53
          : size * 0.5;

      drawEngravedLabel(
        ctx,
        bumpCtx,
        face.faceLabel,
        size * 0.5,
        yOffset,
        0,
        fontSize,
        appearance.labelColor,
        needsUnderline
      );
    }
  }

  const mapTex = new THREE.CanvasTexture(colorCanvas);
  mapTex.colorSpace = THREE.SRGBColorSpace;
  mapTex.anisotropy = 4;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.colorSpace = THREE.NoColorSpace;

  const matParams: THREE.MeshPhysicalMaterialParameters = {
    map: mapTex,
    bumpMap: bumpTex,
    bumpScale: 0.035,
    transparent: true,
    opacity: dropped ? 0.58 : 1,
  };

  if (appearance.material === 'metal') {
    matParams.metalness = 0.76;
    matParams.roughness = 0.26;
    matParams.clearcoat = 0.32;
    matParams.clearcoatRoughness = 0.2;
  } else if (appearance.material === 'gemstone') {
    const rgb = parseHexToRgb(appearance.bodyColor);
    matParams.metalness = 0.1;
    matParams.roughness = 0.12;
    matParams.clearcoat = 1.0;
    matParams.clearcoatRoughness = 0.08;
    matParams.emissive = new THREE.Color(
      rgb.r / 255,
      rgb.g / 255,
      rgb.b / 255
    );
    matParams.emissiveIntensity = 0.14;
  } else if (appearance.material === 'marble') {
    matParams.metalness = 0.05;
    matParams.roughness = 0.28;
    matParams.clearcoat = 0.65;
    matParams.clearcoatRoughness = 0.18;
  } else if (appearance.material === 'wood') {
    matParams.metalness = 0.03;
    matParams.roughness = 0.64;
    matParams.clearcoat = 0.16;
    matParams.clearcoatRoughness = 0.42;
  } else if (appearance.material === 'matte') {
    matParams.metalness = 0.02;
    matParams.roughness = 0.84;
    matParams.clearcoat = 0.0;
  } else {
    matParams.metalness = 0.06;
    matParams.roughness = 0.2;
    matParams.clearcoat = 0.88;
    matParams.clearcoatRoughness = 0.1;
  }

  const mat = new THREE.MeshPhysicalMaterial(matParams);
  materialCache.set(key, mat);
  return mat;
}

function buildPhysicsWorldWithBounds(
  halfWidth: number,
  halfHeight: number
): {
  world: CANNON.World;
  dieMaterial: CANNON.Material;
} {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -34, 0),
  });
  world.allowSleep = false;

  const floorMaterial = new CANNON.Material('floor');
  const wallMaterial = new CANNON.Material('wall');
  const dieMaterial = new CANNON.Material('die');

  world.addContactMaterial(
    new CANNON.ContactMaterial(floorMaterial, dieMaterial, {
      friction: 0.34,
      restitution: 0.42,
    })
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(wallMaterial, dieMaterial, {
      friction: 0.04,
      restitution: 0.58,
    })
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(dieMaterial, dieMaterial, {
      friction: 0.2,
      restitution: 0.52,
    })
  );

  const floorBody = new CANNON.Body({
    mass: 0,
    material: floorMaterial,
    shape: new CANNON.Plane(),
  });
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floorBody);

  const insetX = Math.max(2.4, halfWidth - 1.05);
  const insetZ = Math.max(2.0, halfHeight - 1.05);

  const wallDefs: { pos: [number, number, number]; euler: [number, number, number] }[] = [
    { pos: [-insetX, 0, 0], euler: [0, Math.PI / 2, 0] },
    { pos: [insetX, 0, 0], euler: [0, -Math.PI / 2, 0] },
    { pos: [0, 0, -insetZ], euler: [0, 0, 0] },
    { pos: [0, 0, insetZ], euler: [Math.PI, 0, 0] },
  ];

  for (const w of wallDefs) {
    const wb = new CANNON.Body({
      mass: 0,
      material: wallMaterial,
      shape: new CANNON.Plane(),
    });
    wb.position.set(w.pos[0], w.pos[1], w.pos[2]);
    wb.quaternion.setFromEuler(w.euler[0], w.euler[1], w.euler[2]);
    world.addBody(wb);
  }

  return { world, dieMaterial };
}

function generateInitialStates(
  specs: VttPhysicalDieRoll[],
  halfWidth: number,
  halfHeight: number,
  seed: number
): {
  pos: CANNON.Vec3;
  vel: CANNON.Vec3;
  angVel: CANNON.Vec3;
  quat: CANNON.Quaternion;
}[] {
  const rng = mulberry32(seed);
  const side = Math.floor(rng() * 4);
  const boundX = Math.max(2.1, halfWidth - 1.85);
  const boundZ = Math.max(1.8, halfHeight - 1.85);

  let originX = 0;
  let originZ = 0;
  if (side === 0) {
    originX = -boundX * 0.88;
    originZ = (rng() - 0.5) * boundZ * 0.9;
  } else if (side === 1) {
    originX = boundX * 0.88;
    originZ = (rng() - 0.5) * boundZ * 0.9;
  } else if (side === 2) {
    originX = (rng() - 0.5) * boundX * 0.9;
    originZ = boundZ * 0.86;
  } else {
    originX = (rng() - 0.5) * boundX * 0.9;
    originZ = -boundZ * 0.86;
  }

  const cols = Math.max(1, Math.ceil(Math.sqrt(specs.length)));
  const spacing = DIE_RADIUS * 2.15;

  return specs.map((_, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const jitterX = (col - (cols - 1) / 2) * spacing * 0.65 + (rng() - 0.5) * 0.4;
    const jitterZ = (row - (cols - 1) / 2) * spacing * 0.65 + (rng() - 0.5) * 0.4;

    const px = Math.max(-boundX, Math.min(boundX, originX + jitterX));
    const pz = Math.max(-boundZ, Math.min(boundZ, originZ + jitterZ));
    const py = 3.2 + row * 0.85 + rng() * 1.1;

    const targetX = (rng() - 0.5) * boundX * 0.55;
    const targetZ = (rng() - 0.5) * boundZ * 0.55;
    const dirX = targetX - px;
    const dirZ = targetZ - pz;
    const dist = Math.max(0.5, Math.hypot(dirX, dirZ));
    const speed = 12.5 + rng() * 6.5;

    const vx = (dirX / dist) * speed + (rng() - 0.5) * 2.4;
    const vz = (dirZ / dist) * speed + (rng() - 0.5) * 2.4;
    const vy = -1.5 - rng() * 2.5;

    const angVel = new CANNON.Vec3(
      (rng() - 0.5) * 34,
      (rng() - 0.5) * 34,
      (rng() - 0.5) * 34
    );
    if (angVel.length() < 12) {
      angVel.scale(14 / Math.max(1, angVel.length()), angVel);
    }

    const euler = new THREE.Euler(
      rng() * Math.PI * 2,
      rng() * Math.PI * 2,
      rng() * Math.PI * 2
    );
    const tq = new THREE.Quaternion().setFromEuler(euler);

    return {
      pos: new CANNON.Vec3(px, py, pz),
      vel: new CANNON.Vec3(vx, vy, vz),
      angVel,
      quat: new CANNON.Quaternion(tq.x, tq.y, tq.z, tq.w),
    };
  });
}

export function preSimulateDeterministicThrow(
  specs: VttPhysicalDieRoll[],
  halfWidth: number,
  halfHeight: number,
  baseSeed: number
): PreSimResult {
  const templates = specs.map((s) => getPolyhedronTemplate(s.kind));
  let chosenResult: PreSimResult | null = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    const attemptSeed = (baseSeed + attempt * 7919) >>> 0;
    const initialStates = generateInitialStates(
      specs,
      halfWidth,
      halfHeight,
      attemptSeed
    );
    const { world, dieMaterial } = buildPhysicsWorldWithBounds(
      halfWidth,
      halfHeight
    );

    const bodies = specs.map((_, idx) => {
      const init = initialStates[idx];
      const body = new CANNON.Body({
        mass: 1.2,
        material: dieMaterial,
        shape: templates[idx].cannonShape,
        linearDamping: 0.14,
        angularDamping: 0.16,
      });
      body.position.copy(init.pos);
      body.velocity.copy(init.vel);
      body.angularVelocity.copy(init.angVel);
      body.quaternion.copy(init.quat);
      world.addBody(body);
      return body;
    });

    let quietFrames = 0;
    let settledStep = MAX_PRESIM_STEPS;

    for (let step = 1; step <= MAX_PRESIM_STEPS; step++) {
      world.step(FIXED_DT);

      if (step > 35) {
        let allQuiet = true;
        for (const b of bodies) {
          if (
            b.velocity.lengthSquared() > 0.015 ||
            b.angularVelocity.lengthSquared() > 0.025 ||
            b.position.y > DIE_RADIUS * 1.45
          ) {
            allQuiet = false;
            break;
          }
        }
        if (allQuiet) {
          quietFrames++;
          if (quietFrames >= 10) {
            settledStep = step;
            break;
          }
        } else {
          quietFrames = 0;
        }
      }
    }

    const worldUp = new THREE.Vector3(0, 1, 0);
    let anyCocked = false;

    const finalStates = bodies.map((body, idx) => {
      const tpl = templates[idx];
      const spec = specs[idx];
      const finalQuat = new THREE.Quaternion(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w
      ).normalize();
      const invFinal = finalQuat.clone().invert();
      const localUp = worldUp.clone().applyQuaternion(invFinal).normalize();

      let bestOutcome = tpl.outcomes[0];
      let bestDot = -2;
      for (const out of tpl.outcomes) {
        const d = out.upVector.dot(localUp);
        if (d > bestDot) {
          bestDot = d;
          bestOutcome = out;
        }
      }

      if (bestDot < 0.9) {
        anyCocked = true;
      }

      const targetOutcome =
        tpl.outcomes.find((o) => o.value === spec.targetValue) ?? tpl.outcomes[0];

      const symmetryQuat = computeSymmetryOffsetQuaternion(
        tpl.vertices,
        targetOutcome.upVector,
        bestOutcome.upVector
      );

      return {
        pos: new THREE.Vector3(
          body.position.x,
          body.position.y,
          body.position.z
        ),
        quat: finalQuat,
        symmetryQuat,
      };
    });

    chosenResult = {
      settledStep,
      initialStates,
      finalStates,
    };

    if (!anyCocked) {
      break;
    }
  }

  return chosenResult!;
}

function buildStudioEnvironment(renderer: THREE.WebGLRenderer): {
  envTexture: THREE.Texture;
  pmremTarget: THREE.WebGLRenderTarget;
} {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x162422);

  const warmPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 18),
    new THREE.MeshBasicMaterial({ color: 0xffdcb8 })
  );
  warmPanel.position.set(8, 14, -6);
  warmPanel.lookAt(0, 0, 0);
  envScene.add(warmPanel);

  const coolPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshBasicMaterial({ color: 0xbae6fd })
  );
  coolPanel.position.set(-10, 12, 8);
  coolPanel.lookAt(0, 0, 0);
  envScene.add(coolPanel);

  const rimPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 8),
    new THREE.MeshBasicMaterial({ color: 0xfb923c })
  );
  rimPanel.position.set(0, 6, -14);
  rimPanel.lookAt(0, 0, 0);
  envScene.add(rimPanel);

  const pmremTarget = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  warmPanel.geometry.dispose();
  (warmPanel.material as THREE.Material).dispose();
  coolPanel.geometry.dispose();
  (coolPanel.material as THREE.Material).dispose();
  rimPanel.geometry.dispose();
  (rimPanel.material as THREE.Material).dispose();

  return {
    envTexture: pmremTarget.texture,
    pmremTarget,
  };
}

export class Dice3dStage {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly pmremTarget: THREE.WebGLRenderTarget;
  private readonly diceGroup = new THREE.Group();

  private world: CANNON.World | null = null;
  private actors: ActiveDieActor[] = [];
  private activeAppearanceMaterial: VttDiceMaterial = 'metal';

  private rafId: number | null = null;
  private lastTimestamp = 0;
  private accumulator = 0;
  private currentStep = 0;
  private settledStep = 0;
  private postSettleElapsed = 0;
  private lastSoundTimeMs = 0;

  private halfWidth = 8;
  private halfHeight = 5.5;
  private readonly cameraHeight = 22;
  private readonly fovDeg = 30;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly callbacks: {
      onImpactSound?: (intensity: number, material: VttDiceMaterial) => void;
      onFadeChange?: (opacity: number) => void;
      onThrowComplete?: () => void;
    } = {}
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    const { envTexture, pmremTarget } = buildStudioEnvironment(this.renderer);
    this.pmremTarget = pmremTarget;
    this.scene.environment = envTexture;

    this.camera = new THREE.PerspectiveCamera(this.fovDeg, 1.6, 1, 60);
    this.camera.position.set(0, this.cameraHeight, 0);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xf8fafc, 0x0d1615, 0.85);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.2);
    keyLight.position.set(6, 24, -5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 6;
    keyLight.shadow.camera.far = 36;
    keyLight.shadow.camera.left = -16;
    keyLight.shadow.camera.right = 16;
    keyLight.shadow.camera.top = 16;
    keyLight.shadow.camera.bottom = -16;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.9);
    rimLight.position.set(-9, 14, 7);
    this.scene.add(rimLight);

    const shadowFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 48),
      new THREE.ShadowMaterial({ opacity: 0.4 })
    );
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.position.y = 0.002;
    shadowFloor.receiveShadow = true;
    this.scene.add(shadowFloor);

    this.scene.add(this.diceGroup);
  }

  resize(width: number, height: number): void {
    const safeW = Math.max(1, Math.floor(width));
    const safeH = Math.max(1, Math.floor(height));
    const dpr =
      typeof window !== 'undefined'
        ? Math.min(2, window.devicePixelRatio || 1)
        : 1;

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(safeW, safeH, false);

    const aspect = safeW / safeH;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    const halfFovRad = (this.fovDeg * Math.PI) / 360;
    this.halfHeight = this.cameraHeight * Math.tan(halfFovRad);
    this.halfWidth = this.halfHeight * aspect;
  }

  playThrow(payload: VttDiceThrowPayload): void {
    this.stopAnimationLoop();
    this.clearCurrentActors();

    if (!payload.dice || payload.dice.length === 0) return;

    this.activeAppearanceMaterial = payload.appearance.material;
    const preSim = preSimulateDeterministicThrow(
      payload.dice,
      this.halfWidth,
      this.halfHeight,
      payload.seed || 1
    );

    const { world, dieMaterial } = buildPhysicsWorldWithBounds(
      this.halfWidth,
      this.halfHeight
    );
    this.world = world;
    this.settledStep = preSim.settledStep;
    this.currentStep = 0;
    this.accumulator = 0;
    this.postSettleElapsed = 0;
    this.lastTimestamp = 0;

    this.actors = payload.dice.map((spec, idx) => {
      const tpl = getPolyhedronTemplate(spec.kind);
      const init = preSim.initialStates[idx];
      const fin = preSim.finalStates[idx];

      const body = new CANNON.Body({
        mass: 1.2,
        material: dieMaterial,
        shape: tpl.cannonShape,
        linearDamping: 0.14,
        angularDamping: 0.16,
      });
      body.position.copy(init.pos);
      body.velocity.copy(init.vel);
      body.angularVelocity.copy(init.angVel);
      body.quaternion.copy(init.quat);

      body.addEventListener('collide', (ev: { contact?: CANNON.ContactEquation }) => {
        const nowMs = performance.now();
        if (nowMs - this.lastSoundTimeMs < 36) return;
        const impactVel = Math.abs(
          ev.contact?.getImpactVelocityAlongNormal?.() ?? 0
        );
        if (impactVel < 1.35) return;
        this.lastSoundTimeMs = nowMs;
        const strength = Math.min(1, impactVel / 15);
        this.callbacks.onImpactSound?.(strength, this.activeAppearanceMaterial);
      });

      world.addBody(body);

      const faceMaterials = tpl.faces.map((f) =>
        getFaceMaterial(spec.kind, f, payload.appearance, Boolean(spec.dropped))
      );
      const mesh = new THREE.Mesh(tpl.geometry, faceMaterials);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(init.pos.x, init.pos.y, init.pos.z);
      mesh.quaternion
        .set(init.quat.x, init.quat.y, init.quat.z, init.quat.w)
        .multiply(fin.symmetryQuat);

      this.diceGroup.add(mesh);

      return {
        body,
        mesh,
        symmetryQuat: fin.symmetryQuat,
        finalPos: fin.pos,
        finalQuat: fin.quat,
        dropped: Boolean(spec.dropped),
      };
    });

    this.callbacks.onFadeChange?.(1);
    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.tickFrame);
  }

  private readonly tickFrame = (timestamp: number): void => {
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
    }
    const rawDelta = Math.min(0.08, Math.max(0, (timestamp - this.lastTimestamp) / 1000));
    this.lastTimestamp = timestamp;

    if (this.currentStep < this.settledStep && this.world) {
      this.accumulator += rawDelta;
      while (
        this.accumulator >= FIXED_DT &&
        this.currentStep < this.settledStep
      ) {
        this.world.step(FIXED_DT);
        this.currentStep++;
        this.accumulator -= FIXED_DT;
      }

      if (this.currentStep >= this.settledStep) {
        for (const actor of this.actors) {
          actor.mesh.position.copy(actor.finalPos);
          actor.mesh.quaternion
            .copy(actor.finalQuat)
            .multiply(actor.symmetryQuat);
        }
      } else {
        for (const actor of this.actors) {
          const b = actor.body;
          actor.mesh.position.set(b.position.x, b.position.y, b.position.z);
          actor.mesh.quaternion
            .set(
              b.quaternion.x,
              b.quaternion.y,
              b.quaternion.z,
              b.quaternion.w
            )
            .multiply(actor.symmetryQuat);
        }
      }
      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(this.tickFrame);
      return;
    }

    this.postSettleElapsed += rawDelta;
    if (this.postSettleElapsed < HOLD_DURATION_SEC) {
      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(this.tickFrame);
      return;
    }

    const fadeProgress = Math.min(
      1,
      (this.postSettleElapsed - HOLD_DURATION_SEC) / FADE_DURATION_SEC
    );
    const opacity = 1 - fadeProgress;
    this.callbacks.onFadeChange?.(opacity);
    this.renderer.render(this.scene, this.camera);

    if (fadeProgress >= 1) {
      this.stopAnimationLoop();
      this.clearCurrentActors();
      this.renderer.clear();
      this.callbacks.onThrowComplete?.();
      return;
    }

    this.rafId = requestAnimationFrame(this.tickFrame);
  };

  clear(): void {
    this.stopAnimationLoop();
    this.clearCurrentActors();
    this.renderer.clear();
    this.callbacks.onFadeChange?.(0);
  }

  dispose(): void {
    this.stopAnimationLoop();
    this.clearCurrentActors();
    this.pmremTarget.dispose();
    this.renderer.dispose();
  }

  private stopAnimationLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private clearCurrentActors(): void {
    for (const actor of this.actors) {
      this.diceGroup.remove(actor.mesh);
    }
    this.actors = [];
    this.world = null;
  }
}
