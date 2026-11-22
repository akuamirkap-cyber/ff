// ============================================================================
// Reef critters for Dunia Laut 3D: tiny damselfish darting around the corals,
// vibrant coral shrimp perched on rocks/corals, and swirling 3D krill swarms.
// Decor only – instanced draw calls, all motion & luminescence in vertex/frag shaders.
// ============================================================================
import * as THREE from "three";
import { SHARED } from "./glsl";
import { mergeAux } from "./corals";

export interface Spot {
  x: number;
  y: number;
  z: number;
  tilt?: number;
}

const FISH_VS = /* glsl */ `
attribute float aux;
attribute vec4 iA; // anchor x, y (game y, down), z, orbit radius
attribute vec4 iB; // phase, speed, palette, size
uniform float uTime;
varying vec3 vN; varying vec3 vLP; varying float vPal; varying vec3 vWP;
void main(){
  float t = uTime * iB.y + iB.x;
  float rx = iA.w, ry = iA.w * .35;
  // figure-of-eight patrol around the coral head with nervous darts
  float dart = pow(.5 + .5 * sin(t * 3.1 + iB.x * 7.), 6.);
  vec2 c = vec2(sin(t) * rx + sin(t * 2.3) * rx * .15, sin(t * 2.) * ry + dart * 4.);
  vec2 dc = vec2(cos(t) * rx + cos(t * 2.3) * rx * .35, cos(t * 2.) * ry * 2.);
  float face = dc.x >= 0. ? 1. : -1.;
  float pitch = clamp(dc.y / (abs(dc.x) + 1.), -.6, .6);
  vec3 p = position * iB.w;
  // tail & rear body wag
  float rear = smoothstep(.1, .9, -position.x);
  p.z += sin(uTime * (14. + 6. * dart) + iB.x * 3.) * rear * rear * .35 * iB.w;
  p.x *= face;
  // pitch with the travel direction
  float cp = cos(pitch), sp = sin(pitch);
  p = vec3(p.x * cp - p.y * sp * face, p.x * sp * face + p.y * cp, p.z);
  vec3 n = vec3(normal.x * face, normal.y, normal.z);
  vec3 wp = vec3(iA.x + c.x, -(iA.y + c.y), iA.z) + p;
  vN = n; vLP = position; vPal = iB.z; vWP = wp;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(wp, 1.);
}`;

const FISH_FS = /* glsl */ `
varying vec3 vN; varying vec3 vLP; varying float vPal; varying vec3 vWP;
vec3 palette(float k){
  // tropical damsels & chromis: electric blue, orange, yellow, green chromis, purple
  if (k < .5) return vec3(.15, .55, 1.);
  if (k < 1.5) return vec3(1., .5, .15);
  if (k < 2.5) return vec3(1., .85, .2);
  if (k < 3.5) return vec3(.45, .95, .6);
  return vec3(.7, .4, 1.);
}
void main(){
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 base = palette(vPal);
  // pale belly, darker back, a bright stripe / spot
  float belly = smoothstep(-.1, -.35, vLP.y);
  vec3 col = mix(base, vec3(.95, .97, 1.), belly * .7);
  col = mix(col, base * .55, smoothstep(.1, .35, vLP.y));
  float stripe = smoothstep(.02, .0, abs(vLP.x + .15) - .05) * .6;
  col = mix(col, vec3(1.), stripe * step(1.5, vPal) * step(vPal, 2.5));
  float eye = smoothstep(.07, .04, length(vLP.xy - vec2(.55, .08)));
  col = mix(col, vec3(.02), eye);
  vec3 L = normalize(vec3(-.4, .8, .5));
  float ndl = max(dot(N, L), 0.);
  float wy = -vWP.y;
  float sk = sunK(wy);
  col = col * (.45 + .6 * ndl * sk + .15 * max(N.y, 0.)) * absorbK(wy * .4);
  col += vec3(1.) * pow(max(dot(N, normalize(L + vec3(0., 0., 1.))), 0.), 24.) * .35 * sk;
  col = mix(col, waterCol(wy), .18);
  gl_FragColor = vec4(col, 1.);
}`;

