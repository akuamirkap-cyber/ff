import frames from "./crewAtlas.json";
import type { DiverPose } from "./residents";
export type SocketFrame = {
  lamp: number[];
  light: number[];
  muzzle: number[];
  axis?: number[];
};
const data = frames as SocketFrame[][];
export function atlasPose(d: DiverPose) {
  const frame = Math.floor((d.kick / (2 * Math.PI)) * 12) % 12;
  const row =
    d.aim > 0.24
      ? d.line.phase === "ready"
        ? 3
        : 4
      : d.wave > 0.45
        ? 2
        : d.head > 0.5
          ? 1
          : d.stroke < 0.35
            ? 5
            : 0;
  const scale = (d.depth * d.presence * d.baseScale) / 30.4,
    art = data[row]?.[frame];
  let pitch = d.pitch;
  if (d.aim > 0.24 && art) {
    for (let k = 0; k < 3; k++) {
      const co = Math.cos(pitch),
        si = Math.sin(pitch),
        m = art.muzzle;
      const mx = d.x + d.dir * scale * (m[0] * co - m[1] * si),
        my = d.y + scale * (m[0] * si + m[1] * co);
      const axis = art.axis;
      pitch =
        Math.atan2(d.aimY - my, Math.max(1, Math.abs(d.aimX - mx))) -
        (axis ? Math.atan2(axis[1], axis[0]) : 0);
    }
  }
  return { row, frame, scale, pitch, art };
}
export function atlasMuzzle(d: DiverPose) {
  const a = atlasPose(d);
  if (!a.art) return null;
  const m = a.art.muzzle,
    co = Math.cos(a.pitch),
    si = Math.sin(a.pitch);
  const axis = a.art.axis || [1, 0];
  return {
    x: d.x + d.dir * a.scale * (m[0] * co - m[1] * si),
    y: d.y + a.scale * (m[0] * si + m[1] * co),
    dx: d.dir * (axis[0] * co - axis[1] * si),
    dy: axis[0] * si + axis[1] * co,
  };
}
