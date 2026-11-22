// ============================================================================
// Procedural 3D meshes: Vintage Mark V Scuba Diver & Jules Verne Submarine
// ============================================================================
import { sin, cos, PI, TAU, mix, pow, clamp, qAxis, qMul, qRot, surfaceNets, EntityMesh, Mesh } from './math.js';
import { browY, FACE_BASE, FACE_MOUTH_Y, HEAD_SCALE } from './face.js';
import { BRIDGE_GLOBE, BRIDGE_PIVOT_Y, HALL_GLOBE_Y, HALL_GLOBE_Z } from './cabin.js';
export { HEAD_SCALE } from './face.js';

// Diver material IDs:
// 0=canvas suit, 1=antique copper, 2=burnished brass, 3=warm glowing porthole glass,
// 4=ribbed dark rubber, 5=dark leather & lead, 6=vintage twin scuba tanks,
// 7=forehead dive-lamp lens, 8=expedition collar/tank accent
// 50=skin, 51=hair, 53=mouth, 55=inner ear, 56=brows, 58=facial skin with eye UVs
// Diver part IDs:
// 0=torso/tanks, 1=Dear Flight head, 2=leftArm, 3=rightArm, 4=leftLeg, 5=rightLeg,
// 6=leftFin, 7=rightFin, 8=hoses, 9=harpoon gun, 10=1.4x scuba helmet

export const HELMET_SCALE = 1.4 * HEAD_SCALE;

// Smooth-union implicit ellipsoids produce one continuous skin or hair surface, rather
// than a stack of visible caps. The same builder is used by divers and window crew.
function fusedBlobs(m, mat, part, X, bounds, dims, blobs, blend, face = false) {
  const [nx, ny, nz] = dims, [x0, x1, y0, y1, z0, z1] = bounds;
  const field = new Float32Array(nx * ny * nz);
  for (let iz = 0; iz < nz; iz++) for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    const x = mix(x0, x1, ix / (nx - 1)), y = mix(y0, y1, iy / (ny - 1)), z = mix(z0, z1, iz / (nz - 1));
    let d = 1e3;
    for (const [bx, by, bz, rx, ry, rz] of blobs) {
      const bx0 = (x - bx) / rx, by0 = (y - by) / ry, bz0 = (z - bz) / rz;
      const next = (Math.hypot(bx0, by0, bz0) - 1) * Math.min(rx, ry, rz);
      const h = Math.max(blend - Math.abs(d - next), 0) / blend;
      d = Math.min(d, next) - h * h * blend * 0.25;
    }
    field[ix + nx * (iy + ny * iz)] = -d;
  }
  const surface = surfaceNets(field, nx, ny, nz), base = m.p.length / 3;
  m.tag(mat, part);
  for (let k = 0; k < surface.nv; k++) {
    const i = k * 3, x = mix(x0, x1, surface.pos[i] / (nx - 1));
    const y = mix(y0, y1, surface.pos[i + 1] / (ny - 1)), z = mix(z0, z1, surface.pos[i + 2] / (nz - 1));
    const front = face && z < -0.023;
    const orbit = Math.hypot((Math.abs(x) - 0.0415) / 0.039, (y - 0.174) / 0.035);
    const bulge = front ? 0.011 * pow(Math.max(0, 1 - orbit * orbit), 2) : 0;
    const p = X(x, y, z - bulge);
    m.tag(front ? 58 : mat, part);
    m.v(p[0], p[1], p[2], clamp(0.86 + (y - 0.15) * 0.45, 0.76, 1), 0.5 + x / 0.26, y / 0.30);
  }
  for (let k = 0; k < surface.ni; k += 3) m.tri(base + surface.idx[k], base + surface.idx[k + 1], base + surface.idx[k + 2]);
}

export function addDearFlightHead(m, part, s = 1.0, ox = 0, oy = 0, oz = 0, yaw = 0) {
  const qY = yaw ? qAxis(0, 1, 0, yaw) : null;
  const X = (lx, ly, lz) => {
    let x = lx * s, y = ly * s, z = lz * s;
    if (qY) [x, y, z] = qRot(qY, x, y, z);
    return [ox + x, oy + y, oz + z];
  };

  m.tag(50, part);
  {
    const a = X(0, -0.006, -0.004), b = X(0, 0.045, -0.004);
    m.cyl(a[0], a[1], a[2], b[0], b[1], b[2], 0.046 * s, 0.050 * s, 14, false);
  }

  fusedBlobs(m, 50, part, X, [-0.13, 0.13, 0.015, 0.292, -0.125, 0.13], [42, 46, 40], [
    [0, 0.15, 0.005, 0.084, 0.116, 0.079],
    [0, 0.216, -0.008, 0.080, 0.062, 0.068],
    [-0.047, 0.121, -0.022, 0.045, 0.052, 0.058],
    [0.047, 0.121, -0.022, 0.045, 0.052, 0.058],
    [0, 0.084, -0.007, 0.065, 0.038, 0.063],
    [0, 0.139, -0.083, 0.020, 0.029, 0.022],
  ], 0.025, true);

  // Sculpted helix and a shaded concha make the ears readable from side views.
  for (const sx of [-1, 1]) {
    const e = X(sx * 0.092, 0.142, 0.009);
    m.tag(50, part);
    m.ellipsoid(e[0], e[1], e[2], 0.020 * s, 0.029 * s, 0.020 * s, 14, 12, qY, () => 0.92);
    m.tag(55, part);
    const inner = X(sx * 0.109, 0.143, -0.002);
    m.ellipsoid(inner[0], inner[1], inner[2], 0.006 * s, 0.018 * s, 0.011 * s, 10, 8, qY);
    m.tag(50, part);
    m.tube([X(sx * 0.106, 0.157, -0.009), X(sx * 0.112, 0.159, 0.003), X(sx * 0.112, 0.142, 0.011), X(sx * 0.107, 0.132, 0.004)], 0.0032 * s, 7, true);
  }

  const hair = [
    [0, 0.225, 0.030, 0.098, 0.054, 0.082],
    [0, 0.176, 0.041, 0.099, 0.079, 0.075],
    [-0.068, 0.188, 0.023, 0.038, 0.050, 0.057],
    [0.068, 0.188, 0.023, 0.038, 0.050, 0.057],
    [-0.046, 0.240, -0.007, 0.055, 0.029, 0.061],
    [0.046, 0.240, -0.007, 0.055, 0.029, 0.061],
  ];
  for (let u = -2; u <= 2; u++) hair.push([u * 0.030, 0.242 + (2 - Math.abs(u)) * 0.004, -0.048 + Math.abs(u) * 0.004, 0.028, 0.020, 0.036]);
  fusedBlobs(m, 51, part, X, [-0.13, 0.13, 0.089, 0.29, -0.13, 0.135], [44, 36, 44], hair, 0.022);

  // The brow tubes are the only raised geometry over the contoured eye sockets.
  for (const sx of [-1, 1]) {
    m.tag(56, part);
    const brow = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      brow.push(X(sx * (0.016 + t * 0.055), browY(0, t), -0.086 + 0.030 * pow(t, 1.55)));
    }
    m.tube(brow, (t) => (0.0011 + 0.0031 * pow(sin(t * PI), 0.7)) * s, 8, true);
  }

  m.tag(53, part);
  {
    const mPts = [];
    for (let k = 0; k <= 8; k++) {
      const u = (k / 8) * 2 - 1;
      const lx = u * 0.042;
      const ly = FACE_MOUTH_Y + 0.0025 * u * u;
      const lz = -0.085 + 0.007 * u * u;
      mPts.push(X(lx, ly, lz));
    }
    m.tube(mPts, (t) => (0.0012 + 0.0027 * sin(t * PI)) * s, 8, true);
  }
}

// Reusable 1.4x Mark V Scuba Helmet builder (used on divers AND on the submarine's Tempat Helm rack!)
export function addScubaHelmet(m, part, s = HELMET_SCALE, ox = 0, oy = 0, oz = 0, yaw = 0, openFront = true, mats = null) {
  const M = mats || { dome: 1, brass: 2, glass: 3, lamp: 7, inner: 5 };
  const qY = yaw ? qAxis(0, 1, 0, yaw) : null;
  const X = (lx, ly, lz) => {
    let x = lx * s, y = ly * s, z = lz * s;
    if (qY) [x, y, z] = qRot(qY, x, y, z);
    return [ox + x, oy + y, oz + z];
  };
  const qM = (qLocal) => (qY ? (qLocal ? qMul(qY, qLocal) : qY) : qLocal);

  // Main hammered copper sphere dome (centered at ly = 0.173 above neck base)
  m.tag(M.dome, part);
  if (openFront) {
    // Cut real circular front porthole opening so the Dear Flight giant eyes & mouth shine right through!
    const segU = 28, segV = 18, rings = [];
    for (let j = 0; j <= segV; j++) {
      const tv = j / segV, ph = tv * PI, cp = cos(ph), sp = sin(ph);
      const ao = mix(1.0, 0.72, pow(tv, 2));
      const ring = [];
      for (let k = 0; k <= segU; k++) {
        const tu = k / segU, th = tu * TAU;
        const lx = 0.166 * sp * cos(th), ly = 0.173 + 0.174 * cp, lz = 0.168 * sp * sin(th);
        const p = X(lx, ly, lz);
        ring.push({ idx: m.v(p[0], p[1], p[2], ao, tu, tv), lx, ly, lz });
      }
      rings.push(ring);
    }
    for (let j = 0; j < segV; j++) {
      for (let k = 0; k < segU; k++) {
        const a = rings[j][k], b = rings[j][k + 1], c = rings[j + 1][k + 1], d = rings[j + 1][k];
        const mx = (a.lx + b.lx + c.lx + d.lx) * 0.25;
        const my = (a.ly + b.ly + c.ly + d.ly) * 0.25;
        const mz = (a.lz + b.lz + c.lz + d.lz) * 0.25;
        if (mz < -0.105 && (mx * mx + (my - 0.162) * (my - 0.162)) < 0.088 * 0.088) continue;
        m.quad(a.idx, b.idx, c.idx, d.idx);
      }
    }
    // Dark inner helmet lining behind the head so no copper interior glares behind the face
    m.tag(M.inner, part);
    const iRings = [];
    for (let j = 2; j <= 14; j++) {
      const tv = j / 16, ph = tv * PI, cp = cos(ph), sp = sin(ph);
      const ring = [];
      for (let k = 0; k <= 16; k++) {
        const tu = k / 16, th = mix(-0.15 * PI, 1.15 * PI, tu); // back + sides (+Z half)
        const lx = 0.154 * sp * cos(th), ly = 0.173 + 0.162 * cp, lz = 0.156 * sp * sin(th);
        const p = X(lx, ly, lz);
        ring.push(m.v(p[0], p[1], p[2], 0.35, tu, tv));
      }
      iRings.push(ring);
    }
    for (let j = 0; j < iRings.length - 1; j++) {
      for (let k = 0; k < 16; k++) {
        // Inward-facing winding
        m.quad(iRings[j][k + 1], iRings[j][k], iRings[j + 1][k], iRings[j + 1][k + 1]);
      }
    }
  } else {
    const c = X(0, 0.173, 0);
    m.ellipsoid(c[0], c[1], c[2], 0.166 * s, 0.174 * s, 0.168 * s, 22, 16, qY, (tv) => mix(1.0, 0.72, pow(tv, 2)));
  }

  // Copper lower helmet skirt + heavy brass collar ring
  m.tag(M.dome, part);
  {
    const a = X(0, 0.0, 0), b = X(0, 0.063, 0);
    m.cyl(a[0], a[1], a[2], b[0], b[1], b[2], 0.118 * s, 0.138 * s, 18, false);
  }
  m.tag(M.brass, part);
  {
    const nr = X(0, 0.004, 0);
    m.torus(nr[0], nr[1], nr[2], 0.122 * s, 0.015 * s, 18, 7, 'y', qY);
  }

  // Large Front Brass Porthole Bezel (-Z face)
  m.tag(M.brass, part);
  {
    const fp = X(0, 0.162, -0.148);
    m.torus(fp[0], fp[1], fp[2], 0.092 * s, 0.018 * s, 22, 9, 'z', qY);
    const c0 = X(0, 0.162, -0.132), c1 = X(0, 0.162, -0.164);
    m.cyl(c0[0], c0[1], c0[2], c1[0], c1[1], c1[2], 0.098 * s, 0.094 * s, 20, false);
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * TAU;
      const bp = X(cos(a) * 0.094, 0.162 + sin(a) * 0.094, -0.164);
      m.ellipsoid(bp[0], bp[1], bp[2], 0.006 * s, 0.006 * s, 0.006 * s, 5, 4);
    }
  }
  if (!openFront) {
    // Tinted glowing glass faceplate when sitting empty on the submarine's Tempat Helm rack!
    m.tag(M.glass, part);
    const gp = X(0, 0.162, -0.150);
    m.ellipsoid(gp[0], gp[1], gp[2], 0.086 * s, 0.086 * s, 0.022 * s, 18, 10, qY);
  }

  // Left & Right Circular Side Brass Portholes + Glass + Guard Bar
  for (const sx of [-1, 1]) {
    m.tag(M.brass, part);
    const sp0 = X(sx * 0.152, 0.173, -0.005);
    m.torus(sp0[0], sp0[1], sp0[2], 0.054 * s, 0.013 * s, 14, 7, 'x', qY);
    const g0 = X(sx * 0.168, 0.119, -0.005), g1 = X(sx * 0.168, 0.227, -0.005);
    m.cyl(g0[0], g0[1], g0[2], g1[0], g1[1], g1[2], 0.0055 * s, 0.0055 * s, 6, false);
    m.tag(M.glass, part);
    const gl = X(sx * 0.153, 0.173, -0.005);
    m.ellipsoid(gl[0], gl[1], gl[2], 0.018 * s, 0.049 * s, 0.049 * s, 12, 8, qY);
  }

  // Angled Upper-Front Observation Window + Forehead Brass Dive Lamp
  {
    const topQ = qM(qAxis(1, 0, 0, 0.82));
    const tp = X(0, 0.296, -0.095);
    m.tag(M.brass, part);
    m.torus(tp[0], tp[1], tp[2], 0.042 * s, 0.011 * s, 14, 6, 'z', topQ);
    m.tag(M.glass, part);
    m.ellipsoid(tp[0], tp[1], tp[2], 0.037 * s, 0.037 * s, 0.014 * s, 12, 7, topQ);
  }
  {
    const l0 = X(0, 0.343, -0.010), l1 = X(0, 0.343, -0.068);
    m.tag(M.brass, part);
    m.cyl(l0[0], l0[1], l0[2], l1[0], l1[1], l1[2], 0.024 * s, 0.029 * s, 12, true);
    m.torus(l1[0], l1[1], l1[2], 0.028 * s, 0.006 * s, 12, 6, 'z', qY);
    m.tag(M.lamp, part, 0.5, 0.5);
    m.ellipsoid(l1[0], l1[1], l1[2], 0.024 * s, 0.024 * s, 0.010 * s, 10, 6, qY);
  }

  // Top Brass Lifting Ring & Side Exhaust Valve
  m.tag(M.brass, part);
  {
    const tr = X(0, 0.356, 0.045);
    m.torus(tr[0], tr[1], tr[2], 0.022 * s, 0.006 * s, 10, 6, 'x', qY);
    const v0 = X(0.145, 0.253, 0.055), v1 = X(0.175, 0.273, 0.065);
    m.cyl(v0[0], v0[1], v0[2], v1[0], v1[1], v1[2], 0.014 * s, 0.018 * s, 8, true);
  }
}