const SHRIMP_VS = /* glsl */ `
attribute float aux; // 0 body .. 1 tail, 2 = antennae, 3 = legs, 4 = glossy eyes
attribute vec4 iA; // anchor x, y, z, face
attribute vec4 iB; // phase, size, tilt, palette
uniform float uTime;
varying vec3 vN; varying vec3 vLP; varying float vAux; varying float vPal; varying vec3 vWP;
void main(){
  float ph = iB.x;
  vec3 p = position * iB.y;
  // cheerful little hop + occasional backward flick, then slow crawl back
  float cyc = fract(uTime * .14 + ph * .17);
  float flick = pow(max(0., sin(cyc * 6.2832)), 36.);
  float crawl = sin(uTime * 1.45 + ph) * .36 * iB.y;
  float hop = abs(sin(uTime * 2.2 + ph)) * .085 * iB.y;
  if (aux > 3.5) {
    // oversized cute glossy stalked eyes subtly perk during hops
    p.y += hop * .15;
  } else if (aux > 1.5 && aux < 2.5) {
    // antennae: graceful sweeps + delicate tremble
    float s = sin(uTime * 2.1 + ph) * .24 + sin(uTime * 10. + ph * 3.) * .04;
    float u = clamp((position.x - .85) / 1.5, 0., 1.);
    p.y += s * u * u * iB.y * 1.85;
    p.z += cos(uTime * 1.3 + ph) * u * u * iB.y * .55;
  } else if (aux > 2.5) {
    // legs: cute pitter-patter twitch
    p.y += sin(uTime * 14. + position.x * 26. + ph) * .03 * iB.y;
  } else {
    // tail curls smoothly under during the flick
    float curl = flick * aux * aux * 1.15;
    p.y -= curl * iB.y * .48;
    p.x += curl * iB.y * .38;
  }
  p.x += crawl - flick * iB.y * 2.6;
  p.y += hop + flick * iB.y * 1.4;
  // perch tilt & facing
  float ct = cos(iB.z), st = sin(iB.z);
  p = vec3(p.x * ct - p.y * st, p.x * st + p.y * ct, p.z);
  p.x *= iA.w;
  vec3 n = vec3(normal.x * iA.w, normal.y, normal.z);
  vec3 wp = vec3(iA.x, -iA.y, iA.z) + p;
  vN = n; vLP = position; vAux = aux; vPal = iB.w; vWP = wp;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(wp, 1.);
}`;

const SHRIMP_FS = /* glsl */ `
varying vec3 vN; varying vec3 vLP; varying float vAux; varying float vPal; varying vec3 vWP;
vec3 shrimpAccent(float k){
  if (k < .5) return vec3(.98, .26, .24);      // Candy scarlet cleaner shrimp
  if (k < 1.5) return vec3(1., .62, .18);      // Sunny tangerine-peach shrimp
  if (k < 2.5) return vec3(.98, .38, .66);     // Sakura bubblegum-rose shrimp
  return vec3(1., .44, .26);                   // Bright coral-strawberry shrimp
}
void main(){
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 L = normalize(vec3(-.4, .8, .5));
  float ndl = max(dot(N, L), 0.);
  float wy = -vWP.y;
  float sk = sunK(wy);

  if (vAux > 3.5) {
    // Oversized cute glossy 3D eyes with bright anime highlight sparkle
    vec3 eyeCol = vec3(.03, .03, .06);
    float spec1 = pow(max(dot(N, normalize(vec3(.25, .62, .74))), 0.), 26.);
    float spec2 = pow(max(dot(N, normalize(vec3(-.35, -.35, .86))), 0.), 48.) * .45;
    eyeCol += vec3(1.) * smoothstep(.22, .62, spec1 + spec2);
    eyeCol = mix(eyeCol, waterCol(wy), .06);
    gl_FragColor = vec4(eyeCol, 1.);
    return;
  }

  float band = .5 + .5 * sin(vLP.x * 10.2 + .8);
  vec3 accent = shrimpAccent(vPal);
  vec3 shellWhite = mix(vec3(1., .97, .94), vec3(1., .93, .84), step(1.5, vPal) * .45);
  vec3 col = mix(shellWhite, accent, smoothstep(.28, .68, band));
  // soft rosy cheek blush near head
  float blush = exp(-dot(vLP.xy - vec2(.76, .24), vLP.xy - vec2(.76, .24)) * 22.);
  col = mix(col, vec3(1., .42, .56), blush * .55);
  if (vAux > 1.5) col = mix(vec3(1., .98, .94), accent, .24);
  float fr = pow(1. - abs(N.z), 2.);
  col = col * (.60 + .50 * ndl * sk) * absorbK(wy * .28) + vec3(1., .96, .94) * fr * .30;
  col += accent * .14 * smoothstep(700., 1600., wy);
  col += vec3(1.) * pow(max(dot(N, normalize(L + vec3(0., 0., 1.))), 0.), 26.) * .42;
  col = mix(col, waterCol(wy), .11);
  float a = vAux > 1.5 ? .84 : .92 + fr * .08;
  gl_FragColor = vec4(col * a, a);
}`;

