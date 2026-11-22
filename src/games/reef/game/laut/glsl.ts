// ============================================================================
// MODE "DUNIA LAUT 3D" — shaders & materials
// Water column, god-rays, caustics, rock, coral & entity shading in the style of
// the Abyssal Garden dive scene (PENYELAM). Everything renders side-on with an
// orthographic camera so it stays pixel-aligned with the 2D game layer.
// ============================================================================
import * as THREE from "three";

export const SUN_X_GL = 3800 * 0.56;

/** uniforms shared (by reference) by every material in the scene */
export const SHARED = {
  uTime: { value: 0 },
  uCamC: { value: new THREE.Vector2(1900, 500) }, // camera centre, world units (y down)
  uView: { value: new THREE.Vector2(800, 450) }, // view size, world units
  uCamTL: { value: new THREE.Vector2(0, 0) }, // camLeft, camTop
  uPx: { value: 2 }, // device pixels per world unit
  uReefView: {value:new THREE.Vector2(.055,-.17)},
  uLampCount: { value: 0 },
  uLampOrigin: { value: Array.from({length:7},()=>new THREE.Vector4()) },
  uLampAxis: { value: Array.from({length:7},()=>new THREE.Vector4()) },
  uBgStyle: { value: 1 }, // 0 = Game 1 ocean backdrop, 1 = Tropical Reef backdrop (Game 2)
  uWaterStyle: { value: 1 }, // 0 = Game 1 bright blue water & sunlight, 1 = Game 2 teal water
};