export function buildDiverMesh() {
  const m = new EntityMesh();

  // --- PART 0: Vintage Puffy Canvas Torso + Belt + Copper Corselet + Twin Scuba Tanks ---
  m.tag(0, 0);
  m.lathe(0, 0, 0, [
    [0.00, 0.25, 0.55],
    [0.095, 0.26, 0.72],
    [0.125, 0.31, 0.85],
    [0.118, 0.36, 0.88],
    [0.132, 0.44, 0.95],
    [0.146, 0.52, 0.98],
    [0.132, 0.58, 0.95],
    [0.090, 0.61, 0.85],
    [0.00, 0.62, 0.80],
  ], 18, 'y', 0.80);

  // Riveted antique copper corselet (shoulder breastplate)
  m.tag(1, 0);
  m.lathe(0, 0, 0, [
    [0.150, 0.515, 0.82],
    [0.162, 0.545, 0.95],
    [0.148, 0.585, 1.00],
    [0.118, 0.612, 0.96],
    [0.105, 0.625, 0.90],
  ], 18, 'y', 0.84);

  // Brass neck locking ring + 12 vintage wing-nut bolts around collar
  m.tag(2, 0);
  m.torus(0, 0.612, 0, 0.122, 0.016, 18, 8, 'y');
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * TAU;
    m.ellipsoid(cos(a) * 0.146, 0.552, sin(a) * 0.124, 0.011, 0.011, 0.011, 6, 5);
  }
  // Vintage chest weight medallion & expedition trim ring
  m.box(0, 0.465, -0.108, 0.048, 0.042, 0.016, qAxis(1, 0, 0, -0.1));
  m.tag(8, 0);
  m.torus(0, 0.522, 0, 0.144, 0.011, 16, 6, 'y');

  // Heavy dark saddle-leather weight belt + lead pouches + chunky brass buckle
  m.tag(5, 0);
  m.lathe(0, 0, 0, [
    [0.128, 0.332, 0.8],
    [0.134, 0.352, 0.92],
    [0.128, 0.372, 0.85],
  ], 18, 'y', 0.83);
  for (const a of [-2.3, -1.5, -0.75, 0.75, 1.5, 2.3]) {
    const px = sin(a) * 0.132, pz = -cos(a) * 0.110;
    m.box(px, 0.352, pz, 0.020, 0.026, 0.018, qAxis(0, 1, 0, -a), 0.85);
  }
  // Leather cross-shoulder tank harness straps
  for (const sx of [-1, 1]) {
    m.cyl(sx * 0.075, 0.58, -0.09, sx * 0.06, 0.36, -0.105, 0.012, 0.012, 6, false);
  }
  // Front square brass belt buckle + hip brass dive-knife tube
  m.tag(2, 0);
  m.box(0, 0.352, -0.112, 0.030, 0.027, 0.012);
  m.cyl(0.136, 0.37, -0.01, 0.142, 0.27, 0.01, 0.011, 0.008, 7, true);

  // Twin vintage 1940s Aqua-Lung / Jules Verne Scuba Cylinders on back (+Z)
  for (const sx of [-0.056, 0.056]) {
    m.tag(6, 0);
    m.lathe(sx, 0, 0.142, [
      [0.00, 0.315, 0.7],
      [0.036, 0.325, 0.85],
      [0.048, 0.355, 0.95],
      [0.048, 0.555, 1.0],
      [0.038, 0.585, 0.98],
      [0.016, 0.602, 0.95],
      [0.00, 0.606, 0.95],
    ], 14, 'y');
    // Brass tank harness bands
    m.tag(2, 0);
    m.torus(sx, 0.395, 0.142, 0.049, 0.007, 14, 6, 'y');
    m.torus(sx, 0.515, 0.142, 0.049, 0.007, 14, 6, 'y');
    // Expedition color stripe around upper tank
    m.tag(8, 0);
    m.cyl(sx, 0.525, 0.142, sx, 0.552, 0.142, 0.049, 0.049, 12, false);
  }
  // Brass twin-tank manifold crossbar, first-stage regulator drum & valve wheel
  m.tag(2, 0);
  m.cyl(-0.062, 0.612, 0.142, 0.062, 0.612, 0.142, 0.013, 0.013, 8, true);
  m.cyl(-0.056, 0.595, 0.142, -0.056, 0.618, 0.142, 0.015, 0.015, 8, true);
  m.cyl(0.056, 0.595, 0.142, 0.056, 0.618, 0.142, 0.015, 0.015, 8, true);
  // Classic Cousteau round pancake brass regulator housing at center of manifold
  m.cyl(0, 0.615, 0.125, 0, 0.615, 0.168, 0.034, 0.034, 12, true);
  m.torus(0, 0.648, 0.142, 0.022, 0.005, 10, 6, 'z');

  // --- PART 8: Twin Corrugated Dark Rubber Breathing Hoses (Regulator -> 1.4x Helmet) ---
  for (const sx of [-1, 1]) {
    m.tag(4, 8);
    const hPts = [
      [sx * 0.028, 0.622, 0.142],
      [sx * 0.138, 0.655, 0.155],
      [sx * 0.228, 0.715, 0.110],
      [sx * 0.245, 0.768, 0.025],
      [sx * 0.212, 0.785, -0.062],
    ];
    m.tube(hPts, 0.018, 9, true);
    // Brass hose coupling ferrule on 1.4x helmet
    m.tag(2, 8);
    m.torus(sx * 0.214, 0.785, -0.058, 0.023, 0.006, 9, 5, 'x');
  }

  // --- PART 1: "Dear Flight / Passengers & Crew" Stylized Head (Always present, bare inside sub!) ---
  addDearFlightHead(m, 1, HEAD_SCALE, 0, FACE_BASE, 0, 0);

  // --- PART 10: 1.4x Oversized Mark V Scuba Helmet (Worn underwater; placed on Tempat Helm rack inside sub!) ---
  addScubaHelmet(m, 10, HELMET_SCALE, 0, 0.612, 0, 0, true, { dome: 1, brass: 2, glass: 3, lamp: 7, inner: 5 });

  // --- PARTS 2 & 3: Left & Right Vintage Canvas Arms + Brass Cuffs + Rubber Mittens ---
  for (let s = 0; s < 2; s++) {
    const sx = s === 0 ? -1 : 1, part = s === 0 ? 2 : 3;
    m.tag(0, part);
    m.ellipsoid(sx * 0.155, 0.542, 0, 0.046, 0.046, 0.044, 10, 8);
    m.tube([
      [sx * 0.158, 0.540, 0.00],
      [sx * 0.176, 0.455, 0.008],
      [sx * 0.182, 0.375, -0.022],
    ], (t) => mix(0.041, 0.033, t), 10, true);
    // Brass waterproof wrist-cuff ring
    m.tag(2, part);
    m.torus(sx * 0.182, 0.372, -0.022, 0.034, 0.008, 10, 6, 'y');
    // Vintage dark vulcanized-rubber diving mitten + thumb
    m.tag(4, part);
    m.ellipsoid(sx * 0.182, 0.334, -0.030, 0.030, 0.038, 0.034, 10, 8);
    m.ellipsoid(sx * 0.158, 0.342, -0.052, 0.014, 0.018, 0.016, 7, 6);
  }

  // --- PARTS 4,5 & 6,7: Vintage Canvas Legs + Heavy Brass Diving Boots + Strapped Scuba Fins ---
  for (let s = 0; s < 2; s++) {
    const sx = s === 0 ? -1 : 1, legP = s === 0 ? 4 : 5, finP = s === 0 ? 6 : 7;
    const lx = sx * 0.072;
    // Canvas trouser leg
    m.tag(0, legP);
    m.tube([
      [lx, 0.295, 0.00],
      [lx * 1.04, 0.185, -0.008],
      [lx * 1.05, 0.085, 0.002],
    ], (t) => mix(0.052, 0.041, t), 11, true);
    // Leather knee patch
    m.tag(5, legP);
    m.ellipsoid(lx * 1.04, 0.185, -0.044, 0.028, 0.032, 0.014, 8, 6);
    // Heavy vintage deep-sea boot upper + brass ankle cuff + thick lead sole + domed brass toe cap
    m.cyl(lx * 1.05, 0.022, 0.002, lx * 1.05, 0.092, 0.002, 0.046, 0.044, 10, true);
    m.box(lx * 1.05, 0.014, -0.024, 0.046, 0.014, 0.076, null, 0.65);
    m.tag(2, legP);
    m.torus(lx * 1.05, 0.092, 0.002, 0.044, 0.008, 10, 5, 'y');
    m.ellipsoid(lx * 1.05, 0.038, -0.062, 0.045, 0.034, 0.048, 11, 8, null, () => 0.9);
    // Brass heel fin-strap buckle
    m.box(lx * 1.05, 0.034, 0.052, 0.038, 0.012, 0.012);

    // Classic 1940s frogman strapped dark-rubber swim flipper blade (trails cleanly when swimming!)
    m.tag(4, finP);
    const finSeg = 5;
    const fRings = [];
    for (let k = 0; k <= finSeg; k++) {
      const t = k / finSeg;
      const w = mix(0.038, 0.074, pow(t, 0.65));
      const th = mix(0.011, 0.004, t);
      const fy = mix(0.024, 0.005, t);
      const fz = mix(-0.092, -0.215, t);
      const ring = [];
      for (let j = 0; j <= 8; j++) {
        const a = j / 8 * TAU;
        ring.push(m.v(lx * 1.05 + cos(a) * w, fy + sin(a) * th, fz, 0.85, j / 8, t));
      }
      fRings.push(ring);
    }
    for (let k = 0; k < finSeg; k++) {
      for (let j = 0; j < 8; j++) {
        m.quad(fRings[k][j], fRings[k + 1][j], fRings[k + 1][j + 1], fRings[k][j + 1]);
      }
    }
  }

  // Leather harpoon sheath slung diagonally across the back (gun slides in when holstered)
  {
    const qs = qAxis(0, 0, 1, -0.582);
    m.tag(5, 0);
    m.box(0.03, 0.47, 0.208, 0.03, 0.19, 0.012, qs, 0.8);
    m.tag(2, 0);
    m.box(0.03 + 0.55 * 0.15, 0.47 + 0.835 * 0.15, 0.21, 0.034, 0.008, 0.016, qs, 0.9);
    m.box(0.03 - 0.55 * 0.15, 0.47 - 0.835 * 0.15, 0.21, 0.034, 0.008, 0.016, qs, 0.9);
  }

  // --- PART 9: Vintage Brass & Mahogany Hand-Held Scuba Harpoon Gun ---
  // Each of the six crew members carries a compact spring-loaded reef harpoon.
  // The steel shaft is animated in W_DIVER; firing recoil and the tether are live simulation state.
  m.tag(5, 9);
  m.box(0.205, 0.355, 0.018, 0.034, 0.024, 0.060, null, 0.88); // dark mahogany stock
  m.cyl(0.205, 0.345, -0.005, 0.205, 0.288, 0.018, 0.018, 0.014, 8, true); // rubber pistol grip
  m.tag(2, 9);
  m.cyl(0.205, 0.358, -0.025, 0.205, 0.358, -0.355, 0.017, 0.012, 10, true); // burnished brass barrel
  m.torus(0.205, 0.358, -0.080, 0.018, 0.004, 10, 5, 'z');
  m.torus(0.205, 0.358, -0.315, 0.013, 0.003, 10, 5, 'z');
  // Loaded steel spear with opposing barbs and a bright brass tip
  m.tag(4, 9);
  m.cyl(0.205, 0.358, -0.325, 0.205, 0.358, -0.535, 0.0055, 0.002, 7, true);
  m.tag(2, 9);
  m.cyl(0.205, 0.358, -0.505, 0.205, 0.358, -0.555, 0.009, 0.0008, 5, true);
  m.cyl(0.205, 0.358, -0.405, 0.187, 0.358, -0.445, 0.003, 0.0009, 5, false);
  m.cyl(0.205, 0.358, -0.405, 0.223, 0.358, -0.445, 0.003, 0.0009, 5, false);
  // Brass reel housing & tightly wound dark tether spool on the stock
  m.tag(2, 9);
  m.torus(0.205, 0.394, 0.048, 0.025, 0.006, 12, 6, 'x');
  m.tag(4, 9);
  m.cyl(0.205, 0.394, 0.028, 0.205, 0.394, 0.068, 0.009, 0.009, 8, true);
  m.tag(2, 9);
  m.cyl(0.174, 0.386, 0.018, 0.236, 0.386, 0.018, 0.004, 0.004, 6, false); // simple trigger guard

  return m.build();
}

