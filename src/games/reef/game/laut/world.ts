// ============================================================================
// MODE "DUNIA LAUT 3D"
// A live three.js scene (orthographic, side-on) that replaces the painted water,
// reef, rocks and sea-floor of the 2D arcade layer. The game logic, collisions and
// fish are untouched: every rock is extruded from the very same signed-distance
// fields the physics uses, so silhouettes line up pixel-for-pixel.
//
// Corals, kelp, boulders, the diver and the Jules-Verne submarine are generated
// by the PENYELAM (Abyssal Garden) procedural mesh builders.
// ============================================================================
import * as THREE from "three";
import type { ReefResidents } from "../residents";
import type { Medusa } from "../medusae";
import { createExpeditionRigs } from "./expeditionRigs";
import { MedusaRenderer } from "./jellyMeshes";
import { ReefLifeRenderer } from "../reefInhabitants";
import type { Ocean, Formation } from "../ocean";
import { WORLD_W, WORLD_H } from "../ocean";
import {
  SHARED,
  backdropMaterial,
  raysMaterial,
  litMaterial,
  glowMaterial,
  plumeMaterial,
} from "./glsl";
import {
  mulberry32,
  paintLit,
} from "./geometry";
import { ReefGarden } from "./reefEcology";

type RGB = [number, number, number];

export class LautWorld {
  private static sup: boolean | null = null;
  static supported() {
    if (LautWorld.sup === null) {
      try {
        const c = document.createElement("canvas");
        const gl = c.getContext("webgl2");
        LautWorld.sup = !!gl;
        (gl?.getExtension("WEBGL_lose_context") as { loseContext?: () => void } | null)?.loseContext?.();
      } catch {
        LautWorld.sup = false;
      }
    }
    return LautWorld.sup;
  }

  ready = false;
  failed = false;
  progress = 0;

