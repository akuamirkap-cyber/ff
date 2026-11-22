// ============================================================================
// math + procedural helpers (100% matching Noniv/abyssal-garden + entity mesh)
// ============================================================================
export const { sin, cos, sqrt, min, max, abs, floor, PI, pow, atan2, hypot, exp, round } = Math;
export const TAU = PI * 2;

let _seed = 20261110;
export const rnd = () => {
  _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const rr = (a, b) => a + (b - a) * rnd();
// each generator system starts its own random stream, so the systems stay independent
export const rseed = (s) => { _seed = (20261110 + Math.imul(s, 7919)) | 0; };

// Independent RNG stream for divers/bots/submarine so original world RNG is 100% untouched
let _eseed = 18701943;
export const ernd = () => {
  _eseed = (_eseed + 0x6D2B79F5) | 0;
  let t = Math.imul(_eseed ^ (_eseed >>> 15), 1 | _eseed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const err = (a, b) => a + (b - a) * ernd();

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const mix = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
export const fract = (x) => x - floor(x);
export const wrapAngle = (a) => {
  while (a > PI) a -= TAU;
  while (a < -PI) a += TAU;
  return a;
};

export const ihash = (x, y, z) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const vnoise = (x, y, z) => {
  const ix = floor(x), iy = floor(y), iz = floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const a = mix(mix(ihash(ix, iy, iz), ihash(ix + 1, iy, iz), fx), mix(ihash(ix, iy + 1, iz), ihash(ix + 1, iy + 1, iz), fx), fy);
  const b = mix(mix(ihash(ix, iy, iz + 1), ihash(ix + 1, iy, iz + 1), fx), mix(ihash(ix, iy + 1, iz + 1), ihash(ix + 1, iy + 1, iz + 1), fx), fy);
  return mix(a, b, fz);
};
export const fbm = (x, y, z, o = 4) => {
  let a = 0.5, s = 0;
  for (let i = 0; i < o; i++) { s += a * vnoise(x, y, z); x = x * 2.03 + 17.1; y = y * 2.03 + 31.7; z = z * 2.03 + 5.3; a *= 0.5; }
  return s / (1 - 2 * a);
};

// quaternion helpers
export const qAxis = (x, y, z, a) => { const l = hypot(x, y, z) || 1, s = sin(a / 2) / l; return [x * s, y * s, z * s, cos(a / 2)]; };
export const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
export const qRot = (q, x, y, z) => {
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
  return [
    x + qw * tx + (qy * tz - qz * ty),
    y + qw * ty + (qz * tx - qx * tz),
    z + qw * tz + (qx * ty - qy * tx),
  ];
};
export const qRand = () => { const q = [rr(-1, 1), rr(-1, 1), rr(-1, 1), rr(-1, 1)]; const l = hypot(...q) || 1; return q.map((v) => v / l); };
export const qFromY = (nx, ny, nz) => {
  if (ny < -0.9999) return [1, 0, 0, 0];
  const q = [nz, 0, -nx, 1 + ny]; const l = hypot(...q); return q.map((v) => v / l);
};

// Keep the original horizontal resolution while doubling the playable water column.
// A taller voxel would exceed WebGPU's common 128 MB storage-buffer binding limit.
export const NX = 512, NY = 80, NZ = 512, VS = 0.75, VY = 1.5, OX = -192, OY = -116, OZ = -192;
export const MIN_DIVE_Y = OY + VY * 4;
export const CELLS = 16, CELLW = 24;
export const NCHUNK = 7;

// ---------------------------------------------------------------- naive surface nets
export function surfaceNets(D, nx, ny, nz) {
  let pos = new Float32Array(1 << 20), nv = 0;
  let idx = new Uint32Array(1 << 21), ni = 0;
  const sl = nx * ny;
  let cur = new Int32Array(sl), prev = new Int32Array(sl);
  for (let z = 0; z < nz - 1; z++) {
    for (let y = 0; y < ny - 1; y++) {
      let i0 = nx * (y + ny * z);
      for (let x = 0; x < nx - 1; x++, i0++) {
        const d0 = D[i0], d1 = D[i0 + 1], d2 = D[i0 + nx], d3 = D[i0 + nx + 1];
        const d4 = D[i0 + sl], d5 = D[i0 + sl + 1], d6 = D[i0 + sl + nx], d7 = D[i0 + sl + nx + 1];
        const m = (d0 > 0) | ((d1 > 0) << 1) | ((d2 > 0) << 2) | ((d3 > 0) << 3) | ((d4 > 0) << 4) | ((d5 > 0) << 5) | ((d6 > 0) << 6) | ((d7 > 0) << 7);
        if (m === 0 || m === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0, t;
        if ((d0 > 0) !== (d1 > 0)) { t = d0 / (d0 - d1); sx += t; n++; }
        if ((d2 > 0) !== (d3 > 0)) { t = d2 / (d2 - d3); sx += t; sy += 1; n++; }
        if ((d4 > 0) !== (d5 > 0)) { t = d4 / (d4 - d5); sx += t; sz += 1; n++; }
        if ((d6 > 0) !== (d7 > 0)) { t = d6 / (d6 - d7); sx += t; sy += 1; sz += 1; n++; }
        if ((d0 > 0) !== (d2 > 0)) { t = d0 / (d0 - d2); sy += t; n++; }
        if ((d1 > 0) !== (d3 > 0)) { t = d1 / (d1 - d3); sy += t; sx += 1; n++; }
        if ((d4 > 0) !== (d6 > 0)) { t = d4 / (d4 - d6); sy += t; sz += 1; n++; }
        if ((d5 > 0) !== (d7 > 0)) { t = d5 / (d5 - d7); sy += t; sx += 1; sz += 1; n++; }
        if ((d0 > 0) !== (d4 > 0)) { t = d0 / (d0 - d4); sz += t; n++; }
        if ((d1 > 0) !== (d5 > 0)) { t = d1 / (d1 - d5); sz += t; sx += 1; n++; }
        if ((d2 > 0) !== (d6 > 0)) { t = d2 / (d2 - d6); sz += t; sy += 1; n++; }
        if ((d3 > 0) !== (d7 > 0)) { t = d3 / (d3 - d7); sz += t; sx += 1; sy += 1; n++; }
        if (nv * 3 + 3 > pos.length) { const p2 = new Float32Array(pos.length * 2); p2.set(pos); pos = p2; }
        const vi = nv++;
        pos[vi * 3] = x + sx / n; pos[vi * 3 + 1] = y + sy / n; pos[vi * 3 + 2] = z + sz / n;
        const ci = x + nx * y;
        cur[ci] = vi;
        if (ni + 18 > idx.length) { const i2 = new Uint32Array(idx.length * 2); i2.set(idx); idx = i2; }
        const s0 = d0 > 0;
        let a, b, c, d;
        if ((d1 > 0) !== s0 && y > 0 && z > 0) {
          a = vi; b = cur[ci - nx]; c = prev[ci - nx]; d = prev[ci];
          if (s0) { idx[ni++] = a; idx[ni++] = b; idx[ni++] = c; idx[ni++] = a; idx[ni++] = c; idx[ni++] = d; }
          else { idx[ni++] = a; idx[ni++] = c; idx[ni++] = b; idx[ni++] = a; idx[ni++] = d; idx[ni++] = c; }
        }
        if ((d2 > 0) !== s0 && x > 0 && z > 0) {
          a = vi; b = prev[ci]; c = prev[ci - 1]; d = cur[ci - 1];
          if (s0) { idx[ni++] = a; idx[ni++] = b; idx[ni++] = c; idx[ni++] = a; idx[ni++] = c; idx[ni++] = d; }
          else { idx[ni++] = a; idx[ni++] = c; idx[ni++] = b; idx[ni++] = a; idx[ni++] = d; idx[ni++] = c; }
        }
        if ((d4 > 0) !== s0 && x > 0 && y > 0) {
          a = vi; b = cur[ci - 1]; c = cur[ci - 1 - nx]; d = cur[ci - nx];
          if (s0) { idx[ni++] = a; idx[ni++] = b; idx[ni++] = c; idx[ni++] = a; idx[ni++] = c; idx[ni++] = d; }
          else { idx[ni++] = a; idx[ni++] = c; idx[ni++] = b; idx[ni++] = a; idx[ni++] = d; idx[ni++] = c; }
        }
      }
    }
    const tmp = cur; cur = prev; prev = tmp;
  }
  return { pos: pos.subarray(0, nv * 3), idx: idx.subarray(0, ni), nv, ni };
}

export const sampler3 = (D, nx, ny, nz) => (x, y, z) => {
  x = clamp(x, 0, nx - 1.001); y = clamp(y, 0, ny - 1.001); z = clamp(z, 0, nz - 1.001);
  const ix = x | 0, iy = y | 0, iz = z | 0, fx = x - ix, fy = y - iy, fz = z - iz;
  const i = ix + nx * (iy + ny * iz), sl = nx * ny;
  const a = mix(mix(D[i], D[i + 1], fx), mix(D[i + nx], D[i + nx + 1], fx), fy);
  const b = mix(mix(D[i + sl], D[i + sl + 1], fx), mix(D[i + sl + nx], D[i + sl + nx + 1], fx), fy);
  return mix(a, b, fz);
};

// ---------------------------------------------------------------- solid mesh builder (16 bytes/vertex)
export class Mesh {
  constructor() { this.p = []; this.i = []; this.aux = []; }
  v(x, y, z, aux = 1) { this.p.push(x, y, z); this.aux.push(aux); return this.p.length / 3 - 1; }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  sweep(pts, w, h, upFn, caps = true) {
    const rings = [];
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k], a = pts[max(k - 1, 0)], b = pts[min(k + 1, pts.length - 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2]; const tl = hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      const u0 = upFn ? upFn(p, k) : [0, 1, 0];
      let sx = u0[1] * tz - u0[2] * ty, sy = u0[2] * tx - u0[0] * tz, sz = u0[0] * ty - u0[1] * tx; const sl = hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
      const ux = ty * sz - tz * sy, uy = tz * sx - tx * sz, uz = tx * sy - ty * sx;
      const ww = typeof w === 'function' ? w(k) : w, hh = typeof h === 'function' ? h(k) : h;
      const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([e, f]) => [p[0] + sx * e * ww / 2 + ux * f * hh / 2, p[1] + sy * e * ww / 2 + uy * f * hh / 2, p[2] + sz * e * ww / 2 + uz * f * hh / 2]);
      const r = [];
      for (let s = 0; s < 4; s++) { r.push(this.v(...c[s]), this.v(...c[(s + 1) % 4])); }
      rings.push(r);
      if (caps && (k === 0 || k === pts.length - 1)) {
        const q = c.map((cc) => this.v(...cc));
        if (k === 0) this.quad(q[0], q[1], q[2], q[3]); else this.quad(q[3], q[2], q[1], q[0]);
      }
    }
    for (let k = 0; k < rings.length - 1; k++) for (let s = 0; s < 4; s++) {
      const a = rings[k][s * 2], b = rings[k][s * 2 + 1], c = rings[k + 1][s * 2 + 1], d = rings[k + 1][s * 2];
      this.quad(a, d, c, b);
    }
  }
  tube(pts, rad, sides = 6, capEnd = true, auxFn = null) {
    const rings = [];
    let ux = 0.31, uy = 0.9, uz = 0.3;
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k], a = pts[max(k - 1, 0)], b = pts[min(k + 1, pts.length - 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2]; const tl = hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let sx = uy * tz - uz * ty, sy = uz * tx - ux * tz, sz = ux * ty - uy * tx; const sl = hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
      ux = ty * sz - tz * sy; uy = tz * sx - tx * sz; uz = tx * sy - ty * sx;
      const r = typeof rad === 'function' ? rad(k) : rad, ring = [];
      for (let s = 0; s < sides; s++) { const an = s / sides * TAU; ring.push(this.v(p[0] + (sx * cos(an) + ux * sin(an)) * r, p[1] + (sy * cos(an) + uy * sin(an)) * r, p[2] + (sz * cos(an) + uz * sin(an)) * r, auxFn ? auxFn(k) : min(1, 0.35 + 0.65 * k / (pts.length - 1)))); }
      rings.push(ring);
    }
    for (let k = 0; k < rings.length - 1; k++) for (let s = 0; s < sides; s++) {
      const s2 = (s + 1) % sides; this.quad(rings[k][s], rings[k][s2], rings[k + 1][s2], rings[k + 1][s]);
    }
    if (capEnd) { const e = pts[pts.length - 1], c = this.v(e[0], e[1], e[2], auxFn ? auxFn(pts.length - 1) : 1); const r = rings[rings.length - 1]; for (let s = 0; s < sides; s++) this.tri(r[s], r[(s + 1) % sides], c); }
  }
  build(nrmFn) {
    const n = this.p.length / 3, P = this.p, I = this.i, N = new Float32Array(n * 3);
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const k of [a, b, c]) { N[k] += nx; N[k + 1] += ny; N[k + 2] += nz; }
    }
    const vb = new ArrayBuffer(n * 16), f = new Float32Array(vb), s = new Int8Array(vb);
    for (let k = 0; k < n; k++) {
      let nx = N[k * 3], ny = N[k * 3 + 1], nz = N[k * 3 + 2];
      if (nrmFn) { const q = nrmFn(P[k * 3], P[k * 3 + 1], P[k * 3 + 2], nx, ny, nz); nx = q[0]; ny = q[1]; nz = q[2]; }
      const l = hypot(nx, ny, nz) || 1;
      f[k * 4] = P[k * 3]; f[k * 4 + 1] = P[k * 3 + 1]; f[k * 4 + 2] = P[k * 3 + 2];
      s[k * 16 + 12] = round(nx / l * 127); s[k * 16 + 13] = round(ny / l * 127); s[k * 16 + 14] = round(nz / l * 127); s[k * 16 + 15] = round(clamp(this.aux[k], -1, 1) * 127);
    }
    return { vb, ib: new Uint32Array(I), nv: n };
  }
}