export const COMMON = /* glsl */ `
uniform float uTime;
uniform vec2 uCamC;
uniform vec2 uView;
uniform vec2 uCamTL;
uniform float uPx;
uniform float uBgStyle;
uniform float uWaterStyle;
uniform int uLampCount;
uniform vec4 uLampOrigin[7];
uniform vec4 uLampAxis[7];

#define TAU 6.28318530718
#define SUN_X ${SUN_X_GL.toFixed(1)}

float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  float a = hash21(i), b = hash21(i + vec2(1., 0.)), c = hash21(i + vec2(0., 1.)), d = hash21(i + vec2(1., 1.));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm2(vec2 p){
  float s = 0., a = .5;
  for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= .5; }
  return s;
}

// value noise with analytic derivatives (smooth, pixel-quad independent bump mapping)
vec3 nd(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
  vec2 du = 30. * f * f * (f * (f - 2.) + 1.);
  float a = hash21(i), b = hash21(i + vec2(1., 0.)), c = hash21(i + vec2(0., 1.)), d = hash21(i + vec2(1., 1.));
  float k1 = b - a, k2 = c - a, k4 = a - b - c + d;
  return vec3(a + k1 * u.x + k2 * u.y + k4 * u.x * u.y, du * vec2(k1 + k4 * u.y, k2 + k4 * u.x));
}
vec3 fbmd(vec2 p){
  vec3 s = vec3(0.);
  float a = .5, fr = 1.;
  for (int i = 0; i < 4; i++){
    vec3 n = nd(p * fr + float(i) * 17.3);
    s.x += a * n.x; s.yz += a * n.yz * fr;
    fr *= 2.03; a *= .5;
  }
  return s;
}

// ---- water palette (world y, downwards) : Game 1 classic blue vs Game 2 Tropical Reef teal
const float ST_Y[7] = float[7](0., 300., 820., 1250., 1540., 2150., 2650.);
const vec3 ST_C[7] = vec3[7](
  vec3(.30, .82, .86), vec3(.09, .58, .72), vec3(.035, .34, .56), vec3(.03, .21, .45),
  vec3(.05, .12, .34), vec3(.035, .07, .22), vec3(.02, .045, .14)
);
const vec3 ST_C2[7] = vec3[7](
  vec3(.22, .74, .70), vec3(.06, .48, .53), vec3(.04, .30, .42), vec3(.035, .20, .37),
  vec3(.045, .13, .30), vec3(.03, .08, .20), vec3(.02, .045, .14)
);
vec3 waterCol(float y){
  y = clamp(y, 0., 2650.);
  vec3 c1 = ST_C[0];
  vec3 c2 = ST_C2[0];
  for (int i = 1; i < 7; i++) {
    float t = smoothstep(ST_Y[i - 1], ST_Y[i], y);
    c1 = mix(c1, ST_C[i], t);
    c2 = mix(c2, ST_C2[i], t);
  }
  return mix(c1, c2, uWaterStyle);
}
float sunK(float wy){ return exp(-max(wy, 0.) / 980.) * .93 + .07; }
vec3 absorbK(float wy){ return exp(-vec3(.00062, .00020, .00008) * max(wy, 0.)); }

// tileable-ish water caustic net (after Dave Hoskins), 3 iterations
float caustics(vec2 uv, float time){
  vec2 p = mod(uv * TAU, TAU) - 250.;
  vec2 i = p;
  float c = 1., inten = .005;
  for (int n = 0; n < 3; n++){
    float t = time * (1. - (3.5 / float(n + 1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1. / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
  }
  c /= 3.;
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.), 0., 1.);
}

vec3 lightSurfaceC(vec3 alb, vec3 N, vec3 wp, float ao, float ck){
  float wy = -wp.y;
  vec3 L = normalize(vec3(-.40, .80, .45));
  float d = dot(N, L);
  float ndl = max(d, 0.);
  float wrap = d * .5 + .5;
  float sk = sunK(wy);
  vec3 wc = waterCol(wy);
  float cAmt = smoothstep(1700., 300., wy) * ck;
  float cs = cAmt > .002 ? caustics(wp.xy * .0115, uTime * .5) : 0.;
  vec3 sunC = vec3(1., .94, .80) * sk * (.9 + cAmt * cs * 1.7);
  vec3 hemi = mix(vec3(.10, .15, .26), wc * 1.15 + vec3(.20, .30, .34), N.y * .5 + .5);
  hemi = max(hemi, vec3(.11, .14, .26));
  vec3 col = alb * (hemi * .92 + sunC * (ndl * .95 + wrap * .32)) * ao * 1.3;
  for(int i=0;i<7;i++){
    if(i>=uLampCount)break;
    vec3 off=wp-uLampOrigin[i].xyz;vec3 axis=uLampAxis[i].xyz;
    float along=dot(off,axis),reach=uLampOrigin[i].w;
    if(along>0.&&along<reach){
      float rad=1.4+along*abs(uLampAxis[i].w);
      vec3 side=off-axis*along;float fall=exp(-dot(side,side)/(rad*rad)*2.1);
      vec3 tint=uLampAxis[i].w>0.?vec3(1.0,.76,.39):vec3(.66,.87,1.);
      col+=(alb*.65+vec3(.045))*tint*fall*(1.-along/reach)*(.29+.71*max(0.,-dot(N,axis)));
    }
  }
  col += alb * vec3(.025, .04, .075) * smoothstep(900., 2400., wy);
  return col * absorbK(wy);
}
vec3 lightSurface(vec3 alb, vec3 N, vec3 wp, float ao){ return lightSurfaceC(alb, N, wp, ao, 1.); }
`;

const SCREEN_VS = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

