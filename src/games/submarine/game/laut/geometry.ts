// ============================================================================
// MODE "DUNIA LAUT 3D" — geometry helpers
// * conversion of the PENYELAM procedural meshes (Mesh / EntityMesh) to three.js
// * relief meshes: a signed-distance silhouette extruded into a rounded 3D rock
// ============================================================================
import * as THREE from "three";
import type { RockSDF } from "../ocean";

// ---------------------------------------------------------------- tiny deterministic helpers
export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ihash(x: number, y: number, s: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function vnoise(x: number, y: number, s = 0) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  let fx = x - xi,
    fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = ihash(xi, yi, s),
    b = ihash(xi + 1, yi, s),
    c = ihash(xi, yi + 1, s),
    d = ihash(xi + 1, yi + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function fbm(x: number, y: number, s = 0, oct = 3) {
  let v = 0,
    a = 0.5,
    f = 1,
    n = 0;
  for (let i = 0; i < oct; i++) {
    v += a * vnoise(x * f, y * f, s + i * 17);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return v / n;
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- PENYELAM Mesh -> BufferGeometry
export interface PBuf {
  vb: ArrayBuffer;
  ib: Uint32Array;
  nv: number;
}

/** 16 byte/vertex solid meshes: float32x3 position, snorm8x3 normal, snorm8 aux (base->tip) */
export function solidToGeometry(b: PBuf): THREE.BufferGeometry {
  const f = new Float32Array(b.vb),
    s = new Int8Array(b.vb);
  const pos = new Float32Array(b.nv * 3),
    nor = new Float32Array(b.nv * 3),
    aux = new Float32Array(b.nv);
  for (let k = 0; k < b.nv; k++) {
    pos[k * 3] = f[k * 4];
    pos[k * 3 + 1] = f[k * 4 + 1];
    pos[k * 3 + 2] = f[k * 4 + 2];
    nor[k * 3] = s[k * 16 + 12] / 127;
    nor[k * 3 + 1] = s[k * 16 + 13] / 127;
    nor[k * 3 + 2] = s[k * 16 + 14] / 127;
    aux[k] = Math.max(0, s[k * 16 + 15] / 127);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("aux", new THREE.BufferAttribute(aux, 1));
  g.setIndex(new THREE.BufferAttribute(b.ib, 1));
  return g;
}

/** centre on x/z, rest on y=0 and scale so the height becomes 1 (width keeps its ratio) */
export function normalizeGeo(g: THREE.BufferGeometry, mode: "height" | "radius" = "height") {
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const cx = (bb.min.x + bb.max.x) / 2,
    cz = (bb.min.z + bb.max.z) / 2;
  const h = bb.max.y - bb.min.y;
  const r = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2;
  g.translate(-cx, mode === "height" ? -bb.min.y : -(bb.min.y + bb.max.y) / 2, -cz);
  const sc = 1 / (mode === "height" ? h : r || 1);
  g.scale(sc, sc, sc);
  g.computeBoundingSphere();
  return g;
}

/** a few waving kelp blades, height 1 (aux = height along the blade) */
export function kelpGeometry() {
  const pos: number[] = [],
    nor: number[] = [],
    aux: number[] = [],
    idx: number[] = [];
  const blades = [
    { lean: -0.14, len: 0.92, ph: 0, w: 0.06 },
    { lean: 0.03, len: 1.0, ph: 2.1, w: 0.07 },
    { lean: 0.16, len: 0.8, ph: 4.2, w: 0.055 },
  ];
  const seg = 14;
  for (const b of blades) {
    const base = pos.length / 3;
    for (let k = 0; k <= seg; k++) {
      const t = k / seg;
      const x = b.lean * t * t + Math.sin(t * 4.2 + b.ph) * 0.035 * t;
      const y = t * b.len;
      const z = Math.cos(t * 3.1 + b.ph) * 0.025 * t;
      const hw = b.w * (1 - 0.8 * Math.pow(t, 1.15)) * (0.85 + 0.15 * Math.sin(t * 22 + b.ph));
      pos.push(x - hw, y, z, x + hw, y, z);
      nor.push(0, 0, 1, 0, 0, 1);
      aux.push(t, t);
      if (k < seg) {
        const a = base + k * 2;
        idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("aux", new THREE.Float32BufferAttribute(aux, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** add the attributes the rock shader expects to a plain boulder geometry (instanced chunks) */
export function asRockChunk(g: THREE.BufferGeometry) {
  const n = g.getAttribute("position").count;
  const sdf = new Float32Array(n * 2).fill(-80);
  g.setAttribute("aSdf", new THREE.BufferAttribute(sdf, 2));
  g.setAttribute("aLip", new THREE.BufferAttribute(new Float32Array(n), 1));
  return g;
}

/** a new geometry object that shares the GPU buffers of `base` (so per-batch instance attributes can differ) */
export function sharedGeo(base: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry();
  g.setIndex(base.index);
  for (const k of Object.keys(base.attributes)) g.setAttribute(k, base.attributes[k]);
  g.boundingSphere = base.boundingSphere ? base.boundingSphere.clone() : null;
  return g;
}

// ---------------------------------------------------------------- EntityMesh (20 byte/vertex) -> BufferGeometry subsets
export type Palette = (mat: number) => [number, number, number, number, number]; // r,g,b,emissive,metal

export function entityGeometry(b: PBuf, keep: (mat: number, part: number) => boolean, pal: Palette) {
  const dv = new DataView(b.vb);
  const remap = new Int32Array(b.nv).fill(-1);
  const idx: number[] = [];
  const used: number[] = [];
  for (let t = 0; t < b.ib.length; t += 3) {
    const a = b.ib[t];
    const mat = dv.getUint8(a * 20 + 16),
      part = dv.getUint8(a * 20 + 17);
    if (!keep(mat, part)) continue;
    for (let k = 0; k < 3; k++) {
      const v = b.ib[t + k];
      if (remap[v] < 0) {
        remap[v] = used.length;
        used.push(v);
      }
      idx.push(remap[v]);
    }
  }
  const n = used.length;
  const pos = new Float32Array(n * 3),
    nor = new Float32Array(n * 3),
    col = new Float32Array(n * 3),
    emi = new Float32Array(n),
    met = new Float32Array(n),
    ao = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = used[i],
      o = v * 20;
    pos[i * 3] = dv.getFloat32(o, true);
    pos[i * 3 + 1] = dv.getFloat32(o + 4, true);
    pos[i * 3 + 2] = dv.getFloat32(o + 8, true);
    nor[i * 3] = dv.getInt8(o + 12) / 127;
    nor[i * 3 + 1] = dv.getInt8(o + 13) / 127;
    nor[i * 3 + 2] = dv.getInt8(o + 14) / 127;
    ao[i] = Math.max(0, dv.getInt8(o + 15) / 127);
    const p = pal(dv.getUint8(o + 16));
    col[i * 3] = p[0];
    col[i * 3 + 1] = p[1];
    col[i * 3 + 2] = p[2];
    emi[i] = p[3];
    met[i] = p[4];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("aCol", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aEmi", new THREE.BufferAttribute(emi, 1));
  g.setAttribute("aMet", new THREE.BufferAttribute(met, 1));
  g.setAttribute("aAO", new THREE.BufferAttribute(ao, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** paint a plain three geometry with constant lit-material attributes */
export function paintLit(g: THREE.BufferGeometry, rgb: [number, number, number], emi = 0, met = 0, ao = 1) {
  g.deleteAttribute("uv");
  const n = g.getAttribute("position").count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = rgb[0];
    col[i * 3 + 1] = rgb[1];
    col[i * 3 + 2] = rgb[2];
  }
  g.setAttribute("aCol", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aEmi", new THREE.BufferAttribute(new Float32Array(n).fill(emi), 1));
  g.setAttribute("aMet", new THREE.BufferAttribute(new Float32Array(n).fill(met), 1));
  g.setAttribute("aAO", new THREE.BufferAttribute(new Float32Array(n).fill(ao), 1));
  return g;
}

// ---------------------------------------------------------------- relief meshes
export function sampleSdf(sdf: RockSDF, ox: number, oy: number, wx: number, wy: number) {
  const gx = (wx - ox + sdf.pad) / sdf.step,
    gy = (wy - oy + sdf.pad) / sdf.step;
  if (gx < 0 || gx > sdf.sw - 1 || gy < 0 || gy > sdf.sh - 1) return 999;
  const cx = Math.max(0, Math.min(sdf.sw - 1.0001, gx)),
    cy = Math.max(0, Math.min(sdf.sh - 1.0001, gy));
  const x0 = cx | 0,
    y0 = cy | 0,
    fx = cx - x0,
    fy = cy - y0;
  const i = y0 * sdf.sw + x0;
  const a = sdf.data[i],
    b = sdf.data[i + 1],
    c = sdf.data[i + sdf.sw],
    d = sdf.data[i + sdf.sw + 1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export interface ReliefSpec {
  x0: number; // world position of grid vertex (0,0)
  y0: number;
  step: number;
  nx: number;
  ny: number;
  S: Float32Array; // signed distance of the silhouette (negative inside)
  C?: Float32Array; // signed distance with the cave carved out (positive in the hollow)
  zMax: number; // how far the surface bulges towards the camera
  zR: number; // distance over which the bulge rounds off
  amp: number; // cragginess (world units)
  seed: number;
  caveZ?: number;
  lipW?: number;
  noiseFreq?: number;
}
export interface Relief {
  geo: THREE.BufferGeometry;
  zAt: (wx: number, wy: number) => number;
  cx: number;
  cy: number;
}

export function buildRelief(sp: ReliefSpec): Relief {
  const { nx, ny, step, S, C } = sp;
  const N = nx * ny;
  const z = new Float32Array(N);
  const nf = sp.noiseFreq ?? 0.03;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const d = -S[k];
      if (d <= 0) {
        z[k] = 0;
        continue;
      }
      const u = Math.min(d / sp.zR, 1);
      const base = sp.zMax * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)));
      const wx = sp.x0 + i * step,
        wy = sp.y0 + j * step;
      const nz = (fbm(wx * nf + sp.seed, wy * nf - sp.seed, sp.seed | 0, 3) - 0.5) * 2 * sp.amp * Math.min(1, d / 10);
      let zz = base + nz;
      if (C) {
        const hf = smooth(0, 16, -C[k]);
        zz = (sp.caveZ ?? 2) * (1 - hf) + zz * hf;
      }
      z[k] = zz;
    }
  }

  // which cells need triangles (silhouette cells included so the feathered edge is complete)
  const cellOn = new Uint8Array((nx - 1) * (ny - 1));
  const vOn = new Uint8Array(N);
  const idx: number[] = [];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const m = Math.min(S[a], S[a + 1], S[a + nx], S[a + nx + 1]);
      if (m > step * 1.6) continue;
      cellOn[j * (nx - 1) + i] = 1;
      vOn[a] = vOn[a + 1] = vOn[a + nx] = vOn[a + nx + 1] = 1;
      idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
    }
  }
  // compact the vertex set
  const remap = new Int32Array(N).fill(-1);
  let n = 0;
  for (let k = 0; k < N; k++) if (vOn[k]) remap[k] = n++;

  // cave lip mask: distance from the hollow, solid cells only
  let lip: Float32Array | null = null;
  if (C) {
    const D = new Float32Array(N).fill(1e9);
    for (let k = 0; k < N; k++) if (S[k] < 0 && C[k] > 0) D[k] = 0;
    const dg = step * 1.4142;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        let v = D[k];
        if (i > 0) v = Math.min(v, D[k - 1] + step);
        if (j > 0) {
          v = Math.min(v, D[k - nx] + step);
          if (i > 0) v = Math.min(v, D[k - nx - 1] + dg);
          if (i < nx - 1) v = Math.min(v, D[k - nx + 1] + dg);
        }
        D[k] = v;
      }
    for (let j = ny - 1; j >= 0; j--)
      for (let i = nx - 1; i >= 0; i--) {
        const k = j * nx + i;
        let v = D[k];
        if (i < nx - 1) v = Math.min(v, D[k + 1] + step);
        if (j < ny - 1) {
          v = Math.min(v, D[k + nx] + step);
          if (i < nx - 1) v = Math.min(v, D[k + nx + 1] + dg);
          if (i > 0) v = Math.min(v, D[k + nx - 1] + dg);
        }
        D[k] = v;
      }
    lip = new Float32Array(N);
    const lw = sp.lipW ?? 20;
    for (let k = 0; k < N; k++) lip[k] = S[k] < 0 && !(C[k] > 0) ? Math.max(0, Math.min(1, 1 - D[k] / lw)) : 0;
  }

  const pos = new Float32Array(n * 3),
    nor = new Float32Array(n * 3),
    sdf = new Float32Array(n * 2),
    lp = new Float32Array(n);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i,
        r = remap[k];
      if (r < 0) continue;
      pos[r * 3] = sp.x0 + i * step;
      pos[r * 3 + 1] = -(sp.y0 + j * step);
      pos[r * 3 + 2] = z[k];
      const il = Math.max(0, i - 1),
        ir = Math.min(nx - 1, i + 1),
        ju = Math.max(0, j - 1),
        jd = Math.min(ny - 1, j + 1);
      const gx = (z[j * nx + ir] - z[j * nx + il]) / ((ir - il) * step);
      const gy = (z[jd * nx + i] - z[ju * nx + i]) / ((jd - ju) * step);
      let nxx = -gx,
        nyy = gy,
        nzz = 1;
      const l = Math.hypot(nxx, nyy, nzz);
      nor[r * 3] = nxx / l;
      nor[r * 3 + 1] = nyy / l;
      nor[r * 3 + 2] = nzz / l;
      sdf[r * 2] = S[k];
      sdf[r * 2 + 1] = C ? C[k] : -1000;
      lp[r] = lip ? lip[k] : 0;
    }
  }
  const remIdx = new Uint32Array(idx.length);
  for (let t = 0; t < idx.length; t++) remIdx[t] = remap[idx[t]];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  geo.setAttribute("aSdf", new THREE.BufferAttribute(sdf, 2));
  geo.setAttribute("aLip", new THREE.BufferAttribute(lp, 1));
  geo.setIndex(new THREE.BufferAttribute(remIdx, 1));
  geo.computeBoundingSphere();

  const zAt = (wx: number, wy: number) => {
    const gx = (wx - sp.x0) / step,
      gy = (wy - sp.y0) / step;
    if (gx < 0 || gy < 0 || gx > nx - 1.001 || gy > ny - 1.001) return 0;
    const x0 = gx | 0,
      y0 = gy | 0,
      fx = gx - x0,
      fy = gy - y0;
    const k = y0 * nx + x0;
    const a = z[k],
      b = z[k + 1],
      c = z[k + nx],
      d = z[k + nx + 1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  return { geo, zAt, cx: sp.x0 + (nx * step) / 2, cy: sp.y0 + (ny * step) / 2 };
}

/** instance matrix from a plain TRS (rotation about z first = tilt, then y = turn) */
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
export function composeTRS(
  out: THREE.Matrix4,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  tilt: number,
  turn: number
) {
  _e.set(0, turn, tilt, "ZYX");
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  out.compose(_p, _q, _s);
  return out;
}
export { _m as tmpMatrix };
