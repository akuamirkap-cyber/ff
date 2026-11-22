import { bakedTexture } from "./cachedWorld";
import { glowOrb } from "./ocean";

export const FILAMENTS = 9,
  JOINTS = 14,
  STING_SECONDS = 4;
export const JELLY_COLORS = ["#c4a2ff", "#96e5fa", "#f6bad6"];
const TAU = Math.PI * 2;
const glows: HTMLCanvasElement[] = [];
function jellyGlow(color: number) {
  if (glows[color]) return glows[color];
  const cv = document.createElement("canvas");cv.width=cv.height=96;
  const c=cv.getContext("2d")!,g=c.createRadialGradient(48,48,5,48,48,47);
  const rgb = color === 0 ? "186,136,255" : color === 1 ? "115,228,255" : "255,154,216";
  g.addColorStop(0,`rgba(${rgb},.36)`);g.addColorStop(.39,`rgba(${rgb},.15)`);g.addColorStop(1,`rgba(${rgb},0)`);
  c.fillStyle=g;c.fillRect(0,0,96,96);glows[color]=cv;return cv;
}
type Solid = (x: number, y: number, r: number) => boolean;
type Swimmer = {
  x: number;
  y: number;
  r: number;
  invuln: number;
  hiddenCave: unknown;
};
export interface Medusa {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  r: number;
  seed: number;
  near: boolean;
  color: number;
  phase: number;
  pulse: number;
  tilt: number;
  points: Float32Array;
}

export function createMedusa(
  x: number,
  y: number,
  r: number,
  seed: number,
  near: boolean,
  color: number,
): Medusa {
  return {
    x,
    y,
    homeX: x,
    homeY: y,
    r,
    seed,
    near,
    color,
    phase: seed,
    pulse: 0,
    tilt: 0,
    points: new Float32Array(FILAMENTS * JOINTS * 3),
  };
}

// Normalized 3D centerlines are consumed unchanged by both drawing paths and contact tests.
export function shapeMedusa(j: Medusa, t: number) {
  j.phase = t * (1.42 + 0.13 * Math.sin(j.seed)) + j.seed;
  j.pulse = (0.5 + 0.5 * Math.cos(j.phase)) ** 2.35;
  j.tilt = Math.sin(t * 0.23 + j.seed) * 0.105;
  const width = 1 - 0.17 * j.pulse,
    co = Math.cos(j.tilt),
    si = Math.sin(j.tilt);
  for (let n = 0; n < FILAMENTS; n++) {
    const a = (n / FILAMENTS) * TAU + j.seed * 0.27;
    const len = 1.6 + 0.95 * (0.5 + 0.5 * Math.sin(n * 3.8 + j.seed));
    for (let k = 0; k < JOINTS; k++) {
      const u = k / (JOINTS - 1),
        ix = (n * JOINTS + k) * 3;
      const x =
        Math.cos(a) * width * 0.91 +
        u *
          (0.24 * Math.sin(j.phase * 0.72 - u * 5 + a) +
            0.32 * Math.sin(t * 0.34 + j.seed)) +
        u * u * Math.sin(a) * 0.14;
      const y =
        0.02 +
        len * u +
        0.14 * u * Math.cos(j.phase - u * 3.4) +
        0.03 * Math.sin(a * 6);
      j.points[ix] = x * co - y * si;
      j.points[ix + 1] = x * si + y * co;
      j.points[ix + 2] =
        Math.sin(a) * width * 0.84 + 0.12 * u * Math.cos(a + t * 0.69 - u * 3);
    }
  }
}

function segmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax,
    dy = by - ay,
    u = Math.max(
      0,
      Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)),
    );
  return (px - ax - u * dx) ** 2 + (py - ay - u * dy) ** 2;
}

export function touchesTentacle(j: Medusa, p: Swimmer) {
  if (
    !j.near ||
    Math.abs(p.x - j.x) > j.r * 1.9 + p.r ||
    p.y < j.y - j.r * 0.25 - p.r ||
    p.y > j.y + j.r * 3 + p.r
  )
    return false;
  const px = (p.x - j.x) / j.r,
    py = (p.y - j.y) / j.r,
    radius2 = ((p.r * 0.72) / j.r + 0.035) ** 2;
  for (let n = 0; n < FILAMENTS; n++)
    for (let k = 1; k < JOINTS; k++) {
      const ix = (n * JOINTS + k) * 3,
        v = j.points;
      if (
        segmentDistance(px, py, v[ix - 3], v[ix - 2], v[ix], v[ix + 1]) <=
        radius2
      )
        return true;
    }
  return false;
}

export function touchesBell(j: Medusa, p: Swimmer) {
  if (!j.near || p.y > j.y + j.r * .12 + p.r * .18) return false;
  const dx = (p.x - j.x) / (j.r * 1.03 + p.r * .62);
  const dy = (p.y - (j.y - j.r * .43)) / (j.r * .51 + p.r * .52);
  return dx * dx + dy * dy < 1;
}