// ---------------------------------------------------------------- backdrop (water volume)
export function backdropMaterial() {
  const loaded = { value: 0 };
  const shipLoaded = { value: 0 };
  const kelpLoaded = { value: 0 };
  const templeLoaded = { value: 0 };
  const lagoonLoaded = { value: 0 };
  const loader = new THREE.TextureLoader();
  const habitat = loader.load("/images/reef-habitat.webp", () => { loaded.value = 1; });
  const shipwreck = loader.load("/src/assets/images/ancient_shipwreck_bg_1795254425429.jpg", () => { shipLoaded.value = 1; });
  const kelp = loader.load("/src/assets/images/kelp_cathedral_bg_1795322568135.jpg", () => { kelpLoaded.value = 1; });
  const temple = loader.load("/src/assets/images/sunken_temple_bg_1795322569079.jpg", () => { templeLoaded.value = 1; });
  const lagoon = loader.load("/src/assets/images/crystal_lagoon_bg_1795322569691.jpg", () => { lagoonLoaded.value = 1; });
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...SHARED,
      uHabitat: { value: habitat },
      uHabitatReady: loaded,
      uShipwreck: { value: shipwreck },
      uShipwreckReady: shipLoaded,
      uKelp: { value: kelp },
      uKelpReady: kelpLoaded,
      uTemple: { value: temple },
      uTempleReady: templeLoaded,
      uLagoon: { value: lagoon },
      uLagoonReady: lagoonLoaded,
    },
    depthTest: false,
    depthWrite: false,
    vertexShader: SCREEN_VS,
    fragmentShader:
      COMMON +
      /* glsl */ `
varying vec2 vUv;
uniform sampler2D uHabitat;
uniform float uHabitatReady;
uniform sampler2D uShipwreck;
uniform float uShipwreckReady;
uniform sampler2D uKelp;
uniform float uKelpReady;
uniform sampler2D uTemple;
uniform float uTempleReady;
uniform sampler2D uLagoon;
uniform float uLagoonReady;
void main(){
  vec2 w = vec2(uCamTL.x + vUv.x * uView.x, uCamTL.y + (1. - vUv.y) * uView.y);
  float wy = w.y;
  vec3 col = waterCol(wy);
  float sx = SUN_X + (uCamC.x - SUN_X) * .86;
  float dx = w.x - sx;
  float top = exp(-max(wy, 0.) / 430.);
  col += vec3(.55, .88, .82) * exp(-dx * dx / (2. * 360. * 360.)) * top * .42;
  col += vec3(.10, .26, .30) * exp(-max(wy, 0.) / 760.) * .28;
  col = mix(col, vec3(.80, .97, .98), smoothstep(16., -34., wy) * .9);
  float n = fbm2(vec2((w.x - uCamC.x * .9) * .0034 + uTime * .012, wy * .0042 - uTime * .006));
  col *= .93 + .14 * n;
  col += vec3(.16, .07, .03) * smoothstep(2330., 2680., wy) * (.5 + .5 * fbm2(vec2(w.x * .004, uTime * .05))) * .5;

  float isReef = step(0.5, uBgStyle) * (1.0 - step(1.5, uBgStyle));
  float isShip = step(1.5, uBgStyle) * (1.0 - step(2.5, uBgStyle));
  float isKelp = step(2.5, uBgStyle) * (1.0 - step(3.5, uBgStyle));
  float isTemple = step(3.5, uBgStyle) * (1.0 - step(4.5, uBgStyle));
  float isLagoon = step(4.5, uBgStyle);
  float isCustom169 = step(1.5, uBgStyle);

  // Subtle ambient water color harmonization per ocean theme
  col = mix(col, col * vec3(.78, 1.07, .89) + vec3(0., .03, .01) * top, isKelp * .62);
  col = mix(col, col * vec3(.90, 1.05, 1.09) + vec3(.01, .04, .05) * top, isLagoon * .58);

  float texAspect = mix(3.0, 1.7778, isCustom169);
  float span = max(uView.x * 1.14, uView.y * texAspect * mix(1.22, 1.12, isCustom169));
  vec2 plane = vec2(span, span / texAspect);
  vec2 crop = (plane - uView) / plane;
  vec2 uvReef = vUv * (1.0 - crop) + crop * vec2(.5 + .4 * sin(uCamTL.x * .0009), .75 - clamp(uCamTL.y / 1100.0, 0., .75));
  vec2 uvScene = vUv * (1.0 - crop) + crop * vec2(.5 + .35 * sin(uCamTL.x * .00075), .78 - clamp(uCamTL.y / 1200.0, 0., .78));

  vec3 distantReef = texture2D(uHabitat, clamp(uvReef, 0., 1.)).rgb;
  vec3 brightReef = max(col * .90, distantReef * 1.38 + col * .28);
  vec3 reefCol = mix(brightReef, distantReef, uWaterStyle);
  float reefAmt = mix(.84, .96, uWaterStyle);
  float reefMix = uHabitatReady * isReef * (1.0 - smoothstep(520., 1100., uCamC.y)) * reefAmt;
  col = mix(col, reefCol, reefMix);

  float sceneDepthFade = 1.0 - smoothstep(680., 1380., uCamC.y);
  vec3 shipTex = texture2D(uShipwreck, clamp(uvScene, 0., 1.)).rgb;
  vec3 shipCol = mix(shipTex, max(col * .78, shipTex * 1.08 + col * .14), .48);
  col = mix(col, shipCol, uShipwreckReady * isShip * sceneDepthFade * .92);

  vec3 kelpTex = texture2D(uKelp, clamp(uvScene, 0., 1.)).rgb;
  vec3 kelpCol = mix(kelpTex, max(col * .80, kelpTex * 1.06 + col * .14), .36);
  col = mix(col, kelpCol, uKelpReady * isKelp * sceneDepthFade * .93);

  vec3 templeTex = texture2D(uTemple, clamp(uvScene, 0., 1.)).rgb;
  vec3 templeCol = mix(templeTex, max(col * .82, templeTex * 1.07 + col * .15), .38);
  col = mix(col, templeCol, uTempleReady * isTemple * sceneDepthFade * .93);

  vec3 lagoonTex = texture2D(uLagoon, clamp(uvScene, 0., 1.)).rgb;
  vec3 lagoonCol = mix(lagoonTex, max(col * .84, lagoonTex * 1.09 + col * .18), .34);
  col = mix(col, lagoonCol, uLagoonReady * isLagoon * sceneDepthFade * .94);

  col += (hash21(gl_FragCoord.xy + fract(uTime)) - .5) / 150.;
  gl_FragColor = vec4(col, 1.);
}`,
  });
  mat.addEventListener("dispose", () => {
    habitat.dispose();
    shipwreck.dispose();
    kelp.dispose();
    temple.dispose();
    lagoon.dispose();
  });
  return mat;
}