export function icosphere(sub, fn) {
  const m = new Mesh(), t = (1 + sqrt(5)) / 2;
  let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((v) => { const l = hypot(...v); return v.map((c) => c / l); });
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < sub; s++) {
    const cache = new Map(), F2 = [];
    const mid = (a, b) => {
      const key = a < b ? a * 65536 + b : b * 65536 + a;
      let r = cache.get(key);
      if (r === undefined) { const p = [0, 1, 2].map((k) => V[a][k] + V[b][k]); const l = hypot(...p); V.push(p.map((c) => c / l)); r = V.length - 1; cache.set(key, r); }
      return r;
    };
    for (const [a, b, c] of F) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); F2.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    F = F2;
  }
  for (const v of V) { const p = fn ? fn(v[0], v[1], v[2]) : v; m.v(p[0], p[1], p[2]); }
  for (const f of F) m.tri(f[0], f[1], f[2]);
  return m;
}

// ---------------------------------------------------------------- entity mesh builder (20 bytes/vertex)
// Vertex format: float32x3 pos (0), snorm8x4 normal+ao (12), unorm8x4 mat,part,u,v (16)
export class EntityMesh {
  constructor() {
    this.p = [];
    this.i = [];
    this.ao = [];
    this.meta = [];
    this.curMat = 0;
    this.curPart = 0;
    this.curU = 0;
    this.curV = 0;
  }
  tag(mat, part, u = 0, v = 0) {
    this.curMat = mat;
    this.curPart = part;
    this.curU = u;
    this.curV = v;
    return this;
  }
  v(x, y, z, ao = 1, u = this.curU, v = this.curV) {
    this.p.push(x, y, z);
    this.ao.push(ao);
    this.meta.push(this.curMat, this.curPart, round(clamp(u, 0, 1) * 255), round(clamp(v, 0, 1) * 255));
    return this.p.length / 3 - 1;
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }

  // UV ellipsoid with outward normals
  ellipsoid(cx, cy, cz, rx, ry, rz, segU = 18, segV = 12, q = null, aoFn = null, vMin = 0, vMax = 1) {
    const rings = [];
    for (let j = 0; j <= segV; j++) {
      const tv = mix(vMin, vMax, j / segV);
      const ph = tv * PI;
      const sp = sin(ph), cp = cos(ph);
      const ring = [];
      for (let s = 0; s <= segU; s++) {
        const tu = s / segU;
        const th = tu * TAU;
        let lx = rx * sp * cos(th), ly = ry * cp, lz = rz * sp * sin(th);
        if (q) [lx, ly, lz] = qRot(q, lx, ly, lz);
        const ao = aoFn ? aoFn(tv, tu) : 1;
        ring.push(this.v(cx + lx, cy + ly, cz + lz, ao, tu, tv));
      }
      rings.push(ring);
    }
    for (let j = 0; j < segV; j++) {
      for (let s = 0; s < segU; s++) {
        // Outward winding: (th increases from +X toward +Z, ph increases from +Y to -Y)
        this.quad(rings[j][s], rings[j][s + 1], rings[j + 1][s + 1], rings[j + 1][s]);
      }
    }
  }

  // Lathe along an axis ('x', 'y', or 'z'): prof = [[radius, pos, ao?], ...]
  lathe(cx, cy, cz, prof, seg = 18, axis = 'y', scaleB = 1, q = null) {
    const rings = [];
    for (let k = 0; k < prof.length; k++) {
      const r = prof[k][0], h = prof[k][1], ao = prof[k][2] ?? 1;
      const tv = k / max(1, prof.length - 1);
      const ring = [];
      for (let s = 0; s <= seg; s++) {
        const tu = s / seg, a = tu * TAU;
        const ca = cos(a) * r, sa = sin(a) * r * scaleB;
        let lx, ly, lz;
        if (axis === 'y') { lx = ca; ly = h; lz = sa; }
        else if (axis === 'z') { lx = ca; ly = sa; lz = h; }
        else { lx = h; ly = ca; lz = sa; }
        if (q) [lx, ly, lz] = qRot(q, lx, ly, lz);
        ring.push(this.v(cx + lx, cy + ly, cz + lz, ao, tu, tv));
      }
      rings.push(ring);
    }
    for (let k = 0; k < rings.length - 1; k++) {
      for (let s = 0; s < seg; s++) {
        // Check outward normal for increasing h:
        if (axis === 'y') {
          this.quad(rings[k][s], rings[k + 1][s], rings[k + 1][s + 1], rings[k][s + 1]);
        } else {
          this.quad(rings[k][s], rings[k][s + 1], rings[k + 1][s + 1], rings[k + 1][s]);
        }
      }
    }
  }