const KRILL_VS = /* glsl */ `
attribute float aux; // 0 head .. 1 tail fan, 2 = antennae, 3 = swimmerets
attribute vec4 iA; // anchor x, y (game y down), z, swirl radius
attribute vec4 iB; // phase, speed, palette, size
uniform float uTime;
varying vec3 vN; varying vec3 vLP; varying float vAux; varying float vPal; varying vec3 vWP;
void main(){
  float ph = iB.x;
  float t = uTime * iB.y + ph;
  float rx = iA.w;
  float ry = iA.w * .44;
  float rz = iA.w * .34;
  // Swirling helical & figure-8 plankton drift around coral branches
  float dart = pow(.5 + .5 * sin(t * 1.45 + ph * 2.3), 16.) * 2.6;
  vec3 c = vec3(
    sin(t) * rx + cos(t * 2.1 + ph) * rx * .24 - dart,
    sin(t * 2.0 + ph * .7) * ry + sin(t * .7) * 2.2,
    cos(t * 1.15 + ph) * rz
  );
  vec3 dc = vec3(
    cos(t) * rx * iB.y - sin(t * 2.1 + ph) * rx * .5 * iB.y,
    cos(t * 2.0 + ph * .7) * ry * 2.0 * iB.y,
    -sin(t * 1.15 + ph) * rz * 1.15 * iB.y
  );
  float face = dc.x >= 0. ? 1. : -1.;
  float pitch = clamp(dc.y / (abs(dc.x) + .9), -.58, .58);
  vec3 p = position * iB.w;
  if (aux > 2.5) {
    // fast beating pleopod swimmerets underneath thorax
    p.x += sin(uTime * 26. + position.x * 16. + ph * 5.) * .16 * iB.w;
    p.y += cos(uTime * 26. + position.x * 16. + ph * 5.) * .06 * iB.w;
  } else if (aux > 1.5 && aux < 2.5) {
    // long sweeping antennae
    float u = clamp((position.x - .4) / 1.1, 0., 1.);
    p.y += sin(uTime * 5. + ph) * u * u * .28 * iB.w;
    p.z += cos(uTime * 4.2 + ph) * u * u * .14 * iB.w;
  } else {
    // synchronized tail curl flick
    float curl = sin(uTime * 11. + ph * 3. + dart * 3.) * .18 * aux * aux;
    p.y += curl * iB.w;
    p.z += sin(uTime * 9. + ph) * .12 * aux * iB.w;
  }
  p.x *= face;
  float cp = cos(pitch), sp = sin(pitch);
  p = vec3(p.x * cp - p.y * sp * face, p.x * sp * face + p.y * cp, p.z);
  vec3 n = vec3(normal.x * face, normal.y, normal.z);
  vec3 wp = vec3(iA.x + c.x, -(iA.y + c.y), iA.z + c.z) + p;
  vN = n; vLP = position; vAux = aux; vPal = iB.z; vWP = wp;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(wp, 1.);
}`;

