// ============================================================================
// 3D jellyfish for Dunia Laut 3D. One draw call for all bells and one for all
// tentacles of a field: per-jelly state lives in uniform arrays and the vertex
// shaders do the pulsing / swaying. "near" fields live in world space and are
// gameplay hazards (their tentacles sting the player).
// ============================================================================
import * as THREE from "three";
import { SHARED } from "./glsl";

const MAXJ = 32;

export interface JellyState {
  x: number;
  y: number;
  s: number; // bell radius (px)
  ph: number;
  vx: number;
  vy: number;
  col: [number, number, number];
  glow: number;
  len: number; // tentacle length factor (× s)
  y0: number;
  y1: number;
  seed: number;
  hit: number; // 0..1 squash after something bounced off the bell
  hx: number; // impact direction (bell space, y up)
  hy: number;
  ht: number; // seconds since the hit
}

const HEAD = /* glsl */ `
uniform vec4 uJ[${MAXJ}];
uniform vec4 uJC[${MAXJ}];
uniform vec4 uJH[${MAXJ}];
uniform float uTime;
// asymmetric swimming rhythm: quick contraction, slow relaxed glide
float jellyPulse(float ph){ float s = sin(ph); return pow(max(s, 0.), .55) * .85 + max(-s, 0.) * -.1; }
`;

