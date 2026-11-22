import * as T from "three";
import { mulberry32, normalizeGeo } from "./geometry";

export const STAG = 0,
  FAN = 1,
  SPONGE = 2,
  PORITES = 3,
  PLATE = 4,
  KELP = 5,
  BUBBLE = 6,
  WHIP = 7,
  ANEMONE = 8,
  ORGAN = 9,
  LETTUCE = 10;
export const REEF_KINDS = 11;
const TAU = Math.PI * 2;

class Growth {
  vertices: number[] = [];
  indices: number[] = [];
  tips: number[] = [];
  add(x: number, y: number, z: number, aux: number) {
    this.vertices.push(x, y, z);
    this.tips.push(aux);
    return this.tips.length - 1;
  }
  ellipsoid(x: number,y: number,z: number,rx: number,ry: number,rz: number,tip=.82) {
    const start=this.tips.length,lat=9,lon=14;
    for(let j=0;j<=lat;j++)for(let i=0;i<lon;i++){
      const a=j/lat*Math.PI,ph=i/lon*TAU;
      this.add(x+Math.sin(a)*Math.cos(ph)*rx,y+Math.cos(a)*ry,z+Math.sin(a)*Math.sin(ph)*rz,tip*(.73+.27*Math.cos(a)));
      if(j<lat){const k=start+j*lon+i,n=start+j*lon+(i+1)%lon;this.indices.push(k,n,k+lon,n,n+lon,k+lon);}
    }
  }
  tube(
    points: T.Vector3[],
    radius: (u: number) => number,
    segments = 6,
    base = 0.12,
  ) {
    const off = this.tips.length,
      tangent = new T.Vector3(),
      across = new T.Vector3(),
      around = new T.Vector3(),
      helper = new T.Vector3();
    points.forEach((p, j) => {
      tangent
        .subVectors(
          points[Math.min(j + 1, points.length - 1)],
          points[Math.max(j - 1, 0)],
        )
        .normalize();
      helper.set(
        Math.abs(tangent.x) > 0.85 ? 0 : 1,
        Math.abs(tangent.x) > 0.85 ? 1 : 0,
        0,
      );
      across.crossVectors(tangent, helper).normalize();
      around.crossVectors(tangent, across);
      const u = j / (points.length - 1),
        r = radius(u);
      for (let i = 0; i < segments; i++) {
        const a = (TAU * i) / segments,
          c = Math.cos(a) * r,
          s = Math.sin(a) * r;
        this.add(
          p.x + across.x * c + around.x * s,
          p.y + across.y * c + around.y * s,
          p.z + across.z * c + around.z * s,
          base + (1 - base) * u * 0.88,
        );
        if (j) {
          const b = off + (j - 1) * segments + i,
            n = off + (j - 1) * segments + ((i + 1) % segments);
          this.indices.push(b, n, b + segments, n, n + segments, b + segments);
        }
      }
    });
    const a = points[0],
      b = points[points.length - 1],
      i0 = this.add(a.x, a.y, a.z, base),
      i1 = this.add(b.x, b.y, b.z, 1);
    for (let k = 0; k < segments; k++) {
      const last = off + (points.length - 1) * segments;
      this.indices.push(
        i0,
        off + ((k + 1) % segments),
        off + k,
        i1,
        last + k,
        last + ((k + 1) % segments),
      );
    }
  }
  geometry() {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(this.vertices, 3));
    g.setAttribute("aux", new T.Float32BufferAttribute(this.tips, 1));
    g.setIndex(this.indices);
    g.computeVertexNormals();
    return normalizeGeo(g);
  }
}
const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z);

