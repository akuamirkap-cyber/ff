// ============================================================================
// PENYELAM divers as live hunters in "Dunia Laut 3D".
// Teams of 1-3 divers roam the open water in world space. They swim prone with
// a lazy flutter kick, sometimes stop and wave at the camera, sometimes duck-dive,
// and — like in PENYELAM — they shoulder the harpoon gun with both hands, aim
// (telegraphed with a red laser) and fire a tethered spear. A speared fish is
// dragged back to the diver and dies when it reaches him. The player too!
// ============================================================================
import * as THREE from "three";
import { WORLD_W, FLOOR_TOP } from "../ocean";
import { glowMaterial, plumeMaterial } from "./glsl";
import { paintLit } from "./geometry";
import { coneBeamGeometry, coneBeamMaterial, mergeLit } from "./fx";

export interface DiverTarget {
  x: number;
  y: number;
  r: number;
  dead: boolean;
  kind: string;
  fry?: boolean;
  invuln?: number;
  hiddenCave?: unknown;
  eatenBy?: unknown;
  speared?: boolean;
}

export interface DiverHooks {
  /** a spear tip touched a fish: return true if the fish is now stuck on the spear */
  onHit: (f: DiverTarget, x: number, y: number) => boolean;
  /** the speared fish was reeled all the way back to the diver */
  onKill: (f: DiverTarget, x: number, y: number) => void;
  /** the fish slipped off the spear (e.g. eaten meanwhile) */
  onRelease: (f: DiverTarget) => void;
}

type State = "swim" | "wave" | "dive" | "aim" | "reload";

interface Spear {
  mesh: THREE.Mesh;
  line: THREE.Line;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dist: number;
  phase: "off" | "fly" | "stuck" | "reel";
  t: number;
  fish: DiverTarget | null;
}

interface Diver {
  wrap: THREE.Group;
  root: THREE.Group;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  gunSpear: THREE.Mesh;
  muzzle: THREE.Object3D;
  lamp: THREE.Mesh;
  laser: THREE.Line;
  bub: THREE.ShaderMaterial;
  spear: Spear;
  active: boolean;
  x: number;
  y: number;
  ox: number;
  oy: number;
  dir: number;
  face: number;
  state: State;
  st: number;
  cd: number;
  ph: number;
  diveOff: number;
  aimX: number;
  aimY: number;
  target: DiverTarget | null;
  armRDir: THREE.Vector3;
  armLDir: THREE.Vector3;
  kick: number;
  pitch: number;
}