function bellGeometry(nj: number) {
  const U = 16,
    V = 48;
  const pos: number[] = [],
    nor: number[] = [],
    uv: number[] = [],
    idx: number[] = [],
    jid: number[] = [];
  // moon-jelly profile: domed top, thick rounded margin with 8 soft lobes
  const R = (u: number, v: number) => Math.pow(Math.sin((u * Math.PI) / 2), 0.68) * (1 + 0.045 * Math.pow(u, 4) * Math.sin(v * 8 + 0.4)) * 0.98;
  const Y = (u: number) => Math.cos((u * Math.PI) / 2) * 0.58 - 0.06 * Math.pow(u, 6);
  for (let j = 0; j < nj; j++) {
    const base = pos.length / 3;
    // outer dome (u 0..1), rounded margin lip (u 1..1.25 -> fold under), inner veil back to centre
    const NI = 8;
    for (let iu = 0; iu <= U + NI; iu++) {
      const outer = iu <= U;
      const inner = outer ? 0 : (iu - U) / NI;
      const u = outer ? iu / U : 1 - inner * 0.78;
      for (let iv = 0; iv <= V; iv++) {
        const v = (iv / V) * Math.PI * 2;
        let r = R(u, v),
          y = Y(u);
        if (!outer) {
          const lip = Math.sin(Math.min(1, inner * 2.2) * Math.PI);
          r = r * (1 - inner * 0.08) + lip * 0.035;
          y = Y(1) + 0.11 * inner + 0.09 * Math.sin(inner * Math.PI) + (1 - u) * 0.14;
        }
        pos.push(Math.cos(v) * r, y, Math.sin(v) * r);
        const nr = outer ? 1 : -0.8;
        const ny = outer ? 0.55 * (1 - u) + 0.12 : -0.6;
        const l = Math.hypot(nr, ny);
        nor.push((Math.cos(v) * nr) / l, ny / l, (Math.sin(v) * nr) / l);
        uv.push(outer ? u : 1 + inner, iv / V);
        jid.push(j);
      }
    }
    for (let iu = 0; iu < U + NI; iu++)
      for (let iv = 0; iv < V; iv++) {
        const a = base + iu * (V + 1) + iv,
          b = a + V + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    // soft halo quad (uv.x = 3 marks it)
    const hb = pos.length / 3;
    const H = 1.9;
    pos.push(-H, H * 0.7, 0, H, H * 0.7, 0, -H, -H * 1.6, 0, H, -H * 1.6, 0);
    for (let k = 0; k < 4; k++) {
      nor.push(0, 0, 1);
      uv.push(3, k);
      jid.push(j);
    }
    idx.push(hb, hb + 2, hb + 1, hb + 1, hb + 2, hb + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("aJ", new THREE.Float32BufferAttribute(jid, 1));
  g.setIndex(idx);
  return g;
}

function tentacleGeometry(nj: number, rng: () => number) {
  const pos: number[] = [],
    dat: number[] = [], // t, side, k, w  (w > .1 => oral arm, w < 0 => short marginal fringe)
    jid: number[] = [],
    idx: number[] = [];
  const SEG = 18;
  for (let j = 0; j < nj; j++) {
    const nThin = 18,
      nFringe = 24,
      nArm = 4;
    const total = nThin + nFringe + nArm;
    for (let k = 0; k < total; k++) {
      const arm = k >= nThin + nFringe;
      const fringe = k >= nThin && !arm;
      const ang = arm ? ((k - nThin - nFringe) / nArm) * Math.PI * 2 + 0.6 : fringe ? ((k - nThin) / nFringe) * Math.PI * 2 + rng() * 0.15 : (k / nThin) * Math.PI * 2 + rng() * 0.3;
      const rr = arm ? 0.26 : fringe ? 0.97 : 0.8 + rng() * 0.14;
      const bx = Math.cos(ang) * rr,
        bz = Math.sin(ang) * rr;
      const len = arm ? 1.4 + rng() * 0.5 : fringe ? 0.25 + rng() * 0.3 : 1.8 + rng() * 1.5;
      const w = arm ? 0.16 + rng() * 0.05 : fringe ? -(0.01 + rng() * 0.006) : 0.014 + rng() * 0.01;
      const base = pos.length / 3;
      const segs = fringe ? 6 : SEG;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        for (const side of [-1, 1]) {
          pos.push(bx, -t * len, bz);
          dat.push(t, side, k * 0.61 + j * 0.37, w);
          jid.push(j);
        }
      }
      for (let i = 0; i < segs; i++) {
        const a = base + i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aD", new THREE.Float32BufferAttribute(dat, 4));
  g.setAttribute("aJ", new THREE.Float32BufferAttribute(jid, 1));
  g.setIndex(idx);
  return g;
}

const BLEND = {
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  side: THREE.DoubleSide,
} as const;

const mkUniforms = (zOff: number, fog: number) => ({
  ...SHARED,
  uJ: { value: Array.from({ length: MAXJ }, () => new THREE.Vector4()) },
  uJC: { value: Array.from({ length: MAXJ }, () => new THREE.Vector4()) },
  uJH: { value: Array.from({ length: MAXJ }, () => new THREE.Vector4()) },
  uZ: { value: zOff },
  uFog: { value: fog },
});

function bellMaterial(zOff: number, fog: number) {
  return new THREE.ShaderMaterial({
    uniforms: mkUniforms(zOff, fog),
    ...BLEND,
    vertexShader:
      HEAD +
      /* glsl */ `
attribute float aJ; uniform float uZ;
varying vec3 vN; varying vec2 vUv; varying vec4 vC; varying float vP; varying vec3 vWP; varying vec3 vLP; varying float vPh;
void main(){
  int j = int(aJ + .5);
  vec4 J = uJ[j]; vC = uJC[j];
  float ph = uTime * 1.25 + J.w; vPh = ph;
  float squeeze = jellyPulse(ph);
  vec3 p = position;
  vLP = p;
  vec4 Hh = uJH[j];
  if (uv.x < 2.5) {
    float u = clamp(uv.x, 0., 1.);
    // contraction narrows the margin and lifts the dome; relaxation flares it
    float rs = 1. + .13 * (.3 - squeeze) * u * u;
    p.xz *= rs;
    p.y *= 1. + .2 * squeeze - .04 * (1. - squeeze);
    // trampoline squash when a fish bounces off the bell: dent toward the impact, jelly-wobble back
    float hit = Hh.x;
    if (hit > .001) {
      float wob = sin(Hh.y * 14.) * exp(-Hh.y * 3.5);
      float dent = max(0., dot(normalize(p.xy + vec2(0., .001)), Hh.zw)) ;
      p.xy -= Hh.zw * dent * hit * .32 * (.2 + .8 * p.y);
      p.y *= 1. - hit * .22 + wob * .18 * hit;
      p.xz *= 1. + hit * .28 - wob * .14 * hit;
    }
    // margin ripples travelling around the rim
    float ang = atan(p.z, p.x);
    p.y += sin(ang * 8. + uTime * 2.4 + J.w) * .02 * pow(u, 5.);
    // gentle lean while drifting
    p.x += sin(uTime * .6 + J.w) * .07 * (.6 - p.y);
    vN = normalize(vec3(normal.x / rs, normal.y, normal.z / rs));
  } else {
    vN = vec3(0., 0., 1.);
  }
  vec3 wp = vec3(J.x, -J.y, uZ) + p * J.z;
  vWP = wp; vP = squeeze; vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
}`,
    fragmentShader:
      HEAD +
      /* glsl */ `
uniform float uFog;
varying vec3 vN; varying vec2 vUv; varying vec4 vC; varying float vP; varying vec3 vWP; varying vec3 vLP; varying float vPh;
void main(){
  vec3 col = vC.rgb;
  float wy = -vWP.y;
  float dark = smoothstep(500., 1500., wy);
  // bioluminescent hue: shifted from the body colour toward cyan / violet so it reads as light, not paint
  vec3 bioC = normalize(mix(col, vec3(.35, 1., .9), .45) + vec3(.1, 0., .25)) * 1.2;
  float bioK = .25 + vC.a;               // every jelly glows a little, deep ones a lot
  float contract = vP;                   // 0 relaxed .. 1 contracted
  if (vUv.x > 2.5) {
    // layered halo: wide soft aura + tighter bright core that flares with each contraction
    vec2 d = vec2(vLP.x / 1.9, (vLP.y + .45) / 2.1);
    float r = length(d);
    float aura = pow(max(0., 1. - r), 3.) * .09;
    float core = pow(max(0., 1. - r * 1.8), 2.5) * .22 * (.4 + .6 * contract);
    float a = (aura + core) * bioK * (.35 + .65 * dark);
    gl_FragColor = vec4(bioC * a, a);
    return;
  }
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  float fr = pow(1. - abs(N.z), 1.8);
  float inner = step(1., vUv.x);
  float u = clamp(vUv.x, 0., 1.);
  float ang = vUv.y * 6.2832;
  // four horseshoe gonads seen through the bell + a soft central stomach
  float horse = smoothstep(.2, .3, u) * (1. - smoothstep(.4, .52, u));
  float lobes = smoothstep(.1, .6, .5 + .5 * cos(ang * 4.));
  float gon = horse * lobes * (1. - inner);
  float stomach = (1. - smoothstep(0., .22, u)) * (1. - inner) * .6;
  vec3 gcol = mix(col, vec3(1., .62, .74), .7);
  // radial canals and a brighter thick margin
  float canal = pow(.5 + .5 * cos(ang * 16. + u * 2.), 18.) * smoothstep(.2, .55, u) * (1. - inner) * .3;
  float rim = smoothstep(.78, 1., u) * (1. - inner);
  // iridescent sheen sliding over the dome
  float irid = pow(max(0., dot(N, normalize(vec3(sin(uTime * .4), .7, .6)))), 6.);
  vec3 iridC = vec3(.6 + .4 * sin(u * 9. + uTime), .7 + .3 * sin(u * 9. + 2. + uTime), 1.);
  vec3 L = normalize(vec3(-.4, .8, .45));
  float spec = pow(max(dot(N, normalize(L + vec3(0., 0., 1.))), 0.), 48.) * .9;
  float topLight = .5 + .5 * max(N.y, 0.);
  // ---- bioluminescence
  // light wave rolling from the apex down to the margin with every contraction
  float wave = pow(.5 + .5 * sin(u * 11. - vPh * 2. + .8), 10.) * smoothstep(.05, .3, u);
  // eight rhopalia (sense organs) sparkling around the rim, firing in sequence
  float rho = pow(max(0., cos(ang * 8. + .4)), 60.) * smoothstep(.86, .97, u) * (.4 + .6 * pow(.5 + .5 * sin(uTime * 6. - ang * 2.), 4.));
  // glowing margin ring + faint nerve-net speckle
  float ring = smoothstep(.9, .99, u) * (1. - smoothstep(.99, 1., u)) * (1. - inner);
  float speck = pow(.5 + .5 * sin(ang * 60. + u * 40. + uTime), 30.) * smoothstep(.3, .9, u) * .35;
  float bioP = .35 + .65 * contract;
  float bioLum = (wave * .9 + rho * 1.6 + ring * .7 + speck + gon * .55 * (1. - inner)) * bioK * bioP;
  float a = .1 + fr * .55 + gon * .3 + stomach * .2 + canal + rim * .3 + inner * .14;
  vec3 c = col * (.3 + .55 * fr) * topLight
         + gcol * (gon * .9 + stomach * .5)
         + col * canal * 1.3
         + vec3(1.) * spec
         + mix(col, vec3(1.), .6) * rim * .55
         + iridC * irid * .18;
  // the glow is visible in daylight but owns the night
  c += bioC * bioLum * (.45 + .9 * dark);
  c += bioC * bioK * fr * .25 * (.3 + .7 * dark) * bioP;
  a += bioLum * .3 + bioK * .12 * fr * bioP;
  c = mix(c, c * .7 + bioC * .3 * bioK, dark * .4);
  a = clamp(a, 0., 1.) * (1. - uFog * .4);
  gl_FragColor = vec4(c * a, a);
}`,
  });
}

function tentacleMaterial(zOff: number, fog: number) {
  return new THREE.ShaderMaterial({
    uniforms: mkUniforms(zOff, fog),
    ...BLEND,
    vertexShader:
      HEAD +
      /* glsl */ `
attribute float aJ; attribute vec4 aD; uniform float uZ;
varying vec4 vD; varying vec4 vC; varying float vP; varying float vWy; varying float vPh;
void main(){
  int j = int(aJ + .5);
  vec4 J = uJ[j]; vC = uJC[j];
  float t = aD.x, side = aD.y, k = aD.z;
  bool arm = aD.w > .1;
  bool fringe = aD.w < 0.;
  float ph = uTime * 1.25 + J.w; vPh = ph;
  float squeeze = jellyPulse(ph);
  // tentacles trail: they stretch when the bell contracts and the body jumps up
  float len = arm ? 1. : (1. + .3 * squeeze);
  float sw = sin(uTime * 1.1 + J.w + k * 1.9 - t * 3.4) * t * t * (arm ? .2 : fringe ? .12 : .4)
           + sin(uTime * .37 + k * 3.1) * t * .16
           + sin(t * 17. + uTime * 2.6 + k) * .015 * t;
  float curl = arm ? sin(t * 9. + uTime * 1.5 + k) * .07 * t : 0.;
  vec3 p = position;
  vec4 Hh = uJH[j];
  p.y = p.y * len - .03;
  p.x += Hh.x * sin(Hh.y * 12. + t * 4. + k) * t * .25 * exp(-Hh.y * 3.);
  // rim ripple carries the fringe with it
  float rimAng = atan(p.z, p.x);
  p.y += sin(rimAng * 8. + uTime * 2.4 + J.w) * .02;
  p.x += sw + curl;
  float ruffle = arm ? (1. + .55 * sin(t * 22. + uTime * 2.2 + k) + .25 * sin(t * 47. - uTime * 3.)) : 1.;
  float w = abs(aD.w) * ruffle * (arm ? (1.15 - t * .5) : (1. - t * .55));
  p.x += side * w;
  vec3 wp = vec3(J.x, -J.y, uZ - .6 + .6 * sin(k)) + p * J.z;
  vD = aD; vP = squeeze; vWy = J.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
}`,
    fragmentShader:
      HEAD +
      /* glsl */ `
uniform float uFog;
varying vec4 vD; varying vec4 vC; varying float vP; varying float vWy; varying float vPh;
void main(){
  float t = vD.x;
  bool arm = vD.w > .1;
  bool fringe = vD.w < 0.;
  float edge = 1. - abs(vD.y);
  float a;
  if (arm) a = (.16 + .3 * edge) * (1. - t * .75) * (.75 + .25 * sin(t * 30. + uTime * 2.5 + vD.z));
  else if (fringe) a = (.5 + .4 * edge) * (1. - t);
  else a = (.42 + .45 * edge) * (1. - t * .8) * (.7 + .5 * pow(.5 + .5 * sin(t * 26. - uTime * 3. + vD.z), 5.));
  vec3 c = mix(vC.rgb, vec3(1., .78, .86), arm ? .4 : .12);
  c = mix(c, vec3(1.), fringe ? .45 : .2 * (1. - t));
  float dark = smoothstep(500., 1500., vWy);
  vec3 bioC = normalize(mix(vC.rgb, vec3(.35, 1., .9), .45) + vec3(.1, 0., .25)) * 1.2;
  float bioK = .25 + vC.a;
  float bioP = .35 + .65 * vP;
  // pulses of light racing down each tentacle after a contraction, beads glowing in between
  float pulse = pow(.5 + .5 * sin(t * 9. - vPh * 2.2 + vD.z), 14.) * (1. - t * .4);
  float beads = arm ? 0. : pow(.5 + .5 * sin(t * 40. + uTime * 9. + vD.z * 4.), 28.) * .6 * (1. - t * .5);
  float armGlow = arm ? pow(edge, 3.) * .5 * (.6 + .4 * sin(t * 18. - uTime * 3. + vD.z)) : 0.;
  float lum = (pulse * (arm ? .6 : 1.) + beads + armGlow + (fringe ? .5 : 0.)) * bioK * bioP;
  c += bioC * lum * (.5 + .9 * dark);
  c += vC.rgb * bioK * (1. - t) * .25 * dark;
  a += lum * .35;
  a = clamp(a, 0., 1.) * (1. - uFog * .4);
  gl_FragColor = vec4(c * a, a);
}`,
  });
}

export class JellyField {
  group = new THREE.Group();
  jellies: JellyState[] = [];
  private bellMat: THREE.ShaderMaterial;
  private tentMat: THREE.ShaderMaterial;
  private disposables: { dispose: () => void }[] = [];

  constructor(list: Omit<JellyState, "vx" | "vy" | "seed" | "hit" | "hx" | "hy" | "ht">[], zOff: number, fog: number, rng: () => number) {
    const n = Math.min(MAXJ, list.length);
    this.jellies = list.slice(0, n).map((j) => ({ ...j, vx: 0, vy: 0, seed: rng() * 100, hit: 0, hx: 0, hy: 0, ht: 0 }));
    this.bellMat = bellMaterial(zOff, fog);
    this.tentMat = tentacleMaterial(zOff, fog);
    const bg = bellGeometry(n),
      tg = tentacleGeometry(n, rng);
    const bell = new THREE.Mesh(bg, this.bellMat);
    const tent = new THREE.Mesh(tg, this.tentMat);
    bell.frustumCulled = tent.frustumCulled = false;
    tent.renderOrder = 26;
    bell.renderOrder = 27;
    this.group.add(tent, bell);
    this.disposables.push(bg, tg, this.bellMat, this.tentMat);
    this.jellies.forEach((j, i) => {
      (this.bellMat.uniforms.uJC.value[i] as THREE.Vector4).set(j.col[0], j.col[1], j.col[2], j.glow);
      (this.tentMat.uniforms.uJC.value[i] as THREE.Vector4).set(j.col[0], j.col[1], j.col[2], j.glow);
    });
    this.push();
  }

  private push() {
    const a = this.bellMat.uniforms.uJ.value as THREE.Vector4[];
    const b = this.tentMat.uniforms.uJ.value as THREE.Vector4[];
    const ha = this.bellMat.uniforms.uJH.value as THREE.Vector4[];
    const hb = this.tentMat.uniforms.uJH.value as THREE.Vector4[];
    this.jellies.forEach((j, i) => {
      a[i].set(j.x, j.y, j.s, j.ph);
      b[i].set(j.x, j.y, j.s, j.ph);
      // x: squash amount, y: seconds since the hit (for the wobble), zw: impact direction in bell space (y up)
      ha[i].set(j.hit, j.ht, j.hx, j.hy);
      hb[i].set(j.hit, j.ht, j.hx, j.hy);
    });
  }

  /** something bounced off the bell at direction (nx, ny) (game coords, y down) */
  poke(j: JellyState, nx: number, ny: number, strength = 1) {
    j.hit = Math.min(1, j.hit + strength);
    j.ht = 0;
    // dent points from the bell centre toward the impact (bell space is y-up, game space is y-down)
    j.hx = nx;
    j.hy = -ny;
    j.vx += -nx * 26 * strength;
    j.vy += -ny * 26 * strength;
  }

  /** pulse-driven swimming: each contraction pushes the bell up, then it sinks slowly */
  step(dt: number, t: number, worldW: number) {
    for (const j of this.jellies) {
      if (j.hit > 0) {
        j.ht += dt;
        j.hit = Math.max(0, j.hit - dt * 1.6);
      }
      const ph = t * 1.25 + j.ph;
      const s = Math.sin(ph);
      const squeeze = Math.pow(Math.max(s, 0), 0.55) * 0.85;
      const up = squeeze * 26 * (j.s / 30);
      j.vy += (-up + 8 * (j.s / 30) - j.vy) * Math.min(1, dt * 1.6);
      j.vx += (Math.sin(t * 0.21 + j.seed) * 9 + Math.sin(t * 0.07 + j.seed * 2) * 6 - j.vx) * Math.min(1, dt * 0.7);
      j.x += j.vx * dt;
      j.y += j.vy * dt;
      if (j.y < j.y0) j.vy += (j.y0 - j.y) * dt * 2;
      if (j.y > j.y1) j.vy -= (j.y - j.y1) * dt * 2;
      if (j.x < 40) j.vx += 10 * dt;
      if (j.x > worldW - 40) j.vx -= 10 * dt;
    }
    this.push();
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}