// ---------------------------------------------------------------- god-rays / light shafts
export function raysMaterial(o: { par: number; strength: number; sharp: number; speed: number; off: number; additive: boolean }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...SHARED,
      uPar: { value: o.par },
      uStrength: { value: o.strength },
      uSharp: { value: o.sharp },
      uSpeed: { value: o.speed },
      uOff: { value: o.off },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: o.additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
    vertexShader: SCREEN_VS,
    fragmentShader:
      COMMON +
      /* glsl */ `
uniform float uPar, uStrength, uSharp, uSpeed, uOff;
varying vec2 vUv;
void main(){
  vec2 w = vec2(uCamTL.x + vUv.x * uView.x, uCamTL.y + (1. - vUv.y) * uView.y);
  float lx = w.x - uCamC.x * (1. - uPar);
  float u = lx + w.y * .36 + uOff;
  float t = uTime * uSpeed;
  float n = vnoise(vec2(u * .0105, t * .4)) * .55 + vnoise(vec2(u * .026 + 7., -t * .7)) * .30 + vnoise(vec2(u * .058, t * 1.3 + 3.)) * .15;
  float r = smoothstep(.47 + uSharp * .06, .84, n);
  r = pow(r, 1. + uSharp);
  float depthFade = exp(-max(w.y, 0.) / 820.);
  float boost = 1. + 1.4 * exp(-max(w.y, 0.) / 170.);
  float a = r * depthFade * boost * uStrength * mix(2.15, 1.0, uWaterStyle) * smoothstep(-80., 40., w.y);
  vec3 c = mix(vec3(.55, .93, 1.), vec3(1., .96, .78), exp(-max(w.y, 0.) / 340.) * .75);
  gl_FragColor = vec4(c * a, a * .3);
}`,
  });
}

// ---------------------------------------------------------------- rock / sand / reef rock
export interface RockOpts {
  rock0: [number, number, number];
  rock1: [number, number, number];
  crust: [number, number, number];
  vein: [number, number, number];
  veinK: number;
  seed: number;
  fog: number;
  fade?: [number, number];
  lip?: boolean;
  cave?: boolean;
  crustAll?: number;
  instanced?: boolean;
  dark?: number;
  bump?: number;
  lite?: boolean;
}

export function rockMaterial(o: RockOpts) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...SHARED,
      uRock0: { value: new THREE.Vector3(...o.rock0) },
      uRock1: { value: new THREE.Vector3(...o.rock1) },
      uCrust: { value: new THREE.Vector3(...o.crust) },
      uVein: { value: new THREE.Vector3(...o.vein) },
      uVeinK: { value: o.veinK },
      uSeed: { value: o.seed },
      uFog: { value: o.fog },
      uFade: { value: new THREE.Vector2(...(o.fade ?? [1e6, 2e6])) },
      uLip: { value: o.lip ? 1 : 0 },
      uCave: { value: o.cave ? 1 : 0 },
      uCrustAll: { value: o.crustAll ?? 0 },
      uDark: { value: o.dark ?? 0 },
      uBump: { value: o.bump ?? 1 },
      uLite: { value: o.lite ? 1 : 0 },
    },
    transparent: true,
    premultipliedAlpha: true,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