  // Cylinder between two 3D points with end radii r0, r1 and optional caps
  cyl(ax, ay, az, bx, by, bz, r0, r1 = r0, seg = 12, caps = true, scaleB = 1) {
    let tx = bx - ax, ty = by - ay, tz = bz - az;
    const tl = hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    const ref = abs(ty) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let sx = ref[1] * tz - ref[2] * ty, sy = ref[2] * tx - ref[0] * tz, sz = ref[0] * ty - ref[1] * tx;
    const sl = hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
    const ux = ty * sz - tz * sy, uy = tz * sx - tx * sz, uz = tx * sy - ty * sx;
    const rA = [], rB = [];
    for (let s = 0; s <= seg; s++) {
      const tu = s / seg, an = tu * TAU, ca = cos(an), sa = sin(an) * scaleB;
      const ox = sx * ca + ux * sa, oy = sy * ca + uy * sa, oz = sz * ca + uz * sa;
      rA.push(this.v(ax + ox * r0, ay + oy * r0, az + oz * r0, 0.9, tu, 0));
      rB.push(this.v(bx + ox * r1, by + oy * r1, bz + oz * r1, 0.95, tu, 1));
    }
    for (let s = 0; s < seg; s++) this.quad(rA[s], rA[s + 1], rB[s + 1], rB[s]);
    if (caps && r0 > 1e-4) {
      const c0 = this.v(ax, ay, az, 0.85, 0.5, 0);
      const cap = [];
      for (let s = 0; s <= seg; s++) {
        const an = s / seg * TAU, ca = cos(an), sa = sin(an) * scaleB;
        cap.push(this.v(ax + (sx * ca + ux * sa) * r0, ay + (sy * ca + uy * sa) * r0, az + (sz * ca + uz * sa) * r0, 0.85, 0.5, 0));
      }
      for (let s = 0; s < seg; s++) this.tri(c0, cap[s + 1], cap[s]);
    }
    if (caps && r1 > 1e-4) {
      const c1 = this.v(bx, by, bz, 0.95, 0.5, 1);
      const cap = [];
      for (let s = 0; s <= seg; s++) {
        const an = s / seg * TAU, ca = cos(an), sa = sin(an) * scaleB;
        cap.push(this.v(bx + (sx * ca + ux * sa) * r1, by + (sy * ca + uy * sa) * r1, bz + (sz * ca + uz * sa) * r1, 0.95, 0.5, 1));
      }
      for (let s = 0; s < seg; s++) this.tri(c1, cap[s], cap[s + 1]);
    }
  }

