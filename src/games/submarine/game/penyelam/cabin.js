export const CABIN_LAMP_COUNT = 6;
export const CABIN_UNIFORM_OFFSET = 156;
export const SCENE_FLOATS = CABIN_UNIFORM_OFFSET + 12 + CABIN_LAMP_COUNT * 4;

export const BRIDGE_GLOBE = [0.43, 0.256, -0.42];
export const BRIDGE_PIVOT_Y = 0.3;
export const HALL_GLOBE_Y = -0.02 + 0.6 * 0.745;
export const HALL_GLOBE_Z = [0.5, 1.15, 2.47];
export const SONAR_GLOW = [0, -0.212, -0.401];

export const W_CABIN_LIGHTS = /*wgsl*/`
struct CabinLight { diffuse: vec3f, specular: vec3f };

fn cabinIrradiance(wp: vec3f, N: vec3f, V: vec3f, rough: f32) -> CabinLight {
  var result = CabinLight(vec3f(0.), vec3f(0.));
  let scale = cabinData.origin.w;
  if (scale < .01) { return result; }
  let unit = 1. / scale;
  let local = qrot(cabinData.inverse, (wp - cabinData.origin.xyz) * unit);
  let night = 1. - g.env.x;
  result.diffuse = mix(vec3f(.18, .215, .23), vec3f(.078, .077, .081), night);
  result.diffuse += vec3f(.12, .075, .039) * (.34 + .66 * sat(dot(N, -cabinData.up.xyz)));
  let bridge = ss(.74, -.17, local.z);
  result.diffuse += vec3f(.17, .42, .51) * bridge * g.env.x * (.35 + .65 * sat(N.y));

  for (var k = 0u; k < ${CABIN_LAMP_COUNT}u; k++) {
    let lamp = cabinData.lamps[k];
    let lv = lamp.xyz - wp;
    let distSq = dot(lv, lv);
    let localSq = distSq * unit * unit;
    let distLocal = sqrt(localSq);
    if (distLocal > 2.1) { continue; }
    let L = lv * inverseSqrt(max(distSq, .000009));
    let down = dot(L, cabinData.up.xyz);
    let dash = k == 5u;
    var beam = mix(.16, 1., ss(-.57, .42, down));
    var tint = mix(vec3f(1., .72, .46), vec3f(1., .83, .62), f32(k % 3u) * .44);
    let alarm = g.dmg.y * (.38 + .48 * (.5 + .5 * sin(g.cam.w * 6.)));
    if (dash) {
      beam = .54 + .46 * sat(-down);
      tint = vec3f(.30, .88, .69);
    } else {
      tint = mix(tint, vec3f(1., .25, .12), alarm * f32(k > 1u));
    }
    let source = select(.07, .09, dash);
    let range = select(1.8, .54, dash);
    var radiance = lamp.w * beam * ss(range, range * .39, distLocal) / (source + localSq);
    let ray = qrot(cabinData.inverse, lv * unit);
    let lampZ = local.z + ray.z;
    if ((local.z - 1.6) * (lampZ - 1.6) < 0.) {
      let t = (1.6 - local.z) / (lampZ - local.z);
      let hatch = local + ray * t;
      radiance *= mix(.10, 1., ss(.33, .21, abs(hatch.x)) * ss(.47, .31, hatch.y));
    }
    let ndl = sat(dot(N, L));
    let attenuation = tint * radiance;
    let H = V + L;
    let nh = sat(dot(N, H / max(length(H), .01)));
    result.diffuse += attenuation * (ndl + .14 * ss(.27, .04, distLocal));
    result.specular += attenuation * pow(nh, mix(90., 9., rough)) * ndl;
  }
  return result;
}

fn cabinGlassGlints(wp: vec3f, n: vec3f, v: vec3f) -> vec3f {
  var light = vec3f(0.);
  for (var k = 0u; k < ${CABIN_LAMP_COUNT}u; k++) {
    let lamp = cabinData.lamps[k];
    let lv = lamp.xyz - wp;
    let d = length(lv) / max(cabinData.origin.w, .01);
    let lr = lv / max(length(lv), .003);
    let glint = pow(sat(dot(reflect(-lr, n), v)), 32.);
    let tint = select(vec3f(1., .69, .42), vec3f(.33, .82, .68), k == 5u);
    light += tint * glint * lamp.w * ss(1.65, .24, d) / (.10 + d * d);
  }
  return light;
}
`;