// Submarine material IDs:
// 10=riveted iron-bronze hull, 11=burnished brass, 12=vintage ochre-gold stripe,
// 13=panoramic bubble dome glass, 14=side porthole glass, 15=polished brass propeller,
// 16=searchlight tungsten lens, 17=dark cast-iron keel/fins, 18=top navigation beacon
// 1=copper crew helmet, 3=warm crew visor
// Submarine part IDs:
// 0=hull, 1=propeller, 2=rudder, 3=dive planes, 4=top hatch, 5..10=6 crew inside windows
export function buildSubmarineMesh() {
  const m = new EntityMesh();

  // --- PART 0: Streamlined Riveted Jules Verne Pressure Hull (-Z bow, +Z stern) ---
  m.tag(10, 0);
  const hullProf = [
    [0.64, -1.86, 0.92],
    [0.73, -1.55, 0.96],
    [0.79, -1.10, 1.00],
    [0.82, -0.55, 1.00],
    [0.81, 0.05, 1.00],
    [0.76, 0.62, 0.98],
    [0.66, 1.12, 0.96],
    [0.50, 1.56, 0.94],
    [0.32, 1.92, 0.90],
    [0.16, 2.15, 0.85],
    [0.00, 2.20, 0.82],
  ];
  m.lathe(0, 0, 0, hullProf, 28, 'z', 0.94);

  // Raised Circumferential Brass Structural Hull Ribs
  m.tag(11, 0);
  for (const [rz, rr] of [[-1.85, 0.655], [-1.35, 0.765], [-0.65, 0.822], [0.15, 0.808], [0.92, 0.705], [1.56, 0.505]]) {
    m.torus(0, 0, rz, rr * 0.97, 0.026, 26, 8, 'z');
  }

  // Vintage Ochre-Mustard Expedition Stripe + Lateral Ballast Saddle Tanks
  for (const sx of [-1, 1]) {
    m.tag(12, 0);
    m.box(sx * 0.77, 0.08, -0.35, 0.045, 0.065, 1.18, null, 0.95);
    // Lower riveted ballast saddle tank
    m.tag(10, 0);
    m.ellipsoid(sx * 0.70, -0.28, -0.28, 0.22, 0.19, 1.18, 16, 10, null, () => 0.84);
    // Brass ballast tank straps
    m.tag(11, 0);
    for (const bz of [-0.95, -0.28, 0.38]) {
      m.torus(sx * 0.70, -0.28, bz, 0.20, 0.016, 14, 6, 'z');
    }
    // Tiny Little Nightmares-scale brass boarding ladder rungs climbing up the hull to the hatch!
    for (let k = 0; k < 7; k++) {
      const a = mix(0.05, 0.92, k / 6);
      const rx = sx * (cos(a) * 0.84), ry = sin(a) * 0.80;
      m.cyl(rx, ry, -0.02, rx, ry, -0.18, 0.012, 0.012, 6, true);
    }
  }

  // Heavy Dark Cast-Iron Ventral Keel + Twin Seabed Landing Skids
  m.tag(17, 0);
  m.box(0, -0.80, -0.15, 0.08, 0.14, 1.62, null, 0.65);
  for (const sx of [-0.46, 0.46]) {
    // Horizontal landing runner
    m.cyl(sx, -0.92, -1.25, sx, -0.92, 0.95, 0.036, 0.036, 8, true);
    // Curved upturned ski tip at front
    m.cyl(sx, -0.92, -1.25, sx, -0.78, -1.52, 0.036, 0.028, 8, true);
    // Strut legs connecting hull to skid
    m.cyl(sx * 0.85, -0.62, -0.88, sx, -0.92, -0.88, 0.028, 0.028, 7, false);
    m.cyl(sx * 0.85, -0.62, 0.55, sx, -0.92, 0.55, 0.028, 0.028, 7, false);
  }

  // --- Panoramic Forward Brass-Framed Observation Cockpit Dome + Skylight (-Z nose) ---
  m.tag(13, 0);
  m.ellipsoid(0, 0.02, -1.84, 0.65, 0.62, 0.60, 26, 16);
  // Upper panoramic cockpit skylight window integrated ahead of conning tower
  m.ellipsoid(0, 0.68, -1.18, 0.34, 0.16, 0.38, 18, 10);
  m.tag(11, 0);
  m.torus(0, 0.67, -1.18, 0.35, 0.024, 18, 7, 'y');
  // Riveted brass main cockpit bezel collar + wide-view curved meridian ribs (open center window!)
  m.torus(0, 0.02, -1.84, 0.655, 0.030, 26, 8, 'z');
  for (const a of [-2.45, -0.69, 0.62, 2.52]) {
    const pts = [];
    for (let j = 0; j <= 8; j++) {
      const t = j / 8, ph = mix(0.18, PI * 0.5, t);
      pts.push([cos(a) * sin(ph) * 0.665, 0.02 + sin(a) * sin(ph) * 0.635, -1.84 - cos(ph) * 0.612]);
    }
    m.tube(pts, 0.019, 8, false);
  }
  // Visible interior brass helm wheel & warm instrument console silhouette inside the forward dome
  m.box(0, -0.22, -1.96, 0.34, 0.12, 0.14, qAxis(1, 0, 0, 0.25));
  m.torus(0, -0.10, -1.86, 0.11, 0.014, 14, 6, 'z');
  // Jules Verne curved brass bow bumper / chin guard below dome
  m.tube([
    [-0.64, -0.34, -1.75],
    [-0.50, -0.45, -2.20],
    [0.0, -0.49, -2.46],
    [0.50, -0.45, -2.20],
    [0.64, -0.34, -1.75],
  ], 0.025, 8, true);

  // Twin Vintage Brass Bow Searchlights + Glowing Tungsten Lenses
  for (const sx of [-0.56, 0.56]) {
    m.tag(11, 0);
    m.cyl(sx * 0.86, -0.28, -1.72, sx, -0.34, -1.78, 0.024, 0.024, 7, false);
    m.cyl(sx, -0.34, -1.66, sx, -0.34, -1.96, 0.085, 0.115, 14, true);
    m.torus(sx, -0.34, -1.96, 0.112, 0.016, 14, 7, 'z');
    m.tag(16, 0);
    m.ellipsoid(sx, -0.34, -1.95, 0.098, 0.098, 0.032, 12, 8);
  }

  // --- 6 Round Bolted Brass Side Portholes (3 port, 3 starboard) ---
  for (const sx of [-1, 1]) {
    for (const [pz, rx] of [[-1.02, 0.77], [-0.26, 0.80], [0.50, 0.75]]) {
      m.tag(11, 0);
      m.torus(sx * rx, 0.16, pz, 0.155, 0.030, 16, 8, 'x');
      // Cross brass mullion
      m.cyl(sx * (rx + 0.025), 0.01, pz, sx * (rx + 0.025), 0.31, pz, 0.010, 0.010, 6, false);
      m.tag(14, 0);
      m.ellipsoid(sx * (rx - 0.005), 0.16, pz, 0.035, 0.138, 0.138, 14, 8);
    }
  }

  // --- Classic Conning Tower (Sail) + Top Hatch + Vintage Brass Periscope + Beacon ---
  m.tag(10, 0);
  m.lathe(0, 0, -0.18, [
    [0.38, 0.62, 0.78],
    [0.35, 0.85, 0.94],
    [0.33, 1.12, 1.00],
    [0.35, 1.17, 1.00],
    [0.00, 1.18, 0.98],
  ], 20, 'y', 1.48);
  // Flared brass conning-tower crown collar + vintage nameplate + small bridge porthole
  m.tag(11, 0);
  m.lathe(0, 0, -0.18, [
    [0.355, 1.11, 0.95],
    [0.375, 1.16, 1.00],
    [0.345, 1.20, 1.00],
  ], 20, 'y', 1.48);
  m.torus(0, 0.95, -0.68, 0.095, 0.022, 14, 7, 'z');
  m.tag(14, 0);
  m.ellipsoid(0, 0.95, -0.68, 0.082, 0.082, 0.025, 12, 7);
  m.tag(12, 0);
  m.box(-0.35, 0.94, -0.18, 0.02, 0.07, 0.22);
  m.box(0.35, 0.94, -0.18, 0.02, 0.07, 0.22);

  // Curved Vintage Brass Periscope + Scope Hood + Navigation Beacon Mast
  m.tag(11, 0);
  m.tube([
    [0.0, 1.17, -0.44],
    [0.0, 1.56, -0.44],
    [0.0, 1.70, -0.47],
    [0.0, 1.73, -0.60],
  ], (t) => mix(0.044, 0.056, t), 12, true);
  m.torus(0, 1.73, -0.61, 0.058, 0.012, 12, 6, 'z');
  m.tag(14, 0);
  m.ellipsoid(0, 1.73, -0.60, 0.048, 0.048, 0.018, 10, 6);

  // Aft conning-tower brass radio/lantern mast + warm pulsing navigation beacon
  m.tag(11, 0);
  m.cyl(0, 1.17, 0.14, 0, 1.56, 0.20, 0.022, 0.014, 8, true);
  m.torus(0, 1.58, 0.20, 0.044, 0.008, 10, 5, 'y');
  m.tag(18, 0);
  m.ellipsoid(0, 1.60, 0.20, 0.038, 0.048, 0.038, 10, 8);

  // Top Deck Brass Handrails (fore & aft of conning tower — tiny diver scale!)
  m.tag(11, 0);
  for (const sx of [-0.28, 0.28]) {
    m.cyl(sx, 0.88, -1.48, sx, 0.92, -0.72, 0.012, 0.012, 6, true);
    m.cyl(sx, 0.72, -1.42, sx, 0.88, -1.42, 0.011, 0.011, 6, false);
    m.cyl(sx, 0.76, -1.06, sx, 0.90, -1.06, 0.011, 0.011, 6, false);
    m.cyl(sx, 0.88, 0.34, sx, 0.78, 1.12, 0.012, 0.012, 6, true);
    m.cyl(sx, 0.74, 0.55, sx, 0.85, 0.55, 0.011, 0.011, 6, false);
    m.cyl(sx, 0.66, 1.05, sx, 0.79, 1.05, 0.011, 0.011, 6, false);
  }

  // --- PART 4: Hinged Circular Brass Diver Airlock Hatch + Locking Wheel ---
  m.tag(11, 4);
  m.cyl(0, 1.17, -0.10, 0, 1.24, -0.10, 0.25, 0.23, 16, true);
  m.torus(0, 1.29, -0.10, 0.11, 0.015, 14, 6, 'y');
  m.cyl(0, 1.24, -0.10, 0, 1.30, -0.10, 0.020, 0.020, 8, true);
  m.cyl(-0.11, 1.29, -0.10, 0.11, 0.0 + 1.29, -0.10, 0.010, 0.010, 6, false);
  m.cyl(0, 1.29, -0.21, 0, 1.29, 0.01, 0.010, 0.010, 6, false);

  // --- Stern Fixed Stabilizer Fins + Brass Kort-Nozzle Propeller Shroud ---
  m.tag(17, 0);
  // Fixed dorsal & ventral fin roots
  m.box(0, 0.38, 1.78, 0.032, 0.28, 0.28, qAxis(1, 0, 0, -0.25));
  m.box(0, -0.40, 1.78, 0.032, 0.26, 0.26, qAxis(1, 0, 0, 0.25));
  // Brass Kort nozzle shroud ring around propeller
  m.tag(11, 0);
  m.lathe(0, -0.02, 2.20, [
    [0.44, -0.14, 0.9],
    [0.47, 0.0, 1.0],
    [0.43, 0.14, 0.92],
    [0.40, 0.0, 0.8],
    [0.44, -0.14, 0.9],
  ], 24, 'z');
  // 4 struts linking hull tail to Kort nozzle
  for (let k = 0; k < 4; k++) {
    const a = k * PI / 2 + PI / 4;
    m.cyl(cos(a) * 0.16, -0.02 + sin(a) * 0.16, 2.08, cos(a) * 0.42, -0.02 + sin(a) * 0.42, 2.18, 0.018, 0.018, 6, false);
  }

  // --- PART 2: Articulated Stern Vertical Rudder ---
  m.tag(17, 2);
  m.box(0, 0.0, 1.98, 0.026, 0.56, 0.16);
  m.tag(11, 2);
  m.cyl(0, -0.58, 1.92, 0, 0.58, 1.92, 0.022, 0.022, 8, true);

  // --- PART 3: Articulated Bow & Stern Horizontal Dive Planes (Hydroplanes) ---
  for (const sx of [-1, 1]) {
    m.tag(17, 3);
    // Forward bow hydroplane
    m.box(sx * 0.92, -0.06, -1.18, 0.24, 0.024, 0.14);
    // Aft stern hydroplane
    m.box(sx * 0.56, -0.04, 1.82, 0.28, 0.024, 0.15);
    m.tag(11, 3);
    m.torus(sx * 0.72, -0.06, -1.18, 0.048, 0.014, 10, 5, 'x');
  }

  // --- PART 1: Spinning 5-Blade Polished Brass Screw Propeller ---
  m.tag(15, 1);
  m.cyl(0, -0.04, 2.08, 0, -0.04, 2.34, 0.095, 0.022, 14, true);
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * TAU;
    const bx = cos(a) * 0.22, by = -0.04 + sin(a) * 0.22;
    const q = qMul(qAxis(0, 0, 1, a), qAxis(1, 0, 0, 0.52));
    m.ellipsoid(bx, by, 2.20, 0.165, 0.072, 0.016, 10, 7, q, () => 0.96);
  }

  // --- PARTS 5..10: Bare-Headed "Dear Flight" Crew Visible Inside Forward Dome & Portholes! ---
  // Inside the submarine their helmets are stowed on the Tempat Helm rack, so you see their big eyes & hair!
  const addWindowDiver = (part, x, y, z, faceYaw) => {
    addDearFlightHead(m, part, 0.68 * HEAD_SCALE, x, y - 0.10, z, faceYaw);
  };
  // Pilot (Player standing at center wheel, part 5) & Co-pilot (Bot 1, part 6) inside panoramic forward dome!
  addWindowDiver(5, 0.0, 0.05, -2.02, 0.0);
  addWindowDiver(6, 0.22, 0.03, -1.96, -0.14);
  // Bots 2..5 peering out the cozy round side porthole windows!
  addWindowDiver(7, -0.69, 0.15, -1.02, PI / 2);
  addWindowDiver(8, 0.69, 0.15, -1.02, -PI / 2);
  addWindowDiver(9, -0.72, 0.15, -0.26, PI / 2);
  addWindowDiver(10, 0.72, 0.15, -0.26, -PI / 2);

  // Classic riveted side viewports with external floodlamps (both flanks)
  for (const sx of [-1, 1]) for (const vz of [-0.55, 0.35]) {
    m.tag(11, 0);
    m.torus(sx * 0.8, 0.08, vz, 0.2, 0.035, 26, 8, 'x');
    for (let k = 0; k < 12; k++) { const q = k / 12 * TAU; m.ellipsoid(sx * 0.82, 0.08 + cos(q) * 0.25, vz + sin(q) * 0.25, 0.018, 0.018, 0.018, 6, 4); }
    m.tag(14, 0);
    m.ellipsoid(sx * 0.79, 0.08, vz, 0.02, 0.19, 0.19, 14, 10);
    m.tag(11, 0);
    m.cyl(sx * 0.78, 0.42, vz, sx * 0.9, 0.4, vz, 0.06, 0.07, 12, false);
    m.tag(16, 0);
    m.ellipsoid(sx * 0.9, 0.4, vz, 0.012, 0.058, 0.058, 10, 6);
  }
  return m.build();
}