export class MedusaGarden {
  animals: Medusa[] = [];
  stun = 0;
  time = 0;
  private contact = false;
  private grace = 0;
  private bounceCooldown = 0;
  lastBounce: { x: number; y: number; nx: number; ny: number; r: number } | null = null;
  private lastX = 0;
  private lastY = 0;
  reset(x: number, y: number, solid: Solid) {
    this.animals.length = 0;
    this.stun = 0;
    this.time = 0;
    this.contact = false;
    this.grace = 3.5;
    this.bounceCooldown = 0;
    this.lastBounce = null;
    this.lastX = x;
    this.lastY = y;
    const place = (
      px: number,
      py: number,
      radius: number,
      near: boolean,
      color: number,
      seed: number,
    ) => {
      for (let i = 0; i < 28; i++) {
        const xx = Math.max(28, Math.min(3770, px + Math.sin(i * 2.4) * i * 8));
        const yy = Math.max(45, Math.min(2490, py + Math.cos(i * 1.7) * i * 7));
        if (
          solid(xx, yy + radius * 0.8, radius * 1.8) ||
          Math.hypot(xx - x, yy - y) < (near ? 74 : 30)
        )
          continue;
        const j = createMedusa(xx, yy, radius, seed, near, color);
        shapeMedusa(j, 0);
        this.animals.push(j);
        return;
      }
    };
    const side = x > 3150 ? -1 : 1;
    place(x - side * 117, y - 42, 18, true, 0, 1.2);
    place(x - side * 157, y - 72, 9, false, 1, 3.7);
    place(x + side * 164, y + 26, 13, true, 2, 4.6);
    for (let i = 0; i < 28; i++)
      place(
        115 + ((i * 677) % 3540),
        150 + ((i * 387) % 2220),
        i % 3 ? 12 + (i % 9) : 7 + (i % 6),
        i % 3 !== 0,
        i % 3,
        i * 2.16 + 0.8,
      );
  }

  update(dt: number, p: Swimmer, solid: Solid, shielded: boolean) {
    this.time += dt;
    this.stun = Math.max(0, this.stun - dt);
    this.grace = Math.max(0, this.grace - dt);
    this.bounceCooldown = Math.max(0, this.bounceCooldown - dt);
    if (this.stun < 1e-8) this.stun = 0;
    let touching = false,
      crossed = false;
    let bell: Medusa | null = null;
    const dx = p.x - this.lastX,
      dy = p.y - this.lastY,
      travel = Math.hypot(dx, dy);
    const steps =
      travel < 140
        ? Math.min(32, Math.ceil(travel / Math.max(1.5, p.r * 0.55)))
        : 1;
    for (const j of this.animals) {
      if (Math.abs(p.x - j.x) > 960 || Math.abs(p.y - j.y) > 650) continue;
      const t = this.time,
        ox = j.homeX + Math.sin(t * 0.12 + j.seed) * 19,
        oy = j.homeY + Math.cos(t * 0.13 + j.seed) * 15 - j.pulse * 1.8;
      if (!solid(ox, oy + j.r * 0.55, j.r * 1.28)) {
        j.x = ox;
        j.y = oy;
      }
      shapeMedusa(j, t);
      if (!bell && touchesBell(j, p)) bell = j;
      if (touchesTentacle(j, p)) touching = true;
      if (
        j.near &&
        !touching &&
        !crossed &&
        steps > 1 &&
        Math.abs(j.x - p.x) < j.r * 2 + travel + p.r &&
        Math.abs(j.y - p.y) < j.r * 3 + travel + p.r
      ) {
        const swept = {
          x: 0,
          y: 0,
          r: p.r,
          invuln: p.invuln,
          hiddenCave: p.hiddenCave,
        };
        for (let step = 1; step < steps; step++) {
          swept.x = this.lastX + (dx * step) / steps;
          swept.y = this.lastY + (dy * step) / steps;
          if (touchesTentacle(j, swept)) {
            crossed = true;
            break;
          }
        }
      }
    }
    this.lastX = p.x;
    this.lastY = p.y;
    if (bell && this.bounceCooldown <= 0 && !p.hiddenCave) {
      const nx = (p.x - bell.x) / (bell.r * 1.03 + p.r * .62);
      const ny = (p.y - (bell.y - bell.r * .43)) / (bell.r * .51 + p.r * .52);
      const length = Math.hypot(nx, ny) || 1;
      this.lastBounce = { x: p.x, y: p.y, nx: nx / length, ny: ny / length, r: bell.r };
      bell.phase += .67;
      this.bounceCooldown = .72;
      this.contact = touching;
      return "bounce";
    }
    const fresh =
      (touching || crossed) &&
      !this.contact &&
      this.stun <= 0 &&
      this.grace <= 0 &&
      !p.hiddenCave &&
      p.invuln <= 0;
    this.contact = touching;
    if (!fresh) return null;
    if (shielded) {
      this.grace = 1.5;
      return "shield";
    }
    this.stun = STING_SECONDS;
    this.grace = STING_SECONDS + 1.4;
    return "sting";
  }