attribute vec2 aSdf;
attribute float aLip;
varying vec3 vWP; varying vec3 vN; varying vec2 vLP; varying vec2 vSdf; varying float vLip;
void main(){
  #ifdef USE_INSTANCING
    mat4 im = modelMatrix * instanceMatrix;
    vLP = (instanceMatrix * vec4(position, 1.)).xy;
    vec4 wp = im * vec4(position, 1.);
    vN = normalize(mat3(im) * normal);
  #else
    vec4 wp = modelMatrix * vec4(position, 1.);
    vLP = position.xy;
    vN = normalize(mat3(modelMatrix) * normal);
  #endif
  vWP = wp.xyz; vSdf = aSdf; vLip = aLip;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader:
      COMMON +
      /* glsl */ `
uniform vec3 uRock0, uRock1, uCrust, uVein;
uniform float uVeinK, uSeed, uFog, uLip, uCave, uCrustAll, uDark, uBump, uLite;
uniform vec2 uFade;
varying vec3 vWP; varying vec3 vN; varying vec2 vLP; varying vec2 vSdf; varying float vLip;

void main(){
  float fw = max(fwidth(vSdf.x), 1e-3);
  float a = clamp(.5 - vSdf.x / fw, 0., 1.);
  if (uLip > .5) a *= smoothstep(.02, .42, vLip);
  float wy = -vWP.y;
  a *= 1. - smoothstep(uFade.x, uFade.y, wy);
  if (a < .004) discard;

  vec3 N0 = normalize(vN);
  if (!gl_FrontFacing) N0 = -N0;
  vec2 q = vLP;
  float s = uSeed;
  if (uLite > .5){
    // distant canyon wall: cheap shading (no bump / caustics) — it is mostly water-fog anyway
    float m1 = fbm2(q * .03 + s);
    vec3 b0 = mix(uRock0, uRock1, smoothstep(.2, .8, m1));
    vec3 c0 = lightSurfaceC(b0, N0, vWP, .9, 0.);
    c0 += vec3(.2, .45, .55) * pow(1. - clamp(N0.z, 0., 1.), 2.2) * .25;
    float wy0 = -vWP.y;
    c0 = mix(c0, waterCol(wy0) * 1.06 + vec3(.02, .035, .04), uFog);
    c0 = mix(c0, vec3(.01, .035, .08), uDark);
    float a0 = clamp(.5 - vSdf.x / fw, 0., 1.) * (1. - smoothstep(uFade.x, uFade.y, wy0));
    if (a0 < .004) discard;
    gl_FragColor = vec4(c0 * a0, a0);
    return;
  }
  vec3 g1 = fbmd(q * .05 + s);
  vec3 g2 = fbmd(q * .17 + s * 2.3);
  float n1 = g1.x;
  float st = fbm2(vec2(q.x * .02, q.y * .085) + s * 1.7);
  float pit = smoothstep(.56, .78, fbm2(q * .21 + s * 3.1));
  float fine = vnoise(q * .6 + s);
  vec2 grad = (g1.yz * .05 * 9. + g2.yz * .17 * 2.4) * uBump * .6;
  vec3 N = normalize(vec3(N0.xy - grad, N0.z));

  vec3 base = mix(uRock0, uRock1, smoothstep(.18, .82, n1 * .6 + st * .6));
  base *= 1. - .40 * pit;
  base *= .9 + .2 * fine;
  float up = smoothstep(.32, .88, N0.y);
  float crust = up * smoothstep(.28, .62, fbm2(q * .06 + s * 5. + 3.));
  crust = max(crust, uCrustAll);
  vec3 cr = uCrust * (.78 + .4 * vnoise(q * .17 + s)) * (.9 + .2 * st);
  cr *= mix(1., .5, smoothstep(0., 70., -vSdf.x) * uCrustAll);
  base = mix(base, cr, clamp(crust, 0., 1.) * .92);
  float shallow = smoothstep(1400., 200., wy);
  float alg = smoothstep(.55, .7, fbm2(q * .035 + s * 9.)) * shallow * (1. - uCrustAll);
  base = mix(base, vec3(.42, .46, .17), alg * .38);

  float ao = (1. - .38 * pit) * (.7 + .3 * smoothstep(0., 18., -vSdf.x));
  vec3 col = lightSurface(base, N, vWP, ao);

  float ridge = 1. - abs(2. * fbm2(q * .034 + s * 2.) - 1.);
  float vein = smoothstep(.955, .992, ridge) * uVeinK * .8;
  col += uVein * vein * (.65 + .35 * sin(uTime * 1.4 + q.x * .03 + q.y * .02));

  float hollow = smoothstep(-1.5, 3., vSdf.y) * uCave;
  vec3 gloom = waterCol(wy) * .16 + base * .035 + uVein * .012;
  col = mix(col, gloom, hollow * .88);

  float rim = pow(1. - clamp(N.z, 0., 1.), 2.4);
  col += mix(vec3(.30, .62, .72), vec3(.35, .30, .75), smoothstep(900., 1800., wy)) * rim * (.22 + .22 * sunK(wy)) * (1. - hollow);

  vec3 wc = waterCol(wy);
  col = mix(col, wc * 1.06 + vec3(.02, .035, .04), uFog);
  col = mix(col, vec3(.01, .035, .08), uDark);
  gl_FragColor = vec4(col * a, a);
}`,
  });
}