function branching(seed: number, fan: boolean) {
  const r = mulberry32(seed),
    m = new Growth();
  function limb(
    start: T.Vector3,
    dir: T.Vector3,
    len: number,
    width: number,
    depth: number,
  ) {
    const mid = start.clone().addScaledVector(dir, len * 0.46);
    dir
      .add(
        v(
          (r() - 0.46) * 0.26,
          0.06 + r() * 0.16,
          (r() - 0.5) * (fan ? 0.065 : 0.26),
        ),
      )
      .normalize();
    const end = mid.clone().addScaledVector(dir, len * 0.54);
    m.tube(
      [start, mid, end, end.clone().addScaledVector(dir, width * 0.64)],
      (u) => width * (1 - u * (depth === 0 ? 0.88 : 0.45)),
      fan ? 5 : 6,
      0.17 + (3 - depth) * 0.15,
    );
    if (depth) {
      const n = depth > 1 ? 2 + (r() > 0.72 ? 1 : 0) : 2;
      const phase = r() * TAU;
      for (let k = 0; k < n; k++) {
        const a = phase + (k * TAU) / n;
        const d = fan
          ? v(
              dir.x * 0.55 + (k === 0 ? -1 : 1) * (0.31 + r() * 0.55),
              0.7 + r() * 0.4,
              (r() - 0.5) * 0.22,
            )
          : v(
              dir.x * 0.42 + Math.cos(a) * 0.63,
              0.58 + r() * 0.45,
              dir.z * 0.42 + Math.sin(a) * 0.64,
            );
        limb(
          end.clone(),
          d.normalize(),
          len * (0.58 + r() * 0.2),
          width * 0.61,
          depth - 1,
        );
      }
    }
  }
  if (fan) {
    const trunk = v(0.015, 0.18, 0);
    m.tube([v(0, 0, 0), trunk], (t) => 0.054 - t * 0.019, 8);
    for (let k = 0; k < 6; k++)
      limb(
        trunk.clone(),
        v(
          (k / 5 - 0.5) * 2.9,
          0.48 + r() * 0.8,
          (r() - 0.5) * 0.22,
        ).normalize(),
        0.24 + r() * 0.18,
        0.032,
        3,
      );
  } else {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU + r() * 0.48,
        rad = 0.08 + r() * 0.22;
      limb(
        v(Math.cos(a) * rad, 0.015, Math.sin(a) * rad),
        v(Math.cos(a) * 0.54, 0.8 + r() * 0.35, Math.sin(a) * 0.54).normalize(),
        0.17 + r() * 0.15,
        0.043 + r() * 0.018,
        3,
      );
    }
  }
  return m.geometry();
}

function sponge(seed: number) {
  const rng = mulberry32(seed),
    m = new Growth();
  for (let tube = 0; tube < 5; tube++) {
    const a = tube * 2.399 + seed,
      h = tube === 0 ? 0.85 : 0.29 + rng() * 0.56,
      r = 0.095 + rng() * 0.065;
    const cx = Math.cos(a) * (tube ? 0.11 + rng() * 0.12 : 0),
      cz = Math.sin(a) * (tube ? 0.2 : 0),
      lean = 0.04 + rng() * 0.18;
    const cols = 14,
      base = m.tips.length;
    const rows = [
      [0, 0.53, 0.15],
      [0.16, 0.73, 0.26],
      [0.54, 0.87, 0.56],
      [0.93, 1, 0.85],
      [1, 1.08, 0.98],
      [0.99, 0.84, 0.74],
      [0.77, 0.7, 0.25],
      [0.25, 0.32, 0.035],
    ];
    rows.forEach(([u, rr, light], j) => {
      for (let k = 0; k < cols; k++) {
        const t = (k / cols) * TAU,
          radius =
            r *
            rr *
            (1 + 0.065 * Math.sin(t * 5 + a) + 0.03 * Math.cos(t * 3 - u * 4));
        m.add(
          cx + Math.cos(t) * radius + Math.cos(a) * lean * u * u,
          h * u + 0.017 * Math.cos(t * 3 + u) * u,
          cz + Math.sin(t) * radius + Math.sin(a) * lean * u * u,
          light,
        );
        if (j) {
          const l = base + (j - 1) * cols + k,
            n = base + (j - 1) * cols + ((k + 1) % cols);
          m.indices.push(l, l + cols, n, n, l + cols, n + cols);
        }
      }
    });
  }
  return m.geometry();
}

function mound(seed: number) {
  const r = mulberry32(seed),
    m = new Growth();
  for (let n = 0; n < 6; n++) {
    const a = n * 2.39,
      h = n === 0 ? 0.58 : 0.17 + r() * 0.21,
      rad = n === 0 ? 0.43 : 0.18 + r() * 0.13;
    const x = n ? Math.cos(a) * 0.29 : 0,
      z = n ? Math.sin(a) * 0.29 : 0,
      off = m.tips.length,
      cols = 24,
      rows = 12;
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i < cols; i++) {
        const ph = (j / rows) * 1.76,
          th = (i / cols) * TAU,
          wr =
            1 +
            0.085 * Math.sin(th * 5 + ph * 3 + seed) * Math.sin(ph) +
            0.032 * Math.sin(th * 11 - ph * 5);
        m.add(
          x + Math.cos(th) * Math.sin(ph) * rad * wr,
          (Math.cos(ph) + 0.2) * h,
          z + Math.sin(th) * Math.sin(ph) * rad * wr,
          0.28 + 0.6 * Math.max(0, Math.cos(ph)),
        );
        if (j < rows) {
          const k = off + j * cols + i,
            nx = off + j * cols + ((i + 1) % cols);
          m.indices.push(k, nx, k + cols, nx, nx + cols, k + cols);
        }
      }
  }
  return m.geometry();
}