  private oc: Ocean;
  private gen: Generator<void, void, void>;
  private renderer!: THREE.WebGLRenderer;
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1800);
  private scenes: THREE.Scene[] = [new THREE.Scene(), new THREE.Scene(), new THREE.Scene(), new THREE.Scene()];
  private w = 0;
  private h = 0;

  private disposables: { dispose: () => void }[] = [];

  private garden!: ReefGarden;
  readonly floorTiles: THREE.Group[] = [];
  private caveForms: Formation[] = [];
  private vents: { g: THREE.Group; x: number; mats: THREE.ShaderMaterial[]; pts: THREE.Points }[] = [];
  private expedition!: ReturnType<typeof createExpeditionRigs>;
  private jellyScene!: MedusaRenderer;
  private reefLife!: ReefLifeRenderer;
  get subs() { return this.expedition.subs; }
  get divers() { return this.expedition.divers; }
  private raysNear!: THREE.Mesh;
  private visible = [true, true, false, false];

  constructor(oc: Ocean, bgStyle: "game1" | "game2" | "reef_g1" | "shipwreck" | "kelp" | "temple" | "lagoon" = "game2") {
    this.oc = oc;
    this.setBgStyle(bgStyle);
    this.gen = this.build();
  }

  setBgStyle(style: "game1" | "game2" | "reef_g1" | "shipwreck" | "kelp" | "temple" | "lagoon") {
    SHARED.uBgStyle.value =
      style === "game1" ? 0 : style === "shipwreck" ? 2 : style === "kelp" ? 3 : style === "temple" ? 4 : style === "lagoon" ? 5 : 1;
    SHARED.uWaterStyle.value = style === "game2" || style === "kelp" ? 1 : 0;
  }

  // ------------------------------------------------------------------ incremental construction
  step(ms: number): boolean {
    if (this.ready || this.failed) return true;
    const t0 = performance.now();
    try {
      do {
        const r = this.gen.next();
        if (r.done) {
          this.ready = true;
          this.progress = 1;
          return true;
        }
      } while (performance.now() - t0 < ms);
    } catch (e) {
      console.error("[Dunia Laut] build failed", e);
      this.failed = true;
      this.dispose();
      return true;
    }
    return false;
  }

  private *build(): Generator<void, void, void> {
    this.initRenderer();
    yield;
    this.makeKinds();
    this.progress = 0.05;
    yield;
    this.makeBackdrop();
    this.progress = 0.2;
    const fs = this.oc.formations;
    for (let i = 0; i < fs.length; i++) {
      this.buildFormation(fs[i]);
      this.progress = 0.2 + (0.5 * (i + 1)) / fs.length;
      yield;
    }
    this.buildFloor();
    this.progress = 0.78;
    yield;
    this.buildEntities();
    this.progress = 0.88;
    yield;
    // compile every program up-front so the first frames do not hitch
    this.cam.position.set(1900, -520, 600);
    for (let i = 0; i < 4; i++) {
      this.renderer.compile(this.scenes[i], this.cam);
      this.progress = 0.88 + 0.03 * (i + 1);
      yield;
    }
  }

  private initRenderer() {
    const canvas = document.createElement("canvas");
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(1);
    this.cam.position.set(0, 0, 600);
    this.cam.lookAt(0, 0, 0);
    for (const s of this.scenes) s.matrixWorldAutoUpdate = true;
  }

  // ------------------------------------------------------------------ shared geometries
  private makeKinds() {
    this.garden = new ReefGarden();
    this.disposables.push(this.garden);
  }

  // ------------------------------------------------------------------ backdrop & light
  private makeBackdrop() {
    const quad = new THREE.PlaneGeometry(2, 2);
    const bd = new THREE.Mesh(quad, backdropMaterial());
    bd.frustumCulled = false;
    bd.renderOrder = -100;
    this.scenes[0].add(bd);
    this.disposables.push(quad, bd.material);

    const mk = (par: number, strength: number, sharp: number, speed: number, off: number, additive: boolean, order: number, scene: THREE.Scene) => {
      const m = new THREE.Mesh(quad, raysMaterial({ par, strength, sharp, speed, off, additive }));
      m.frustumCulled = false;
      m.renderOrder = order;
      scene.add(m);
      this.disposables.push(m.material);
      return m;
    };
    mk(0.3, 0.24, 0.2, 0.55, 300, true, -90, this.scenes[0]);
    mk(0.62, 0.19, 0.7, 0.8, 1700, true, 6, this.scenes[0]);
    this.raysNear = mk(1.14, 0.16, 1.3, 1.0, 900, false, 6, this.scenes[3]);
  }

  // ------------------------------------------------------------------ main plane: pinnacles
  private buildFormation(f: Formation) {
    const reef = this.garden.formation(f);
    this.scenes[1].add(reef.root);
    if(f.cave){
      const rim=new THREE.Mesh(reef.geometry,this.garden.caveMats[f.zone]);
      rim.renderOrder=12; this.scenes[2].add(rim); this.caveForms.push(f);
    }
  }

  // ------------------------------------------------------------------ sea floor, vents, treasure
  private buildFloor() {
    const rng=mulberry32(4242);
    const ventsXY=this.oc.vents.map(v=>({x:v.x-2,y:v.y+40}));
    const chest=this.oc.chestPos;
    const clear=(x:number)=>Math.abs(x-chest.x)>45 && !ventsXY.some(v=>Math.abs(v.x-x)<40);
    for(let i=0;i<8;i++){
      const tile=this.garden.seabed(i*WORLD_W/8,(i+1)*WORLD_W/8,i,clear);
      this.floorTiles.push(tile);this.scenes[1].add(tile);
    }

    // black smokers
    const lit = litMaterial({ fog: 0 });
    this.disposables.push(lit);
    ventsXY.forEach((v, i) => {
      const g = new THREE.Group();
      const prof: THREE.Vector2[] = [
        new THREE.Vector2(19, -4),
        new THREE.Vector2(16, 6),
        new THREE.Vector2(11.5, 20),
        new THREE.Vector2(9, 34),
        new THREE.Vector2(8.5, 46),
        new THREE.Vector2(10.5, 49),
        new THREE.Vector2(7, 48),
      ];
      const chimney = paintLit(new THREE.LatheGeometry(prof, 14), [0.075, 0.07, 0.1], 0, 0.1, 0.9);
      chimney.computeVertexNormals();
      const cm = new THREE.Mesh(chimney, lit);
      g.add(cm);
      const rimG = paintLit(new THREE.TorusGeometry(8.4, 1.6, 6, 16).rotateX(Math.PI / 2), [1.0, 0.45, 0.15], 1.1, 0, 1);
      const rim = new THREE.Mesh(rimG, lit);
      rim.position.y = 49;
      g.add(rim);
      g.position.set(v.x, -v.y, 14 + (i % 2) * 3);
      g.rotation.z = (rng() - 0.5) * 0.08;
      this.scenes[1].add(g);
      this.disposables.push(chimney, rimG);

      // glow + smoke plume
      const gm = glowMaterial([1.0, 0.5, 0.18], 0.75, "radial");
      const gq = new THREE.Mesh(new THREE.PlaneGeometry(74, 56), gm);
      gq.position.set(v.x, -v.y + 52, 24);
      gq.renderOrder = 40;
      this.scenes[1].add(gq);
      const N = 26;
      const pg = new THREE.BufferGeometry();
      pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      pg.setAttribute("aSeed", new THREE.BufferAttribute(Float32Array.from({ length: N }, (_, k) => (k + rng() * 0.8) / N), 1));
      const pm = plumeMaterial({ color: [0.2, 0.24, 0.33], additive: false, size: 15, rise: 120, spread: 12, alpha: 0.7, speed: 0.12 });
      (pm.uniforms.uOrigin.value as THREE.Vector3).set(v.x, -v.y + 50, 30);
      const pts = new THREE.Points(pg, pm);
      pts.frustumCulled = false;
      pts.renderOrder = 41;
      this.scenes[1].add(pts);
      this.vents.push({ g, x: v.x, mats: [gm, pm], pts });
      this.disposables.push(gm, pm, pg);
    });

    // treasure chest
    const cg = new THREE.Group();
    const wood: RGB = [0.34, 0.18, 0.08],
      iron: RGB = [0.13, 0.11, 0.1],
      gold: RGB = [1.0, 0.78, 0.22];
    const part = (geo: THREE.BufferGeometry, rgb: RGB, emi: number, met: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(paintLit(geo, rgb, emi, met, 0.95), lit);
      m.position.set(x, y, z);
      cg.add(m);
      this.disposables.push(geo);
      return m;
    };
    part(new THREE.BoxGeometry(32, 15, 20), wood, 0, 0.05, 0, 7.5, 0);
    const lid = new THREE.CylinderGeometry(10, 10, 32, 16, 1, false, 0, Math.PI);
    lid.rotateZ(Math.PI / 2);
    lid.rotateY(-Math.PI / 2);
    lid.rotateX(Math.PI / 2 * 0);
    part(lid, [0.4, 0.22, 0.1], 0, 0.05, 0, 15, 0);
    for (const bx of [-11, 11]) {
      part(new THREE.BoxGeometry(3.2, 16, 21), iron, 0, 0.5, bx, 7.5, 0);
      part(new THREE.BoxGeometry(3.4, 5, 21), iron, 0, 0.5, bx, 18.5, 0);
    }
    part(new THREE.BoxGeometry(6, 7, 2), gold, 0.35, 0.9, 0, 12, 10.8);
    cg.position.set(chest.x, -(chest.y + 14), 16);
    this.scenes[1].add(cg);
    const cgm = glowMaterial([1.0, 0.82, 0.3], 0.5, "radial");
    const cq = new THREE.Mesh(new THREE.PlaneGeometry(96, 80), cgm);
    cq.position.set(chest.x, -(chest.y + 4), 24);
    cq.renderOrder = 40;
    this.scenes[1].add(cq);
    this.disposables.push(cgm);
  }

  // ------------------------------------------------------------------ PENYELAM residents: articulated submarine and expedition crew
  private buildEntities() {
    this.expedition = createExpeditionRigs();
    this.scenes[0].add(this.expedition.sea);
    this.jellyScene = new MedusaRenderer(this.scenes[0], this.scenes[1]);
    this.reefLife = new ReefLifeRenderer(this.scenes[1].children.flatMap((o) => o.userData.fauna || []));
    this.scenes[1].add(this.reefLife.group);
    this.disposables.push(this.expedition, this.jellyScene, this.reefLife);
  }

  // ------------------------------------------------------------------ per-frame
  update(canvas: HTMLCanvasElement, camLeft: number, camTop: number, vw: number, vh: number, t: number, life: ReefResidents, animals: Medusa[]) {
    if (!this.ready) return;
    const w = canvas.width,
      h = canvas.height;
    if (w !== this.w || h !== this.h) {
      this.renderer.setSize(w, h, false);
      this.w = w;
      this.h = h;
    }
    const cx = camLeft + vw / 2,
      cy = camTop + vh / 2;
    SHARED.uTime.value = t;
    SHARED.uReefView.value.set(.055,-.17);
    SHARED.uCamC.value.set(cx, cy);
    SHARED.uView.value.set(vw, vh);
    SHARED.uCamTL.value.set(camLeft, camTop);
    SHARED.uPx.value = h / vh;
    const cam = this.cam;
    cam.left = -vw / 2;
    cam.right = vw / 2;
    cam.top = vh / 2;
    cam.bottom = -vh / 2;
    cam.position.set(cx, -cy, 600);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    this.raysNear.visible = camTop < 1150;

    this.expedition.update(life, t, cx, cy, vw, vh);
    this.jellyScene.update(animals, cx, cy, vw, vh);
    this.reefLife.update(t,cx,cy,vw,vh);

    // black smokers: only animate what is near the view
    for (const v of this.vents) {
      const on = Math.abs(v.x - cx) < vw / 2 + 120 && camTop + vh > WORLD_H - 420;
      v.g.visible = on;
      v.pts.visible = on;
      v.mats[0].visible = on;
    }

    // visibility of the cave-lip pass
    let lips = false;
    for (const f of this.caveForms) {
      if (f.x + f.w > camLeft - 30 && f.x < camLeft + vw + 30 && f.y + f.h > camTop - 30 && f.y < camTop + vh + 30) {
        lips = true;
        break;
      }
    }
    this.visible[2] = lips;
    this.visible[3] = camTop < 1150;
  }

  /** render one pass of the 3D scene and composite it (1:1 pixels) onto the game canvas */
  drawPass(pass: number, ctx: CanvasRenderingContext2D) {
    if (!this.ready || !this.visible[pass] || this.w === 0) return;
    const r = this.renderer;
    r.clear(true, true, false);
    r.render(this.scenes[pass], this.cam);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(r.domElement, 0, 0, this.w, this.h);
    ctx.restore();
  }

  dispose() {
    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        /* ignore */
      }
    }
    this.disposables.length = 0;
    try {
      this.renderer?.dispose();
      this.renderer?.forceContextLoss();
    } catch {
      /* ignore */
    }
  }
}