// ---------------------------------------------------------------- coral (instanced, swaying)
export function coralMaterial(o: { fog: number; dark?: number; sway?: number; double?: boolean; oblique?: boolean }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...SHARED,
      uFog: { value: o.fog },
      uDark: { value: o.dark ?? 0 },
      uSway: { value: o.sway ?? 1 },
      uOblique: { value: o.oblique === false ? 0 : 1 },
    },
    side: o.double ? THREE.DoubleSide : THREE.FrontSide,
    vertexShader: /* glsl */ `
attribute float aux;
attribute vec4 iTint;
attribute vec2 iData;
uniform float uTime; uniform float uSway; uniform float uOblique; uniform vec2 uReefView;
varying vec3 vWP; varying vec3 vN; varying vec3 vLP; varying vec3 vCol; varying float vAux; varying float vGlow;
void main(){
  vec3 lp = position;
  float h = clamp(position.y, 0., 1.6);
  float sw = uSway * iData.x * h * h;
  lp.x += sin(uTime * 1.25 + iTint.w + h * 2.4) * sw;
  lp.z += cos(uTime * .95 + iTint.w * 1.3 + h * 1.9) * sw * .6;
  mat4 im = modelMatrix * instanceMatrix;
  vec4 wp = im * vec4(lp, 1.);
  vWP = wp.xyz;
  vN = normalize(mat3(im) * normal);
  vLP = position;
  vAux = aux; vCol = iTint.rgb; vGlow = iData.y;
  wp.xy+=uReefView*wp.z*uOblique;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader:
      COMMON +
      /* glsl */ `
uniform float uFog, uDark;
varying vec3 vWP; varying vec3 vN; varying vec3 vLP; varying vec3 vCol; varying float vAux; varying float vGlow;
void main(){
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  float tip = clamp(vAux, 0., 1.);
  float tex = vnoise(vLP.xy * 34. + vLP.z * 21.);
  vec3 alb = vCol * (.70 + .56 * tip) * (.88 + .26 * tex);
  alb = mix(alb, alb * vec3(1.08, 1.14, 1.16) + .055, smoothstep(.63, 1., tip) * .66);
  float wy = -vWP.y;
  float deep = smoothstep(1000., 1900., wy);
  vec3 col = lightSurface(alb, N, vWP, .62 + .38 * tip);
  // living colour: corals keep their saturated hues instead of turning blue with the water
  vec3 pop = vCol * (.79+.55*tip) * (.84 + .57 * sunK(wy)) * (.89 + .11 * N.y) * absorbK(wy * .23);
  col = mix(col, pop, .74);
  float lum = dot(col, vec3(.3, .59, .11));
  col = mix(vec3(lum), col, 1.48);
  col+=vec3(.15,.13,.09)*smoothstep(.62,.96,tip)*(.48+.52*max(0.,N.y));
  col+=vCol*tip*sunK(wy)*.17;
  col += vCol * (.07 + .5 * tip) * deep * vGlow;
  col += vCol * pow(1. - abs(N.z), 2.) * .20 * (sunK(wy) * .8 + .3 * deep * vGlow);
  col = mix(col, waterCol(wy) * 1.06 + vec3(.02, .035, .04), mix(uFog, uFog * .62, clamp(uBgStyle, 0., 1.)));
  col = mix(col, vec3(.01, .035, .08), uDark);
  gl_FragColor = vec4(col, 1.);
}`,
  });
}

// ---------------------------------------------------------------- entities (submarine, diver, chest, vent)
export function litMaterial(o: { fog: number; suit?: readonly [number,number,number] }) {
  return new THREE.ShaderMaterial({
    uniforms: { ...SHARED, uFog: { value: o.fog },uSuit:{value:new THREE.Vector3(...(o.suit||[.76,.51,.12] as const))} },
    vertexShader: /* glsl */ `