function table(seed: number) {
  const r = mulberry32(seed),
    m = new Growth();
  const tiers = 3 + Math.floor(r() * 2);
  for (let tier = 0; tier < tiers; tier++) {
    const a = tier * 2.4 + seed,
      h = 0.125 + tier * 0.095,
      x = Math.cos(a) * (0.18 + r() * 0.1),
      z = Math.sin(a) * 0.19,
      rr = 0.31 + 0.14 * r() + tier * 0.018;
    m.tube(
      [v(0, 0.01, 0), v(x * 0.6, h * 0.8, z * 0.6), v(x, h + 0.04, z)],
      (t) => 0.037 - t * 0.015,
      7,
    );
    const rows = 7,
      cols = 40,
      off = m.tips.length;
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i < cols; i++) {
        const u = j / rows,
          th = (i / cols) * TAU,
          ed =
            1 +
            0.06 * Math.sin(th * 7 + a) +
            0.045 * Math.cos(th * 11 - a) +
            0.05 * Math.cos(th * 3 + a);
        const r0 = rr * u * ed,
          yy =
            h +
            0.043 * (1 - u * u) +
            0.044 * Math.sin(th * 2 + a) * u * u +
            0.025 * Math.cos(th * 5 + u) * u;
        m.add(
          x + Math.cos(th) * r0,
          yy + Math.sin(th) * r0 * 0.14,
          z + Math.sin(th) * r0 * 0.79,
          0.32 + 0.68 * u,
        );
        if (j < rows) {
          const k = off + j * cols + i,
            nx = off + j * cols + ((i + 1) % cols);
          m.indices.push(k, nx, k + cols, nx, nx + cols, k + cols);
        }
      }
    const rim = off + rows * cols;
    for (let k = 0; k < cols; k++) {
      const i = (rim + k) * 3;
      m.add(m.vertices[i], m.vertices[i + 1] - 0.022, m.vertices[i + 2], 0.18);
    }
    for (let i = 0; i < cols; i++) {
      const k = rim + i,
        nx = rim + ((i + 1) % cols);
      m.indices.push(k, nx + cols, nx, k, k + cols, nx + cols);
    }
  }
  return m.geometry();
}

function kelp(seed: number) {
  const r = mulberry32(seed),
    m = new Growth();
  for (let n = 0; n < 3; n++) {
    const a = n * 2.399 + seed,
      h = 0.74 + r() * 0.44,
      cx = Math.cos(a) * 0.045,
      cz = Math.sin(a) * 0.045;
    const spine = (t: number) =>
      v(
        cx + 0.11 * t * t + Math.sin(t * 5 + a) * 0.036 * t,
        t * h,
        cz + Math.sin(a + t * 3) * 0.08 * t,
      );
    m.tube(
      Array.from({ length: 10 }, (_, i) => spine(i / 9)),
      (u) => 0.012 * (1 - 0.73 * u),
      5,
    );
    for (let k = 0; k < 8; k++) {
      const u = 0.13 + k * 0.1,
        base = spine(u),
        dir = k * 2.22 + a,
        length = (0.19 + 0.15 * r()) * (1 - 0.47 * u),
        off = m.tips.length;
      for (let j = 0; j <= 10; j++) {
        const t = j / 10,
          w =
            0.039 *
            Math.sin(Math.PI * t) ** 0.85 *
            (1 + 0.26 * Math.sin(t * 26));
        const s = length * t * (0.59 + 0.1 * t),
          yy = base.y + length * (0.18 * t + 0.75 * t * t);
        const tx = base.x + Math.cos(dir) * s + 0.025 * t * t,
          tz = base.z + Math.sin(dir) * s + Math.cos(t * 6 + dir) * 0.02 * t;
        m.add(
          tx + Math.sin(dir) * w,
          yy + w * 0.38,
          tz - Math.cos(dir) * w,
          0.22 + 0.6 * t,
        );
        m.add(
          tx - Math.sin(dir) * w,
          yy - w * 0.38,
          tz + Math.cos(dir) * w,
          0.26 + 0.6 * t,
        );
        if (j) {
          const i = off + (j - 1) * 2;
          m.indices.push(i, i + 1, i + 3, i, i + 3, i + 2);
        }
      }
    }
  }
  return m.geometry();
}