  // Smooth tube along polyline
  tube(pts, rad, seg = 10, caps = true) {
    const rings = [];
    let ux = 0, uy = 1, uz = 0;
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k], a = pts[max(k - 1, 0)], b = pts[min(k + 1, pts.length - 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
      const tl = hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      if (k === 0 && abs(ty) > 0.92) { ux = 1; uy = 0; uz = 0; }
      let sx = uy * tz - uz * ty, sy = uz * tx - ux * tz, sz = ux * ty - uy * tx;
      const sl = hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
      ux = ty * sz - tz * sy; uy = tz * sx - tx * sz; uz = tx * sy - ty * sx;
      const r = typeof rad === 'function' ? rad(k / max(1, pts.length - 1), k) : rad;
      const tv = k / max(1, pts.length - 1);
      const ring = [];
      for (let s = 0; s <= seg; s++) {
        const tu = s / seg, an = tu * TAU, ca = cos(an) * r, sa = sin(an) * r;
        ring.push(this.v(p[0] + sx * ca + ux * sa, p[1] + sy * ca + uy * sa, p[2] + sz * ca + uz * sa, 0.92, tu, tv));
      }
      rings.push(ring);
    }
    for (let k = 0; k < rings.length - 1; k++) {
      for (let s = 0; s < seg; s++) this.quad(rings[k][s], rings[k][s + 1], rings[k + 1][s + 1], rings[k + 1][s]);
    }
    if (caps) {
      const p0 = pts[0], c0 = this.v(p0[0], p0[1], p0[2], 0.85, 0.5, 0);
      for (let s = 0; s < seg; s++) this.tri(c0, rings[0][s + 1], rings[0][s]);
      const p1 = pts[pts.length - 1], c1 = this.v(p1[0], p1[1], p1[2], 0.95, 0.5, 1);
      const rl = rings[rings.length - 1];
      for (let s = 0; s < seg; s++) this.tri(c1, rl[s], rl[s + 1]);
    }
  }

