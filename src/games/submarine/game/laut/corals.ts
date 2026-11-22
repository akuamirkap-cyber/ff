// ============================================================================
// Five extra reef builders for Dunia Laut 3D (all height-normalised: base at
// y = 0, top at y = 1, `aux` = 0 at the root .. 1 at the growing tips):
//   brain coral, sea anemone, pillar coral, leather mushroom coral, sea pen.
// ============================================================================
import * as THREE from "three";

function nonIdx(g: THREE.BufferGeometry) {
  return g.index ? g.toNonIndexed() : g;
}

/** merge position/normal(/aux) geometries; parts without aux get a constant */
export function mergeAux(parts: { g: THREE.BufferGeometry; aux?: number | ((x: number, y: number, z: number) => number) }[]) {
  const P: number[] = [],
    N: number[] = [],
    A: number[] = [];
  for (const { g, aux } of parts) {
    const n = nonIdx(g);
    const p = n.getAttribute("position") as THREE.BufferAttribute;
    const nn = n.getAttribute("normal") as THREE.BufferAttribute;
    const a = n.getAttribute("aux") as THREE.BufferAttribute | undefined;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      P.push(x, y, z);
      N.push(nn.getX(i), nn.getY(i), nn.getZ(i));
      A.push(a ? a.getX(i) : typeof aux === "function" ? aux(x, y, z) : (aux ?? y));
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  out.setAttribute("aux", new THREE.Float32BufferAttribute(A, 1));
  return out;
}

function finish(g: THREE.BufferGeometry) {
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const h = bb.max.y - bb.min.y || 1;
  g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  g.scale(1 / h, 1 / h, 1 / h);
  g.computeBoundingSphere();
  return g;
}

const n2 = (x: number, y: number) => Math.sin(x * 12.9898 + y * 78.233) * 0.5 + Math.sin(x * 3.7 - y * 5.1) * 0.5;

/** brain coral: squat dome carved by meandering grooves */
export function brainCoral(seed = 1) {
  const g = new THREE.SphereGeometry(1, 48, 28, 0, Math.PI * 2, 0, Math.PI * 0.6);
  g.deleteAttribute("uv");
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  const aux = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const ang = Math.atan2(z, x);
    // meanders: wandering ridges whose direction drifts with position
    const m = Math.sin(ang * 7 + y * 9 + n2(x * 2 + seed, z * 2) * 2.2) + 0.5 * Math.sin(ang * 13 - y * 5 + n2(z * 3, x * 3 + seed) * 1.5);
    const groove = Math.pow(Math.abs(m), 0.55) * (m < 0 ? -1 : 1);
    const d = 1 + 0.07 * groove - 0.02 * Math.abs(groove);
    p.setXYZ(i, x * d, y * 0.72 * d + 0.3, z * d);
    aux[i] = 0.3 + 0.7 * Math.max(0, y) * (0.6 + 0.4 * (groove + 1) * 0.5);
  }
  g.computeVertexNormals();
  g.setAttribute("aux", new THREE.BufferAttribute(aux, 1));
  return finish(mergeAux([{ g }]));
}

/** sea anemone: fleshy column crowned by a ring of tapered tentacles */
export function anemone(seed = 1) {
  const parts: { g: THREE.BufferGeometry; aux?: number | ((x: number, y: number, z: number) => number) }[] = [];
  const col = new THREE.CylinderGeometry(0.31, 0.21, 0.42, 20, 3, false);
  col.translate(0, 0.21, 0);
  parts.push({ g: col, aux: (_x, y) => y * 0.8 });
  const disk = new THREE.SphereGeometry(0.32, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  disk.scale(1, 0.25, 1);
  disk.translate(0, 0.4, 0);
  parts.push({ g: disk, aux: 0.45 });
  const rings = [
    { r: 0.27, n: 22, tilt: 1.15, len: 0.42 },
    { r: 0.17, n: 14, tilt: 0.7, len: 0.5 },
    { r: 0.07, n: 7, tilt: 0.25, len: 0.55 },
  ];
  let k = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++, k++) {
      const a = (i / ring.n) * Math.PI * 2 + k * 0.37 + seed;
      const len = ring.len * (0.85 + 0.3 * Math.abs(Math.sin(k * 2.3 + seed)));
      const t = new THREE.CylinderGeometry(0.012, 0.034, len, 6, 4);
      t.translate(0, len / 2, 0);
      // gentle outward curl
      const tp = t.getAttribute("position") as THREE.BufferAttribute;
      for (let v = 0; v < tp.count; v++) {
        const yy = tp.getY(v) / len;
        tp.setX(v, tp.getX(v) + yy * yy * 0.12);
      }
      t.computeVertexNormals();
      t.rotateZ(-ring.tilt);
      t.rotateY(a);
      t.translate(Math.cos(a) * ring.r, 0.44, -Math.sin(a) * ring.r);
      parts.push({ g: t, aux: (_x, y) => 0.5 + 0.5 * Math.min(1, (y - 0.44) / 0.5) });
    }
  }
  return finish(mergeAux(parts));
}