const KRILL_FS = /* glsl */ `
varying vec3 vN; varying vec3 vLP; varying float vAux; varying float vPal; varying vec3 vWP;
vec3 krillPalette(float k){
  if (k < .5) return vec3(1., .46, .48);      // Rose-pink Antarctic / coral krill
  if (k < 1.5) return vec3(1., .64, .30);     // Warm coral-amber krill
  return vec3(1., .74, .82);                  // Pearlescent cherry-blush krill
}
void main(){
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 base = krillPalette(vPal);
  float seg = .5 + .5 * sin(vLP.x * 16.0);
  vec3 col = mix(vec3(1., .92, .88), base, .55 + .45 * smoothstep(.2, .8, seg));
  // translucent rosy internal carapace core
  float core = exp(-dot(vLP.xy - vec2(.24, .03), vLP.xy - vec2(.24, .03)) * 12.);
  col = mix(col, vec3(1., .24, .22), core * .65);
  // prominent black krill compound eye
  float eye = smoothstep(.11, .055, length(vLP.xy - vec2(.62, .09)));
  col = mix(col, vec3(.02, .02, .05), eye);
  if (vAux > 1.5) col = vec3(1., .95, .90);

  vec3 L = normalize(vec3(-.4, .8, .5));
  float ndl = max(dot(N, L), 0.);
  float wy = -vWP.y;
  float sk = sunK(wy);
  float fr = pow(1. - abs(N.z), 2.1);
  // photophores along lower thorax glow aquamarine/cyan in deeper reef zones
  float photo = smoothstep(.05, -.14, vLP.y) * smoothstep(.15, .5, fract(vLP.x * 4.5)) * (1. - step(1.5, vAux));
  float deepGlow = smoothstep(550., 1450., wy);
  vec3 bioGlow = vec3(.32, .95, 1.) * photo * (.25 + 1.15 * deepGlow);

  col = col * (.56 + .52 * ndl * sk) * absorbK(wy * .28) + vec3(1., .9, .95) * fr * .32 + bioGlow;
  col += vec3(1.) * pow(max(dot(N, normalize(L + vec3(0., 0., 1.))), 0.), 26.) * .42;
  col = mix(col, waterCol(wy), .12);
  float a = vAux > 1.5 ? .65 : .78 + fr * .22;
  gl_FragColor = vec4(col * a, a);
}`;

function fishGeometry() {
  const body = new THREE.SphereGeometry(0.5, 16, 10);
  body.scale(1.1, 0.5, 0.26);
  const tail = new THREE.ConeGeometry(0.28, 0.42, 3);
  tail.rotateZ(Math.PI / 2);
  tail.scale(1, 1, 0.15);
  tail.translate(-0.72, 0, 0);
  const dorsal = new THREE.ConeGeometry(0.22, 0.22, 3);
  dorsal.scale(1.6, 1, 0.12);
  dorsal.translate(-0.05, 0.3, 0);
  const g = mergeAux([{ g: body, aux: 0 }, { g: tail, aux: 1 }, { g: dorsal, aux: 0.3 }]);
  g.deleteAttribute("uv");
  return g;
}

