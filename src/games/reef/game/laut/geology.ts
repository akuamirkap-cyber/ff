import * as T from "three";
import type { Formation } from "../ocean";
import { floorY } from "../ocean";
import { surfaceNets, sampler3 } from "../penyelam/math.js";
import { mulberry32, sampleSdf, fbm } from "./geometry";

const TAU = Math.PI * 2;
const sat = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = sat(v);
  return t * t * (3 - 2 * t);
};
export type SurfaceHit = {
  point: T.Vector3;
  normal: T.Vector3;
  support: string;
};

/** Sample the actual rendered triangles, not a height estimate or a bounding box. */
export class BedSurface {
  private bins = new Map<string, number[]>();
  private facets: number[][] = [];
  constructor(
    geometry: T.BufferGeometry,
    matrix: T.Matrix4,
    readonly name: string,
    private step = 22,
  ) {
    const p = geometry.getAttribute("position"),
      idx = geometry.index!;
    const a = new T.Vector3(),
      b = new T.Vector3(),
      c = new T.Vector3();
    const normal = new T.Vector3(),
      edge = new T.Vector3(),
      edge2 = new T.Vector3();
    for (let t = 0; t < idx.count; t += 3) {
      a.fromBufferAttribute(p, idx.getX(t)).applyMatrix4(matrix);
      b.fromBufferAttribute(p, idx.getX(t + 1)).applyMatrix4(matrix);
      c.fromBufferAttribute(p, idx.getX(t + 2)).applyMatrix4(matrix);
      normal
        .crossVectors(edge.subVectors(b, a), edge2.subVectors(c, a))
        .normalize();
      if (normal.y < 0.055) continue;
      const den = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      if (Math.abs(den) < 0.0001) continue;
      const id = this.facets.length;
      this.facets.push([
        a.x,
        a.y,
        a.z,
        b.x,
        b.y,
        b.z,
        c.x,
        c.y,
        c.z,
        1 / den,
        normal.x,
        normal.y,
        normal.z,
      ]);
      for (
        let x = Math.floor(Math.min(a.x, b.x, c.x) / step);
        x <= Math.floor(Math.max(a.x, b.x, c.x) / step);
        x++
      ) {
        for (
          let z = Math.floor(Math.min(a.z, b.z, c.z) / step);
          z <= Math.floor(Math.max(a.z, b.z, c.z) / step);
          z++
        ) {
          const key = `${x}:${z}`,
            bin = this.bins.get(key);
          if (bin) bin.push(id);
          else this.bins.set(key, [id]);
        }
      }
    }
  }
  top(x: number, z: number): SurfaceHit | null {
    let best = -Infinity,
      triangle: number[] | undefined;
    const bin = this.bins.get(
      `${Math.floor(x / this.step)}:${Math.floor(z / this.step)}`,
    );
    if (!bin) return null;
    for (const i of bin) {
      const f = this.facets[i],
        dx = x - f[6],
        dz = z - f[8];
      const u = ((f[5] - f[8]) * dx + (f[6] - f[3]) * dz) * f[9],
        v = ((f[8] - f[2]) * dx + (f[0] - f[6]) * dz) * f[9];
      const w = 1 - u - v;
      if (Math.min(u, v, w) < -0.00001) continue;
      const y = u * f[1] + v * f[4] + w * f[7];
      if (y > best) {
        best = y;
        triangle = f;
      }
    }
    return triangle
      ? {
          point: new T.Vector3(x, best, z),
          normal: new T.Vector3(triangle[10], triangle[11], triangle[12]),
          support: this.name,
        }
      : null;
  }
}

