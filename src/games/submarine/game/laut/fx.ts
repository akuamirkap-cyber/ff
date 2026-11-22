// ============================================================================
// Extra materials & helpers for Dunia Laut 3D: clear glass, volumetric lamp
// cones, cartoon eyes for the PENYELAM crew, and geometry merging.
// ============================================================================
import * as THREE from "three";
import { SHARED } from "./glsl";
import { paintLit } from "./geometry";
import type { PBuf } from "./geometry";

const PREMUL = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
} as const;

/** clear curved glass: faint tint, strong fresnel rim, sun glint – you can see what's behind it */
export function glassMaterial(tint: [number, number, number] = [0.75, 0.92, 1.0], alpha = 0.16, body = 0.2) {
  return new THREE.ShaderMaterial({
    uniforms: { ...SHARED, uTint: { value: new THREE.Vector3(...tint) }, uA: { value: alpha }, uBody: { value: body } },
    ...PREMUL,
    depthTest: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
varying vec3 vN; varying vec3 vWP;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vWP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
uniform float uTime; uniform vec3 uTint; uniform float uA, uBody;
varying vec3 vN; varying vec3 vWP;
void main(){
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  float fr = pow(1. - abs(N.z), 2.2);
  vec3 L = normalize(vec3(-.40, .80, .45));
  vec3 H = normalize(L + vec3(0., 0., 1.));
  float spec = pow(max(dot(N, H), 0.), 70.);
  float spec2 = pow(max(dot(N, normalize(vec3(.5, -.3, 1.))), 0.), 30.) * .25; // secondary soft lamp reflection
  // sliding caustic sheen
  float sheen = pow(max(dot(N, normalize(vec3(sin(uTime * .5) * .4, .6, .7))), 0.), 18.) * .35;
  // thick glass: environment reflection (bright water above, dark below) and a green-blue tint in the body
  float env = smoothstep(-.6, .9, N.y) * .55 + .1;
  float wy = -vWP.y;
  vec3 envC = mix(vec3(.05, .12, .2), vec3(.75, .95, 1.), env) * (1. - .5 * smoothstep(600., 1600., wy));
  float a = uA + fr * .55 + spec * .9 + sheen + uBody * (.18 + .3 * env);
  a = clamp(a, 0., .96);
  vec3 col = uTint * (uA * .9 + fr * .5) + envC * uBody * (.35 + .45 * env) + vec3(1., .97, .9) * (spec + sheen) + vec3(1., .9, .7) * spec2 * uBody;
  gl_FragColor = vec4(col * a, a);
}`,
  });
}

/** volumetric looking light cone (apex at origin, pointing down -Y, length 1, base radius 1) */
export function coneBeamGeometry(len: number, r0: number, r1: number) {
  const g = new THREE.CylinderGeometry(r0, r1, len, 26, 6, true);
  g.translate(0, -len / 2, 0);
  // aT: 0 at the apex, 1 at the far end
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  const t = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) t[i] = -p.getY(i) / len;
  g.setAttribute("aT", new THREE.BufferAttribute(t, 1));
  return g;
}

export function coneBeamMaterial(color: [number, number, number], strength: number) {
  return new THREE.ShaderMaterial({
    uniforms: { ...SHARED, uColor: { value: new THREE.Vector3(...color) }, uStrength: { value: strength } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
attribute float aT; varying float vT; varying vec3 vN; varying vec3 vWP; varying vec3 vLP;
void main(){ vT = aT; vLP = position; vec4 wp = modelMatrix * vec4(position, 1.); vWP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
uniform float uTime; uniform vec3 uColor; uniform float uStrength;
varying float vT; varying vec3 vN; varying vec3 vWP; varying vec3 vLP;
void main(){
  vec3 N = normalize(vN);
  float core = .35 + .65 * abs(N.z);           // thicker through the middle of the cone
  float fall = pow(1. - vT, 1.7) * (.25 + .75 * smoothstep(0., .08, vT));
  float ang = atan(vLP.x, vLP.z);
  float shafts = .78 + .22 * sin(ang * 7. + uTime * 1.3) * sin(ang * 3. - uTime * .7 + vT * 6.);
  float dust = .9 + .1 * sin(vT * 40. - uTime * 3.);
  float wy = -vWP.y;
  float depthK = .3 + .7 * smoothstep(200., 1400., wy); // lamps matter more in the dark
  float a = fall * core * shafts * dust * uStrength * depthK;
  gl_FragColor = vec4(uColor * a, a);
}`,
  });
}

