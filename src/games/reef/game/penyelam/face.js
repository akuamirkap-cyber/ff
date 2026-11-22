import { mix, sin, PI } from './math.js';

const BROWS = [
  [0.205, 0.201, 0.005], // relaxed, resting over a half-lidded gaze
  [0.208, 0.205, 0.010], // happy, lifted above the smiling cheek
  [0.219, 0.197, 0.003], // sad
  [0.227, 0.195, 0.003], // worried, noticeably raised at the bridge
  [0.195, 0.204, 0.002], // focused
];

export const FACE_BASE = 0.612;
export const HEAD_SCALE = 1.05;
export const FACE_MOUTH_Y = 0.096;

export function browY(style, t) {
  const [start, end, rise] = BROWS[style];
  return mix(start, end, t) + rise * sin(PI * t);
}

const browProfiles = BROWS.map((profile) => `vec3f(${profile.join(', ')})`).join(', ');

export const W_FACE = /*wgsl*/`
const FACE_BROWS = array<vec3f, 5>(${browProfiles});
fn browProfile(k: u32, t: f32) -> f32 {
  let b = FACE_BROWS[k];
  return mix(b.x, b.y, t) + b.z * sin(t * 3.14159265);
}
fn browLift(m: vec4f, t: f32) -> f32 {
  let base = browProfile(0u, t);
  return dot(m, vec4f(browProfile(1u, t), browProfile(2u, t), browProfile(3u, t), browProfile(4u, t)) - base);
}
fn mouthCurve(m: vec4f, t: f32) -> f32 {
  let end = pow(abs(t * 2. - 1.), 1.65);
  return m.x * (.021 * end - .003) - m.y * .009 * end - m.z * (.008 * end + .004);
}
fn faceMotion(t: f32, seed: f32) -> vec3f {
  let glance = floor(t * .53 + seed * 16.);
  let take = ss(.06, .27, fract(t * .53 + seed * 16.));
  let previous = sin((glance - 1.) * 23.3 + seed * 7.);
  let nextLook = sin(glance * 23.3 + seed * 7.);
  let cycle = fract((t + seed * 9.0) / (3.3 + seed * 1.8));
  let blink = ss(.935, .966, cycle) * ss(.998, .977, cycle);
  return vec3f(mix(previous, nextLook, take), sin(t * .73 + seed * 23.) * .4, blink);
}

// The iris sits on the curved face surface. Upper and lower lids actually mask
// the iris and the sclera independently, so a blink never squashes the pupil.
fn paintEyes(uv: vec2f, aa: vec2f, mood: vec4f, motion: vec3f, base: vec3f) -> vec4f {
  let xy = vec2f((uv.x - .5) * .26, uv.y * .30);
  let side_ = select(-1., 1., xy.x >= 0.);
  let u = (abs(xy.x) - .0415) / .031;
  let q = clamp(u, -1., 1.);
  let arc = pow(sat(1. - q * q), .72);
  let tilt = .001 + dot(mood, vec4f(.0035, -.0045, -.006, .004));
  let center = .174 + tilt * q;
  let top = center + arc * (.0095 + dot(mood, vec4f(.0105, -.001, .017, -.003)));
  let bottom = center + arc * (-.011 + dot(mood, vec4f(.015, .003, -.004, .001)));
  let blinkLine = center + arc * mix(-.004, .009, mood.x);
  let upper = mix(top, blinkLine, motion.z);
  let lower = mix(bottom, blinkLine, motion.z);
  let feather = clamp(aa.y * .17, .00055, .0035);
  let endMask = ss(1. + aa.x * 6., .97, abs(u));
  let aperture = ss(lower - feather, lower + feather, xy.y)
    * ss(upper + feather, upper - feather, xy.y) * endMask * (1. - ss(.88, .995, motion.z));

  let lidFold = ss(.002, 0., abs(xy.y - upper - .0018)) * endMask * (.32 + .3 * motion.z);
  let smileCheek = mood.x * ss(.026, .004, length(vec2f((abs(xy.x) - .058), xy.y - .141)));
  let skin = mix(base, base * vec3f(.70, .54, .49), lidFold * .55) + vec3f(.10, -.021, -.024) * smileCheek;

  let irisY = .170 + dot(mood, vec4f(.010, -.004, .0105, .003)) + motion.y * .004;
  let irisX = side_ * .0415 + motion.x * mix(.0045, .0024, mood.z) - side_ * mood.z * .0015;
  let pupil = xy - vec2f(irisX, irisY);
  let irisR = length(pupil);
  let pupilR = .0064 - .0019 * mood.z + .0007 * mood.x;
  let irisEdge = ss(.0118 + feather, .0102 - feather, irisR);
  let irisColor = mix(vec3f(.22, .105, .047), vec3f(.115, .21, .17), ss(.005, .012, irisR));
  let whites = mix(vec3f(.84, .81, .74), vec3f(.96, .93, .85), ss(.001, .010, upper - xy.y));
  var eye = mix(whites, irisColor, irisEdge);
  eye = mix(eye, vec3f(.013, .009, .008), ss(pupilR + feather, pupilR - feather, irisR));
  let gleam = ss(.0025 + feather, .0011, length(pupil - vec2f(-.0039, .0043))) * irisEdge;
  eye = mix(eye, vec3f(1., .94, .78), gleam * .89);
  return vec4f(mix(skin, eye, aperture), aperture);
}
`;