  drawCached(
    c: CanvasRenderingContext2D,
    cl: number,
    ct: number,
    vw: number,
    vh: number,
    near: boolean,
  ) {
    const atlas = bakedTexture("moon-jellies");
    if (!atlas) return;
    c.save();
    c.translate(-cl, -ct);
    c.lineJoin = "round";
    c.lineCap = "round";
    for (const j of this.animals) {
      if (
        j.near !== near ||
        j.x < cl - 35 ||
        j.x > cl + vw + 35 ||
        j.y < ct - 75 ||
        j.y > ct + vh + 35
      )
        continue;
      const r = j.r,
        v = j.points;
      c.save();
      c.translate(j.x, j.y);
      c.scale(r, r);
      c.save();c.globalCompositeOperation="screen";c.globalAlpha=near?.6:.26;
      c.drawImage(jellyGlow(j.color),-1.75,-2.05,3.5,3.5);c.restore();
      c.strokeStyle = JELLY_COLORS[j.color];
      c.globalAlpha = near ? 0.8 : 0.44;
      for (let n = 0; n < FILAMENTS; n++) {
        c.beginPath();
        c.lineWidth = 0.029 + (n % 3) * 0.007;
        for (let k = 0; k < JOINTS; k++) {
          const i = (n * JOINTS + k) * 3;
          if (!k) c.moveTo(v[i], v[i + 1]);
          else c.lineTo(v[i], v[i + 1]);
        }
        c.stroke();
      }
      c.rotate(j.tilt);
      c.globalAlpha = near ? 1 : 0.7;
      const f = Math.floor(((((j.phase / TAU) % 1) + 1) % 1) * 12);
      c.drawImage(
        atlas,
        f * 144,
        j.color * 160,
        144,
        160,
        -1.35,
        -1.16,
        2.7,
        3,
      );
      c.fillStyle="rgba(235,255,255,.75)";
      for(let n=0;n<7;n++){
        const a=n*2.399+j.seed,rr=.23+.64*Math.sqrt((n+1)/8),tw=.42+.28*Math.sin(j.phase*1.3+n*2);
        c.globalAlpha=(near?.63:.28)*tw;c.beginPath();
        c.arc(Math.cos(a)*rr,-.23-Math.sin(a)*rr*.35,.025+n%3*.012,0,TAU);c.fill();
      }
      c.restore();
    }
    c.restore();
  }

  drawShock(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    reduced: boolean,
  ) {
    if (this.stun <= 0) return;
    const t = reduced ? 0.5 : this.time;
    c.save();
    c.globalCompositeOperation = "lighter";
    const nB = 5;
    for (let b = 0; b < nB; b++) {
      const seed = Math.floor(t * 24) * 7 + b * 13;
      const a0 = (b / nB) * TAU + t * 3;
      const R = r * 1.3;
      c.strokeStyle = b % 2 ? "#e0f2fe" : "#67e8f9";
      c.lineWidth = b % 2 ? 1 : 1.8;
      c.globalAlpha = 0.55 + 0.45 * Math.sin(t * 40 + b);
      c.beginPath();
      let sx = x + Math.cos(a0) * R * 0.3,
        sy = y + Math.sin(a0) * R * 0.3;
      c.moveTo(sx, sy);
      for (let k = 1; k <= 5; k++) {
        const h = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
        const jit = (h - Math.floor(h) - 0.5) * R * 0.6;
        const ang = a0 + (k / 5) * 0.8;
        sx = x + Math.cos(ang) * (R * (0.3 + 0.7 * (k / 5))) + Math.cos(ang + 1.57) * jit;
        sy = y + Math.sin(ang) * (R * (0.3 + 0.7 * (k / 5))) + Math.sin(ang + 1.57) * jit;
        c.lineTo(sx, sy);
      }
      c.stroke();
    }
    c.globalAlpha = 0.5 + 0.2 * Math.sin(t * 30);
    c.drawImage(glowOrb("rgba(140, 230, 255, 0.5)", false), x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
    for (let k = 0; k < 4; k++) {
      const a = t * 4.2 + (k / 4) * TAU;
      const sx = x + Math.cos(a) * r * 1.25,
        sy = y - r * 1.1 + Math.sin(a) * r * 0.35;
      c.fillStyle = k % 2 ? "#fde047" : "#fef9c3";
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? 1.5 : 3.6;
        const aa = (i / 10) * TAU + t * 6;
        c.lineTo(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr);
      }
      c.closePath();
      c.fill();
    }
    c.restore();
  }
}