// ---------------------------------------------------------------- 3D Vintage Submarine Cockpit Interior
// Centered at captain's eye (0, 0, 0), looking forward along -Z (+X right, +Y up).
// Cockpit material IDs:
// 20=riveted dark bronze bulkhead, 21=burnished marine brass, 22=polished antique mahogany wood,
// 23=hammered copper pipes & co-pilot helmet, 24=painted crimson valve wheel & brass trim,
// 25=live CRT phosphor Sonar screen, 26=antique ivory Depth manometer, 27=antique ivory Speed gauge,
// 28=gimbaled brass Compass rose, 29=warm tungsten cabin lantern & crew indicator bulbs,
// 30=subtle curved dome glass rim sheen, 31=co-pilot warm glowing visor
// Cockpit animated part IDs:
// 0=static cabin & console, 1=spoked brass helm wheel, 2=engine telegraph lever,
// 3=ballast dive lever, 4=swaying cabin lanterns, 5=co-pilot companion diver
// Rear crew cabin layout (cockpit-local units; shared with the simulation for crew stations)
export const CAB = {
  Z0: 0.16, Z1: 3.45, RX: 0.64, RY: 0.6, YC: -0.02, FLOOR: -0.34, NT: 36, NZ: 32, PR: 0.135,
  // [centre theta-cell, first z-cell] of 3x3-cell viewport blocks
  PORTS: [[0, 2], [0, 8], [17, 3], [17, 9], [0, 16], [17, 16]],
  DOOR: 1.6, MESS: 2.1, BUNK: 2.95,
};
export function buildCockpitMesh() {
  const m = new EntityMesh();

  // Helper: planar polar-UV instrument face pointing toward pilot (+Z in local frame)
  const dialFace = (cx, cy, cz, r, seg, q) => {
    const c = m.v(cx, cy, cz, 1, 0.5, 0.5);
    const ring = [];
    for (let s = 0; s <= seg; s++) {
      const a = s / seg * TAU;
      const ca = cos(a), sa = sin(a);
      let lx = ca * r, ly = sa * r, lz = 0;
      if (q) [lx, ly, lz] = qRot(q, lx, ly, lz);
      ring.push(m.v(cx + lx, cy + ly, cz + lz, 1, 0.5 + 0.5 * ca, 0.5 + 0.5 * sa));
    }
    for (let s = 0; s < seg; s++) m.tri(c, ring[s], ring[s + 1]);
  };

  // --- 1. Wide-Open Panoramic Brass Observation Dome Framing (unobstructed center & skylight!) ---
  m.tag(21, 0);
  // One continuous window frame: left sill junction -> A-pillar -> brow arch -> A-pillar -> right sill junction
  const framePts = [];
  const pil = (sx, t) => [sx * mix(0.505, 0.42, t * t), mix(-0.18, 0.42, t) + sin(t * PI) * 0.03, mix(-0.35, -0.46, t)];
  for (let k = 0; k <= 8; k++) framePts.push(pil(-1, k / 8));
  for (let k = 1; k < 12; k++) { const u = k / 12 * 2 - 1; framePts.push([u * 0.42, 0.42 + (1 - u * u) * 0.085, -0.46 - (1 - u * u) * 0.06]); }
  for (let k = 8; k >= 0; k--) framePts.push(pil(1, k / 8));
  m.tube(framePts, 0.019, 10, false);
  for (let k = 9; k < 20; k++) { const p = framePts[k]; m.ellipsoid(p[0], p[1] + 0.006, p[2] + 0.016, 0.0055, 0.0055, 0.0055, 6, 5); }
  // Sill: one curve sweeping from the left cabin wall around the bow to the right cabin wall
  const sillPts = [[-0.594, -0.18, 0.16], [-0.55, -0.18, -0.10]];
  for (let k = 0; k <= 26; k++) {
    const u = (k / 26) * 2 - 1;
    sillPts.push([u * 0.505, -0.18, -0.35 - (1 - u * u) * 0.27]);
  }
  sillPts.push([0.55, -0.18, -0.10], [0.594, -0.18, 0.16]);
  m.tube(sillPts, 0.018, 9, false);
  // Roof ribs (pillar tops -> cabin bulkhead ring) + side uprights + centre skylight rib
  for (const sx of [-1, 1]) {
    const rib = [];
    for (let k = 0; k <= 10; k++) { const t = k / 10; rib.push([sx * mix(0.42, 0.40, t), 0.42 + sin(t * PI) * 0.06, mix(-0.46, 0.16, t)]); }
    m.tube(rib, 0.016, 8, false);
    m.tube([[sx * 0.594, -0.18, 0.16], [sx * 0.615, 0.12, 0.16], [sx * 0.40, 0.42, 0.16]], 0.02, 8, false);
  }
  const mid = [];
  for (let k = 0; k <= 10; k++) { const t = k / 10; mid.push([0, 0.505 + sin(t * PI) * 0.03 + t * 0.05, mix(-0.52, 0.16, t)]); }
  m.tube(mid, 0.014, 8, false);
  for (const j of [pil(-1, 0), pil(1, 0), pil(-1, 1), pil(1, 1), [0, 0.505, -0.52], [0, 0.555, 0.16], [-0.40, 0.42, 0.16], [0.40, 0.42, 0.16], [-0.594, -0.18, 0.16], [0.594, -0.18, 0.16]]) {
    m.ellipsoid(j[0], j[1], j[2], 0.03, 0.03, 0.03, 10, 8);
  }
  m.tag(23, 0);
  for (const sx of [-1, 1]) m.tube([[sx * 0.54, -0.3, -0.28], [sx * 0.58, 0.0, -0.2], [sx * 0.52, 0.3, -0.05], [sx * 0.42, 0.47, 0.14]], 0.010, 8, false);
  m.tag(24, 0);
  m.torus(-0.5, 0.02, -0.37, 0.05, 0.007, 14, 6, 'x');
  m.cyl(-0.53, 0.02, -0.37, -0.49, 0.02, -0.37, 0.010, 0.010, 7, true);

  // --- 2. Lower Riveted-Bronze Hull Tub, Rear Cabin Bulkhead & Cabin Deck ---
  m.tag(20, 0);
  // Lower curved cockpit wall below windows (never blocks the panoramic glass!)
  const tubRows = [
    [-0.48, 0.56, 0.55],
    [-0.36, 0.62, 0.78],
    [-0.20, 0.63, 0.92],
  ];
  const tRings = [];
  for (let r = 0; r < tubRows.length; r++) {
    const [yy, rad, ao] = tubRows[r];
    const ring = [];
    for (let s = 0; s <= 24; s++) {
      const a = mix(-0.6 * PI, 0.6 * PI, s / 24);
      ring.push(m.v(sin(a) * rad, yy, -cos(a) * rad * 0.94, ao, s / 24, r / 2));
    }
    tRings.push(ring);
  }
  for (let r = 0; r < 2; r++) {
    for (let s = 0; s < 24; s++) {
      // Inward-facing normals toward pilot at (0,0,0)
      m.quad(tRings[r][s], tRings[r][s + 1], tRings[r + 1][s + 1], tRings[r + 1][s]);
    }
  }
  // Cabin wooden grating floor
  m.tag(22, 0);
  m.box(0, -0.48, -0.05, 0.52, 0.02, 0.50, null, 0.55);

  // --- 3. Curved Antique Mahogany & Burnished-Brass Bridge Instrument Console ---
  const cTilt = qAxis(1, 0, 0, -0.34); // faces upward & back toward pilot eyes!
  // Main center mahogany instrument desk + side wing panels
  m.tag(22, 0);
  m.box(0, -0.255, -0.49, 0.25, 0.095, 0.065, cTilt, 0.94);
  m.box(-0.31, -0.262, -0.42, 0.13, 0.088, 0.062, qMul(qAxis(0, 1, 0, 0.46), cTilt), 0.92);
  m.box(0.31, -0.262, -0.42, 0.13, 0.088, 0.062, qMul(qAxis(0, 1, 0, -0.46), cTilt), 0.92);
  // Horizontal mahogany dashboard shelf lip + gleaming brass rail trim
  m.tag(21, 0);
  m.tube([
    [-0.42, -0.185, -0.36],
    [-0.24, -0.172, -0.46],
    [0.0, -0.165, -0.50],
    [0.24, -0.172, -0.46],
    [0.42, -0.185, -0.36],
  ], 0.011, 8, true);
  // Riveted dark-bronze pedestal column under console
  m.tag(20, 0);
  m.box(0, -0.39, -0.46, 0.22, 0.09, 0.08, null, 0.72);

  // --- 4. LIVE INSTRUMENTS: Center CRT Sonar, Depth Manometer, Knot Gauge & Gimbal Compass ---
  // (a) Center Round Brass-Bezeled Live Sonar CRT Display (detects 10x Manta Ray in real time!)
  const sonX = 0, sonY = -0.222, sonZ = -0.432, sonR = 0.066;
  m.tag(21, 0);
  m.torus(sonX, sonY, sonZ, sonR + 0.006, 0.010, 22, 8, 'z', cTilt);
  // Anti-glare upper brass hood over sonar + 8 bezel rivets
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * TAU;
    const o = qRot(cTilt, cos(a) * (sonR + 0.008), sin(a) * (sonR + 0.008), 0.009);
    m.ellipsoid(sonX + o[0], sonY + o[1], sonZ + o[2], 0.0032, 0.0032, 0.0032, 5, 4);
  }
  m.tag(25, 0);
  dialFace(sonX, sonY, sonZ + 0.003, sonR, 24, cTilt);

  // (b) Port (Left) Vintage Brass Depth Manometer (live rotating depth needle!)
  const depX = -0.145, depY = -0.225, depZ = -0.425, depR = 0.046;
  m.tag(21, 0);
  m.torus(depX, depY, depZ, depR + 0.005, 0.008, 18, 7, 'z', cTilt);
  m.tag(26, 0);
  dialFace(depX, depY, depZ + 0.003, depR, 20, cTilt);

  // (c) Starboard (Right) Vintage Brass Knot / Speedometer Gauge (live rotating speed needle!)
  const spdX = 0.145, spdY = -0.225, spdZ = -0.425, spdR = 0.046;
  m.tag(21, 0);
  m.torus(spdX, spdY, spdZ, spdR + 0.005, 0.008, 18, 7, 'z', cTilt);
  m.tag(27, 0);
  dialFace(spdX, spdY, spdZ + 0.003, spdR, 20, cTilt);

  // (d) Top-Center Gimbaled Brass Binnacle Compass on Forward Nose Sill (live heading rose!)
  const cmpX = 0, cmpY = -0.142, cmpZ = -0.505, cmpR = 0.028;
  const cmpQ = qAxis(1, 0, 0, -0.48);
  m.tag(21, 0);
  m.torus(cmpX, cmpY, cmpZ, cmpR + 0.006, 0.0055, 18, 6, 'z', cmpQ);
  m.cyl(cmpX - 0.036, cmpY - 0.026, cmpZ, cmpX - 0.036, cmpY + 0.002, cmpZ, 0.004, 0.004, 6, true);
  m.cyl(cmpX + 0.036, cmpY - 0.026, cmpZ, cmpX + 0.036, cmpY + 0.002, cmpZ, 0.004, 0.004, 6, true);
  m.tag(28, 0);
  dialFace(cmpX, cmpY, cmpZ + 0.002, cmpR, 18, cmpQ);

  // (e) 6 Warm Filament Crew-Aboard Bulbs + Searchlight Indicator Jewel + Brass Toggle Switches
  for (let k = 0; k < 6; k++) {
    const bx = mix(-0.068, 0.068, k / 5), by = -0.302, bz = -0.398;
    m.tag(21, 0);
    m.torus(bx, by, bz, 0.0075, 0.0025, 8, 5, 'z', cTilt);
    m.tag(29, 0, (k + 0.5) / 6, 0.2); // u encodes crew slot 0..5!
    m.ellipsoid(bx, by + 0.002, bz + 0.005, 0.006, 0.006, 0.006, 7, 6, null, null, 0, 1);
  }
  // Searchlight indicator lamp (v = 0.85 marks searchlight status lamp!)
  m.tag(21, 0);
  m.torus(-0.215, -0.228, -0.415, 0.011, 0.003, 10, 5, 'z', cTilt);
  m.tag(29, 0, 0.5, 0.85);
  m.ellipsoid(-0.215, -0.226, -0.409, 0.0085, 0.0085, 0.007, 8, 6);
  // Vintage brass toggle switches on side wing panel
  m.tag(21, 0);
  for (let k = 0; k < 3; k++) {
    const tx = 0.215 + k * 0.022;
    m.cyl(tx, -0.265, -0.40, tx, -0.252, -0.382, 0.003, 0.0045, 6, true);
  }

  // --- 5. PART 1: Animated 8-Spoke Brass & Mahogany Submarine Helm Wheel ---
  // Positioned at (0, -0.315, -0.315) right in front of the captain's standing helm spot (z = -0.23)
  // so the diver's natural arms reach and grip the wheel without any stretching!
  const wx = 0, wy = -0.315, wz = -0.315, wR = 0.096;
  // Brass steering shaft housing (static)
  m.tag(21, 0);
  m.cyl(wx, wy - 0.022, -0.44, wx, wy, wz + 0.01, 0.022, 0.018, 12, true);
  // Mahogany outer wheel rim + inner brass strengthening ring + center brass hub
  m.tag(22, 1);
  m.torus(wx, wy, wz, wR, 0.011, 24, 8, 'z');
  m.tag(21, 1);
  m.torus(wx, wy, wz, wR * 0.62, 0.005, 20, 6, 'z');
  m.ellipsoid(wx, wy, wz + 0.006, 0.022, 0.022, 0.014, 12, 8);
  // 8 turned brass spokes extending into classic outer handle pegs!
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * TAU + PI / 2;
    const ca = cos(a), sa = sin(a);
    m.tag(k === 0 ? 24 : 21, 1); // Top center "king spoke" accented in crimson-brass!
    m.cyl(wx + ca * 0.016, wy + sa * 0.016, wz, wx + ca * (wR + 0.032), wy + sa * (wR + 0.032), wz, 0.0048, 0.0062, 7, true);
    m.tag(21, 1);
    m.ellipsoid(wx + ca * (wR + 0.034), wy + sa * (wR + 0.034), wz, 0.0085, 0.0085, 0.0085, 7, 6);
  }

  // --- 6. PART 2: Animated Chadburn Brass Engine Order Telegraph (Port / Left) ---
  // Pivot at (-0.285, -0.235, -0.385), tilts forward/back with W/S & Shift!
  const etX = -0.285, etY = -0.235, etZ = -0.385;
  m.tag(21, 0);
  m.cyl(etX - 0.016, etY, etZ, etX + 0.016, etY, etZ, 0.038, 0.038, 16, true);
  m.tag(24, 0);
  m.torus(etX + 0.016, etY, etZ, 0.034, 0.004, 14, 5, 'x');
  m.tag(21, 2);
  m.cyl(etX + 0.020, etY, etZ, etX + 0.024, etY + 0.095, etZ, 0.005, 0.0045, 7, true);
  m.tag(24, 2);
  m.ellipsoid(etX + 0.025, etY + 0.104, etZ, 0.014, 0.016, 0.014, 9, 7);
  m.tag(21, 2);
  m.torus(etX + 0.025, etY + 0.104, etZ, 0.0145, 0.003, 9, 5, 'y');

  // --- 7. PART 3: Animated Copper Ballast Dive-Plane Lever (Starboard / Right) ---
  // Pivot at (+0.285, -0.235, -0.385), tilts forward/back with E/Q ascent/descent!
  const blX = 0.285, blY = -0.235, blZ = -0.385;
  m.tag(21, 0);
  m.cyl(blX - 0.016, blY, blZ, blX + 0.016, blY, blZ, 0.034, 0.034, 14, true);
  m.tag(21, 3);
  m.cyl(blX - 0.020, blY, blZ, blX - 0.024, blY + 0.088, blZ, 0.005, 0.0045, 7, true);
  // T-bar copper dive grip
  m.tag(23, 3);
  m.cyl(blX - 0.048, blY + 0.092, blZ, blX + 0.002, blY + 0.092, blZ, 0.009, 0.009, 8, true);

  // --- 8. PART 4: Twin Hanging Warm Tungsten Brass Cabin Lanterns (upper corners) ---
  for (const sx of [-1, 1]) {
    const [gx, gy, lz] = BRIDGE_GLOBE, lx = sx * gx;
    m.tag(21, 4);
    m.cyl(lx, BRIDGE_PIVOT_Y, lz, lx, gy + 0.015, lz, 0.004, 0.014, 8, true);
    m.cyl(lx, gy - 0.027, lz, lx, gy - 0.016, lz, 0.013, 0.007, 8, true);
    m.tag(35, 4);
    m.ellipsoid(lx, gy, lz, 0.014, 0.020, 0.014, 14, 10);
  }

  // --- 9. PART 5: Cute Copper-Helmeted Companion Friend Co-Pilot on Starboard Seat! ---
  const cpX = 0.40, cpY = -0.23, cpZ = -0.17;
  const cpQ = qAxis(0, 1, 0, 0.42);
  // Vintage canvas shoulders + copper corselet
  m.tag(23, 5);
  m.ellipsoid(cpX, cpY - 0.10, cpZ, 0.095, 0.065, 0.075, 12, 8, cpQ);
  m.tag(21, 5);
  m.torus(cpX, cpY - 0.055, cpZ, 0.072, 0.010, 12, 6, 'y');
  // Antique copper Mark V diving helmet + brass portholes + warm glowing visor
  m.tag(23, 5);
  m.ellipsoid(cpX, cpY + 0.03, cpZ, 0.088, 0.092, 0.088, 16, 12, cpQ);
  const fOff = qRot(cpQ, 0, 0, -0.082);
  const sOff = qRot(cpQ, -0.082, 0, 0);
  m.tag(21, 5);
  m.torus(cpX + fOff[0], cpY + 0.03, cpZ + fOff[2], 0.048, 0.009, 14, 6, 'z', cpQ);
  m.torus(cpX + sOff[0], cpY + 0.03, cpZ + sOff[2], 0.032, 0.007, 12, 5, 'x', cpQ);
  m.tag(31, 5);
  m.ellipsoid(cpX + fOff[0], cpY + 0.03, cpZ + fOff[2], 0.043, 0.043, 0.014, 12, 8, cpQ);
  m.ellipsoid(cpX + sOff[0], cpY + 0.03, cpZ + sOff[2], 0.012, 0.028, 0.028, 10, 7, cpQ);


  // --- 6. REAR CREW CABIN: riveted elliptical hull, real side portholes, ribs, deck, lamps & furniture ---
  {
    const NT = CAB.NT, NZ = CAB.NZ, dT = TAU / NT, dZ = (CAB.Z1 - CAB.Z0) / NZ;
    const P = (t, z) => [CAB.RX * cos(t), CAB.YC + CAB.RY * sin(t), z];
    const inPort = (a, b) => CAB.PORTS.some((pt) => (a === pt[0] || a === (pt[0] - 1 + NT) % NT || a === (pt[0] + 1) % NT) && b >= pt[1] && b <= pt[1] + 2);
    m.tag(20, 0);
    for (let a = 0; a < NT; a++) for (let b = 0; b < NZ; b++) {
      if (inPort(a, b)) continue;
      const t0 = a * dT, t1 = (a + 1) * dT, z0 = CAB.Z0 + b * dZ, z1 = z0 + dZ;
      const ao0 = 0.55 + 0.45 * Math.max(0, Math.min(1, (sin(t0) + 0.6) * 1.2)), ao1 = 0.55 + 0.45 * Math.max(0, Math.min(1, (sin(t1) + 0.6) * 1.2));
      const v0 = m.v(...P(t0, z0), ao0, a / NT, b / NZ), v1 = m.v(...P(t1, z0), ao1, (a + 1) / NT, b / NZ);
      const v2 = m.v(...P(t1, z1), ao1, (a + 1) / NT, (b + 1) / NZ), v3 = m.v(...P(t0, z1), ao0, a / NT, (b + 1) / NZ);
      m.quad(v0, v1, v2, v3);
    }
    // Porthole plates: annulus from the round window to the square wall opening (no gaps)
    for (const pt of CAB.PORTS) {
      const tc = (pt[0] + 0.5) * dT, zc = CAB.Z0 + (pt[1] + 1.5) * dZ, sp = CAB.RY, ht = 1.5 * dT * sp, hz = 1.5 * dZ, r = CAB.PR;
      const angs = [];
      for (let k = 0; k < 32; k++) angs.push(k / 32 * TAU);
      for (const c of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) { let q = Math.atan2(c[1] * hz, c[0] * ht); if (q < 0) q += TAU; angs.push(q); }
      angs.sort((x, y) => x - y); angs.push(angs[0] + TAU);
      const tp = (ot, oz) => P(tc + ot / sp, zc + oz);
      for (let k = 0; k < angs.length - 1; k++) {
        const pts = [angs[k], angs[k + 1]].map((q) => {
          const ca = cos(q), sa = sin(q);
          const sq = Math.min(ht / Math.max(Math.abs(ca), 1e-6), hz / Math.max(Math.abs(sa), 1e-6));
          return [m.v(...tp(r * ca, r * sa), 0.8), m.v(...tp(sq * ca, sq * sa), 0.9)];
        });
        m.quad(pts[0][0], pts[0][1], pts[1][1], pts[1][0]);
      }
      const c = P(tc, zc);
      m.tag(21, 0);
      m.torus(c[0] * 0.985, c[1], c[2], r + 0.014, 0.018, 26, 8, 'x');
      m.torus(c[0] * 0.965, c[1], c[2], r + 0.006, 0.008, 26, 6, 'x');
      for (let k = 0; k < 12; k++) { const q = k / 12 * TAU; m.ellipsoid(c[0] * 0.972, c[1] + cos(q) * (r + 0.04), c[2] + sin(q) * (r + 0.04), 0.008, 0.008, 0.008, 6, 5); }
      for (const q of [0.6, 2.5, 4.4]) m.cyl(c[0] * 0.97, c[1] + cos(q) * (r + 0.02), c[2] + sin(q) * (r + 0.02), c[0] * 0.93, c[1] + cos(q) * (r + 0.05), c[2] + sin(q) * (r + 0.05), 0.006, 0.004, 5, true);
      m.tag(20, 0);
    }
    // Brass ribs and bulkhead frame
    m.tag(21, 0);
    for (const zi of [0, 7, 14, 21, 32]) {
      const z = CAB.Z0 + zi * dZ + (zi === 0 ? 0.004 : 0), pts = [];
      for (let k = 0; k <= 40; k++) { const t = k / 40 * TAU; pts.push([CAB.RX * 0.965 * cos(t), CAB.YC + CAB.RY * 0.965 * sin(t), z]); }
      m.tube(pts, zi === 0 ? 0.026 : 0.016, 8, false);
    }
    // Raised mahogany plank deck + step
    m.tag(22, 0);
    m.box(0, CAB.FLOOR - 0.015, (CAB.Z0 + CAB.Z1) / 2, 0.5, 0.015, (CAB.Z1 - CAB.Z0) / 2, null, 0.6);
    for (let k = -3; k <= 3; k++) { m.tag(21, 0); m.box(k * 0.14, CAB.FLOOR + 0.001, (CAB.Z0 + CAB.Z1) / 2, 0.003, 0.002, (CAB.Z1 - CAB.Z0) / 2 - 0.02, null, 0.7); }
    m.tag(20, 0);
    m.box(0, (CAB.FLOOR - 0.48) / 2, CAB.Z0 + 0.01, 0.5, (CAB.FLOOR + 0.48) / 2, 0.012, null, 0.6);
    // Rear pressure bulkhead with round hatch & handwheel
    {
      const c = m.v(0, CAB.YC, CAB.Z1, 0.7), ring = [];
      for (let k = 0; k <= 40; k++) { const t = k / 40 * TAU; ring.push(m.v(CAB.RX * cos(t), CAB.YC + CAB.RY * sin(t), CAB.Z1, 0.85)); }
      for (let k = 0; k < 40; k++) m.tri(c, ring[k], ring[k + 1]);
      m.tag(21, 0);
      m.torus(0, CAB.YC + 0.02, CAB.Z1 - 0.012, 0.21, 0.02, 28, 8, 'z');
      m.tag(23, 6);
      m.cyl(0, CAB.YC + 0.02, CAB.Z1 - 0.004, 0, CAB.YC + 0.02, CAB.Z1 - 0.02, 0.2, 0.2, 28, true);
      m.tag(24, 6);
      m.torus(0, CAB.YC + 0.02, CAB.Z1 - 0.05, 0.075, 0.009, 18, 6, 'z');
      for (let k = 0; k < 4; k++) { const q = k / 4 * PI; m.cyl(-cos(q) * 0.075, CAB.YC + 0.02 - sin(q) * 0.075, CAB.Z1 - 0.05, cos(q) * 0.075, CAB.YC + 0.02 + sin(q) * 0.075, CAB.Z1 - 0.05, 0.006, 0.006, 6, false); }
      m.cyl(0, CAB.YC + 0.02, CAB.Z1 - 0.02, 0, CAB.YC + 0.02, CAB.Z1 - 0.05, 0.012, 0.012, 8, true);
    }
    m.tag(29, 6, 0.5, 0.85);
    m.ellipsoid(0.14, CAB.YC + 0.2, CAB.Z1 - 0.03, 0.012, 0.012, 0.008, 8, 6); // airlock status lamp
    // Doorway frame between observation room and mess
    m.tag(21, 0);
    m.tube([[-0.28, CAB.FLOOR, CAB.DOOR], [-0.28, 0.3, CAB.DOOR], [-0.15, 0.42, CAB.DOOR], [0.15, 0.42, CAB.DOOR], [0.28, 0.3, CAB.DOOR], [0.28, CAB.FLOOR, CAB.DOOR]], 0.022, 8, false);
    m.tag(20, 0);
    for (const sx of [-1, 1]) m.box(sx * 0.42, 0.05, CAB.DOOR, 0.14, 0.42, 0.015, null, 0.7);
    // Mess: table & four chairs
    m.tag(22, 0);
    m.box(0, CAB.FLOOR + 0.2, CAB.MESS, 0.13, 0.012, 0.2, null, 0.9);
    m.tag(21, 0);
    m.cyl(0, CAB.FLOOR, CAB.MESS, 0, CAB.FLOOR + 0.19, CAB.MESS, 0.018, 0.012, 8, true);
    m.cyl(0, CAB.FLOOR + 0.002, CAB.MESS, 0, CAB.FLOOR + 0.008, CAB.MESS, 0.07, 0.07, 12, true);
    for (const cx of [-0.24, 0.24]) for (const cz of [-0.1, 0.1]) {
      m.tag(22, 0);
      m.box(cx, CAB.FLOOR + 0.12, CAB.MESS + cz, 0.055, 0.01, 0.055, null, 0.85);
      m.box(cx + Math.sign(cx) * 0.055, CAB.FLOOR + 0.2, CAB.MESS + cz, 0.008, 0.08, 0.05, null, 0.8);
      m.tag(21, 0);
      m.cyl(cx, CAB.FLOOR, CAB.MESS + cz, cx, CAB.FLOOR + 0.11, CAB.MESS + cz, 0.009, 0.009, 6, false);
    }
    m.tag(34, 0);
    for (const q of [[-0.06, -0.1], [0.05, 0.08]]) m.cyl(q[0], CAB.FLOOR + 0.212, CAB.MESS + q[1], q[0], CAB.FLOOR + 0.25, CAB.MESS + q[1], 0.014, 0.013, 8, true);
    m.tag(29, 0, 0.5, 0.5);
    m.ellipsoid(0, CAB.FLOOR + 0.25, CAB.MESS, 0.018, 0.028, 0.018, 8, 6);
    // Bunk room: two-tier bunks on both sides
    for (const sx of [-1, 1]) for (const tier of [0, 1]) {
      const by = CAB.FLOOR + 0.1 + tier * 0.26, bx = sx * 0.33, bz = CAB.BUNK + 0.05;
      m.tag(21, 0);
      for (const cz of [-0.3, 0.3]) for (const cx of [-0.1, 0.1]) m.cyl(bx + cx, CAB.FLOOR, bz + cz, bx + cx, CAB.FLOOR + 0.5, bz + cz, 0.008, 0.008, 6, false);
      m.box(bx, by - 0.012, bz, 0.115, 0.01, 0.31, null, 0.8);
      m.tag(34, 0);
      m.box(bx, by + 0.012, bz, 0.105, 0.018, 0.29, null, 0.85);
      m.ellipsoid(bx, by + 0.04, bz - 0.23, 0.07, 0.022, 0.04, 10, 6);
      m.tag(33, 0);
      m.box(bx, by + 0.034, bz + 0.07, 0.108, 0.008, 0.2, null, 0.9);
    }
    // Repair panel with gauge & brass lever (rear starboard)
    m.tag(20, 0);
    m.box(0.47, CAB.FLOOR + 0.3, 3.3, 0.02, 0.14, 0.1, null, 0.7);
    m.tag(24, 0);
    m.cyl(0.45, CAB.FLOOR + 0.24, 3.34, 0.39, CAB.FLOOR + 0.32, 3.34, 0.008, 0.008, 6, true);
    m.ellipsoid(0.39, CAB.FLOOR + 0.32, 3.34, 0.016, 0.016, 0.016, 8, 6);
    m.tag(21, 0);
    m.torus(0.452, CAB.FLOOR + 0.36, 3.27, 0.035, 0.006, 14, 5, 'x');

    // Ceiling lanterns (warm tungsten) with brass cages (including above the Tempat Helm rack!)
    for (const lz of HALL_GLOBE_Z) {
      m.tag(21, 0);
      m.cyl(0, CAB.YC + CAB.RY * 0.96, lz, 0, CAB.YC + CAB.RY * 0.82, lz, 0.008, 0.008, 6, false);
      m.cyl(0, CAB.YC + CAB.RY * 0.84, lz, 0, CAB.YC + CAB.RY * 0.80, lz, 0.045, 0.03, 12, true);
      for (let k = 0; k < 4; k++) { const q = k / 4 * TAU; m.cyl(cos(q) * 0.034, CAB.YC + CAB.RY * 0.8, lz + sin(q) * 0.034, cos(q) * 0.03, CAB.YC + CAB.RY * 0.7, lz + sin(q) * 0.03, 0.003, 0.003, 4, false); }
      m.tag(35, 0);
      m.ellipsoid(0, HALL_GLOBE_Y, lz, 0.027, 0.035, 0.027, 14, 10);
    }
    // Copper pipes along the ceiling & a crimson valve wheel
    m.tag(23, 0);
    for (const px of [-0.3, 0.3]) m.cyl(px, CAB.YC + CAB.RY * 0.82, CAB.Z0, px, CAB.YC + CAB.RY * 0.82, CAB.Z1, 0.014, 0.014, 8, false);
    m.cyl(0.42, CAB.YC + 0.35, 1.4, 0.42, CAB.FLOOR, 1.4, 0.016, 0.016, 8, false);
    m.tag(24, 0);
    m.torus(0.5, CAB.YC + 0.22, 1.4, 0.055, 0.008, 16, 6, 'x');
    // Port bench & starboard chart table
    m.tag(22, 0);
    m.box(-0.38, CAB.FLOOR + 0.12, 1.05, 0.12, 0.018, 0.17, null, 0.8);
    m.box(-0.47, CAB.FLOOR + 0.25, 1.05, 0.02, 0.12, 0.17, null, 0.7);
    m.box(0.36, CAB.FLOOR + 0.22, 0.86, 0.12, 0.012, 0.13, null, 0.85);
    m.tag(21, 0);
    for (const lz of [0.75, 0.97]) m.cyl(0.33, CAB.FLOOR, lz, 0.33, CAB.FLOOR + 0.21, lz, 0.008, 0.008, 6, false);
    m.cyl(-0.3, CAB.FLOOR, 0.92, -0.3, CAB.FLOOR + 0.11, 0.92, 0.008, 0.008, 6, false);
    m.cyl(-0.3, CAB.FLOOR, 1.18, -0.3, CAB.FLOOR + 0.11, 1.18, 0.008, 0.008, 6, false);

    // --- TEMPAT HELM SCUBA (6-Slot Brass & Mahogany Diving Helmet Rack at z = 2.32..2.62) ---
    // Right inside the cabin forward of the airlock/bunks: 3 helmets on Port + 3 helmets on Starboard!
    // Each helmet is rendered at full 1.4x scuba scale matching the crew (parts 11..16 -> slots 0..5).
    {
      const helmCabinS = HELMET_SCALE * 0.485; // matches the enlarged worn helmets
      const rackMats = { dome: 23, brass: 21, glass: 31, lamp: 29, inner: 20 };
      for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
        const sx = sideIdx === 0 ? -1 : 1;
        const rx = sx * 0.405;
        const faceYaw = sx < 0 ? -PI / 2 : PI / 2; // helmets face inward toward the walkway!
        // Polished mahogany lower & upper rack shelves + vertical brass stanchions + retention rail
        m.tag(22, 0);
        m.box(rx, CAB.FLOOR + 0.095, 2.47, 0.115, 0.013, 0.225, null, 0.86);
        m.box(rx, CAB.FLOOR + 0.355, 2.47, 0.105, 0.013, 0.145, null, 0.88);
        m.tag(21, 0);
        for (const pz of [2.26, 2.68]) {
          m.cyl(rx - sx * 0.095, CAB.FLOOR, pz, rx - sx * 0.095, CAB.FLOOR + 0.56, pz, 0.0085, 0.0085, 7, true);
        }
        // Brass helmet-retaining front guard bar & nameplate strip
        m.cyl(rx - sx * 0.102, CAB.FLOOR + 0.132, 2.26, rx - sx * 0.102, CAB.FLOOR + 0.132, 2.68, 0.005, 0.005, 6, true);
        m.cyl(rx - sx * 0.092, CAB.FLOOR + 0.392, 2.33, rx - sx * 0.092, CAB.FLOOR + 0.392, 2.61, 0.005, 0.005, 6, true);

        // 3 brass collar pedestals per side: 1 upper-center + 2 lower-flanking
        const slots = [
          { part: sideIdx === 0 ? 11 : 14, y: CAB.FLOOR + 0.368, z: 2.47, idx: sideIdx === 0 ? 0 : 3 },
          { part: sideIdx === 0 ? 12 : 15, y: CAB.FLOOR + 0.108, z: 2.35, idx: sideIdx === 0 ? 1 : 4 },
          { part: sideIdx === 0 ? 13 : 16, y: CAB.FLOOR + 0.108, z: 2.59, idx: sideIdx === 0 ? 2 : 5 },
        ];
        for (const sl of slots) {
          // Brass neck-ring stand (always visible even if a bot hasn't boarded yet)
          m.tag(21, 0);
          m.cyl(rx, sl.y, sl.z, rx, sl.y + 0.024, sl.z, 0.068, 0.058, 14, true);
          m.torus(rx, sl.y + 0.024, sl.z, 0.062, 0.007, 14, 6, 'y');
          // Warm filament slot-occupied indicator bulb on the shelf edge
          m.tag(29, 0, (sl.idx + 0.5) / 6, 0.2);
          m.ellipsoid(rx - sx * 0.105, sl.y - 0.012, sl.z, 0.007, 0.007, 0.007, 7, 6);
          // Stowed 1.4x Mark V Scuba Helmet (appears on stand when that crew member is aboard!)
          addScubaHelmet(m, sl.part, helmCabinS, rx, sl.y + 0.022, sl.z, faceYaw, false, rackMats);
        }
      }
    }

    // Brass-trimmed teak standing helm platform right near the wheel (z = -0.23) — no far-back chair!
    m.tag(22, 0);
    m.cyl(0, -0.478, -0.23, 0, -0.466, -0.23, 0.165, 0.158, 22, true);
    m.tag(21, 0);
    m.torus(0, -0.467, -0.23, 0.160, 0.0075, 22, 6, 'y');
  }
  return m.build();
}