function shrimpGeometry() {
  const parts: { g: THREE.BufferGeometry; aux?: number }[] = [];
  // chubbier, cuter arched body: 7 plump rounded candy-striped segments
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const r = 0.34 * (1 - t * 0.50);
    const seg = new THREE.SphereGeometry(r, 12, 8);
    seg.scale(1.18, 1.14, 0.94);
    const x = 0.86 - t * 1.78,
      y = 0.28 - Math.pow(t, 1.55) * 0.44 + Math.sin(t * Math.PI) * 0.22;
    seg.translate(x, y, 0);
    parts.push({ g: seg, aux: t });
  }
  // fluffy fanned twin tail blades
  for (const s of [-1, 1]) {
    const fan = new THREE.ConeGeometry(0.24, 0.34, 5);
    fan.rotateZ(Math.PI / 2);
    fan.rotateY(s * 0.34);
    fan.scale(1, 0.85, 0.35);
    fan.translate(-1.08, -0.20, s * 0.09);
    parts.push({ g: fan, aux: 1 });
  }
  // cute short upturned rostrum
  const ros = new THREE.ConeGeometry(0.065, 0.26, 6);
  ros.rotateZ(-Math.PI / 2 + 0.22);
  ros.translate(1.22, 0.44, 0);
  parts.push({ g: ros, aux: 0 });
  // 2 oversized cute 3D glossy stalked eyes (rendered with bright anime specular dot)
  for (const s of [-1, 1]) {
    const eyeOrb = new THREE.SphereGeometry(0.11, 10, 8);
    eyeOrb.scale(1.0, 1.08, 0.95);
    eyeOrb.translate(1.06, 0.52, s * 0.14);
    parts.push({ g: eyeOrb, aux: 4 });
  }
  // curvy cute whisker antennae
  for (const s of [-1, 1]) {
    const a = new THREE.CylinderGeometry(0.015, 0.030, 1.55, 5);
    a.rotateZ(-Math.PI / 2 + 0.62);
    a.rotateY(s * 0.22);
    a.translate(1.65, 0.92, s * 0.10);
    parts.push({ g: a, aux: 2 });
  }
  // cute perky little swimmeret legs
  for (let i = 0; i < 5; i++) {
    const l = new THREE.CylinderGeometry(0.026, 0.024, 0.38, 5);
    l.rotateZ(0.45 - i * 0.18);
    l.translate(0.65 - i * 0.26, -0.08, (i % 2 ? 1 : -1) * 0.14);
    parts.push({ g: l, aux: 3 });
  }
  const g = mergeAux(parts);
  // ground the feet at y = 0
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox!.min.y, 0);
  return g;
}

function krillGeometry() {
  const parts: { g: THREE.BufferGeometry; aux?: number }[] = [];
  // carapace thorax
  const head = new THREE.SphereGeometry(0.24, 10, 7);
  head.scale(1.85, 0.72, 0.62);
  head.translate(0.32, 0.05, 0);
  parts.push({ g: head, aux: 0.05 });

  // 5 graceful curved abdomen segments
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const r = 0.16 * (1 - t * 0.52);
    const seg = new THREE.SphereGeometry(r, 8, 6);
    seg.scale(1.15, 0.85, 0.72);
    seg.translate(-0.08 - t * 0.68, 0.06 - Math.pow(t, 1.5) * 0.16, 0);
    parts.push({ g: seg, aux: 0.2 + t * 0.75 });
  }
  // flared uropod tail fan (twin blades)
  for (const s of [-1, 1]) {
    const uropod = new THREE.ConeGeometry(0.11, 0.28, 3);
    uropod.rotateZ(Math.PI / 2);
    uropod.rotateY(s * 0.28);
    uropod.scale(1, 0.4, 0.85);
    uropod.translate(-0.88, -0.1, s * 0.06);
    parts.push({ g: uropod, aux: 1 });
  }
  // delicate forward V-antennae
  for (const s of [-1, 1]) {
    const ant = new THREE.CylinderGeometry(0.008, 0.016, 1.0, 4);
    ant.rotateZ(-Math.PI / 2 + 0.36);
    ant.rotateY(s * 0.18);
    ant.translate(0.96, 0.24, s * 0.07);
    parts.push({ g: ant, aux: 2 });
  }
  // 4 pairs of feathery swimmeret pleopods underneath
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      const leg = new THREE.CylinderGeometry(0.01, 0.015, 0.24, 4);
      leg.rotateZ(0.45 - i * 0.12);
      leg.translate(0.28 - i * 0.18, -0.13, s * 0.065);
      parts.push({ g: leg, aux: 3 });
    }
  }
  const g = mergeAux(parts);
  g.deleteAttribute("uv");
  return g;
}