/** pillar coral: a family of knobbly fingers rising from a common foot */
export function pillarCoral(seed = 1) {
  const parts: { g: THREE.BufferGeometry; aux?: number | ((x: number, y: number, z: number) => number) }[] = [];
  const foot = new THREE.SphereGeometry(0.5, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  foot.scale(1, 0.3, 0.8);
  parts.push({ g: foot, aux: 0.1 });
  const n = 6 + (seed % 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed;
    const rr = i === 0 ? 0 : 0.16 + 0.18 * Math.abs(Math.sin(i * 1.7 + seed));
    const h = i === 0 ? 1 : 0.5 + 0.42 * Math.abs(Math.cos(i * 2.1 + seed));
    const r0 = 0.09 + 0.03 * Math.sin(i + seed);
    const c = new THREE.CylinderGeometry(r0 * 0.75, r0 * 1.15, h, 12, 10);
    const cp = c.getAttribute("position") as THREE.BufferAttribute;
    for (let v = 0; v < cp.count; v++) {
      const x = cp.getX(v),
        y = cp.getY(v) + h / 2,
        z = cp.getZ(v);
      const ang = Math.atan2(z, x);
      const bump = 1 + 0.12 * Math.sin(ang * 6 + y * 18 + seed) * Math.sin(y * 9 + ang * 2);
      const lean = y * y * 0.08 * Math.sin(i * 3.3 + seed);
      cp.setXYZ(v, x * bump + lean, y, z * bump);
    }
    c.computeVertexNormals();
    const cap = new THREE.SphereGeometry(r0 * 0.8, 10, 6);
    cap.translate(h * h * 0.08 * Math.sin(i * 3.3 + seed), h, 0);
    c.translate(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    cap.translate(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    parts.push({ g: c, aux: (_x, y) => Math.min(1, y / h) }, { g: cap, aux: 1 });
  }
  return finish(mergeAux(parts));
}

/** leather mushroom coral: a short stalk and a broad cap with a folded, ruffled rim */
export function mushroomCoral(seed = 1) {
  const parts: { g: THREE.BufferGeometry; aux?: number | ((x: number, y: number, z: number) => number) }[] = [];
  const stalk = new THREE.CylinderGeometry(0.2, 0.26, 0.4, 14, 2);
  stalk.translate(0, 0.2, 0);
  parts.push({ g: stalk, aux: 0.15 });
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    // cap: rises from the stalk, domes gently, then droops at the rim
    prof.push(new THREE.Vector2(0.02 + t * 0.95, 0.38 + 0.28 * Math.sin(t * Math.PI * 0.9) - 0.18 * Math.pow(t, 5)));
  }
  prof.push(new THREE.Vector2(0.9, 0.34), new THREE.Vector2(0.3, 0.36));
  const cap = new THREE.LatheGeometry(prof, 44);
  const cp = cap.getAttribute("position") as THREE.BufferAttribute;
  for (let v = 0; v < cp.count; v++) {
    const x = cp.getX(v),
      y = cp.getY(v),
      z = cp.getZ(v);
    const r = Math.hypot(x, z),
      ang = Math.atan2(z, x);
    // ruffles that grow toward the rim
    const fold = 1 + (0.14 * Math.sin(ang * 7 + seed) + 0.05 * Math.sin(ang * 19 - seed)) * Math.pow(r, 3);
    const wave = (0.09 * Math.sin(ang * 7 + seed) + 0.03 * Math.sin(ang * 23)) * Math.pow(r, 2.5);
    cp.setXYZ(v, x * fold, y + wave, z * fold);
  }
  cap.computeVertexNormals();
  parts.push({ g: cap, aux: (x, _y, z) => 0.4 + 0.6 * Math.min(1, Math.hypot(x, z)) });
  const g = mergeAux(parts);
  g.scale(0.62, 1, 0.62);
  return finish(g);
}

/** sea pen: a quill-like stalk with soft feathery leaves on both sides */
export function seaPen(seed = 1) {
  const parts: { g: THREE.BufferGeometry; aux?: number | ((x: number, y: number, z: number) => number) }[] = [];
  const stalk = new THREE.CylinderGeometry(0.02, 0.05, 1, 8, 6);
  stalk.translate(0, 0.5, 0);
  parts.push({ g: stalk, aux: (_x, y) => y });
  const bulb = new THREE.SphereGeometry(0.07, 8, 6);
  bulb.scale(1, 1.6, 1);
  bulb.translate(0, 0.08, 0);
  parts.push({ g: bulb, aux: 0.05 });
  const n = 15;
  for (let i = 0; i < n; i++) {
    const t = 0.22 + (i / (n - 1)) * 0.76;
    const len = 0.34 * Math.sin(Math.min(1, (t - 0.1) / 0.9) * Math.PI) + 0.08;
    for (const side of [-1, 1]) {
      const leaf = new THREE.PlaneGeometry(len, 0.07, 6, 1);
      const lp = leaf.getAttribute("position") as THREE.BufferAttribute;
      for (let v = 0; v < lp.count; v++) {
        const u = lp.getX(v) / len + 0.5; // 0 root .. 1 tip
        lp.setXYZ(v, (lp.getX(v) + len / 2) * side, lp.getY(v) * (1 - u * 0.7) + u * len * 0.55, 0.01 * Math.sin(u * 9 + i));
      }
      leaf.deleteAttribute("uv");
      leaf.computeVertexNormals();
      leaf.rotateY(side * 0.25 * Math.sin(i + seed));
      leaf.translate(0, t, 0);
      parts.push({ g: leaf, aux: (x) => Math.min(1, t * 0.5 + Math.abs(x) / len * 0.6) });
    }
  }
  return finish(mergeAux(parts));
}

/** golden kelp: a tall stipe with broad ovate blades alternating up its length */
export function goldenKelp(seed = 1) {
  const parts: { g: THREE.BufferGeometry; aux?: number | ((x: number, y: number, z: number) => number) }[] = [];
  const stipe = new THREE.CylinderGeometry(0.012, 0.03, 1, 7, 10);
  const sp = stipe.getAttribute("position") as THREE.BufferAttribute;
  for (let v = 0; v < sp.count; v++) {
    const y = sp.getY(v) + 0.5;
    sp.setXYZ(v, sp.getX(v) + Math.sin(y * 4 + seed) * 0.05 * y, y, sp.getZ(v) + Math.cos(y * 3 + seed) * 0.03 * y);
  }
  stipe.computeVertexNormals();
  parts.push({ g: stipe, aux: (_x, y) => y });
  const n = 15;
  for (let i = 0; i < n; i++) {
    const t = 0.12 + (i / (n - 1)) * 0.86;
    const side = i % 2 ? 1 : -1;
    const len = 0.2 + 0.14 * Math.sin(Math.min(1, t) * Math.PI * 0.85) + 0.04 * Math.sin(i * 2.7 + seed);
    const wid = len * 0.42;
    const leaf = new THREE.PlaneGeometry(len, wid, 7, 3);
    const lp = leaf.getAttribute("position") as THREE.BufferAttribute;
    for (let v = 0; v < lp.count; v++) {
      const u = lp.getX(v) / len + 0.5; // 0 at the stipe .. 1 tip
      const w = lp.getY(v) / wid; // -0.5..0.5
      // ovate outline, slight cup and upward curl, crinkled edge
      const outline = Math.sin(u * Math.PI) * (0.6 + 0.4 * (1 - u));
      const x = (u * len) * side + Math.sin(t * 4 + seed) * 0.05 * t;
      const y = u * u * len * 0.9 + Math.abs(w) * 0.02 + 0.015 * Math.sin(u * 14 + i);
      const z = w * wid * outline + Math.sin(u * 9 + w * 6 + i) * 0.01 + w * w * 0.05;
      lp.setXYZ(v, x, y, z);
    }
    leaf.deleteAttribute("uv");
    leaf.computeVertexNormals();
    leaf.rotateY(side * (0.5 + 0.3 * Math.sin(i + seed)));
    leaf.translate(Math.sin(t * 4 + seed) * 0.05 * t, t, Math.cos(t * 3 + seed) * 0.03 * t);
    parts.push({ g: leaf, aux: () => Math.min(1, 0.35 + t * 0.65) });
  }
  // float bulbs at the top
  const bulb = new THREE.SphereGeometry(0.035, 8, 6);
  bulb.translate(Math.sin(4 + seed) * 0.05, 1.0, 0);
  parts.push({ g: bulb, aux: 1 });
  return finish(mergeAux(parts));
}