  // Torus ring centered at (cx,cy,cz), lying perpendicular to axis ('y' or 'z' or 'x')
  torus(cx, cy, cz, R, r, segMaj = 20, segMin = 10, axis = 'z', q = null, arc = TAU) {
    const rings = [];
    for (let i = 0; i <= segMaj; i++) {
      const tu = i / segMaj, A = tu * arc;
      const cA = cos(A), sA = sin(A);
      const ring = [];
      for (let j = 0; j <= segMin; j++) {
        const tv = j / segMin, B = tv * TAU;
        const rr0 = R + r * cos(B), zz = r * sin(B);
        let lx, ly, lz;
        if (axis === 'z') { lx = rr0 * cA; ly = rr0 * sA; lz = zz; }
        else if (axis === 'y') { lx = rr0 * cA; ly = zz; lz = rr0 * sA; }
        else { lx = zz; ly = rr0 * cA; lz = rr0 * sA; }
        if (q) [lx, ly, lz] = qRot(q, lx, ly, lz);
        ring.push(this.v(cx + lx, cy + ly, cz + lz, 0.92, tu, tv));
      }
      rings.push(ring);
    }
    for (let i = 0; i < segMaj; i++) {
      for (let j = 0; j < segMin; j++) {
        if (axis === 'y') this.quad(rings[i][j], rings[i][j + 1], rings[i + 1][j + 1], rings[i + 1][j]);
        else this.quad(rings[i][j], rings[i + 1][j], rings[i + 1][j + 1], rings[i][j + 1]);
      }
    }
  }