export class Critters {
  group = new THREE.Group();
  private disposables: { dispose: () => void }[] = [];

  constructor(fishSpots: Spot[], shrimpSpots: Spot[], krillSpots: Spot[], rng: () => number, common: string) {
    // ---- damselfish
    if (fishSpots.length) {
      const g = fishGeometry();
      const n = fishSpots.length;
      const A = new Float32Array(n * 4),
        B = new Float32Array(n * 4);
      fishSpots.forEach((s, i) => {
        A.set([s.x, s.y, s.z, 10 + rng() * 16], i * 4);
        B.set([rng() * 100, 0.5 + rng() * 0.6, Math.floor(rng() * 5), 3.2 + rng() * 2.6], i * 4);
      });
      g.setAttribute("iA", new THREE.InstancedBufferAttribute(A, 4));
      g.setAttribute("iB", new THREE.InstancedBufferAttribute(B, 4));
      const m = new THREE.ShaderMaterial({ uniforms: { ...SHARED }, vertexShader: FISH_VS, fragmentShader: common + FISH_FS, side: THREE.DoubleSide });
      const mesh = new THREE.InstancedMesh(g, m, n);
      const mtx = new THREE.Matrix4();
      for (let i = 0; i < n; i++) mesh.setMatrixAt(i, mtx);
      mesh.frustumCulled = false;
      mesh.renderOrder = 14;
      this.group.add(mesh);
      this.disposables.push(g, m);
    }
    // ---- shrimp (perched on corals & boulders)
    if (shrimpSpots.length) {
      const g = shrimpGeometry();
      const n = shrimpSpots.length;
      const A = new Float32Array(n * 4),
        B = new Float32Array(n * 4);
      shrimpSpots.forEach((s, i) => {
        A.set([s.x, s.y, s.z, rng() < 0.5 ? 1 : -1], i * 4);
        B.set([rng() * 100, 3.6 + rng() * 2.4, (s.tilt ?? 0) * 0.8, Math.floor(rng() * 4)], i * 4);
      });
      g.setAttribute("iA", new THREE.InstancedBufferAttribute(A, 4));
      g.setAttribute("iB", new THREE.InstancedBufferAttribute(B, 4));
      const m = new THREE.ShaderMaterial({
        uniforms: { ...SHARED },
        vertexShader: SHRIMP_VS,
        fragmentShader: common + SHRIMP_FS,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      });
      const mesh = new THREE.InstancedMesh(g, m, n);
      const mtx = new THREE.Matrix4();
      for (let i = 0; i < n; i++) mesh.setMatrixAt(i, mtx);
      mesh.frustumCulled = false;
      mesh.renderOrder = 15;
      this.group.add(mesh);
      this.disposables.push(g, m);
    }
    // ---- krill swarms swirling around the corals
    if (krillSpots.length) {
      const g = krillGeometry();
      const n = krillSpots.length;
      const A = new Float32Array(n * 4),
        B = new Float32Array(n * 4);
      krillSpots.forEach((s, i) => {
        A.set([s.x, s.y, s.z, 8 + rng() * 16], i * 4);
        B.set([rng() * 100, 0.72 + rng() * 0.65, Math.floor(rng() * 3), 2.1 + rng() * 1.45], i * 4);
      });
      g.setAttribute("iA", new THREE.InstancedBufferAttribute(A, 4));
      g.setAttribute("iB", new THREE.InstancedBufferAttribute(B, 4));
      const m = new THREE.ShaderMaterial({
        uniforms: { ...SHARED },
        vertexShader: KRILL_VS,
        fragmentShader: common + KRILL_FS,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      });
      const mesh = new THREE.InstancedMesh(g, m, n);
      const mtx = new THREE.Matrix4();
      for (let i = 0; i < n; i++) mesh.setMatrixAt(i, mtx);
      mesh.frustumCulled = false;
      mesh.renderOrder = 16;
      this.group.add(mesh);
      this.disposables.push(g, m);
    }
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}
