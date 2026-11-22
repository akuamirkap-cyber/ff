import { clamp, hypot, sin, sstep } from './math.js';

export const REEF = [76, 102];
export const REEF_LOOK = [71, -29, 77];

export function reefBasin(x, z) {
  return sstep(40, 22, hypot(x - REEF[0], z - 94));
}

// The winding sandy passage is shared by terrain, decoration placement and shading.
export function sandway(x, z) {
  const basin = reefBasin(x, z);
  const center = 76 - 0.20 * clamp(102 - z, -14, 37) + sin((z - 102) * 0.16) * 1.7;
  return basin * sstep(9.5, 3.8, Math.abs(x - center));
}

export const W_REEF = /*wgsl*/`
fn reefBasin(p: vec2f) -> f32 {
  return ss(40., 22., length(p - vec2f(76., 94.)));
}
fn reefSandway(p: vec2f) -> f32 {
  let center = 76. - .20 * clamp(102. - p.y, -14., 37.) + sin((p.y - 102.) * .16) * 1.7;
  return reefBasin(p) * ss(9.5, 3.8, abs(p.x - center));
}
`;