/** merge several lit (aCol/aEmi/aMet/aAO) non-indexed geometries into one */
export function mergeLit(parts: THREE.BufferGeometry[]) {
  const ni = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const names = ["position", "normal", "aCol", "aEmi", "aMet", "aAO"] as const;
  const out = new THREE.BufferGeometry();
  for (const n of names) {
    const size = (ni[0].getAttribute(n) as THREE.BufferAttribute).itemSize;
    let total = 0;
    for (const g of ni) total += g.getAttribute(n).count;
    const arr = new Float32Array(total * size);
    let off = 0;
    for (const g of ni) {
      const a = g.getAttribute(n) as THREE.BufferAttribute;
      arr.set(a.array as Float32Array, off);
      off += a.count * size;
    }
    out.setAttribute(n, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere();
  return out;
}

/**
 * Cartoon eyes for a "Dear Flight" head built by PENYELAM: finds the facial-skin
 * vertices (material 58) of `part`, derives the facing direction and places two
 * glossy eyes on the face surface. Returns a lit geometry in model space.
 */
export function eyesForHead(buf: PBuf, part: number, scale = 1) {
  const dv = new DataView(buf.vb);
  const pts: { x: number; y: number; z: number; nx: number; ny: number; nz: number }[] = [];
  const mn = [1e9, 1e9, 1e9],
    mx = [-1e9, -1e9, -1e9];
  const F = new THREE.Vector3();
  for (let v = 0; v < buf.nv; v++) {
    const o = v * 20;
    if (dv.getUint8(o + 16) !== 58 || dv.getUint8(o + 17) !== part) continue;
    const p = { x: dv.getFloat32(o, true), y: dv.getFloat32(o + 4, true), z: dv.getFloat32(o + 8, true), nx: dv.getInt8(o + 12) / 127, ny: dv.getInt8(o + 13) / 127, nz: dv.getInt8(o + 14) / 127 };
    pts.push(p);
    F.x += p.nx;
    F.y += p.ny;
    F.z += p.nz;
    mn[0] = Math.min(mn[0], p.x);
    mn[1] = Math.min(mn[1], p.y);
    mn[2] = Math.min(mn[2], p.z);
    mx[0] = Math.max(mx[0], p.x);
    mx[1] = Math.max(mx[1], p.y);
    mx[2] = Math.max(mx[2], p.z);
  }
  if (!pts.length) return null;
  F.y = 0;
  F.normalize();
  const c = new THREE.Vector3((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2);
  const h = mx[1] - mn[1];
  const wdt = Math.max(mx[0] - mn[0], mx[2] - mn[2]);
  const right = new THREE.Vector3(0, 1, 0).cross(F).normalize();
  const geos: THREE.BufferGeometry[] = [];
  const eyeR = h * 0.085;
  for (const s of [-1, 1]) {
    const want = c.clone().addScaledVector(right, s * wdt * 0.2).add(new THREE.Vector3(0, h * 0.1, 0)).addScaledVector(F, wdt);
    // snap to the nearest face vertex (projected along F)
    let best = pts[0],
      bd = 1e9;
    for (const p of pts) {
      const d = (p.x - want.x) ** 2 + (p.y - want.y) ** 2 + (p.z - want.z) ** 2 - ((p.x - want.x) * F.x + (p.z - want.z) * F.z) ** 2;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    const n = new THREE.Vector3(best.nx, best.ny, best.nz).normalize();
    const base = new THREE.Vector3(best.x, best.y, best.z).addScaledVector(n, -eyeR * 0.35);
    const white = paintLit(new THREE.SphereGeometry(eyeR, 10, 8), [0.97, 0.97, 0.95], 0.25, 0, 1);
    white.translate(base.x, base.y, base.z);
    const ic = base.clone().addScaledVector(n, eyeR * 0.62);
    const iris = paintLit(new THREE.SphereGeometry(eyeR * 0.55, 8, 6), [0.16, 0.38, 0.55], 0.15, 0.3, 1);
    iris.translate(ic.x, ic.y, ic.z);
    const pc = base.clone().addScaledVector(n, eyeR * 0.82);
    const pupil = paintLit(new THREE.SphereGeometry(eyeR * 0.3, 8, 6), [0.03, 0.03, 0.04], 0, 0.2, 1);
    pupil.translate(pc.x, pc.y, pc.z);
    const gc = base.clone().addScaledVector(n, eyeR * 0.9).addScaledVector(right, -s * eyeR * 0.25).add(new THREE.Vector3(0, eyeR * 0.3, 0));
    const gleam = paintLit(new THREE.SphereGeometry(eyeR * 0.14, 6, 5), [1, 1, 1], 2.2, 0, 1);
    gleam.translate(gc.x, gc.y, gc.z);
    geos.push(white, iris, pupil, gleam);
  }
  const g = mergeLit(geos);
  if (scale !== 1) g.scale(scale, scale, scale);
  return g;
}

/** sunlit rippled sand with drifting caustics, for the sea floor (uses the relief geometry) */
export function sandMaterial(common: string) {
  return new THREE.ShaderMaterial({
    uniforms: { ...SHARED },
    vertexShader: /* glsl */ `
attribute vec2 aSdf;
varying vec3 vWP; varying vec3 vN; varying float vIn;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vWP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); vIn = -aSdf.x; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader:
      common +
      /* glsl */ `
varying vec3 vWP; varying vec3 vN; varying float vIn;
void main(){
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  float wy = -vWP.y;
  vec2 q = vWP.xy;
  // ripples running diagonally, broken up by noise
  float rip = sin(q.x * .35 + q.y * .12 + vnoise(q * .05) * 4.) * .5 + .5;
  rip = pow(rip, 1.6);
  float grain = vnoise(q * .9) * .5 + vnoise(q * 2.3) * .3;
  vec3 sand = mix(vec3(.80, .72, .52), vec3(.93, .86, .66), rip * .55 + grain * .45);
  // shells & dark specks
  float speck = step(.985, hash21(floor(q * .8)));
  sand = mix(sand, vec3(.55, .45, .35), speck * .7);
  // caustics: two sliding interference grids
  float c1 = sin(q.x * .16 + uTime * .9 + sin(q.y * .11 + uTime * .5) * 2.);
  float c2 = sin(q.y * .14 - uTime * .7 + sin(q.x * .13 - uTime * .4) * 2.);
  float caus = pow(max(0., c1 * c2), 2.5) * sunK(wy) * 1.2;
  vec3 L = normalize(vec3(-.4, .8, .45));
  float ndl = max(dot(N, L), 0.);
  float sk = sunK(wy);
  vec3 col = sand * (.42 + .62 * ndl * sk + .12 * max(N.y, 0.)) * absorbK(wy * .35);
  col += vec3(1., .97, .85) * caus * .35;
  // darker, rockier where the relief dives steeply (the sand pools in the hollows)
  col = mix(col, col * vec3(.55, .5, .5), smoothstep(.55, .95, 1. - abs(N.z)) * .6);
  col = mix(col, waterCol(wy) * 1.03, .12);
  gl_FragColor = vec4(col, 1.);
}`,
  });
}