// Curved transparent viewport shell rendered over the world in the 3D bridge.
// The bent front, two side panes, and overhead skylight make the glazing feel like a
// continuous, thick Jules Verne dome rather than an empty hole or a flat overlay.
export function buildCockpitGlassMesh() {
  const m = new EntityMesh();
  m.tag(32, 0);

  // Loft the front pane exactly inside the brass arch. The old x +/-1.22 pane
  // extended far outside its half-meter frame, leaving a conspicuous rectangle.
  const U = 32, V = 18, front = [];
  for (let j = 0; j <= V; j++) {
    const v = j / V;
    const row = [];
    for (let k = 0; k <= U; k++) {
      const u = k / U * 2 - 1;
      const x = u * mix(0.505, 0.42, v);
      const y = mix(-0.18, 0.42, v) + (1 - u * u) * 0.085 * v * v;
      const z = mix(-0.35, -0.46, v) - (1 - u * u) * mix(0.27, 0.06, v);
      row.push(m.v(x, y, z, 1, k / U, v));
    }
    front.push(row);
  }
  for (let j = 0; j < V; j++) {
    for (let k = 0; k < U; k++) {
      m.quad(front[j][k], front[j][k + 1], front[j + 1][k + 1], front[j + 1][k]);
    }
  }

  // Bowed side panes meet the front at the A-pillars and meet the cupola above.
  for (const side of [-1, 1]) {
    const rows = [];
    for (let j = 0; j <= 14; j++) {
      const v = j / 14;
      const row = [];
      for (let k = 0; k <= 16; k++) {
        const u = k / 16;
        const z = mix(mix(-0.35, -0.46, v), 0.16, u);
        const x = side * (mix(0.505, 0.42, v) + 0.035 * sin(u * PI) * sin(v * PI));
        const y = mix(-0.18, 0.42, v) + 0.025 * sin(u * PI) * sin(v * PI);
        row.push(m.v(x, y, z, 1, u, v));
      }
      rows.push(row);
    }
    for (let j = 0; j < 14; j++) {
      for (let k = 0; k < 16; k++) {
        if (side > 0) m.quad(rows[j][k], rows[j][k + 1], rows[j + 1][k + 1], rows[j + 1][k]);
        else m.quad(rows[j][k + 1], rows[j][k], rows[j + 1][k], rows[j + 1][k + 1]);
      }
    }
  }

  // The skylight shares the front pane's curved brow, with no hard seam.
  const roof = [];
  for (let j = 0; j <= 12; j++) {
    const v = j / 12;
    const row = [];
    for (let k = 0; k <= 20; k++) {
      const u = k / 20 * 2 - 1;
      const z = mix(-0.46 - (1 - u * u) * 0.06, 0.16, v);
      const x = u * mix(0.42, 0.40, v);
      const y = 0.42 + (1 - u * u) * mix(0.085, 0.105, v) + sin(v * PI) * 0.025;
      row.push(m.v(x, y, z, 1, k / 20, v));
    }
    roof.push(row);
  }
  for (let j = 0; j < 12; j++) {
    for (let k = 0; k < 20; k++) {
      m.quad(roof[j][k], roof[j][k + 1], roof[j + 1][k + 1], roof[j + 1][k]);
    }
  }

  // Side porthole panes of the rear crew cabin
  {
    const dT = TAU / CAB.NT, dZ = (CAB.Z1 - CAB.Z0) / CAB.NZ;
    for (const pt of CAB.PORTS) {
      const t = (pt[0] + 0.5) * dT, zc = CAB.Z0 + (pt[1] + 1.5) * dZ;
      const cx = CAB.RX * cos(t) * 0.99, cy = CAB.YC + CAB.RY * sin(t);
      const c = m.v(cx, cy, zc, 1, 0.5, 0.5), ring = [];
      for (let k = 0; k <= 24; k++) { const q = k / 24 * TAU; ring.push(m.v(cx, cy + cos(q) * (CAB.PR + 0.006), zc + sin(q) * (CAB.PR + 0.006), 1, 0.5 + 0.5 * cos(q), 0.5 + 0.5 * sin(q))); }
      for (let k = 0; k < 24; k++) m.tri(c, ring[k], ring[k + 1]);
    }
  }
  return m.build();
}