function bubbleCoral(seed:number){
  const r=mulberry32(seed),m=new Growth();
  for(let i=0;i<19;i++){
    const a=i*2.39996, u=Math.sqrt((i+.35)/19),x=Math.cos(a)*u*.42,z=Math.sin(a)*u*.39;
    const h=.17+(1-u)*.27+r()*.15,rad=.065+.085*r();
    m.tube([v(x*.68,0,z*.68),v(x*.88,h*.55,z*.88),v(x,h*.83,z)],t=>rad*(.66-t*.22),6);
    m.ellipsoid(x,h,z,rad*(.96+r()*.3),rad*(1.03+r()*.44),rad, .63+r()*.30);
  }
  return m.geometry();
}
function seaWhip(seed:number){
  const r=mulberry32(seed),m=new Growth();
  for(let i=0;i<10;i++){
    const a=i*2.39996,base=v(Math.cos(a)*r()*.14,0,Math.sin(a)*r()*.14),h=.53+r()*.46;
    m.tube(Array.from({length:13},(_,j)=>{const t=j/12;return v(base.x+Math.cos(a)*(.27*t*t)+Math.sin(t*6+a)*t*.066,h*t,base.z+Math.sin(a)*.18*t*t);}),t=>.020*(1-t*.79),6,.17);
    for(let k=0;k<4;k++){
      const t=(k+2)/7,h2=h*t;
      m.tube([v(base.x+Math.cos(a)*.20*t*t,h2,base.z),v(base.x+Math.cos(a)*.20*t*t+Math.cos(a+k*2)*.14,h2+.095,base.z+Math.sin(a+k)*.08),v(base.x+Math.cos(a)*.20*t*t+Math.cos(a+k*2)*.24,h2+.18,base.z+Math.sin(a+k)*.13)],u=>.010*(1-u*.8),5,.34);
    }
  }
  return m.geometry();
}
function anemone(seed:number){
  const r=mulberry32(seed),m=new Growth();
  m.ellipsoid(0,.08,0,.39,.17,.39,.34);
  for(let i=0;i<31;i++){
    const a=i*2.39996,rad=Math.sqrt((i+.5)/31)*.36;
    const x=Math.cos(a)*rad,z=Math.sin(a)*rad,h=.35+.32*r();
    m.tube([v(x,.12,z),v(x+Math.cos(a)*.07,.25,z+Math.sin(a)*.03),v(x+Math.cos(a)*(.13+r()*.05),h*.75,z+Math.sin(a)*.06),v(x+Math.cos(a)*.18,h,z+Math.sin(a)*.08)],u=>.028*(1-u*.79),7,.27);
  }
  return m.geometry();
}
function organPipe(seed:number){
  const r=mulberry32(seed),m=new Growth();
  for(let i=0;i<20;i++){
    const a=i*2.39996,u=Math.sqrt((i+.3)/20),x=Math.cos(a)*u*.38,z=Math.sin(a)*u*.37;
    const h=.24+.48*(1-u*.64)+r()*.18,rad=.041+r()*.018;
    m.tube([v(x*.92,.01,z*.92),v(x,h*.38,z),v(x+.017*Math.sin(a),h*.76,z),v(x,h,z)],t=>rad*(.84+t*.28),10,.22);
    m.tube(Array.from({length:13},(_,j)=>v(x+Math.cos(j/12*TAU)*rad*1.1,h+.008,z+Math.sin(j/12*TAU)*rad*1.1)),()=>.008,5,.95);
  }
  return m.geometry();
}
function lettuce(seed:number){
  const m=new Growth();
  for(let i=0;i<5;i++){
    const a=i*2.39996,off=m.tips.length,cols=35,rows=11;
    for(let j=0;j<=rows;j++)for(let k=0;k<cols;k++){
      const t=j/rows,ph=k/cols*TAU,rad=(.10+.47*t)*(.91+.09*Math.sin(ph*5+i+seed*.01)),w=.07*t*t*Math.sin(ph*8+i*2+t*5);
      m.add(Math.cos(ph)*rad+Math.cos(a)*.14*t,.04+.31*t+.05*t*t*Math.sin(ph*6+a)+w+i*.016,Math.sin(ph)*rad*.78+Math.sin(a)*.11*t,.25+.66*t);
      if(j<rows){const q=off+j*cols+k,n=off+j*cols+(k+1)%cols;m.indices.push(q,n,q+cols,n,n+cols,q+cols);}
    }
  }
  return m.geometry();
}

export function reefForm(kind: number, seed: number) {
  return kind === STAG
    ? branching(seed, false)
    : kind === FAN
      ? branching(seed, true)
      : kind === SPONGE
        ? sponge(seed)
        : kind === PORITES
          ? mound(seed)
          : kind === PLATE
            ? table(seed)
            : kind === KELP ? kelp(seed)
            : kind === BUBBLE ? bubbleCoral(seed)
            : kind === WHIP ? seaWhip(seed)
            : kind === ANEMONE ? anemone(seed)
            : kind === ORGAN ? organPipe(seed)
            : lettuce(seed);
}
