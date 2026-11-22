import { bakedTexture, searchlight } from "./cachedWorld";
import { crewPose, subLightDirection, subLens, subYaw } from "./crewKinematics";
import { Euler } from "three";
import { atlasPose, atlasMuzzle } from "./atlasProjection";

export interface ReefFish {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dead: boolean;
  kind: "player" | "npc" | "bot";
  hiddenCave: unknown;
  eatenBy: unknown;
  invuln: number;
  caught?: boolean;
  tilt?: number;
  sp: { pal: { body: string } };
}

type Activity = "swim" | "wave" | "look" | "dive" | "explore" | "aim";
type Point = { x: number; y: number };
type Solid = (x: number, y: number, pad: number) => boolean;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const ease = (v: number, target: number, dt: number, speed = 2) => v + (target - v) * (1 - Math.exp(-speed * dt));

export interface DiverPose extends Point {
  baseScale: number; stroke: number; yaw: number; cached: boolean;
  dir: number; phase: number; depth: number; presence: number; active: boolean;
  head: number; pitch: number; wave: number; kick: number; recoil: number;
  state: Activity; timer: number; tx: number; ty: number; vx: number; vy: number;
  homeX: number; homeY: number; cooldown: number; target: ReefFish | null;
  aimX: number; aimY: number; aim: number;
  line: { phase: "ready" | "flying" | "tethered" | "reeling"; x: number; y: number; vx: number; vy: number; time: number; fish: ReefFish | null };
}

interface SubPose extends Point {
  dir: number; phase: number; depth: number; targetDepth: number; ty: number; timer: number; pitch: number;
}

function lineOrigin(d: DiverPose) {
  const cached=d.cached?atlasMuzzle(d):null;if(cached)return cached;
  const v = crewPose(d).muzzle;
  return { x: v.x, y: -v.y };
}

function diver(i: number): DiverPose {
  return {
    baseScale: (i ? 36 : 38) * .8, yaw: -2.02, stroke: .55, cached: false,
    x: 0, y: 0, dir: 1, phase: rnd(0, 6.28), depth: 1, presence: 1, active: true,
    head: 0, pitch: 0, wave: 0, kick: 0, recoil: 0, state: "swim", timer: 2 + i,
    tx: 0, ty: 0, vx: 0, vy: 0, homeX: 0, homeY: 0, cooldown: 10 + i * 2,
    target: null, aimX: 0, aimY: 0, aim: 0,
    line: { phase: "ready", x: 0, y: 0, vx: 0, vy: 0, time: 0, fish: null },
  };
}

export class ReefResidents {
  divers = [diver(0), diver(1), diver(2)];
  subs: SubPose[] = [0, 1].map(i => ({ x: 1000, y: 280 + i * 1450, dir: i ? 1 : -1, phase: i * 2, depth: .92, targetDepth: .92, ty: 280, timer: 12, pitch: 0 }));
  time = 0;
  crewCount = 2;
  private crewTimer = 30;
  private away = 0;
  private habitat: HTMLImageElement | null = null;
  private shipwreck: HTMLImageElement | null = null;
  private kelp: HTMLImageElement | null = null;
  private temple: HTMLImageElement | null = null;
  private lagoon: HTMLImageElement | null = null;