export function geologicalGeometry(
  pos: number[] | Float32Array,
  indices: number[] | Uint32Array,
) {
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setIndex(new T.Uint32BufferAttribute(indices, 1));
  g.computeVertexNormals();
  const n = g.attributes.position.count;
  g.setAttribute(
    "aShelter",
    new T.Float32BufferAttribute(new Float32Array(n), 1),
  );
  g.setAttribute("aLip", new T.Float32BufferAttribute(new Float32Array(n), 1));
  g.setAttribute("aMouth", new T.Float32BufferAttribute(new Float32Array(n), 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

export function makeLimestoneCrown(f: Formation) {
  const cx = f.x + f.cxl,
    cy = f.y + f.cyl,
    halfZ = f.rx * 0.48;
  const rng = mulberry32(f.seed),
    ph = rng() * TAU,
    shear = rng() > 0.5 ? 1 : -1;
  const dx = 4.8,
    dy = 4.1,
    dz = 5.7;
  const nx = Math.ceil((f.w + 18) / dx) + 1,
    ny = Math.ceil((f.h + 24) / dy) + 1,
    nz = Math.ceil((halfZ * 2.32 + 16) / dz) + 1;
  const x0 = f.x - 9,
    y0 = -(f.y + f.h + 12),
    z0 = -nz * dz * 0.5;
  const field = new Float32Array(nx * ny * nz);
  // The z=0 cross-section remains the game's collision field. Both faces taper
  // into the water; the cavity has a recessed back wall and an actual ceiling.
  for (let k = 0; k < nz; k++) {
    const z = z0 + k * dz,
      t = z / halfZ,
      at = Math.abs(t);
    const taper = Math.sqrt(Math.max(0.0002, 1 - t * t));
    for (let j = 0; j < ny; j++) {
      const wy = -(y0 + j * dy),
        yy = cy + (wy - cy) / Math.max(0.055, taper) ** 0.74;
      const ledge = Math.sin(wy * 0.102 + ph + z * 0.014) * 0.5 + 0.5;
      for (let i = 0; i < nx; i++) {
        const n = i + nx * (j + ny * k);
        if (
          at >= 1 ||
          i === 0 ||
          j === 0 ||
          i === nx - 1 ||
          j === ny - 1 ||
          k === 0 ||
          k === nz - 1
        ) {
          field[n] = -8;
          continue;
        }
        const x = x0 + i * dx;
        const xx =
          cx +
          (x - cx) / Math.max(0.055, taper ** 0.68) +
          at * shear * (8 + ledge * 9);
        const stepped =
          yy +
          at *
            (4.5 * Math.sin(x * 0.032 + z * 0.017 + ph) +
              4.0 * Math.sin(z * 0.07 + ph) +
              ledge * 3.0);
        const solid = sampleSdf(f.sdfSolid, f.x, f.y, xx, stepped);
        const cavity = sampleSdf(f.sdfCave, f.x, f.y, xx, stepped);
        const carved = solid + (cavity - solid) * smooth((t + 0.83) / 0.29);
        const fracture =
          (fbm(x * 0.025 + z * 0.009, wy * 0.031 - z * 0.016, f.seed, 2) -
            0.48) *
          14;
        field[n] = -carved * taper + at * fracture;
      }
    }
  }
  const net = surfaceNets(field, nx, ny, nz),
    read = sampler3(field, nx, ny, nz);
  const positions = new Float32Array(net.nv * 3),
    normals = new Float32Array(positions.length),
    lip = new Float32Array(net.nv),
    mouth = new Float32Array(net.nv);
  const normal = new T.Vector3();
  for (let i = 0; i < net.nv; i++) {
    const n = i * 3,
      gx = net.pos[n],
      gy = net.pos[n + 1],
      gz = net.pos[n + 2];
    const x = x0 + gx * dx,
      y = y0 + gy * dy,
      z = z0 + gz * dz;
    positions.set([x, y, z], n);
    normal
      .set(
        (read(gx - 0.65, gy, gz) - read(gx + 0.65, gy, gz)) / dx,
        (read(gx, gy - 0.65, gz) - read(gx, gy + 0.65, gz)) / dy,
        (read(gx, gy, gz - 0.65) - read(gx, gy, gz + 0.65)) / dz,
      )
      .normalize();
    normals.set([normal.x, normal.y, normal.z], n);
    const s = sampleSdf(f.sdfSolid, f.x, f.y, x, -y),
      c = sampleSdf(f.sdfCave, f.x, f.y, x, -y);
    lip[i] =
      smooth((-s - 1) / 10) *
      smooth((c - s) / 7) *
      smooth((18 + c) / 18) *
      smooth(z / 9) *
      smooth((2 - c) / 4);
    if (f.cave) {
      const mouthX=(x-f.cave.x)/(f.cave.rx*.91);
      const mouthY=(-y-f.cave.y)/(f.cave.ry*1.32);
      const contour=Math.abs(Math.hypot(mouthX,mouthY)-1);
      const rough=fbm(x*.087+z*.013,-y*.095,f.seed,2);
      mouth[i]=(1-smooth((contour-.045)/(.17+.05*rough)))*smooth((z+halfZ*.10)/(halfZ*.58))*(.53+.47*rough);
    }
  }
  const g = geologicalGeometry(positions, new Uint32Array(net.idx));
  g.setAttribute("normal", new T.BufferAttribute(normals, 3));
  g.setAttribute("aLip", new T.BufferAttribute(lip, 1));
  g.setAttribute("aMouth", new T.BufferAttribute(mouth, 1));
  g.userData.volume = true;
  g.userData.seed = f.seed;
  return { geometry: g, halfZ };
}

export function makeButtresses(f: Formation) {
  const rng = mulberry32(f.colSeed + 509),
    cx = f.x + f.cxl,
    cy = f.y + f.cyl;
  const pos: number[] = [],
    idx: number[] = [];
  for (let arm = 0; arm < 3; arm++) {
    const side = arm === 0 ? 0 : arm === 1 ? -1 : 1,
      s = arm === 0 ? 1 : 0.54 + rng() * 0.19;
    const top = cy + f.ry * (0.07 + Math.abs(side) * 0.27),
      bottom = floorY(cx) + 48;
    const rings = Math.ceil((bottom - top) / 17),
      cols = 26,
      ph = rng() * TAU,
      start = pos.length / 3;
    for (let j = 0; j <= rings; j++) {
      const t = j / rings,
        wy = top + (bottom - top) * t;
      const toe = smooth((t - 0.69) / 0.31),
        neck = 1 - 0.23 * Math.sin(Math.PI * t);
      const ox =
        cx +
        side * f.rx * (0.32 + 0.29 * t) +
        Math.sin(t * 6.1 + ph) * f.rx * 0.085 * t;
      const oz = -f.rx * (0.36 + 0.36 * t) - 24 * side;
      const rx = f.rx * (0.72 + 0.32 * t + 0.35 * toe) * s * neck;
      const rz = f.rx * (0.31 + 0.25 * t + 0.15 * toe) * s;
      for (let i = 0; i < cols; i++) {
        const a = (i / cols) * TAU;
        const stratum =
          3.6 * Math.sin(wy * 0.095 + Math.sin(a * 2 + ph) * 0.9) +
          2.4 * Math.tanh(Math.sin(wy * 0.041 + ph) * 4);
        const flutes =
          0.91 +
          0.1 * Math.sin(a * 3 + ph + t * 4) +
          0.072 * Math.sin(a * 7 + wy * 0.006) +
          0.055 * Math.sin(wy * 0.028 + a * 2);
        pos.push(
          ox + Math.cos(a) * (rx * flutes + stratum),
          -wy + Math.sin(a + ph) * 3.4,
          oz + Math.sin(a) * (rz * flutes + stratum * 0.6),
        );
        if (j < rings) {
          const l = start + j * cols + i,
            r = start + j * cols + ((i + 1) % cols);
          idx.push(l, r, l + cols, r, r + cols, l + cols);
        }
      }
    }
    const upper = pos.length / 3;
    pos.push(cx + side * f.rx * 0.32, -top, -f.rx * 0.36 - 24 * side);
    const lower = pos.length / 3;
    pos.push(cx + side * f.rx * 0.61, -bottom, -f.rx * 0.72 - 24 * side);
    for (let i = 0; i < cols; i++) {
      idx.push(upper, start + ((i + 1) % cols), start + i);
      idx.push(
        lower,
        start + rings * cols + i,
        start + rings * cols + ((i + 1) % cols),
      );
    }
  }
  const geo = geologicalGeometry(pos, idx);
  geo.userData.volume = true;
  geo.userData.buttresses = 3;
  return geo;
}

export function sandHeight(x: number, z: number) {
  const back = Math.max(0, -z),
    near = Math.max(0, z);
  const variance = fbm(x * 0.008, z * 0.01, 136, 3) - 0.5;
  const channel = Math.exp(-(((z + 88 + Math.sin(x * 0.0038) * 49) / 70) ** 2));
  return (
    -floorY(x) -
    near * 0.55 +
    back * 0.15 +
    (1 - Math.exp(-Math.abs(z) * 0.028)) *
      (variance * 23 - channel * 8 + Math.sin(x * 0.045 + z * 0.082) * 1.7)
  );
}

export function makeSandTerrace(left: number, right: number) {
  const nx = Math.ceil((right - left) / 8),
    nz = 34,
    pos: number[] = [],
    idx: number[] = [];
  // A tilted, continuous sediment surface has a visible back, middle and near shore.
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const x = left + (i / nx) * (right - left),
        z = -370 + (j / nz) * 710;
      pos.push(x, sandHeight(x, z), z);
      if (i < nx && j < nz) {
        const k = i + j * (nx + 1);
        idx.push(k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2);
      }
    }
  const geo = geologicalGeometry(pos, idx);
  geo.userData.surface = "winding-sand-channel";
  return geo;
}