// Open tapered cone mesh in standard 16-byte vbSolid format for volumetric light beams
export function buildBeamMesh() {
  const m = new Mesh();
  const seg = 24, ringsN = 8, rings = [];
  for (let j = 0; j <= ringsN; j++) {
    const t = j / ringsN;
    const r = [];
    for (let s = 0; s < seg; s++) {
      const a = s / seg * TAU;
      r.push(m.v(cos(a), sin(a), t, 1));
    }
    rings.push(r);
  }
  for (let j = 0; j < ringsN; j++) {
    for (let s = 0; s < seg; s++) {
      const s2 = (s + 1) % seg;
      m.quad(rings[j][s], rings[j][s2], rings[j + 1][s2], rings[j + 1][s]);
    }
  }
  return m.build();
}

// ---------------------------------------------------------------- Megalodon (Otodus megalodon)
// Local space: -Z = snout, +Z = tail, +Y = dorsal. Body length 1.0 (instance scale = metres).
// Materials: 40=skin, 41=eye/nostril, 42=fin, 43=serrated teeth, 44=crimson inner oral cavity & gums
// Parts: 0=upper skull & body, 1=dorsal, 2=left pectoral, 3=right pectoral, 4=caudal, 5=small fins,
//        6=articulated 3D lower jaw, 7=upper gum & teeth, 8=articulated lower gum & teeth
export const MEGA_BODY = [
  // [z, halfWidth, dorsalH, ventralH, centreY]
  [-0.528, 0.007, 0.006, 0.005, 0.015],
  [-0.515, 0.028, 0.019, 0.013, 0.015],
  [-0.494, 0.051, 0.035, 0.019, 0.014],
  [-0.468, 0.072, 0.052, 0.025, 0.012], // overhanging subterminal Great White snout
  [-0.435, 0.090, 0.072, 0.032, 0.008], // eye & supraorbital brow ridge station
  [-0.395, 0.105, 0.092, 0.038, 0.004], // mid-mouth cheek
  [-0.345, 0.118, 0.109, 0.046, 0.001], // masseter jaw muscle
  [-0.295, 0.125, 0.120, 0.094, -0.002], // jaw hinge joins throat seamlessly
  [-0.230, 0.129, 0.128, 0.112, -0.004], // gill chamber
  [-0.140, 0.131, 0.132, 0.118, -0.004], // peak pectoral girth
  [-0.030, 0.124, 0.126, 0.112, -0.002],
  [0.070, 0.108, 0.112, 0.098, 0.002],
  [0.165, 0.084, 0.090, 0.078, 0.006],
  [0.250, 0.056, 0.064, 0.055, 0.010],
  [0.320, 0.034, 0.042, 0.036, 0.014],
  [0.372, 0.021, 0.028, 0.024, 0.018],
  [0.410, 0.015, 0.020, 0.018, 0.020],
  [0.440, 0.012, 0.022, 0.020, 0.022],
];