interface Team {
  x: number;
  y: number;
  dir: number;
  speed: number;
  n: number;
  members: Diver[];
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const DOWN = V(0, -1, 0);
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3();

/** quaternion whose +Y is `head` and whose +Z (the diver's back / tanks) is as close as possible to `back` */
function basisQuat(head: THREE.Vector3, back: THREE.Vector3, out: THREE.Quaternion) {
  const y = tmpV3.copy(head).normalize();
  const z = back.clone().addScaledVector(y, -back.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  tmpM.makeBasis(x, y, z);
  return out.setFromRotationMatrix(tmpM);
}

export interface DiverParts {
  body: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
  eyes: THREE.BufferGeometry | null;
  legL: THREE.BufferGeometry;
  legR: THREE.BufferGeometry;
  armL: THREE.BufferGeometry;
  armR: THREE.BufferGeometry;
  mat: THREE.Material;
  glassMat: THREE.Material;
  lit: THREE.Material;
}

export class DiverSquad {
  group = new THREE.Group();
  private teams: Team[] = [];
  private all: Diver[] = [];
  private disposables: { dispose: () => void }[] = [];
  private t = 0;
  private scale: number;

  constructor(parts: DiverParts, scale: number) {
    this.scale = scale;
    // ---- harpoon gun: stock, barrel, grip, loaded spear (hangs from the right hand, pointing along -y of the arm = forward)
    const gun = mergeLit([
      paintLit(new THREE.BoxGeometry(0.05, 0.3, 0.07).translate(0, -0.5, 0.05), [0.28, 0.2, 0.12], 0, 0.2, 0.6), // wooden stock
      paintLit(new THREE.CylinderGeometry(0.03, 0.034, 0.7, 8).translate(0, -0.78, 0.04), [0.14, 0.14, 0.16], 0, 0.7, 0.6), // barrel
      paintLit(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 8).translate(0, -1.1, 0.04), [0.55, 0.42, 0.2], 0, 0.9, 0.7), // brass muzzle ring
      paintLit(new THREE.BoxGeometry(0.04, 0.1, 0.05).translate(0, -0.42, 0.09), [0.2, 0.17, 0.14], 0, 0.3, 0.5), // grip
      paintLit(new THREE.TorusGeometry(0.03, 0.008, 6, 10).rotateY(Math.PI / 2).translate(0, -0.47, 0.11), [0.5, 0.4, 0.2], 0, 0.9, 0.7), // trigger guard
    ]);
    const loaded = mergeLit([
      paintLit(new THREE.CylinderGeometry(0.011, 0.011, 0.5, 5).translate(0, -1.0, 0.04), [0.78, 0.78, 0.84], 0.1, 0.9, 0.9),
      paintLit(new THREE.ConeGeometry(0.028, 0.1, 6).rotateX(Math.PI).translate(0, -1.28, 0.04), [0.9, 0.9, 0.95], 0.2, 0.9, 0.9),
    ]);
    const flyG = paintLit(
      mergeLit([new THREE.CylinderGeometry(0.06, 0.06, 1, 5), new THREE.ConeGeometry(0.18, 0.26, 6).translate(0, 0.6, 0)].map((g) => paintLit(g, [0.86, 0.86, 0.92], 0.15, 0.9, 0.9))),
      [0.86, 0.86, 0.92],
      0.15,
      0.9,
      0.9,
    );
    this.disposables.push(gun, loaded, flyG);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xd8e4ea, transparent: true, opacity: 0.6 });
    const laserMat = new THREE.LineBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.0 });
    this.disposables.push(lineMat, laserMat);
    // helmet lamp cone (model space: lamp sits on the brow at (0, 1.12, -0.1); shines forward-down of the face)
    const lampGeo = coneBeamGeometry(4.2, 0.05, 1.05);
    const lampMat = coneBeamMaterial([1.0, 0.93, 0.74], 0.5);
    const lampDir = V(0, 0.62, -0.78).normalize();
    this.disposables.push(lampGeo, lampMat);

    for (let i = 0; i < 6; i++) {
      const wrap = new THREE.Group();
      const root = new THREE.Group();
      root.scale.setScalar(scale);
      const bodyG = new THREE.Group();
      bodyG.position.y = -0.55;
      root.add(bodyG);
      bodyG.add(new THREE.Mesh(parts.body, parts.mat));
      if (parts.eyes) bodyG.add(new THREE.Mesh(parts.eyes, parts.lit));
      const glass = new THREE.Mesh(parts.glass, parts.glassMat);
      glass.renderOrder = 28;
      bodyG.add(glass);
      const legL = new THREE.Mesh(parts.legL, parts.mat);
      legL.position.set(-0.072, 0.295, 0);
      const legR = new THREE.Mesh(parts.legR, parts.mat);
      legR.position.set(0.072, 0.295, 0);
      const armL = new THREE.Mesh(parts.armL, parts.mat);
      armL.position.set(-0.155, 0.54, 0);
      const armR = new THREE.Mesh(parts.armR, parts.mat);
      armR.position.set(0.155, 0.54, 0);
      armR.add(new THREE.Mesh(gun, parts.lit));
      const gunSpear = new THREE.Mesh(loaded, parts.lit);
      armR.add(gunSpear);
      const muzzle = new THREE.Object3D();
      muzzle.position.set(0, -1.14, 0.04);
      armR.add(muzzle);
      bodyG.add(legL, legR, armL, armR);
      // lamp
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(0, 1.12, -0.1);
      lamp.quaternion.setFromUnitVectors(DOWN, lampDir);
      lamp.renderOrder = 30;
      bodyG.add(lamp);
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), glowMaterial([1.0, 0.9, 0.7], 0.9, "radial"));
      lens.position.set(0, 1.12, -0.12);
      lens.renderOrder = 30;
      bodyG.add(lens);
      wrap.add(root);
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(scale * 2.2, scale * 2.2), glowMaterial([1.0, 0.8, 0.45], 0.1, "radial"));
      halo.renderOrder = 29;
      halo.position.z = -6;
      wrap.add(halo);
      const N = 20;
      const pg = new THREE.BufferGeometry();
      pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      pg.setAttribute("aSeed", new THREE.BufferAttribute(Float32Array.from({ length: N }, (_, k) => k / N), 1));
      const pm = plumeMaterial({ color: [0.82, 0.95, 1.0], additive: false, size: 5.5, rise: 80, spread: 6, alpha: 0.95, speed: 0.3, bubble: true });
      const pts = new THREE.Points(pg, pm);
      pts.frustumCulled = false;
      pts.renderOrder = 31;
      wrap.add(pts);
      this.group.add(wrap);
      // spear + tether + laser (world space)
      const sm = new THREE.Mesh(flyG, parts.lit);
      sm.scale.set(10, 26, 10);
      sm.visible = false;
      sm.renderOrder = 32;
      const lg = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, 0, 0)]);
      const line = new THREE.Line(lg, lineMat);
      line.frustumCulled = false;
      line.visible = false;
      const zg = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, 0, 0)]);
      const laser = new THREE.Line(zg, laserMat.clone());
      laser.frustumCulled = false;
      laser.visible = false;
      this.group.add(sm, line, laser);
      this.disposables.push(halo.geometry, halo.material as THREE.Material, lens.geometry, lens.material as THREE.Material, pg, pm, lg, zg, laser.material as THREE.Material);
      const d: Diver = {
        wrap,
        root,
        legL,
        legR,
        armL,
        armR,
        gunSpear,
        muzzle,
        lamp,
        laser,
        bub: pm,
        spear: { mesh: sm, line, x: 0, y: 0, vx: 0, vy: 0, dist: 0, phase: "off", t: 0, fish: null },
        active: false,
        x: 0,
        y: 0,
        ox: 0,
        oy: 0,
        dir: 1,
        face: 1,
        state: "swim",
        st: 1 + Math.random() * 3,
        cd: 3 + Math.random() * 4,
        ph: Math.random() * 100,
        diveOff: 0,
        aimX: 0,
        aimY: 0,
        target: null,
        armRDir: V(1, 0, 0),
        armLDir: V(-1, 0, 0),
        kick: Math.random() * 6,
        pitch: 0,
      };
      wrap.visible = false;
      this.all.push(d);
    }
    for (let k = 0; k < 2; k++) {
      const team: Team = { x: 0, y: 0, dir: 1, speed: 24, n: 1, members: this.all.slice(k * 3, k * 3 + 3) };
      this.teams.push(team);
      this.spawnTeam(team, true);
    }
  }

  private spawnTeam(team: Team, initial = false) {
    const r = Math.random();
    team.n = r < 0.33 ? 1 : r < 0.72 ? 2 : 3;
    team.dir = Math.random() < 0.5 ? 1 : -1;
    team.speed = 18 + Math.random() * 12;
    team.y = 170 + Math.random() * (FLOOR_TOP - 420);
    team.x = initial ? 300 + Math.random() * (WORLD_W - 600) : team.dir > 0 ? -120 : WORLD_W + 120;
    team.members.forEach((d, k) => {
      if (d.spear.fish) this.release(d, null);
      d.active = k < team.n;
      d.wrap.visible = false;
      d.ox = -team.dir * k * (52 + Math.random() * 20);
      d.oy = k === 0 ? 0 : (k % 2 ? -1 : 1) * (24 + Math.random() * 20);
      d.x = team.x + d.ox;
      d.y = team.y + d.oy;
      d.dir = team.dir;
      d.face = team.dir;
      d.state = "swim";
      d.st = 1 + Math.random() * 3;
      d.cd = 2.5 + Math.random() * 4;
      d.diveOff = 0;
      this.hideSpear(d);
    });
  }

  private hideSpear(d: Diver) {
    d.spear.phase = "off";
    d.spear.fish = null;
    d.spear.mesh.visible = false;
    d.spear.line.visible = false;
    d.laser.visible = false;
    d.gunSpear.visible = true;
  }

  private release(d: Diver, hooks: DiverHooks | null) {
    const f = d.spear.fish;
    d.spear.fish = null;
    if (f) {
      f.speared = false;
      hooks?.onRelease(f);
    }
  }

  /** gameplay + animation step. `fish` are the 2D game fish (world coords). */
  step(dt: number, fish: DiverTarget[], player: DiverTarget | null, hooks: DiverHooks, view: { l: number; t: number; w: number; h: number }) {
    this.t += dt;
    const T = this.t;
    for (const team of this.teams) {
      team.x += team.dir * team.speed * dt;
      team.y += Math.sin(T * 0.13 + team.dir) * 6 * dt;
      if (team.x < -260 || team.x > WORLD_W + 260) this.spawnTeam(team);
      for (const d of team.members) {
        if (!d.active) continue;
        this.stepDiver(d, team, dt, fish, player, hooks);
        d.wrap.visible = d.x > view.l - 120 && d.x < view.l + view.w + 120 && d.y > view.t - 120 && d.y < view.t + view.h + 120;
      }
    }
  }

  /** hunters go for small and medium fish – big ones are left alone */
  private pickTarget(d: Diver, fish: DiverTarget[], player: DiverTarget | null): DiverTarget | null {
    const ok = (f: DiverTarget) => !f.dead && !f.eatenBy && !f.hiddenCave && !f.speared && !(f.invuln && f.invuln > 0) && f.r >= 5 && f.r <= 46;
    if (player && ok(player) && Math.hypot(player.x - d.x, player.y - d.y) < 300 && Math.random() < 0.6) return player;
    let best: DiverTarget | null = null,
      bd = 250;
    for (const f of fish) {
      if (f === player || f.fry || !ok(f)) continue;
      const dd = Math.hypot(f.x - d.x, f.y - d.y);
      if (dd < bd) {
        bd = dd;
        best = f;
      }
    }
    return best;
  }

  private stepDiver(d: Diver, team: Team, dt: number, fish: DiverTarget[], player: DiverTarget | null, hooks: DiverHooks) {
    const T = this.t + d.ph;
    d.st -= dt;
    d.cd -= dt;
    // ----- state machine
    if (d.state === "swim" && d.cd <= 0) {
      const tg = this.pickTarget(d, fish, player);
      if (tg) {
        d.target = tg;
        d.aimX = d.x + d.face * 60;
        d.aimY = d.y;
        d.state = "aim";
        d.st = tg === player ? 1.35 : 1.0;
      } else d.cd = 0.6;
    }
    if (d.state !== "aim" && d.state !== "reload" && d.st <= 0) {
      const r = Math.random();
      if (d.state === "swim") {
        if (r < 0.28) {
          d.state = "wave";
          d.st = 2.4 + Math.random() * 1.6;
        } else if (r < 0.55) {
          d.state = "dive";
          d.st = 3.6;
        } else d.st = 2.5 + Math.random() * 3.5;
      } else {
        d.state = "swim";
        d.st = 2.5 + Math.random() * 3;
      }
    }
    if (d.state === "aim") {
      const tg = d.target;
      if (!tg || tg.dead || tg.hiddenCave || tg.speared || tg.eatenBy || Math.hypot(tg.x - d.x, tg.y - d.y) > 420) {
        d.state = "swim";
        d.st = 1.5;
        d.cd = 1.5;
        d.laser.visible = false;
      } else {
        // the aim lags behind the target (gives a chance to dodge)
        const k = Math.min(1, dt * 3.4);
        d.aimX += (tg.x - d.aimX) * k;
        d.aimY += (tg.y - d.aimY) * k;
        d.face = d.aimX >= d.x ? 1 : -1;
        if (d.st <= 0) this.fire(d);
      }
    }
    if (d.state === "reload" && d.spear.phase === "off") {
      d.state = "swim";
      d.st = 1.5 + Math.random() * 2;
      d.cd = 3.5 + Math.random() * 4;
    }

    // ----- movement (spring to the formation slot)
    const halt = d.state === "wave" || d.state === "aim" || d.spear.phase === "reel" || d.spear.phase === "stuck";
    if (d.state === "dive") {
      const u = 1 - Math.max(0, d.st) / 3.6;
      d.diveOff = Math.sin(Math.min(1, u) * Math.PI) * 90;
    } else d.diveOff += (0 - d.diveOff) * Math.min(1, dt * 0.8);
    const tx = team.x + d.ox + Math.sin(T * 0.31) * 14;
    const ty = team.y + d.oy + Math.sin(T * 0.53) * 9 + d.diveOff;
    const kx = halt ? 0.12 : 1.4;
    const px = d.x;
    d.x += (tx - d.x) * Math.min(1, dt * kx);
    d.y += (Math.min(FLOOR_TOP - 40, ty) - d.y) * Math.min(1, dt * 1.6);
    const vx = (d.x - px) / Math.max(1e-3, dt);
    if (d.state === "swim" || d.state === "dive") d.face = team.dir;
    d.dir += (d.face - d.dir) * Math.min(1, dt * 2.5);
    const sd = d.dir >= 0 ? 1 : -1;

    // ----- pose: head = model +Y, back (tanks) = model +Z, face = model -Z
    const head = tmpV,
      back = tmpV2;
    let kickAmp = 0.42,
      kickSpd = 3.0;
    const aDir = V(d.aimX - d.x, -(d.aimY - d.y), 0).normalize();
    const speedK = Math.min(1, Math.abs(vx) / 30);
    switch (d.state) {
      case "wave": {
        // upright, chest to the camera, right hand waving above the head
        head.set(0.06 * Math.sin(T * 0.8), 1, 0.05);
        back.set(0, 0.08, -1);
        kickAmp = 0.2;
        kickSpd = 1.7;
        const w = Math.sin(T * 6.5);
        d.armRDir.lerp(V(0.75 + 0.35 * w, 0.72, -0.15), Math.min(1, dt * 9));
        d.armLDir.lerp(V(-0.35, -0.9, -0.1), Math.min(1, dt * 5));
        break;
      }
      case "dive": {
        // duck-dive: pike forward and down, then level out again
        const u = 1 - Math.max(0, d.st) / 3.6;
        const down = u < 0.45 ? Math.sin((u / 0.45) * Math.PI * 0.5) : Math.cos(((u - 0.45) / 0.55) * Math.PI * 0.5) * 1.2 - 0.2;
        head.set(sd * (1 - Math.abs(down) * 0.75), -down, 0).normalize();
        back.set(-sd * Math.max(0, down) * 0.3, 1, -0.25);
        kickAmp = 0.7;
        kickSpd = 4.6;
        d.armRDir.lerp(head.clone().add(V(sd * 0.1, 0, 0)), Math.min(1, dt * 4));
        d.armLDir.lerp(head.clone().add(V(-sd * 0.1, 0, 0)), Math.min(1, dt * 4));
        break;
      }
      case "aim":
      case "reload": {
        // shoulder the gun: body turned three-quarters toward the target, both hands on the stock
        const toward = d.state === "aim" ? aDir : V(sd, 0, 0);
        head.set(toward.x * 0.6, 0.8 + toward.y * 0.3, -0.15).normalize();
        back.set(-toward.x * 0.5, 0.35, -0.8);
        kickAmp = 0.22;
        kickSpd = 2.0;
        d.armRDir.lerp(toward.clone().add(V(0, -0.06, -0.08)).normalize(), Math.min(1, dt * 9));
        d.armLDir.lerp(toward.clone().add(V(0, -0.22, -0.1)).normalize(), Math.min(1, dt * 7));
        break;
      }
      default: {
        // prone cruise: slight undulation, head lifted a little, arms trailing along the body
        const und = Math.sin(d.kick * 0.5) * 0.06;
        head.set(sd, 0.1 + und + 0.08 * (1 - speedK), 0).normalize();
        back.set(0, 1, -0.22);
        kickAmp = 0.3 + 0.25 * speedK;
        kickSpd = 2.4 + 1.2 * speedK;
        d.armRDir.lerp(V(sd * 0.9, -0.25, 0.25), Math.min(1, dt * 3));
        d.armLDir.lerp(V(-sd * 0.9, -0.3, 0.2), Math.min(1, dt * 3));
      }
    }
    basisQuat(head, back, tmpQ);
    d.root.quaternion.slerp(tmpQ, Math.min(1, dt * 3));
    d.kick += dt * kickSpd;
    // flutter kick: alternate legs with a soft knee lag; fins follow with delay
    const k1 = Math.sin(d.kick),
      k2 = Math.sin(d.kick - 0.5);
    d.legL.rotation.x = k1 * kickAmp;
    d.legR.rotation.x = -k2 * kickAmp;
    const inv = d.root.quaternion.clone().invert();
    d.armR.quaternion.setFromUnitVectors(DOWN, d.armRDir.clone().normalize().applyQuaternion(inv));
    d.armL.quaternion.setFromUnitVectors(DOWN, d.armLDir.clone().normalize().applyQuaternion(inv));
    if (d.state === "swim") {
      d.armL.rotateX(Math.sin(d.kick * 0.5) * 0.1);
      d.armR.rotateX(Math.sin(d.kick * 0.5 + 1) * 0.08);
    }

    const bob = Math.sin(T * 0.9) * 2.5;
    d.wrap.position.set(d.x, -(d.y + bob), 0);
    d.wrap.updateMatrixWorld(true);

    // bubbles from the regulator, above the head
    const o = d.bub.uniforms.uOrigin.value as THREE.Vector3;
    const hw = V(0, 0.5, 0).applyQuaternion(d.root.quaternion).multiplyScalar(this.scale);
    o.set(hw.x, hw.y + 2, 0);
    d.bub.uniforms.uDir.value = sd;

    // laser telegraph
    if (d.state === "aim") {
      const m = this.muzzleWorld(d);
      const L = d.laser;
      const pos = L.geometry.getAttribute("position") as THREE.BufferAttribute;
      const dx = d.aimX - m.x,
        dy = d.aimY - m.y;
      const len = Math.hypot(dx, dy) || 1;
      pos.setXYZ(0, m.x, -m.y, 2);
      pos.setXYZ(1, m.x + (dx / len) * 440, -(m.y + (dy / len) * 440), 2);
      pos.needsUpdate = true;
      L.visible = true;
      const blink = d.st < 0.45 ? (Math.sin(this.t * 40) > 0 ? 0.9 : 0.25) : 0.45;
      (L.material as THREE.LineBasicMaterial).opacity = blink;
    } else d.laser.visible = false;

    this.stepSpear(d, dt, fish, hooks);
  }

  private muzzleWorld(d: Diver) {
    d.muzzle.getWorldPosition(tmpV);
    const p = tmpV.clone();
    p.sub(this.group.getWorldPosition(new THREE.Vector3()));
    return { x: p.x, y: -p.y };
  }

  private fire(d: Diver) {
    const m = this.muzzleWorld(d);
    const dx = d.aimX - m.x,
      dy = d.aimY - m.y;
    const len = Math.hypot(dx, dy) || 1;
    const s = d.spear;
    s.x = m.x;
    s.y = m.y;
    s.vx = (dx / len) * 560;
    s.vy = (dy / len) * 560;
    s.dist = 0;
    s.phase = "fly";
    s.t = 0;
    s.fish = null;
    d.gunSpear.visible = false;
    d.state = "reload";
    d.laser.visible = false;
    d.target = null;
    // recoil
    d.armRDir.add(V(-dx / len, dy / len, 0).multiplyScalar(0.3)).normalize();
  }

  private stepSpear(d: Diver, dt: number, fish: DiverTarget[], hooks: DiverHooks) {
    const s = d.spear;
    if (s.phase === "off") return;
    s.t += dt;
    const m = this.muzzleWorld(d);
    if (s.phase === "fly") {
      const px = s.x,
        py = s.y;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 40 * dt; // slight drop
      s.dist += Math.hypot(s.vx, s.vy) * dt;
      for (const f of fish) {
        if (f.dead || f.eatenBy || f.hiddenCave || f.speared) continue;
        const ex = s.x - px,
          ey = s.y - py;
        const l2 = ex * ex + ey * ey || 1;
        let u = ((f.x - px) * ex + (f.y - py) * ey) / l2;
        u = Math.max(0, Math.min(1, u));
        const cx = px + ex * u,
          cy = py + ey * u;
        if (Math.hypot(f.x - cx, f.y - cy) < f.r * 0.8 + 2) {
          const stuck = hooks.onHit(f, cx, cy);
          if (stuck) {
            s.fish = f;
            f.speared = true;
            s.x = cx;
            s.y = cy;
          }
          s.phase = stuck ? "stuck" : "reel";
          s.t = 0;
          break;
        }
      }
      if (s.phase === "fly" && (s.dist > 480 || s.y > FLOOR_TOP + 60 || s.y < 0)) {
        s.phase = "reel";
        s.t = 0;
      }
    } else if (s.phase === "stuck") {
      // the fish thrashes on the line for a moment, then the diver starts reeling
      const f = s.fish;
      if (f && !f.dead && !f.eatenBy) {
        f.x = s.x + Math.sin(s.t * 28) * 2;
        f.y = s.y + Math.cos(s.t * 23) * 2;
      } else if (f) this.release(d, hooks);
      if (s.t > 0.5) s.phase = "reel";
    } else if (s.phase === "reel") {
      const dx = m.x - s.x,
        dy = m.y - s.y;
      const dd = Math.hypot(dx, dy);
      const f = s.fish;
      const sp = (f ? 150 + 40 * Math.sin(s.t * 6) : 420) * dt;
      if (f && (f.dead || f.eatenBy)) this.release(d, hooks);
      if (dd <= sp + 6) {
        const ff = s.fish;
        if (ff) {
          s.fish = null;
          ff.speared = false;
          hooks.onKill(ff, s.x, s.y);
        }
        this.hideSpear(d);
        return;
      }
      s.x += (dx / dd) * sp;
      s.y += (dy / dd) * sp;
      if (s.fish) {
        // struggling fish is dragged along the line
        s.fish.x = s.x + Math.sin(s.t * 20) * 3;
        s.fish.y = s.y + Math.cos(s.t * 17) * 3;
      }
    }
    // render
    const ang = s.phase === "reel" ? Math.atan2(-(s.y - m.y), s.x - m.x) : Math.atan2(-s.vy, s.vx);
    s.mesh.visible = true;
    s.mesh.position.set(s.x, -s.y, 3);
    s.mesh.rotation.set(0, 0, ang - Math.PI / 2);
    const pos = s.line.geometry.getAttribute("position") as THREE.BufferAttribute;
    pos.setXYZ(0, m.x, -m.y, 2);
    pos.setXYZ(1, s.x - Math.cos(ang) * 12, -s.y - Math.sin(ang) * 12, 2);
    pos.needsUpdate = true;
    s.line.visible = true;
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}