  reset(x: number, y: number, solid?: Solid) {
    this.time = 0;
    this.away = 0;
    this.crewCount = 1 + Math.floor(Math.random() * 3);
    this.crewTimer = rnd(22, 38);
    for (const d of this.divers) if (d.line.fish) d.line.fish.caught = false;
    this.divers = [diver(0), diver(1), diver(2)];
    this.divers.forEach((d, i) => {
      d.x = d.homeX = clamp(x + 5 + i * 39, 40, 3750);
      d.y = d.homeY = clamp(y + 23 + i * 15, 40, 2520);
      if (solid?.(d.x, d.y, 8)) {
        for (let tries = 0; tries < 16; tries++) {
          d.x = clamp(x + rnd(-70, 75), 18, 3780);
          d.y = clamp(y + rnd(-60, 55), 30, 2530);
          if (!solid(d.x, d.y, 8)) break;
        }
        d.homeX = d.x; d.homeY = d.y;
      }
      d.tx = d.x + 30; d.ty = d.y;
      d.active = i < this.crewCount;
      d.presence = d.active ? 1 : 0;
      d.state = i === 0 ? "look" : "swim";
      d.timer = 3 + i;
    });
    this.subs.forEach((s, i) => {
      s.x = clamp(x + (i ? -400 : 96), 100, 3650);
      s.y = s.ty = i ? 1700 : clamp(y - 66, 55, 1000);
      s.timer = rnd(10, 21); s.depth = s.targetDepth = i ? .68 : .95;
    });
    if (!this.habitat && typeof Image !== "undefined") {
      this.habitat = new Image(); this.habitat.src = "/images/reef-habitat.webp";
    }
    if (!this.shipwreck && typeof Image !== "undefined") {
      this.shipwreck = new Image(); this.shipwreck.src = "/src/assets/images/ancient_shipwreck_bg_1795254425429.jpg";
    }
    if (!this.kelp && typeof Image !== "undefined") {
      this.kelp = new Image(); this.kelp.src = "/src/assets/images/kelp_cathedral_bg_1795322568135.jpg";
    }
    if (!this.temple && typeof Image !== "undefined") {
      this.temple = new Image(); this.temple.src = "/src/assets/images/sunken_temple_bg_1795322569079.jpg";
    }
    if (!this.lagoon && typeof Image !== "undefined") {
      this.lagoon = new Image(); this.lagoon.src = "/src/assets/images/crystal_lagoon_bg_1795322569691.jpg";
    }
  }