attribute vec3 aCol; attribute float aEmi; attribute float aMet; attribute float aAO;
attribute vec3 aFace; varying vec3 vFace;
attribute float aKind;varying float vKind;varying vec3 vLocal;uniform vec3 uSuit;
varying vec3 vWP; varying vec3 vN; varying vec3 vC; varying float vE; varying float vM; varying float vAO;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.);
  vWP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
  vC = aCol; vE = aEmi; vM = aMet; vAO = aAO;
  vFace = aFace;
  vKind=aKind;vLocal=position;if(abs(aKind)<.1)vC=uSuit;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader:
      COMMON +
      /* glsl */ `
uniform float uFog;
varying vec3 vFace;
varying float vKind;varying vec3 vLocal;
varying vec3 vWP; varying vec3 vN; varying vec3 vC; varying float vE; varying float vM; varying float vAO;
void main(){
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  float wy = -vWP.y;
  vec3 L = normalize(vec3(-.40, .80, .45));
  float sk = sunK(wy);
  float ndl = max(dot(N, L), 0.);
  vec3 wc = waterCol(wy);
  // brass / bronze keep their warm hue: soft water-tinted ambient + warm sun
  vec3 amb = mix(vec3(.20, .21, .24), wc * .75 + vec3(.06), .32);
  vec3 sun = vec3(1., .92, .76) * sk * (ndl * .95 + .06);
  vec3 col = vC * (amb * (.55 + .45 * N.y * .5 + .2) + sun) * (.5 + .5 * vAO) * absorbK(wy * .5) * 1.05;
  vec3 Hh = normalize(L + vec3(0., 0., 1.));
  float spec = pow(max(dot(N, Hh), 0.), 28.) * vM * (sk * .9 + .12);
  col += vec3(1., .86, .6) * spec * .75;
  // dark sea reflected on metal edges
  col = mix(col, col * .55 + wc * .18 * vM, pow(1. - abs(N.z), 2.2) * vM * .7);
  col += vC * vE * (.85 + .15 * sin(uTime * 2.1 + vWP.x * .05));
  float patina=vnoise(vLocal.xy*9.+vLocal.z*4.)*.67+vnoise(vLocal.zy*22.+vLocal.x*11.)*.33;
  if(vM>.5){
    col*=.89+.23*patina;
    if(vKind>9.5&&vKind<10.5){float a=atan(vLocal.y,vLocal.x)/6.283;float seam=min(abs(fract(vLocal.z*2.3)-.5),abs(fract(a*11.)-.5));col*=.81+.19*smoothstep(.004,.025,seam);}
    col=mix(col,vec3(.12,.22,.19),smoothstep(.67,.88,patina)*.18);
    col+=vec3(.13,.19,.19)*pow(1.-abs(N.z),2.6)*vM+vec3(.30,.24,.13)*pow(max(dot(N,normalize(vec3(-.53,.70,.46))),0.),52.)*vM;
  }else if(abs(vKind)<.1)col*=.86+.21*patina+.025*sin(vLocal.y*255.)*sin(vLocal.x*215.);
  if(vFace.z > .5){
    vec2 face = vec2((vFace.x-.5)*.26, vFace.y*.30);
    float u=(abs(face.x)-.0415)/.031,q=clamp(u,-1.,1.),arc=pow(clamp(1.-q*q,0.,1.),.72);
    float center=.174+.001*q,cycle=fract((uTime+.99)/3.498),blink=smoothstep(.935,.966,cycle)*(1.-smoothstep(.977,.998,cycle));
    float upper=mix(center+arc*.0095,center-arc*.004,blink),lower=mix(center-arc*.011,center-arc*.004,blink);
    float feather=clamp(fwidth(vFace.y)*.17,.00055,.0035);
    float mask=smoothstep(lower-feather,lower+feather,face.y)*(1.-smoothstep(upper-feather,upper+feather,face.y))*(1.-smoothstep(.97,1.08,abs(u)))*(1.-smoothstep(.88,.995,blink));
    vec2 iris=face-vec2(sign(face.x)*.0415+sin(floor(uTime*.53)*23.3)*.003,.170+sin(uTime*.73)*.0016);
    float ir=length(iris);vec3 paint=mix(vec3(.96,.93,.85),mix(vec3(.22,.105,.047),vec3(.115,.21,.17),smoothstep(.005,.012,ir)),1.-smoothstep(.0102-feather,.0118+feather,ir));
    paint=mix(paint,vec3(.013,.009,.008),1.-smoothstep(.0064-feather,.0064+feather,ir));
    paint+=vec3(.89,.85,.75)*(1.-smoothstep(.0011,.0025+feather,length(iris-vec2(-.0039,.0043))));
    col=max(col,vC*.72); col=mix(col,paint,mask);
  }
  col = mix(col, wc * 1.04 + vec3(.02, .035, .04), uFog);
  gl_FragColor = vec4(col, 1.);
}`,
  });
}