  // Hard-edged box centered at (cx,cy,cz) with half-extents (hx,hy,hz) and optional rotation q
  box(cx, cy, cz, hx, hy, hz, q = null, ao = 0.92) {
    const faces = [
      [[hx, -hy, -hz], [hx, -hy, hz], [hx, hy, hz], [hx, hy, -hz]],
      [[-hx, -hy, hz], [-hx, -hy, -hz], [-hx, hy, -hz], [-hx, hy, hz]],
      [[-hx, hy, -hz], [hx, hy, -hz], [hx, hy, hz], [-hx, hy, hz]],
      [[-hx, -hy, hz], [hx, -hy, hz], [hx, -hy, -hz], [-hx, -hy, -hz]],
      [[-hx, -hy, hz], [-hx, hy, hz], [hx, hy, hz], [hx, -hy, hz]],
      [[hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz], [-hx, -hy, -hz]],
    ];
    for (const fc of faces) {
      const idx = fc.map(([x, y, z], k) => {
        if (q) [x, y, z] = qRot(q, x, y, z);
        return this.v(cx + x, cy + y, cz + z, ao, k & 1, k >> 1);
      });
      this.quad(idx[3], idx[2], idx[1], idx[0]);
    }
  }

  build() {
    const n = this.p.length / 3, P = this.p, I = this.i, N = new Float32Array(n * 3);
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      N[a] += nx; N[a + 1] += ny; N[a + 2] += nz;
      N[b] += nx; N[b + 1] += ny; N[b + 2] += nz;
      N[c] += nx; N[c + 1] += ny; N[c + 2] += nz;
    }
    const vb = new ArrayBuffer(n * 20), dv = new DataView(vb);
    for (let k = 0; k < n; k++) {
      const nx = N[k * 3], ny = N[k * 3 + 1], nz = N[k * 3 + 2];
      const l = hypot(nx, ny, nz) || 1;
      const off = k * 20;
      dv.setFloat32(off, P[k * 3], true);
      dv.setFloat32(off + 4, P[k * 3 + 1], true);
      dv.setFloat32(off + 8, P[k * 3 + 2], true);
      dv.setInt8(off + 12, round(nx / l * 127));
      dv.setInt8(off + 13, round(ny / l * 127));
      dv.setInt8(off + 14, round(nz / l * 127));
      dv.setInt8(off + 15, round(clamp(this.ao[k], -1, 1) * 127));
      dv.setUint8(off + 16, this.meta[k * 4] & 255);
      dv.setUint8(off + 17, this.meta[k * 4 + 1] & 255);
      dv.setUint8(off + 18, this.meta[k * 4 + 2] & 255);
      dv.setUint8(off + 19, this.meta[k * 4 + 3] & 255);
    }
    return { vb, ib: new Uint32Array(I), nv: n };
  }
}