  update(dt: number, player: ReefFish, fish: ReefFish[], solid: Solid, hit: (f: ReefFish) => void, warn: (text: string) => void) {
    this.time += dt;
    const t = this.time;
    for (const [i, s] of this.subs.entries()) {
      s.timer -= dt;
      if (s.timer <= 0) {
        s.timer = rnd(16, 32);
        s.targetDepth = rnd(.57, 1.04);
        s.ty = clamp(s.y + rnd(-130, 160), i ? 1050 : 65, i ? 2470 : 1080);
      }
      s.x += s.dir * (i ? 8 : 10) * dt * s.depth;
      if (s.x > 3910 || s.x < -110) s.dir *= -1;
      s.depth = ease(s.depth, s.targetDepth, dt, .1);
      const prevY = s.y;
      s.y = ease(s.y, s.ty + Math.sin(t * .19 + s.phase) * 9, dt, .12);
      s.pitch = ease(s.pitch, clamp((s.y - prevY) / Math.max(dt, .001) * .015, -.16, .16), dt);
    }
    this.crewTimer -= dt;
    this.away = Math.hypot(this.divers[0].x - player.x, this.divers[0].y - player.y) > 620 ? this.away + dt : 0;
    if (this.crewTimer <= 0) {
      this.crewTimer = rnd(25, 45);
      this.crewCount = 1 + ((this.crewCount + Math.floor(Math.random() * 2)) % 3);
      this.divers.forEach((d, i) => { d.active = i < this.crewCount || d.line.phase !== "ready"; });
    }
    // New encounters enter from outside the view, never by teleporting a visible swimmer.
    if (this.away > 38) {
      this.away = 0;
      this.divers.forEach((d, i) => {
        if (d.line.phase !== "ready") return;
        d.x = d.homeX = clamp(player.x + (player.x < 1900 ? 530 : -530) + i * 30, 25, 3770);
        d.y = d.homeY = clamp(player.y + rnd(-95, 95), 45, 2510);
        d.tx = player.x + rnd(-75, 75); d.ty = player.y + rnd(-65, 65);
        d.state = "swim"; d.timer = 12; d.target = null; d.line.phase = "ready";
      });
    }
    for (const [i, d] of this.divers.entries()) {
      d.presence = ease(d.presence, d.active || d.line.phase !== "ready" ? 1 : 0, dt, .22);
      if (d.presence < .015) continue;
      d.timer -= dt; d.cooldown -= dt;
      d.recoil = Math.max(0, d.recoil - dt * 4);
      const near = Math.hypot(d.x - player.x, d.y - player.y) < 340;
      if (d.timer <= 0 && d.state !== "aim" && d.line.phase === "ready") {
        const roll = Math.random();
        d.state = roll < .18 ? "look" : roll < .35 ? "wave" : roll < .57 ? "dive" : roll < .77 ? "explore" : "swim";
        d.timer = rnd(3, 8) + i * .4;
        d.tx = clamp(d.homeX + rnd(-155, 155), 25, 3775);
        d.ty = clamp(d.homeY + (d.state === "dive" ? rnd(45, 120) : rnd(-65, 60)), 40, 2500);
        if (d.state === "wave" || d.state === "look") { d.tx = d.x + d.dir * 6; d.ty = d.y - 2; }
        if (near && d.active && d.cooldown <= 0 && d.line.phase === "ready" && Math.random() < .62) {
          let best = 145;
          let found: ReefFish | null = null;
          for (const f of fish) {
            if (f.dead || f.caught || f.eatenBy || f.hiddenCave || f.kind !== "npc" || f.r > 16) continue;
            const dist = Math.hypot(f.x - d.x, f.y - d.y);
            if (dist < 24 || dist >= best || !this.clearPath(d, f, solid)) continue;
            best = dist; found = f;
          }
          if (found) {
            d.target = found; d.state = "aim"; d.timer = 1.75; d.tx = d.x; d.ty = d.y;
            d.dir = found.x >= d.x ? 1 : -1;
            if (Math.hypot(player.x - d.x, player.y - d.y) < 120) warn("Penyelam membidik. Jauhi garis kuning!");
          }
        }
      }
      if (d.state === "aim") {
        const f = d.target;
        if (!f || f.dead || f.r>16 || f.caught || f.eatenBy || f.hiddenCave || Math.hypot(f.x - d.x, f.y - d.y) > 195 || !d.active) {
          d.state = "look"; d.timer = 2; d.target = null; d.cooldown = 5;
        } else {
          const lead = Math.min(.35, Math.hypot(f.x - d.x, f.y - d.y) / 270);
          d.aimX = f.x + f.vx * lead; d.aimY = f.y + f.vy * lead; d.dir = f.x > d.x ? 1 : -1;
          if (d.timer <= 0) {
            const { x, y } = lineOrigin(d);
            const axis = crewPose(d).barrel;
            if (this.clearPath(d, f, solid)) {
              Object.assign(d.line, { phase: "flying", x, y, vx: axis.x * 270, vy: -axis.y * 270, time: 0, fish: null });
              const m=d.cached?atlasMuzzle(d):null;if(m){d.line.vx=m.dx*270;d.line.vy=m.dy*270;}
              d.recoil = 1;
            }
            d.state = "explore"; d.timer = 3; d.cooldown = rnd(11, 21); d.target = null;
          }
        }
      }
      const dx = d.tx - d.x, dy = d.ty - d.y, length = Math.max(1, Math.hypot(dx, dy));
      const holding = d.state === "aim" || d.line.phase !== "ready";
      const pace = .7 + .48 * (.5 + .5 * Math.sin(d.kick * .5 - .4));
      const speed = holding ? 0 : Math.min(length * .48, d.state === "dive" ? 19 : 12 + i * 2) * pace;
      d.vx = ease(d.vx, dx / length * speed, dt, 1.3);
      d.vy = ease(d.vy, dy / length * speed + Math.sin(t * .8 + d.phase) * .8, dt, 1.3);
      const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
      if (!solid(nx, ny, 7)) { d.x = nx; d.y = ny; }
      else { d.ty = d.y - 38; d.tx = d.x - d.dir * 22; d.timer = Math.min(d.timer, 1.4); }
      if (!holding && Math.abs(d.vx) > 1.4) d.dir = d.vx > 0 ? 1 : -1;
      const watching = !holding && (d.state === "look" || d.state === "wave");
      const yaw = -d.dir * (1.88 + d.head * .70);
      d.yaw += Math.atan2(Math.sin(yaw - d.yaw), Math.cos(yaw - d.yaw)) * (1 - Math.exp(-dt * (holding ? 5 : 2.5)));
      d.stroke = ease(d.stroke, holding ? .13 : clamp(speed / 13, .18, 1), dt, 2.4);
      d.head = ease(d.head, watching ? 1 : 0, dt);
      d.wave = ease(d.wave, d.state === "wave" ? 1 : 0, dt, 3);
      d.aim = ease(d.aim, d.state === "aim" || d.line.phase !== "ready" ? 1 : 0, dt, 4);
      d.pitch = ease(d.pitch, holding ? clamp(Math.atan2(d.aimY - d.y, Math.abs(d.aimX - d.x)), -.7, .7) : clamp(d.vy * .035, -.6, .7), dt);
      d.depth = ease(d.depth, d.state === "dive" ? .64 : watching ? .98 : .83 + i * .04, dt, .4);
      d.kick += dt * (1.65 + d.stroke * 2.65 + i * .19);
      this.advanceLine(d, dt, fish, solid, hit);
    }
  }