// ---------------------------------------------------------------- soft glow quad / beam cone
export function glowMaterial(color: [number, number, number], strength: number, kind: "radial" | "beam") {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...SHARED,
      uColor: { value: new THREE.Vector3(...color) },
      uStrength: { value: strength },
      uBeam: { value: kind === "beam" ? 1 : 0 },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
varying vec2 vUv; varying vec3 vWP;
void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader:
      COMMON +
      /* glsl */ `
uniform vec3 uColor; uniform float uStrength; uniform float uBeam;
varying vec2 vUv; varying vec3 vWP;
void main(){
  float wy = -vWP.y;
  float a;
  if (uBeam > .5){
    float across = abs(vUv.y - .5) * 2.;
    a = (1. - smoothstep(0., 1., across)) * pow(1. - vUv.x, 1.6);
    a *= .55 + .45 * sin(uTime * 1.7 + vUv.x * 9.);
    a *= .22 + .78 * smoothstep(250., 1500., wy);
  } else {
    vec2 d = (vUv - .5) * 2.;
    a = pow(max(1. - dot(d, d), 0.), 2.2);
  }
  a *= uStrength;
  gl_FragColor = vec4(uColor * a, a);
}`,
  });
}

// ---------------------------------------------------------------- rising particles (smoke plume / bubbles)
export function plumeMaterial(o: { color: [number, number, number]; additive: boolean; size: number; rise: number; spread: number; alpha: number; speed: number }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...SHARED,
      uOrigin: { value: new THREE.Vector3(0, 0, 0) },
      uColor: { value: new THREE.Vector3(...o.color) },
      uSize: { value: o.size },
      uRise: { value: o.rise },
      uSpread: { value: o.spread },
      uAlpha: { value: o.alpha },
      uSpeed: { value: o.speed },
      uDir: { value: 0 },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: o.additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
    vertexShader: /* glsl */ `
attribute float aSeed;
uniform float uTime, uPx, uSize, uRise, uSpread, uSpeed, uDir;
uniform vec3 uOrigin;
varying float vA;
float hsh(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
void main(){
  float age = fract(uTime * uSpeed * (.7 + .6 * hsh(aSeed)) + aSeed);
  float wob = sin(age * 7. + aSeed * 40.);
  vec3 p = uOrigin + vec3(wob * uSpread * (.25 + age) - uDir * age * uSpread * 1.4, age * uRise, 0.);
  vA = smoothstep(0., .1, age) * (1. - smoothstep(.55, 1., age));
  gl_PointSize = max(1.5, uSize * uPx * (.45 + age * 1.1) * (.7 + .6 * hsh(aSeed * 3.1)));
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.);
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uColor; uniform float uAlpha;
varying float vA;
void main(){
  vec2 d = gl_PointCoord * 2. - 1.;
  float r = dot(d, d);
  if (r > 1.) discard;
  float a = (1. - r) * vA * uAlpha;
  gl_FragColor = vec4(uColor * a, a);
}`,
  });
}