export function buildMegalodonMesh() {
  const m = new EntityMesh();
  const sstepLocal = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const R = 32, rings = [];

  // 1. Watertight Upper Cranium, Overhanging Rostrum & Muscular Fusiform Torso (Part 0)
  m.tag(40, 0);
  for (let i = 0; i < MEGA_BODY.length; i++) {
    const [z, w, hUp, hDn, yc] = MEGA_BODY[i];
    // Smooth weight across the subterminal mouth opening [-0.465 .. -0.298]
    const mouthW = sstepLocal(-0.482, -0.452, z) * sstepLocal(-0.282, -0.312, z);
    const browW = Math.exp(-pow((z + 0.415) / 0.042, 2));
    const lipY = -0.016 - (z + 0.465) * 0.048;
    const ring = [];
    for (let k = 0; k <= R; k++) {
      const a = k / R * TAU, ca = cos(a), sa = sin(a);
      const keel = i >= 13 ? 1 + 0.62 * pow(Math.abs(ca), 6) : 1; // caudal peduncle lateral keels
      // Sculpted supraorbital brow ridge above the eyes for a fierce Great White silhouette
      const brow = sa > 0.15 ? browW * 0.008 * pow(Math.abs(ca), 1.6) * sin(clamp((sa - 0.15) / 0.7, 0, 1) * PI) : 0;
      let x = ca * (w + brow) * keel;
      let y;
      if (sa >= 0) {
        y = yc + hUp * pow(sa, 0.94) + brow * 0.7;
      } else {
        const bellyY = yc + hDn * sa;
        // Vault the underside upward inside the mouth zone to form a real concave upper palate!
        const palateY = lipY + (-sa) * 0.024;
        y = mix(bellyY, palateY, mouthW);
      }
      const ao = mouthW > 0.35 && sa < -0.2 ? 0.42 : (0.62 + 0.38 * (sa * 0.5 + 0.5));
      ring.push(m.v(x, y, z, ao, k / R, i / (MEGA_BODY.length - 1)));
    }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < R; k++) {
      m.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k + 1], rings[i][k + 1]);
    }
  }
  {
    const last = rings[rings.length - 1];
    const c = m.v(0, MEGA_BODY[MEGA_BODY.length - 1][4], 0.445, 0.72);
    for (let k = 0; k < R; k++) m.tri(last[k], c, last[k + 1]);
  }

  // 2. Crimson Upper Oral Palate & Gum Arch tucked cleanly inside the upper snout (Part 7, Mat 44)
  m.tag(44, 7);
  {
    const uRows = [];
    const NZ = 8, NU = 16;
    for (let iz = 0; iz <= NZ; iz++) {
      const v = iz / NZ;
      const z = mix(-0.458, -0.305, v);
      const hw = mix(0.048, 0.098, pow(v, 0.72));
      const lipY = -0.015 - (z + 0.465) * 0.048;
      const row = [];
      for (let iu = 0; iu <= NU; iu++) {
        const u = (iu / NU) * 2 - 1;
        const arch = 1 - u * u;
        row.push(m.v(u * hw, lipY + 0.003 + arch * 0.019, z, 0.45 + 0.25 * (1 - arch), iu / NU, v));
      }
      uRows.push(row);
    }
    for (let iz = 0; iz < NZ; iz++) {
      for (let iu = 0; iu < NU; iu++) {
        // Downward-facing normal (visible when looking up into the open shark maw!)
        m.quad(uRows[iz][iu], uRows[iz][iu + 1], uRows[iz + 1][iu + 1], uRows[iz + 1][iu]);
      }
    }
  }

  // 3. Separate Articulated 3D Lower Jaw / Mandible (Part 6, Mat 40) + Crimson Mouth Floor (Part 8, Mat 44)
  // Hinges cleanly downward around (0, -0.026, -0.300) in W_MEGA without any vertex inversion!
  const JAW_STATIONS = [
    // [z, halfWidth, topLipY, bellyDepth]
    [-0.458, 0.010, -0.020, 0.008],
    [-0.446, 0.044, -0.020, 0.024],
    [-0.422, 0.066, -0.022, 0.038],
    [-0.388, 0.085, -0.024, 0.053],
    [-0.348, 0.100, -0.026, 0.066],
    [-0.305, 0.108, -0.027, 0.072],
    [-0.276, 0.094, -0.032, 0.058], // tucks cleanly into the throat so hinge never gaps!
  ];
  m.tag(40, 6);
  {
    const JR = 24, jRings = [];
    for (let i = 0; i < JAW_STATIONS.length; i++) {
      const [z, jw, yTop, depth] = JAW_STATIONS[i];
      const ring = [];
      for (let k = 0; k <= JR; k++) {
        const a = k / JR * TAU, ca = cos(a), sa = sin(a);
        const x = ca * jw;
        // sa <= 0 is the white lower chin/jaw; sa > 0 dips slightly into the oral floor
        const y = sa <= 0 ? (yTop + sa * depth) : (yTop - sin(sa * PI * 0.5) * 0.009);
        const ao = sa > 0.15 ? 0.45 : (0.68 + 0.25 * (-sa));
        ring.push(m.v(x, y, z, ao, k / JR, i / (JAW_STATIONS.length - 1)));
      }
      jRings.push(ring);
    }
    for (let i = 0; i < jRings.length - 1; i++) {
      for (let k = 0; k < JR; k++) {
        m.quad(jRings[i][k], jRings[i + 1][k], jRings[i + 1][k + 1], jRings[i][k + 1]);
      }
    }
    const lastJ = jRings[jRings.length - 1];
    const cj = m.v(0, -0.055, -0.274, 0.6);
    for (let k = 0; k < JR; k++) m.tri(lastJ[k], cj, lastJ[k + 1]);
  }
  // Crimson lower gum & tongue floor on top of the lower mandible (Part 8, Mat 44)
  m.tag(44, 8);
  {
    const lRows = [];
    const NZ = 6, NU = 14;
    for (let iz = 0; iz <= NZ; iz++) {
      const v = iz / NZ;
      const z = mix(-0.446, -0.305, v);
      const hw = mix(0.038, 0.094, pow(v, 0.68));
      const yTop = mix(-0.020, -0.027, v);
      const row = [];
      for (let iu = 0; iu <= NU; iu++) {
        const u = (iu / NU) * 2 - 1;
        const basin = 1 - u * u;
        row.push(m.v(u * hw, yTop + 0.002 - basin * 0.008, z, 0.48 + 0.3 * (1 - basin), iu / NU, v));
      }
      lRows.push(row);
    }
    for (let iz = 0; iz < NZ; iz++) {
      for (let iu = 0; iu < NU; iu++) {
        // Upward-facing normal
        m.quad(lRows[iz][iu + 1], lRows[iz][iu], lRows[iz + 1][iu], lRows[iz + 1][iu + 1]);
      }
    }
  }

  // 4. Gleaming Flattened Triangular Serrated Shark Teeth (strictly inside upper & lower gum arches!)
  // Upper teeth (Part 7, Mat 43) — broad triangular blades angled slightly inward
  m.tag(43, 7);
  for (let rowIdx = 0; rowIdx < 2; rowIdx++) {
    const inset = rowIdx * 0.009;
    const nT = rowIdx === 0 ? 18 : 14;
    for (let k = 0; k <= nT; k++) {
      const u = (k / nT) * 2 - 1;
      const ph = u * 1.18;
      const z = -0.448 + inset + (1 - cos(ph)) * 0.098;
      const maxW = mix(0.044, 0.092, clamp((z + 0.45) / 0.12, 0, 1)) - inset;
      const x = sin(ph) * maxW;
      const y0 = -0.015 - (z + 0.465) * 0.048 + 0.003;
      const len = (0.021 - Math.abs(u) * 0.006) * (rowIdx === 0 ? 1.0 : 0.72);
      const wBase = (0.0062 - Math.abs(u) * 0.0018) * (rowIdx === 0 ? 1.0 : 0.78);
      m.cyl(x, y0, z, x * 0.92, y0 - len, z + 0.003, wBase, 0.0005, 6, true, 0.38);
    }
  }
  // Two staggered lower rows hinge down with the mandible to reveal the full bite.
  m.tag(43, 8);
  for (let rowIdx = 0; rowIdx < 2; rowIdx++) {
    const nT = rowIdx === 0 ? 16 : 12, inset = rowIdx * 0.009;
    for (let k = 0; k <= nT; k++) {
      const u = (k / nT) * 2 - 1;
      const ph = u * 1.15;
      const z = -0.438 + inset + (1 - cos(ph)) * 0.090;
      const maxW = mix(0.036, 0.082, clamp((z + 0.44) / 0.11, 0, 1)) - inset;
      const x = sin(ph) * maxW;
      const y0 = mix(-0.020, -0.026, clamp((z + 0.44) / 0.13, 0, 1)) - 0.001;
      const len = (0.018 - Math.abs(u) * 0.005) * (rowIdx === 0 ? 1 : 0.72);
      const wBase = (0.0052 - Math.abs(u) * 0.0014) * (rowIdx === 0 ? 1 : 0.75);
      m.cyl(x, y0, z, x * 0.93, y0 + len, z + 0.002, wBase, 0.0004, 6, true, 0.40);
    }
  }

  // 5. Lofted Hydrodynamic Fins (Dorsal, Pectorals, Pelvic, 2nd Dorsal, Anal & Crescent Caudal)
  const fin = (a0, a1, tip, nrm, th, rows = 6, sweep = 0) => {
    const top = [], bot = [];
    for (let r = 0; r <= rows; r++) {
      const v = r / rows, e = v * v;
      const L = a0.map((c, j) => c + (tip[j] - c) * v);
      const T = a1.map((c, j) => c + (tip[j] - c) * pow(v, 0.8));
      const cv = sin(v * PI) * sweep;
      const rowT = [], rowB = [];
      for (let c = 0; c <= 4; c++) {
        const u = c / 4;
        const p = L.map((q, j) => q + (T[j] - q) * u);
        p[2] += cv * (1 - u);
        const t = th * (1 - e * 0.85) * sin(PI * (0.08 + 0.84 * (1 - Math.abs(u - 0.35) / 0.65 * 0.9)));
        rowT.push(m.v(p[0] + nrm[0] * t, p[1] + nrm[1] * t, p[2] + nrm[2] * t, 0.9, u, v));
        rowB.push(m.v(p[0] - nrm[0] * t, p[1] - nrm[1] * t, p[2] - nrm[2] * t, 0.75, u, v));
      }
      top.push(rowT); bot.push(rowB);
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < 4; c++) {
      m.quad(top[r][c], top[r + 1][c], top[r + 1][c + 1], top[r][c + 1]);
      m.quad(bot[r][c + 1], bot[r + 1][c + 1], bot[r + 1][c], bot[r][c]);
    }
    for (let r = 0; r < rows; r++) { m.quad(top[r][0], bot[r][0], bot[r + 1][0], top[r + 1][0]); m.quad(bot[r][4], top[r][4], top[r + 1][4], bot[r + 1][4]); }
  };
  m.tag(42, 1); fin([0, 0.122, -0.13], [0, 0.112, 0.03], [0, 0.315, 0.06], [1, 0, 0], 0.02, 8, 0.03);          // first dorsal
  for (const sd of [-1, 1]) {
    m.tag(42, sd < 0 ? 2 : 3);
    fin([sd * 0.108, -0.055, -0.23], [sd * 0.102, -0.065, -0.10], [sd * 0.385, -0.18, 0.03], [0, 1, 0.15], 0.014, 8, 0.05); // pectoral
    m.tag(42, 5);
    fin([sd * 0.045, -0.07, 0.17], [sd * 0.035, -0.06, 0.23], [sd * 0.10, -0.12, 0.27], [0, 1, 0], 0.006, 4);       // pelvic
  }
  m.tag(42, 5);
  fin([0, 0.045, 0.27], [0, 0.04, 0.31], [0, 0.095, 0.33], [1, 0, 0], 0.006, 4);    // second dorsal
  fin([0, -0.035, 0.28], [0, -0.03, 0.32], [0, -0.08, 0.34], [1, 0, 0], 0.006, 4);  // anal
  m.tag(42, 4);
  fin([0, 0.03, 0.40], [0, 0.012, 0.445], [0, 0.275, 0.62], [1, 0, 0], 0.012, 9, -0.04);   // upper caudal lobe
  fin([0, 0.0, 0.405], [0, 0.01, 0.445], [0, -0.195, 0.57], [1, 0, 0], 0.011, 8, -0.03);  // lower caudal lobe

  // 6. Deep-Set Predatory Black Shark Eyes (under brow ridge) & Underside Snout Nostrils
  m.tag(41, 0);
  for (const sd of [-1, 1]) {
    const eq = qAxis(0, 1, 0, sd * -0.34);
    m.ellipsoid(sd * 0.080, 0.025, -0.418, 0.0065, 0.0095, 0.0115, 12, 9, eq);
    // Snout nostrils (nares) underneath the overhanging rostrum
    m.ellipsoid(sd * 0.033, 0.001, -0.484, 0.0055, 0.0028, 0.0042, 8, 6, qAxis(0, 0, 1, sd * 0.35));
  }
  return m.build();
}