  private clearPath(a: Point, b: Point, solid: Solid) {
    const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5));
    for (let k = 1; k <= count; k++) if (solid(a.x + (b.x - a.x) * k / count, a.y + (b.y - a.y) * k / count, 1)) return false;
    return true;
  }

  // The reference's flight, tether and reel cycle shares one world-space simulation
  // between WebGL and Canvas so contacts always match the visible line.
  private advanceLine(d: DiverPose, dt: number, fish: ReefFish[], solid: Solid, hit: (f: ReefFish) => void) {
    const s = d.line;
    if (s.phase === "ready") return;
    s.time += dt;
    if (s.phase === "flying") {
      const ox = s.x, oy = s.y;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.time > 1 || solid(s.x, s.y, 1)) { s.phase = "reeling"; return; }
      for (const f of fish) {
        if (f.dead || f.caught || f.eatenBy || f.hiddenCave || f.invuln > 0 || f.kind === "bot" || (f.kind !== "player" && f.r > 16)) continue;
        const dx = s.x - ox, dy = s.y - oy;
        const u = clamp(((f.x - ox) * dx + (f.y - oy) * dy) / (dx * dx + dy * dy || 1), 0, 1);
        if (Math.hypot(ox + u * dx - f.x, oy + u * dy - f.y) > f.r * .85 + 1) continue;
        if (f.kind === "player") { hit(f); s.phase = "reeling"; return; }
        s.fish = f; f.caught = true; f.vx = 0; f.vy = 0;
        s.x = f.x; s.y = f.y;
        s.phase = "tethered"; s.time = 0; break;
      }
    } else if (s.phase === "tethered") {
      if (s.fish) { s.fish.tilt = Math.sin(this.time * 14) * .18; s.fish.x = s.x; s.fish.y = s.y; }
      if (s.time > .35) { s.phase = "reeling"; s.time = 0; }
    } else {
      const origin = lineOrigin(d);
      const dx = origin.x - s.x, dy = origin.y - s.y, len = Math.hypot(dx, dy);
      if (len < 2 + dt * 94) {
        if (s.fish) { s.fish.caught = false; if (!s.fish.dead) { s.fish.dead = true; hit(s.fish); } s.fish = null; }
        s.phase = "ready";
      } else {
        const nx = s.x + dx / len * dt * 94, ny = s.y + dy / len * dt * 94;
        if (s.fish && solid(nx, ny, s.fish.r * .6)) { s.fish.caught = false; s.fish = null; }
        s.x = nx; s.y = ny;
        if (s.fish) { s.fish.x = nx; s.fish.y = ny; s.fish.tilt = Math.sin(this.time * 12) * .13; }
      }
    }
  }

  private pickBackdropImg(bgStyle = "game2") {
    if (bgStyle === "shipwreck") return { img: this.shipwreck, custom169: true };
    if (bgStyle === "kelp") return { img: this.kelp, custom169: true };
    if (bgStyle === "temple") return { img: this.temple, custom169: true };
    if (bgStyle === "lagoon") return { img: this.lagoon, custom169: true };
    return { img: this.habitat, custom169: false };
  }

  hasHabitat(top: number, bgStyle = "game2") {
    const { img, custom169 } = this.pickBackdropImg(bgStyle);
    return top < (custom169 ? 1150 : 900) && !!img?.complete && !!img.naturalWidth;
  }

  backdrop(ctx: CanvasRenderingContext2D, cl: number, ct: number, w: number, h: number, alphaMult = 1, bgStyle = "game2") {
    const { img, custom169 } = this.pickBackdropImg(bgStyle);
    const maxCt = custom169 ? 1150 : 970;
    if (!img?.complete || !img.naturalWidth || ct > maxCt) return;
    const width = Math.max(w * 1.14, h * img.naturalWidth / img.naturalHeight * (custom169 ? 1.12 : 1.22));
    const height = width * img.naturalHeight / img.naturalWidth;
    const fade = custom169 ? clamp(1 - (ct - 620) / 560, 0, 1) : clamp(1 - (ct - 480) / 490, 0, 1);
    ctx.save();
    ctx.globalAlpha = fade * alphaMult;
    ctx.drawImage(img, -(width - w) * (.5 + (custom169 ? .35 : .4) * Math.sin(cl * (custom169 ? .0008 : .0009))), -(height - h) * clamp(.25 + ct / (custom169 ? 1150 : 1100), 0, 1), width, height);
    ctx.restore();
  }

  drawLines(c: CanvasRenderingContext2D, cl: number, ct: number) {
    c.save(); c.translate(-cl, -ct);
    for (const d of this.divers) {
      const s = d.line;
      if (d.presence < .25 || (d.state !== "aim" && s.phase === "ready")) continue;
      const aiming = d.state === "aim";
      const x = aiming ? d.aimX : s.x, y = aiming ? d.aimY : s.y;
      c.lineWidth = aiming ? .65 : .5;
      c.strokeStyle = aiming ? `rgba(255,207,92,${.42 + .2 * Math.sin(this.time * 7)})` : "rgba(222,246,229,.72)";
      c.setLineDash(aiming ? [2, 2] : []);
      const origin = lineOrigin(d);
      c.beginPath(); c.moveTo(origin.x, origin.y); c.quadraticCurveTo((origin.x+x)*.5,(origin.y+y)*.5+(aiming?0:Math.min(5,Math.abs(x-origin.x)*.035)),x,y); c.stroke();
      c.setLineDash([]);
      if (aiming) { c.beginPath(); c.arc(x, y, 5.5 + d.timer * 1.5, 0, 6.283); c.stroke(); }
      else if (!s.fish) { const a=Math.atan2(s.vy,s.vx); c.lineWidth=.9; c.beginPath(); c.moveTo(x-Math.cos(a)*7,y-Math.sin(a)*7); c.lineTo(x,y); c.stroke(); }
    }
    c.restore();
  }

  drawFallback(c: CanvasRenderingContext2D, cl: number, ct: number, w: number, h: number) {
    const sub = bakedTexture("submarine");
    const beam=(x:number,y:number,dx:number,dy:number,length:number,width:number,cool=false)=>{
      const len=Math.hypot(dx,dy)*length;if(len<2)return;
      c.save();c.translate(x,y);c.rotate(Math.atan2(dy,dx)+Math.PI);c.globalCompositeOperation="screen";
      c.drawImage(searchlight(cool),-len,-width,len,width*2);c.restore();
    };
    if (sub) for (const [i,s] of this.subs.entries()) {
      const x = s.x - cl, y = s.y - ct;
      if (x < -260 || y < -100 || x > w + 260 || y > h + 100) continue;
      const sc=s.depth*(i?44/48:1),q=new Euler(0,subYaw(-1,0,0),s.pitch,"ZYX");
      for(const side of [-1,1]){const o=subLens(side).applyEuler(q).multiplyScalar(sc*48),n=subLightDirection(side,this.time).applyEuler(q);beam(x-s.dir*o.x,y-o.y,-s.dir*n.x,-n.y,sc*215,sc*34);}
      c.save(); c.translate(x, y); c.scale(-s.dir * sc, sc); c.rotate(-s.pitch);
      const frame = Math.floor(this.time * 14) % 8;
      const sh = sub.height / 2, height = sh / 2;
      c.drawImage(sub, (frame % 4) * 512, Math.floor(frame / 4) * sh, 512, sh, -128, 48 - height, 256, height);
      c.restore();
    }
    for (const [i, d] of this.divers.entries()) {
      const x = d.x - cl, y = d.y - ct;
      if (d.presence < .03 || x < -40 || x > w + 40 || y < -70 || y > h + 70) continue;
      const people=bakedTexture(i?`divers-${i}`:"divers");if(!people)continue;
      const a=atlasPose(d),scale=a.scale,angle=a.pitch;
      c.save(); c.translate(x, y); c.scale(d.dir * scale, scale); c.rotate(angle);
      if(a.art){const o=a.art.lamp,n=a.art.light;beam(o[0],o[1],n[0],n[1],100,15,true);}
      const cw=people.width/12,ch=people.height/6;
      c.drawImage(people,a.frame*cw,a.row*ch,cw,ch,-32,-34,64,62);
      c.restore();
      c.save(); c.strokeStyle = "rgba(190,244,244,.65)"; c.lineWidth = .45;
      for (let j = 0; j < 6; j++) {
        const q = (this.time * .25 + j / 6 + d.phase + i*.07) % 1;
        c.globalAlpha = (1 - q) * d.presence;
        c.beginPath(); c.arc(x + d.dir * 15 * scale + Math.sin(q * 7 + j) * 2, y - 5 - q * 38, .65 + q * 1.2, 0, 6.283); c.stroke();
      }
      c.restore();
    }
  }
}
