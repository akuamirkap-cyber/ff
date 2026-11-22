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
import type { Ocean, Formation } from "../ocean";
import { WORLD_W, WORLD_H, FLOOR_TOP } from "../ocean";
import {
  SHARED,
  backdropMaterial,
  raysMaterial,
  rockMaterial,
  coralMaterial,
  litMaterial,
  glowMaterial,
  plumeMaterial,
  COMMON,
} from "./glsl";
import {
  mulberry32,
  fbm,
  solidToGeometry,
  normalizeGeo,
  kelpGeometry,
  asRockChunk,
  sharedGeo,
  entityGeometry,
  paintLit,
  sampleSdf,
  buildRelief,
  composeTRS,
} from "./geometry";
import type { Relief, Palette } from "./geometry";
// PENYELAM procedural builders (copied verbatim from PENYELAM.zip)
import { meshCoral, meshTubes, meshCoralBloom, meshCoralPlate, meshChunk } from "../penyelam/world.js";
import { buildDiverMesh, buildSubmarineMesh } from "../penyelam/meshes.js";
import { DiverSquad } from "./divers";
import type { DiverTarget, DiverHooks } from "./divers";
import { glassMaterial, coneBeamGeometry, coneBeamMaterial, eyesForHead, sandMaterial } from "./fx";
import { JellyField } from "./jelly";
import { brainCoral, anemone, pillarCoral, mushroomCoral, seaPen, goldenKelp } from "./corals";
import { Critters } from "./critters";
import type { Spot } from "./critters";

type RGB = [number, number, number];

// ---------------------------------------------------------------- palettes
const ZONE_ROCK: { rock0: RGB; rock1: RGB; crust: RGB; vein: RGB; veinK: number }[] = [
  { rock0: [0.17, 0.23, 0.27], rock1: [0.46, 0.54, 0.54], crust: [0.8, 0.72, 0.52], vein: [0, 0, 0], veinK: 0 },
  { rock0: [0.12, 0.16, 0.28], rock1: [0.32, 0.4, 0.56], crust: [0.36, 0.48, 0.7], vein: [0.4, 0.6, 1.0], veinK: 0.15 },
  { rock0: [0.09, 0.08, 0.2], rock1: [0.27, 0.23, 0.44], crust: [0.42, 0.3, 0.68], vein: [0.45, 0.85, 1.0], veinK: 1 },
  { rock0: [0.07, 0.07, 0.14], rock1: [0.21, 0.2, 0.31], crust: [0.6, 0.52, 0.4], vein: [1.0, 0.5, 0.2], veinK: 0.9 },
];

// coral kinds
const K_STAG = 0,
  K_FAN = 1,
  K_TUBE = 2,
  K_BLOOM = 3,
  K_PLATE = 4,
  K_KELP = 5,
  K_BASE = 6, // encrusting holdfast that fuses a colony to the rock
  K_BRAIN = 7,
  K_ANEM = 8,
  K_PILLAR = 9,
  K_MUSH = 10,
  K_PEN = 11,
  K_GKELP = 12; // tall golden kelp fronds
const N_KINDS = 13;
const KIND_H: [number, number][] = [
  [20, 38],
  [26, 50],
  [14, 28],
  [14, 26],
  [24, 40],
  [34, 70],
  [10, 10], // base (unused)
  [18, 34], // brain
  [16, 30], // anemone
  [30, 52], // pillar
  [18, 32], // mushroom
  [34, 62], // sea pen
  [70, 130], // golden kelp
];
// corals are rigid (no animation); only kelp blades move with the current
const KIND_SWAY = [0, 0, 0, 0, 0, 0.2, 0, 0, 0, 0, 0, 0, 0.14];

const CORAL_COL: RGB[][][] = [
  // zone 0 : warm sunlit garden
  [
    [[0.93, 0.52, 0.28], [0.95, 0.62, 0.4], [0.9, 0.42, 0.4], [0.96, 0.72, 0.55]],
    [[0.62, 0.45, 0.82], [0.72, 0.55, 0.88], [0.8, 0.4, 0.7]],
    [[0.95, 0.78, 0.2], [0.9, 0.65, 0.15], [0.96, 0.84, 0.3]],
    [[0.95, 0.62, 0.52], [0.98, 0.78, 0.62], [0.9, 0.5, 0.6]],
    [[0.28, 0.72, 0.72], [0.4, 0.8, 0.7], [0.3, 0.6, 0.78]],
    [[0.55, 0.62, 0.22], [0.4, 0.55, 0.25], [0.62, 0.58, 0.2]],
  ],
  // zone 1 : gorgonian canyon
  [
    [[0.9, 0.4, 0.35], [0.95, 0.55, 0.4], [0.85, 0.35, 0.55]],
    [[0.55, 0.45, 0.9], [0.7, 0.5, 0.95], [0.3, 0.6, 0.9], [0.9, 0.4, 0.6]],
    [[0.8, 0.7, 0.3], [0.9, 0.6, 0.3]],
    [[0.85, 0.5, 0.7], [0.7, 0.55, 0.9]],
    [[0.25, 0.6, 0.85], [0.35, 0.75, 0.85]],
    [[0.3, 0.55, 0.4], [0.35, 0.6, 0.5]],
  ],
  // zone 2 : bioluminescent terraces
  [
    [[0.4, 0.6, 1.0], [1.0, 0.4, 0.7], [0.6, 0.45, 1.0]],
    [[0.3, 0.9, 1.0], [0.7, 0.4, 1.0], [1.0, 0.35, 0.8]],
    [[0.5, 1.0, 0.7], [1.0, 0.8, 0.3]],
    [[0.8, 0.5, 1.0], [0.4, 0.8, 1.0]],
    [[0.3, 0.9, 0.9], [0.5, 0.7, 1.0]],
    [[0.4, 0.95, 0.6], [0.3, 0.8, 0.8]],
  ],
  // zone 3 : abyssal vents
  [
    [[1.0, 0.5, 0.25], [0.95, 0.4, 0.35]],
    [[0.6, 0.5, 1.0], [1.0, 0.6, 0.3], [0.4, 0.8, 1.0]],
    [[1.0, 0.35, 0.28], [0.95, 0.9, 0.85], [1.0, 0.55, 0.3]],
    [[1.0, 0.55, 0.75], [0.8, 0.6, 1.0]],
    [[0.5, 0.8, 1.0], [0.7, 0.7, 1.0]],
    [[0.5, 0.8, 0.5], [0.4, 0.7, 0.7]],
  ],
];
const KIND_W: number[][] = [
  [28, 14, 14, 16, 14, 14],
  [20, 28, 16, 12, 10, 14],
  [18, 22, 20, 20, 20, 0],
  [14, 20, 34, 16, 16, 0],
];
const EXTRA_COL: RGB[][][] = [
  [[[0.85, 0.75, 0.35], [0.6, 0.72, 0.35], [0.9, 0.62, 0.45]], [[0.95, 0.5, 0.55], [0.6, 0.85, 0.6], [0.95, 0.75, 0.4], [0.75, 0.6, 0.9]], [[0.9, 0.7, 0.4], [0.8, 0.55, 0.35], [0.95, 0.8, 0.55]], [[0.75, 0.7, 0.4], [0.8, 0.5, 0.55], [0.65, 0.75, 0.5]], [[0.95, 0.55, 0.3], [0.9, 0.8, 0.3], [0.95, 0.65, 0.6]]],
  [[[0.55, 0.65, 0.8], [0.8, 0.6, 0.5], [0.7, 0.75, 0.45]], [[0.8, 0.45, 0.9], [0.4, 0.8, 0.85], [0.95, 0.6, 0.5]], [[0.85, 0.5, 0.45], [0.6, 0.6, 0.85]], [[0.7, 0.6, 0.85], [0.85, 0.6, 0.5]], [[0.95, 0.45, 0.35], [0.7, 0.5, 0.95], [0.95, 0.75, 0.35]]],
  [[[0.4, 0.9, 0.9], [0.9, 0.5, 1.0], [0.5, 1.0, 0.6]], [[1.0, 0.4, 0.8], [0.4, 1.0, 0.7], [0.6, 0.6, 1.0]], [[0.5, 0.7, 1.0], [0.9, 0.4, 0.9]], [[0.6, 1.0, 0.9], [1.0, 0.7, 0.4]], [[0.4, 0.8, 1.0], [1.0, 0.5, 0.9], [0.5, 1.0, 0.8]]],
  [[[0.9, 0.6, 0.4], [0.95, 0.85, 0.7]], [[1.0, 0.45, 0.3], [0.95, 0.9, 0.85], [0.8, 0.5, 1.0]], [[0.95, 0.5, 0.3], [0.8, 0.7, 0.9]], [[1.0, 0.6, 0.5], [0.7, 0.6, 1.0]], [[1.0, 0.6, 0.3], [0.6, 0.6, 1.0], [1.0, 0.8, 0.5]]],
];
const EXTRA_W = [
  [0, 10, 12, 9, 8, 6],
  [0, 8, 10, 8, 8, 10],
  [0, 8, 12, 8, 8, 10],
  [0, 6, 10, 8, 6, 10],
];
const GOLD: RGB[] = [
  [0.96, 0.8, 0.3],
  [0.9, 0.72, 0.24],
  [0.82, 0.74, 0.32],
  [0.98, 0.86, 0.42],
];
const GKELP_W = [7, 5, 2, 3];
for (let z = 0; z < 4; z++) {
  CORAL_COL[z].push([[0.5, 0.45, 0.4]], ...EXTRA_COL[z], GOLD);
  KIND_W[z].push(...EXTRA_W[z], GKELP_W[z]);
}
const ZONE_GLOW = [0, 0.25, 1, 0.8];

function pick<T>(r: () => number, a: T[]): T {
  return a[Math.min(a.length - 1, (r() * a.length) | 0)];
}
function pickKind(r: () => number, zone: number) {
  const w = KIND_W[zone];
  let tot = 0;
  for (const v of w) tot += v;
  let x = r() * tot;
  for (let k = 0; k < w.length; k++) {
    x -= w[k];
    if (x <= 0) return k;
  }
  return 0;
}

// ---------------------------------------------------------------- batched instancing
interface Item {
  x: number;
  y: number;
  z: number;
  h: number;
  sq: number;
  tilt: number;
  turn: number;
  tint: RGB;
  ph: number;
  glow: number;
}

class Batch {
  items: Item[][] = Array.from({ length: N_KINDS }, () => []);
  /**
   * A coral rooted into the rock: the colony is sunk by a tenth of its height and a
   * low encrusting holdfast (same hue, darker) spreads over the rock around the stem,
   * so the base never reads as a flat cut floating above the surface.
   */
  rooted(kind: number, x: number, y: number, z: number, h: number, tilt: number, turn: number, tint: RGB, ph: number, glow: number, sq = 1) {
    const sink = h * (0.12 + Math.min(0.14, Math.abs(tilt) * 0.14));
    // sink along the negative stem axis (+sin(tilt) in X, +cos(tilt) in Y-down) so tilted corals enter the rock cleanly
    const sx = Math.sin(tilt) * sink,
      sy = Math.cos(tilt) * sink;
    this.add(kind, x + sx, y + sy, z, h, tilt, turn, tint, ph, glow, sq);
    const slopeShrink = Math.max(0.62, 1 - Math.abs(tilt) * 0.35);
    const w = Math.max(4, h * (kind === K_KELP || kind === K_PEN || kind === K_GKELP ? 0.11 : kind === K_FAN ? 0.23 : kind === K_PLATE || kind === K_MUSH ? 0.27 : kind === K_BRAIN ? 0.48 : kind === K_ANEM ? 0.32 : 0.29) * (0.8 + sq * 0.28) * slopeShrink);
    const bt: RGB = [tint[0] * 0.62 + 0.08, tint[1] * 0.62 + 0.07, tint[2] * 0.62 + 0.06];
    this.add(K_BASE, x + sx * 0.72, y + sy * 0.72 + 1.1, z - 0.5, w, tilt * 0.8, turn, bt, ph, glow * 0.4, 1);
  }
  add(kind: number, x: number, y: number, z: number, h: number, tilt: number, turn: number, tint: RGB, ph: number, glow: number, sq = 1) {
    this.items[kind].push({ x, y, z, h, sq, tilt, turn, tint, ph, glow });
  }
}

interface ChunkItem {
  x: number;
  y: number;
  z: number;
  r: number;
  sy: number;
  turn: number;
}

/** low knobbly encrusting dome, radius 1, height ~0.3 (aux = 0 base .. 0.35 top) */
function holdfastGeometry() {
  const g = new THREE.SphereGeometry(1, 18, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  g.deleteAttribute("uv");
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const n = pos.count;
  const aux = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    const bump = 1 + 0.08 * Math.sin(x * 9.1 + z * 7.3) * Math.cos(z * 11.7 - x * 5.2);
    pos.setXYZ(i, x * bump, y * 0.3 * bump + 0.02 * Math.sin(x * 13 + z * 17), z * bump);
    aux[i] = y * 0.35;
  }
  g.computeVertexNormals();
  g.setAttribute("aux", new THREE.BufferAttribute(aux, 1));
  g.translate(0, -0.015, 0);
  return g;
}

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

  private kindGeo: THREE.BufferGeometry[] = [];
  private chunkGeo: THREE.BufferGeometry[] = [];
  private matCache = new Map<string, THREE.Material>();
  private disposables: { dispose: () => void }[] = [];

  // parallax groups
  private entA = new THREE.Group(); // submarines
  private entB = new THREE.Group(); // divers
  private fgGroup = new THREE.Group();
  private fgRoot = new THREE.Group();
  private ENT_A = { p: 0.55, period: 0 };
  private ENT_B = { p: 1, period: 0 };
  private squad: DiverSquad | null = null;
  private jellyFar: JellyField | null = null;
  private jellyNear: JellyField | null = null;
  private FG_P = 1.24;

  private caveForms: Formation[] = [];
  private fishSpots: Spot[] = [];
  private shrimpSpots: Spot[] = [];
  private krillSpots: Spot[] = [];
  private critters: Critters | null = null;
  private vents: { g: THREE.Group; x: number; mats: THREE.ShaderMaterial[]; pts: THREE.Points }[] = [];
  private subs: { wrap: THREE.Group; root: THREE.Group; prop: THREE.Mesh; dir: number; phase: number; speed: number; yl: number }[] = [];

  private raysNear!: THREE.Mesh;
  private visible = [true, true, false, false];
  private lastT = 0;

  constructor(oc: Ocean, bgStyle: "game1" | "game2" | "reef_g1" | "shipwreck" | "kelp" | "temple" | "lagoon" = "game1") {
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
    this.buildForeground();
    yield;
    this.buildEntities();
    this.critters = new Critters(this.fishSpots, this.shrimpSpots, this.krillSpots, mulberry32(9191), COMMON);
    this.scenes[1].add(this.critters.group);
    this.disposables.push(this.critters);
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
    const norm = (b: any) => normalizeGeo(solidToGeometry(b));
    this.kindGeo[K_STAG] = norm(meshCoral(0).build());
    this.kindGeo[K_FAN] = norm(meshCoral(1).build());
    this.kindGeo[K_TUBE] = norm(meshTubes().build());
    this.kindGeo[K_BLOOM] = norm(meshCoralBloom().build());
    // table corals are tipped towards the viewer so the scalloped plates read from the side
    const plate = solidToGeometry(meshCoralPlate().build());
    plate.rotateX(0.95);
    this.kindGeo[K_PLATE] = normalizeGeo(plate);
    this.kindGeo[K_KELP] = kelpGeometry();
    this.kindGeo[K_BASE] = holdfastGeometry();
    this.kindGeo[K_BRAIN] = brainCoral(3);
    this.kindGeo[K_ANEM] = anemone(2);
    this.kindGeo[K_PILLAR] = pillarCoral(4);
    this.kindGeo[K_MUSH] = mushroomCoral(5);
    this.kindGeo[K_PEN] = seaPen(1);
    this.kindGeo[K_GKELP] = goldenKelp(2);
    for (let i = 0; i < 3; i++) {
      const g = normalizeGeo(solidToGeometry(meshChunk(11 + i * 7, 2).build()), "radius");
      this.chunkGeo.push(asRockChunk(g));
    }
  }

  private coralMats(fog: number, dark: number): THREE.Material[] {
    const key = `c${fog}_${dark}`;
    let m = this.matCache.get(key) as any;
    if (!m) {
      m = {
        solid: coralMaterial({ fog, dark, sway: 1, double: true }),
        kelp: coralMaterial({ fog, dark, sway: 1, double: true }),
      };
      this.matCache.set(key, m);
      this.disposables.push(m.solid, m.kelp);
    }
    const arr: THREE.Material[] = Array.from({ length: N_KINDS }, () => m.solid);
    arr[K_KELP] = m.kelp;
    arr[K_PEN] = m.kelp;
    arr[K_GKELP] = m.kelp;
    return arr;
  }

  private flushBatch(b: Batch, parent: THREE.Object3D, fog: number, dark: number, order = 0) {
    const mats = this.coralMats(fog, dark);
    const mtx = new THREE.Matrix4();
    for (let kind = 0; kind < b.items.length; kind++) {
      const it = b.items[kind];
      if (!it.length) continue;
      const geo = sharedGeo(this.kindGeo[kind]);
      const n = it.length;
      const tint = new Float32Array(n * 4),
        data = new Float32Array(n * 2);
      const mesh = new THREE.InstancedMesh(geo, mats[kind], n);
      for (let i = 0; i < n; i++) {
        const q = it[i];
        composeTRS(mtx, q.x, -q.y, q.z, q.h * q.sq, q.h, q.h * q.sq, q.tilt, q.turn);
        mesh.setMatrixAt(i, mtx);
        tint[i * 4] = q.tint[0];
        tint[i * 4 + 1] = q.tint[1];
        tint[i * 4 + 2] = q.tint[2];
        tint[i * 4 + 3] = q.ph;
        data[i * 2] = KIND_SWAY[kind];
        data[i * 2 + 1] = q.glow;
      }
      geo.setAttribute("iTint", new THREE.InstancedBufferAttribute(tint, 4));
      geo.setAttribute("iData", new THREE.InstancedBufferAttribute(data, 2));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      if (mesh.boundingSphere) mesh.boundingSphere.radius += 8;
      mesh.renderOrder = order;
      parent.add(mesh);
      this.disposables.push(geo);
    }
  }

  private flushChunks(items: ChunkItem[], parent: THREE.Object3D, zone: number, fog: number, dark: number, key: string) {
    if (!items.length) return;
    const z = ZONE_ROCK[zone];
    const mat = rockMaterial({ ...z, seed: 7 + zone * 13, fog, dark, instanced: true, bump: 1.1 });
    this.disposables.push(mat);
    const mtx = new THREE.Matrix4();
    for (let v = 0; v < this.chunkGeo.length; v++) {
      const mine = items.filter((_, i) => i % this.chunkGeo.length === v);
      if (!mine.length) continue;
      const geo = sharedGeo(this.chunkGeo[v]);
      const mesh = new THREE.InstancedMesh(geo, mat, mine.length);
      mine.forEach((c, i) => {
        composeTRS(mtx, c.x, -c.y, c.z, c.r, c.r * c.sy, c.r, 0, c.turn);
        mesh.setMatrixAt(i, mtx);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.name = key;
      mesh.renderOrder = 9;
      parent.add(mesh);
      this.disposables.push(geo);
    }
  }

  // ------------------------------------------------------------------ backdrop & light
  private makeBackdrop() {
    const quad = new THREE.PlaneGeometry(2, 2);
    const bd = new THREE.Mesh(quad, backdropMaterial());
    bd.frustumCulled = false;
    bd.renderOrder = -100;
    this.scenes[0].add(bd);

    const mk = (par: number, strength: number, sharp: number, speed: number, off: number, additive: boolean, order: number, scene: THREE.Scene) => {
      const m = new THREE.Mesh(quad, raysMaterial({ par, strength, sharp, speed, off, additive }));
      m.frustumCulled = false;
      m.renderOrder = order;
      scene.add(m);
      return m;
    };
    mk(0.3, 0.55, 0.2, 0.55, 300, true, -90, this.scenes[0]); // far, broad shafts behind the canyon
    mk(0.62, 0.42, 0.7, 0.8, 1700, true, 6, this.scenes[0]); // mid, crisper shafts crossing the far walls
    this.raysNear = mk(1.14, 0.34, 1.3, 1.0, 900, false, 6, this.scenes[3]); // crisp shafts in front of the reef
  }

  // ------------------------------------------------------------------ main plane: pinnacles
  private buildFormation(f: Formation) {
    const zone = f.zone;
    const zr = ZONE_ROCK[zone];
    const sc = f.sdfCave;
    const nx = sc.sw,
      ny = sc.sh;
    const x0 = f.x - sc.pad,
      y0 = f.y - sc.pad;
    const S = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) S[j * nx + i] = sampleSdf(f.sdfSolid, f.x, f.y, x0 + i * sc.step, y0 + j * sc.step);
    const C = new Float32Array(sc.data);
    const rel: Relief = buildRelief({ x0, y0, step: sc.step, nx, ny, S, C, zMax: 36, zR: 44, amp: 11, seed: f.seed * 0.0137, caveZ: 3, lipW: 20, noiseFreq: 0.022 });
    const root = new THREE.Group();
    this.scenes[1].add(root);

    const mat = rockMaterial({ ...zr, seed: (f.seed % 89) + 1, fog: 0, cave: true });
    const mesh = new THREE.Mesh(rel.geo, mat);
    mesh.renderOrder = 12;
    root.add(mesh);
    this.disposables.push(mat, rel.geo);

    // cave lips drawn again over the fish (pass 2)
    if (f.cave) {
      const lm = rockMaterial({ ...zr, seed: (f.seed % 89) + 1, fog: 0, cave: true, lip: true });
      const lip = new THREE.Mesh(rel.geo, lm);
      lip.renderOrder = 12;
      this.scenes[2].add(lip);
      this.disposables.push(lm);
      this.caveForms.push(f);
    }

    // rooted stem / hanging column
    this.buildColumn(f, root);

    // living reef
    const rng = mulberry32(f.seed * 31 + 7);
    const b = new Batch();
    const W = f.w;
    let first = -1,
      last = -1;
    for (let x = 0; x < W; x++)
      if (f.top[x] >= 0) {
        if (first < 0) first = x;
        last = x;
      }
    const glow = ZONE_GLOW[zone];
    const addCoral = (kind: number, wx: number, wy: number, tilt: number, hMul = 1, zOff = 0) => {
      const tint = pick(rng, CORAL_COL[zone][kind]);
      const hh = (KIND_H[kind][0] + rng() * (KIND_H[kind][1] - KIND_H[kind][0])) * hMul * 1.3;
      const z = rel.zAt(wx, wy + 3) + 1.5 + rng() * 5 + zOff;
      b.rooted(kind, wx, wy, z, hh, tilt, rng() * 6.28, tint, rng() * 6.28, glow, 0.85 + rng() * 0.45);
    };
    // crown: dense like before, but grouped in species patches (one family of colour per patch,
    // the biggest colony in the middle of the patch) with golden soft-coral turf between them
    let patchKind = pickKind(rng, zone),
      patchTint: RGB = pick(rng, CORAL_COL[zone][patchKind]),
      patchN = 3 + Math.floor(rng() * 4),
      patchI = 0;
    for (let x = first + 5; x < last - 5; x += 5 + rng() * 9) {
      const xi = Math.round(x);
      const ty = f.top[xi];
      if (ty < 0) continue;
      const a = f.top[Math.max(0, xi - 6)],
        c = f.top[Math.min(W - 1, xi + 6)];
      if (a < 0 || c < 0) continue;
      const sideDrop = Math.max(0, a - ty, c - ty);
      if (sideDrop > 16) continue;
      const slope = Math.max(-0.55, Math.min(0.55, Math.atan2(-(c - a), 12)));
      if (patchI >= patchN) {
        patchKind = pickKind(rng, zone);
        patchTint = pick(rng, CORAL_COL[zone][patchKind]);
        patchN = 3 + Math.floor(rng() * 4);
        patchI = 0;
      }
      const mid = 1 - Math.abs((patchI + 0.5) / patchN - 0.5) * 2; // 0 edge .. 1 centre of the patch
      const kind = rng() < 0.8 ? patchKind : pickKind(rng, zone);
      const tint: RGB = kind === patchKind ? [Math.min(1, patchTint[0] * (0.9 + rng() * 0.2)), Math.min(1, patchTint[1] * (0.9 + rng() * 0.2)), Math.min(1, patchTint[2] * (0.9 + rng() * 0.2))] : pick(rng, CORAL_COL[zone][kind]);
      const hh = (KIND_H[kind][0] + rng() * (KIND_H[kind][1] - KIND_H[kind][0])) * 1.3 * (0.7 + 0.5 * mid);
      const wx = f.x + x,
        wy = f.y + ty + 2.5 + sideDrop * 0.45;
      b.rooted(kind, wx, wy, rel.zAt(wx, wy + 3) + 1.5 + rng() * 5 + (1 - mid) * 4, hh, slope * 0.8 + (rng() - 0.5) * 0.25, rng() * 6.28, tint, rng() * 6.28, glow, 0.85 + rng() * 0.45);
      patchI++;
      // golden turf in the sunlit zones: low anemone / bloom carpet in front of the big colonies
      if (zone < 2 && rng() < 0.7) {
        const tx = wx + (rng() - 0.5) * 9;
        const tk = rng() < 0.6 ? K_ANEM : K_BLOOM;
        b.rooted(tk, tx, wy + 1, rel.zAt(tx, wy + 3) + 7 + rng() * 4, 7 + rng() * 9, slope * 0.8 + (rng() - 0.5) * 0.4, rng() * 6.28, pick(rng, GOLD), rng() * 6.28, glow, 1 + rng() * 0.5);
      }
    }
    // golden kelp groves on wide sunlit crowns
    if (zone < 2 && last - first > 90) {
      const groves = last - first > 240 ? 2 : 1;
      for (let gI = 0; gI < groves; gI++) {
        const gx = Math.round(first + (last - first) * (groves === 1 ? 0.3 + rng() * 0.4 : 0.2 + gI * 0.55 + rng() * 0.1));
        const nK = 3 + Math.floor(rng() * 4);
        for (let k = 0; k < nK; k++) {
          const xi = Math.max(0, Math.min(W - 1, gx + Math.round((rng() - 0.5) * 50)));
          const ty = f.top[xi];
          if (ty < 0) continue;
          const wx = f.x + xi,
            wy = f.y + ty + 2;
          b.rooted(K_GKELP, wx, wy, rel.zAt(wx, wy + 3) + (rng() < 0.5 ? -6 : 8), KIND_H[K_GKELP][0] + rng() * (KIND_H[K_GKELP][1] - KIND_H[K_GKELP][0]), (rng() - 0.5) * 0.25, rng() * 6.28, pick(rng, GOLD), rng() * 6.28, glow, 1);
        }
      }
    }
    // reef critters: damselfish & swirling krill hovering over coral heads, shrimp perched between corals
    for (let x = first + 14; x < last - 14; x += 38 + rng() * 58) {
      const xi = Math.round(x);
      const ty = f.top[xi];
      if (ty < 0) continue;
      const wx = f.x + xi,
        wy = f.y + ty;
      if (rng() < 0.72) this.fishSpots.push({ x: wx, y: wy - 18 - rng() * 22, z: rel.zAt(wx, wy) + 14 + rng() * 10 });
      if (rng() < 0.74) {
        const a = f.top[Math.max(0, xi - 5)],
          c = f.top[Math.min(W - 1, xi + 5)];
        const tilt = a >= 0 && c >= 0 ? Math.atan2(-(c - a), 10) : 0;
        const nSh = rng() < 0.35 ? 2 : 1;
        for (let s = 0; s < nSh; s++) {
          const sx = wx + (rng() - 0.5) * 14;
          this.shrimpSpots.push({ x: sx, y: wy + 0.5 + (rng() - 0.5) * 1.5, z: rel.zAt(sx, wy + 3) + 6 + rng() * 5, tilt });
        }
      }
      if (rng() < 0.78) {
        const nK = 2 + Math.floor(rng() * 3);
        const cz = rel.zAt(wx, wy + 2) + 8 + rng() * 10;
        for (let k = 0; k < nK; k++) {
          this.krillSpots.push({
            x: wx + (rng() - 0.5) * 24,
            y: wy - 10 - rng() * 18,
            z: cz + (rng() - 0.5) * 10,
          });
        }
      }
    }
    // shelves on both flanks
    const caveCy = f.cave ? f.cave.y - f.y : -999;
    const caveRy = f.cave ? f.cave.ry : 0;
    for (const fy of [-0.36, -0.02, 0.34]) {
      const yy = Math.round(f.cyl + f.ry * fy);
      let xl = 0;
      while (xl < W && !(f.top[xl] >= 0 && yy >= f.top[xl] && yy <= f.bot[xl])) xl++;
      let xr = W - 1;
      while (xr > 0 && !(f.top[xr] >= 0 && yy >= f.top[xr] && yy <= f.bot[xr])) xr--;
      if (xl >= xr) continue;
      const inMouth = Math.abs(yy - caveCy) < caveRy + 10;
      const openL = f.cave && (f.cave.kind === "tunnel" || f.cave.dir === -1);
      const openR = f.cave && (f.cave.kind === "tunnel" || f.cave.dir === 1);
      for (let n = 0; n < 2; n++) {
        const yv = yy + (n ? 14 : 0) + (rng() - 0.5) * 8;
        if (!(inMouth && openL) && rng() < 0.85) {
          const kk = rng() < 0.6 ? K_FAN : pickKind(rng, zone) || K_PLATE;
          const cxL = f.x + xl + 2, cyL = f.y + yv;
          addCoral(kk === K_KELP ? K_FAN : kk, cxL, cyL, 1.15 + (rng() - 0.5) * 0.5, 0.95, 2);
          if (rng() < 0.55) {
            this.shrimpSpots.push({ x: cxL - 2 + (rng() - 0.5) * 6, y: cyL + (rng() - 0.5) * 4, z: rel.zAt(cxL, cyL + 3) + 6, tilt: 0.75 });
          }
          if (rng() < 0.65) {
            const kz = rel.zAt(cxL, cyL) + 10;
            for (let k = 0; k < 2; k++) this.krillSpots.push({ x: cxL - 10 - rng() * 12, y: cyL - 6 + (rng() - 0.5) * 14, z: kz + rng() * 6 });
          }
        }
        if (!(inMouth && openR) && rng() < 0.85) {
          const kk = rng() < 0.6 ? K_FAN : pickKind(rng, zone) || K_PLATE;
          const cxR = f.x + xr - 2, cyR = f.y + yv;
          addCoral(kk === K_KELP ? K_FAN : kk, cxR, cyR, -1.15 + (rng() - 0.5) * 0.5, 0.95, 2);
          if (rng() < 0.55) {
            this.shrimpSpots.push({ x: cxR + 2 + (rng() - 0.5) * 6, y: cyR + (rng() - 0.5) * 4, z: rel.zAt(cxR, cyR + 3) + 6, tilt: -0.75 });
          }
          if (rng() < 0.65) {
            const kz = rel.zAt(cxR, cyR) + 10;
            for (let k = 0; k < 2; k++) this.krillSpots.push({ x: cxR + 10 + rng() * 12, y: cyR - 6 + (rng() - 0.5) * 14, z: kz + rng() * 6 });
          }
        }
      }
    }
    // vines hanging from the underside
    for (let x = first + 14 + rng() * 14; x < last - 14; x += 18 + rng() * 26) {
      const xi = Math.round(x);
      if (f.bot[xi] > 0 && Math.abs(xi - f.cxl) > f.rx * 0.34) {
        const tint = pick(rng, CORAL_COL[zone][K_KELP].length ? CORAL_COL[zone][K_KELP] : CORAL_COL[0][K_KELP]);
        const wy = f.y + f.bot[xi] - 3;
        b.rooted(K_KELP, f.x + xi, wy, rel.zAt(f.x + xi, wy - 3) + 2, 24 + rng() * 26, Math.PI + (rng() - 0.5) * 0.35, rng() * 6.28, tint, rng() * 6.28, glow, 1);
      }
    }
    // big PENYELAM boulders resting on wide crowns
    const fch: ChunkItem[] = [];
    if (last - first > 110) {
      const nB = last - first > 260 ? 2 : 1;
      for (let i = 0; i < nB; i++) {
        const xi = Math.round(first + (last - first) * (nB === 1 ? 0.35 + rng() * 0.3 : 0.22 + i * 0.5 + rng() * 0.1));
        const ty = f.top[xi];
        if (ty < 0) continue;
        const wy = f.y + ty + 6;
        this.boulderCluster(b, fch, f.x + xi, wy, rel.zAt(f.x + xi, wy + 3) + 2, zone, rng, 22 + rng() * 18, zone < 2);
      }
    }
    this.flushChunks(fch, root, zone, 0, 0, "crownboulders");
    this.flushBatch(b, root, 0, 0, 0);
  }

  // ------------------------------------------------------------------ PENYELAM big boulders with clinging coral & kelp
  /**
   * Height of the (turned, scaled) boulder surface along its front face at a lateral
   * offset `u` (-1..1 of radius). Returns the top-most vertex (y up, z toward viewer)
   * so corals can be rooted on the actual rock instead of floating above it.
   */
  private chunkSurface(variant: number, turn: number, sy: number, u: number) {
    const g = this.chunkGeo[variant];
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const c = Math.cos(turn),
      sn = Math.sin(turn);
    let bestY = -1e9,
      bestZ = 0,
      bestNx = 0,
      bestNy = 1;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      // rotate about Y by `turn` (matches composeTRS ZYX euler with tilt 0)
      const rx = x * c + z * sn,
        rz = -x * sn + z * c;
      if (rz < 0.05) continue; // front half only
      if (Math.abs(rx - u) > 0.11) continue;
      const y = pos.getY(i) * sy;
      if (y > bestY) {
        bestY = y;
        bestZ = rz;
        bestNx = rx;
        bestNy = y;
      }
    }
    if (bestY < -1e8) return null;
    const nl = Math.hypot(bestNx, bestNy) || 1;
    return { y: bestY, z: bestZ, tilt: Math.atan2(bestNx / nl, Math.max(0.2, bestNy / nl)) };
  }

  private boulderCluster(b: Batch, chunks: ChunkItem[], cx: number, gy: number, z: number, zone: number, rng: () => number, size: number, kelp = true) {
    const n = 2 + Math.floor(rng() * 3);
    const glow = ZONE_GLOW[zone];
    const kelpCol = CORAL_COL[zone][K_KELP].length ? CORAL_COL[zone][K_KELP] : CORAL_COL[0][K_KELP];
    const NV = this.chunkGeo.length;
    for (let i = 0; i < n; i++) {
      const r = i === 0 ? size : size * (0.42 + rng() * 0.35);
      const x = cx + (i === 0 ? 0 : (i % 2 ? 1 : -1) * size * (0.75 + rng() * 0.4));
      const sy = 0.68 + rng() * 0.25;
      const turn = rng() * 6.28;
      const variant = chunks.length % NV;
      // boulders are ~0.69 r tall (half-height) – sink the bottom a little into the ground
      const y = gy - r * sy * 0.6 + (i === 0 ? 0 : r * 0.1);
      const zz = z + (i === 0 ? -r * 0.3 : r * 0.1);
      chunks.push({ x, y, z: zz, r, sy, turn });
      // corals rooted on the real rock surface (crown + shoulders of the boulder)
      const nc = Math.round(3 + r / 9 + rng() * 3);
      for (let k = 0; k < nc; k++) {
        const u = (rng() - 0.5) * 1.5;
        const sfc = this.chunkSurface(variant, turn, sy, u);
        if (!sfc) continue;
        const px = x + u * r;
        const py = y - sfc.y * r; // on the sampled rock surface (rooted() sinks it further)
        if (py > gy + 2) continue; // below ground level: skip
        let kind = pickKind(rng, zone);
        if (kind === K_KELP) kind = K_FAN;
        if (Math.abs(u) > 0.55 && rng() < 0.5) kind = rng() < 0.5 ? K_PLATE : K_BLOOM;
        const hh = (KIND_H[kind][0] + rng() * (KIND_H[kind][1] - KIND_H[kind][0])) * (0.5 + r / 170);
        const bz = zz + sfc.z * r * 0.9 + 1;
        b.rooted(kind, px, py, bz, hh, -sfc.tilt * 0.9 + (rng() - 0.5) * 0.2, rng() * 6.28, pick(rng, CORAL_COL[zone][kind]), rng() * 6.28, glow, 0.85 + rng() * 0.4);
        if (k < 2 || rng() < 0.45) {
          this.shrimpSpots.push({ x: px + (rng() - 0.5) * 8, y: py + 0.5, z: bz + 3, tilt: -sfc.tilt * 0.6 });
        }
        if (rng() < 0.55) {
          this.krillSpots.push({ x: px + (rng() - 0.5) * 14, y: py - 8 - rng() * 14, z: bz + 5 + rng() * 6 });
        }
      }
      // encrusting blooms around the foot, rooted on the ground
      for (let k = 0; k < 2; k++) {
        const px = x + (rng() < 0.5 ? -1 : 1) * r * (0.9 + rng() * 0.5);
        b.rooted(K_BLOOM, px, gy + 1, zz + r * 0.6, 8 + rng() * 8, (rng() - 0.5) * 0.4, rng() * 6.28, pick(rng, CORAL_COL[zone][K_BLOOM]), rng() * 6.28, glow, 1);
      }
    }
    // kelp forest rooted in the ground, swaying out from behind and beside the rocks
    if (kelp) {
      const nk = 3 + Math.floor(rng() * 5);
      for (let k = 0; k < nk; k++) {
        const px = cx + (rng() - 0.5) * size * 3.2;
        const front = rng() < 0.4;
        b.rooted(K_KELP, px, gy + 1, z + (front ? size * 0.7 : -size * 0.6), 48 + rng() * 60 + size * 0.4, (rng() - 0.5) * 0.25, rng() * 6.28, pick(rng, kelpCol), rng() * 6.28, glow, 0.9 + rng() * 0.4);
        if (rng() < 0.6) {
          this.krillSpots.push({ x: px + (rng() - 0.5) * 16, y: gy - 18 - rng() * 24, z: z + 8 + rng() * 8 });
        }
      }
    }
  }

  private buildColumn(f: Formation, root: THREE.Group) {
    const step = 4;
    const hw0 = f.colHw0,
      colTop = f.colTop,
      colH = f.colH;
    const rng = mulberry32(f.colSeed * 13 + 5);
    const s1 = rng() * 9,
      s2 = rng() * 9,
      s3 = rng() * 9,
      s4 = rng() * 9,
      lean = (rng() - 0.5) * 30;
    const cxw = f.colX + f.colW / 2;
    const x0 = f.colX - 8,
      y0 = colTop;
    const nx = Math.ceil((f.colW + 16) / step) + 1,
      ny = Math.ceil(colH / step) + 1;
    const S = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      const y = y0 + j * step;
      const t = Math.min(1, (y - colTop) / colH);
      let hw = hw0 * (0.92 + 0.5 * Math.pow(t, 1.4)) + Math.sin((y - colTop) * 0.043 + s1) * 5 + Math.sin((y - colTop) * 0.13 + s2) * 2.2 + (Math.floor((y - colTop) / 41 + s3) & 1) * 4;
      if (f.colRooted) hw += Math.pow(Math.max(0, (t - 0.7) / 0.3), 2) * 38;
      const cx = cxw + Math.sin((y - colTop) * 0.017 + s4) * 7 + lean * t - 0 * 0;
      for (let i = 0; i < nx; i++) {
        const x = x0 + i * step;
        let s = Math.abs(x - cx) - hw;
        s = Math.max(s, colTop - y, y - (colTop + colH));
        S[j * nx + i] = s;
      }
    }
    const rel = buildRelief({ x0, y0, step, nx, ny, S, zMax: 22, zR: 30, amp: 5, seed: f.seed * 0.021 + 3, noiseFreq: 0.04 });
    const zr = ZONE_ROCK[f.zone];
    const rooted = f.colRooted;
    const mat = rockMaterial({
      ...zr,
      rock0: [zr.rock0[0] * 0.85, zr.rock0[1] * 0.85, zr.rock0[2] * 0.9],
      seed: (f.seed % 61) + 3,
      fog: rooted ? 0.14 : 0.22,
      fade: rooted ? undefined : [colTop + colH * 0.5, colTop + colH * 0.98],
      veinK: zr.veinK * 0.6,
    });
    const m = new THREE.Mesh(rel.geo, mat);
    m.position.z = -24;
    m.renderOrder = 5;
    root.add(m);
    this.disposables.push(mat, rel.geo);
  }

  // ------------------------------------------------------------------ sea floor, vents, treasure
  private buildFloor() {
    const top = this.oc.floorProfile();
    const step = 4;
    const topY = (x: number) => {
      let a = 0;
      for (let k = -3; k <= 3; k++) a += top[Math.max(0, Math.min(WORLD_W - 1, Math.round(x) + k))];
      return FLOOR_TOP + a / 7;
    };
    let minTop = 1e9;
    for (let x = 0; x < WORLD_W; x++) minTop = Math.min(minTop, FLOOR_TOP + top[x]);
    const y0 = minTop - 14,
      y1 = WORLD_H + 110;
    const nx = Math.ceil(WORLD_W / step) + 1,
      ny = Math.ceil((y1 - y0) / step) + 1;
    const S = new Float32Array(nx * ny);
    for (let i = 0; i < nx; i++) {
      const ty = topY(i * step);
      for (let j = 0; j < ny; j++) S[j * nx + i] = ty - (y0 + j * step);
    }
    const rel = buildRelief({ x0: 0, y0, step, nx, ny, S, zMax: 34, zR: 70, amp: 6, seed: 5.5, noiseFreq: 0.02 });
    // sunlit-looking rippled sand with caustics (the trench floor reads as a sandy channel between the rocks)
    const mat = sandMaterial(COMMON);
    const mesh = new THREE.Mesh(rel.geo, mat);
    mesh.renderOrder = 10;
    this.scenes[1].add(mesh);
    this.disposables.push(mat, rel.geo);

    const rng = mulberry32(4242);
    const ventsXY = this.oc.vents.map((v) => ({ x: v.x - 2, y: v.y + 40 }));
    const chest = this.oc.chestPos;
    const clear = (x: number) => {
      for (const v of ventsXY) if (Math.abs(x - v.x) < 44) return false;
      if (Math.abs(x - chest.x) < 54) return false;
      return true;
    };

    // reef at the foot of the trench
    const b = new Batch();
    for (let x = 14; x < WORLD_W - 14; x += 13 + rng() * 34) {
      if (!clear(x)) continue;
      const kind = pickKind(rng, 3);
      const tint = pick(rng, CORAL_COL[3][kind]);
      const hh = KIND_H[kind][0] + rng() * (KIND_H[kind][1] - KIND_H[kind][0]);
      const y = topY(x) + 3;
      b.rooted(kind, x, y, rel.zAt(x, y + 3) + 2 + rng() * 6, hh * (0.9 + rng() * 0.8), (rng() - 0.5) * 0.3, rng() * 6.28, tint, rng() * 6.28, ZONE_GLOW[3], 0.85 + rng() * 0.5);
    }
    // golden soft-coral turf along the sand and kelp groves between the colonies
    for (let x = 20; x < WORLD_W - 20; x += 7 + rng() * 10) {
      if (!clear(x) || rng() < 0.3) continue;
      const y = topY(x) + 2;
      const tk = rng() < 0.6 ? K_ANEM : K_BLOOM;
      b.rooted(tk, x, y, rel.zAt(x, y + 3) + 6 + rng() * 5, 8 + rng() * 10, (rng() - 0.5) * 0.4, rng() * 6.28, pick(rng, GOLD), rng() * 6.28, ZONE_GLOW[3] * 0.5, 1 + rng() * 0.5);
    }
    for (let gx = 200 + rng() * 200; gx < WORLD_W - 150; gx += 320 + rng() * 300) {
      if (!clear(gx)) continue;
      const nK = 4 + Math.floor(rng() * 5);
      for (let k = 0; k < nK; k++) {
        const x = gx + (rng() - 0.5) * 70;
        if (!clear(x)) continue;
        const y = topY(x) + 2;
        b.rooted(K_GKELP, x, y, rel.zAt(x, y + 3) + (rng() < 0.5 ? -8 : 10), KIND_H[K_GKELP][0] + rng() * (KIND_H[K_GKELP][1] - KIND_H[K_GKELP][0]), (rng() - 0.5) * 0.25, rng() * 6.28, pick(rng, GOLD), rng() * 6.28, ZONE_GLOW[3] * 0.4, 1);
      }
    }
    // tube-worm thickets around each black smoker
    for (const v of ventsXY) {
      for (const dx of [-34, -18, 30, 52]) {
        if (rng() < 0.2) continue;
        const x = v.x + dx + (rng() - 0.5) * 8,
          y = topY(x) + 3;
        b.rooted(K_TUBE, x, y, rel.zAt(x, y + 3) + 3, 18 + rng() * 14, (rng() - 0.5) * 0.3, rng() * 6.28, pick(rng, CORAL_COL[3][K_TUBE]), rng() * 6.28, 0.9, 1);
      }
    }
    this.flushBatch(b, this.scenes[1], 0, 0, 0);
    for (let x = 50; x < WORLD_W - 50; x += 68 + rng() * 90) {
      if (!clear(x)) continue;
      const gy = topY(x);
      const tilt = Math.atan2(-(topY(x + 5) - topY(x - 5)), 10);
      if (rng() < 0.58) this.fishSpots.push({ x, y: gy - 22 - rng() * 20, z: rel.zAt(x, gy) + 14 });
      if (rng() < 0.85) {
        const nSh = rng() < 0.35 ? 2 : 1;
        for (let s = 0; s < nSh; s++) {
          const sx = x + (rng() - 0.5) * 22;
          this.shrimpSpots.push({ x: sx, y: gy + 0.5, z: rel.zAt(sx, gy + 3) + 6 + rng() * 4, tilt });
        }
      }
      if (rng() < 0.8) {
        const nK = 2 + Math.floor(rng() * 3);
        const kz = rel.zAt(x, gy + 2) + 10 + rng() * 8;
        for (let k = 0; k < nK; k++) {
          this.krillSpots.push({ x: x + (rng() - 0.5) * 26, y: gy - 12 - rng() * 18, z: kz + (rng() - 0.5) * 10 });
        }
      }
    }
    // extra tube-worm shrimp around deep vents
    for (const v of ventsXY) {
      for (const dx of [-26, 40]) {
        const x = v.x + dx, gy = topY(x);
        this.shrimpSpots.push({ x, y: gy + 0.5, z: rel.zAt(x, gy + 3) + 7, tilt: 0 });
        this.krillSpots.push({ x: x + (rng() - 0.5) * 16, y: gy - 14 - rng() * 12, z: rel.zAt(x, gy + 3) + 10 });
      }
    }

    // boulders (PENYELAM meshChunk)
    const chunks: ChunkItem[] = [];
    for (let i = 0; i < 70; i++) {
      const x = 20 + rng() * (WORLD_W - 40);
      if (!clear(x)) continue;
      const r = 6 + rng() * 16;
      chunks.push({ x, y: topY(x) - r * 0.1, z: rel.zAt(x, topY(x) + 4) + 4, r, sy: 0.6 + rng() * 0.3, turn: rng() * 6 });
    }
    // large boulder outcrops on the trench floor, overgrown with coral and kelp
    const b2 = new Batch();
    for (let x = 140 + rng() * 120; x < WORLD_W - 120; x += 300 + rng() * 260) {
      if (!clear(x) || !clear(x - 60) || !clear(x + 60)) continue;
      const gy = topY(x) + 4;
      this.boulderCluster(b2, chunks, x, gy, rel.zAt(x, gy) + 6, 3, rng, 34 + rng() * 34, true);
    }
    this.flushChunks(chunks, this.scenes[1], 3, 0, 0, "floorchunks");
    this.flushBatch(b2, this.scenes[1], 0, 0, 0);

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

  // ------------------------------------------------------------------ foreground silhouettes (parallax 1.24)
  private buildForeground() {
    const rng = mulberry32(777);
    const b = new Batch();
    const chunks: ChunkItem[] = [];
    const spanL = WORLD_W * this.FG_P + 900;
    const baseY = WORLD_H + 44;
    for (let x = -60; x < spanL; x += 70 + rng() * 120) {
      const roll = rng();
      if (roll < 0.3) {
        const r = 26 + rng() * 38;
        chunks.push({ x, y: baseY - r * 0.1, z: 30 + rng() * 20, r, sy: 0.7 + rng() * 0.3, turn: rng() * 6 });
      } else {
        const kind = [K_STAG, K_STAG, K_FAN, K_KELP, K_KELP, K_TUBE, K_BLOOM][(rng() * 7) | 0];
        const tint = pick(rng, CORAL_COL[3][kind]);
        const hh = kind === K_KELP ? 150 + rng() * 120 : 70 + rng() * 70;
        b.rooted(kind, x, baseY + 2, 44 + rng() * 30, hh, (rng() - 0.5) * 0.3, rng() * 6.28, tint, rng() * 6.28, 0.5, 0.9 + rng() * 0.6);
      }
    }
    this.fgRoot.position.z = 0;
    this.flushBatch(b, this.fgGroup, 0.08, 0.5, 0);
    this.flushChunks(chunks, this.fgGroup, 3, 0.08, 0.6, "fgchunks");
    this.fgRoot.add(this.fgGroup);
    this.scenes[3].add(this.fgRoot);
  }

  // ------------------------------------------------------------------ PENYELAM residents: submarines & divers (decor only)
  private buildEntities() {
    const PAL: Record<number, [number, number, number, number, number]> = {
      0: [0.78, 0.6, 0.2, 0, 0.1],
      1: [0.66, 0.32, 0.16, 0, 0.75],
      2: [0.78, 0.58, 0.24, 0, 0.85],
      3: [0.95, 0.66, 0.26, 1.0, 0.1],
      4: [0.06, 0.065, 0.075, 0, 0.1],
      5: [0.18, 0.1, 0.055, 0, 0.1],
      6: [0.58, 0.5, 0.26, 0, 0.6],
      7: [1.0, 0.86, 0.5, 2.0, 0.1],
      8: [0.78, 0.28, 0.22, 0, 0.2],
      10: [0.42, 0.29, 0.16, 0, 0.55],
      11: [0.74, 0.55, 0.22, 0, 0.85],
      12: [0.7, 0.48, 0.13, 0, 0.3],
      13: [0.96, 0.66, 0.26, 0.85, 0.1],
      14: [1.0, 0.74, 0.3, 1.1, 0.1],
      15: [0.92, 0.72, 0.3, 0, 0.9],
      16: [1.0, 0.84, 0.5, 2.2, 0.1],
      17: [0.1, 0.11, 0.12, 0, 0.5],
      18: [1.0, 0.5, 0.2, 1.6, 0.1],
      50: [0.84, 0.54, 0.36, 0.12, 0],
      58: [0.84, 0.54, 0.36, 0.12, 0],
      51: [0.16, 0.09, 0.05, 0, 0],
      53: [0.15, 0.05, 0.04, 0, 0],
      55: [0.58, 0.29, 0.24, 0, 0],
      56: [0.14, 0.07, 0.04, 0, 0],
    };
    const pal: Palette = (m) => PAL[m] ?? [0.7, 0.7, 0.7, 0, 0.3];
    const subBuf = buildSubmarineMesh();
    const diverBuf = buildDiverMesh();
    const lit = litMaterial({ fog: 0.12 });
    const litD = litMaterial({ fog: 0.1 });
    this.disposables.push(lit, litD);

    // ---- submarines: hull + crew heads behind clear glass, bow searchlight cone
    const GLASS = (m: number) => m === 3 || m === 13 || m === 14;
    const subBody = entityGeometry(subBuf, (m, p) => p !== 1 && !GLASS(m), pal);
    const subGlass = entityGeometry(subBuf, (m, p) => p !== 1 && GLASS(m), pal);
    const subProp = entityGeometry(subBuf, (_m, p) => p === 1, pal);
    subProp.translate(0, 0.04, -2.2);
    const subEyes: THREE.BufferGeometry[] = [];
    for (let p = 5; p <= 10; p++) {
      const e = eyesForHead(subBuf, p);
      if (e) subEyes.push(e);
    }
    const glassMat = glassMaterial([0.55, 0.85, 0.95], 0.3, 0.7); // thick submarine glass
    const visorMat = glassMaterial([0.7, 0.9, 1.0], 0.12, 0.2); // thin diver visor
    this.disposables.push(visorMat);
    const subBeamGeo = coneBeamGeometry(10, 0.12, 2.4);
    const subBeamMat = coneBeamMaterial([1.0, 0.88, 0.6], 0.75);
    this.disposables.push(subBody, subGlass, subProp, glassMat, subBeamGeo, subBeamMat, ...subEyes);
    const mkSub = (dir: number, yl: number, phase: number, speed: number, scale: number) => {
      const wrap = new THREE.Group();
      const root = new THREE.Group();
      root.scale.setScalar(scale);
      root.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      root.add(new THREE.Mesh(subBody, lit));
      for (const e of subEyes) root.add(new THREE.Mesh(e, lit));
      const glass = new THREE.Mesh(subGlass, glassMat);
      glass.renderOrder = 28;
      root.add(glass);
      const prop = new THREE.Mesh(subProp, lit);
      prop.position.set(0, -0.04, 2.2);
      root.add(prop);
      // bow searchlight: cone pointing along -Z (the nose), slightly down
      const beam = new THREE.Mesh(subBeamGeo, subBeamMat);
      beam.position.set(0, -0.2, -2.45);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, -0.12, -1).normalize());
      beam.renderOrder = 30;
      root.add(beam);
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), glowMaterial([1.0, 0.9, 0.7], 1.1, "radial"));
      lens.position.set(0, -0.2, -2.4);
      lens.renderOrder = 30;
      root.add(lens);
      // warm cabin light spilling out of the dome
      const cabin = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.0), glowMaterial([1.0, 0.72, 0.4], 0.5, "radial"));
      cabin.position.set(0, 0.1, -1.7);
      cabin.renderOrder = 27;
      root.add(cabin);
      wrap.add(root);
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(scale * 5.6, scale * 3.6), glowMaterial([1.0, 0.72, 0.3], 0.14, "radial"));
      halo.renderOrder = 29;
      halo.position.z = 1;
      wrap.add(halo);
      this.entA.add(wrap);
      this.subs.push({ wrap, root, prop, dir, phase, speed, yl });
      this.disposables.push(lens.geometry, lens.material as THREE.Material, cabin.geometry, cabin.material as THREE.Material, halo.geometry, halo.material as THREE.Material);
    };
    // depth bands where the player will meet them: sunlit garden & the abyssal trench
    // twice as big and cruising deeper in the water column
    mkSub(1, this.ENT_A.p * 1050, 100, 15, 48);
    mkSub(-1, this.ENT_A.p * 2120, 1400, 12, 44);

    // ---- divers (legs kick, bubbles rise)
    const keepBody = (m: number, p: number) => !(p === 2 || p === 3 || p === 4 || p === 5 || p === 6 || p === 7 || p === 9) && !GLASS(m);
    const body = entityGeometry(diverBuf, keepBody, pal);
    const dGlass = entityGeometry(diverBuf, (m, p) => p === 10 && GLASS(m), pal);
    const dEyes = eyesForHead(diverBuf, 1);
    this.disposables.push(dGlass);
    if (dEyes) this.disposables.push(dEyes);
    const legLg = entityGeometry(diverBuf, (_m, p) => p === 4 || p === 6, pal).translate(0.072, -0.295, 0);
    const legRg = entityGeometry(diverBuf, (_m, p) => p === 5 || p === 7, pal).translate(-0.072, -0.295, 0);
    const armLg = entityGeometry(diverBuf, (_m, p) => p === 2, pal).translate(0.155, -0.54, 0);
    const armRg = entityGeometry(diverBuf, (_m, p) => p === 3, pal).translate(-0.155, -0.54, 0);
    this.disposables.push(body, legLg, legRg, armLg, armRg);
    // PENYELAM hunters (20% smaller), 1-3 per team, in world space
    this.squad = new DiverSquad({ body, glass: dGlass, eyes: dEyes, legL: legLg, legR: legRg, armL: armLg, armR: armRg, mat: litD, glassMat: visorMat, lit: litD }, 29);
    this.entB.add(this.squad.group);
    this.disposables.push(this.squad);

    // ---- 3D jellyfish: a far drifting bloom (parallax) and a few near ones that sting
    {
      const jr = mulberry32(777);
      const far: ConstructorParameters<typeof JellyField>[0] = [];
      for (let i = 0; i < 30; i++) {
        const deep = i >= 12;
        const y = deep ? 1150 + jr() * 1100 : 220 + jr() * 760;
        const col: [number, number, number] = deep
          ? pick(jr, [
              [0.45, 0.75, 1.0],
              [0.9, 0.45, 1.0],
              [0.35, 1.0, 0.85],
            ])
          : pick(jr, [
              [0.85, 0.9, 1.0],
              [1.0, 0.8, 0.9],
              [0.8, 0.95, 1.0],
            ]);
        far.push({ x: jr() * (WORLD_W * this.ENT_A.p + 1200), y: y * this.ENT_A.p, s: 14 + jr() * 16, ph: jr() * 6.28, col, glow: deep ? 0.95 : 0.3, len: 2.5, y0: (y - 160) * this.ENT_A.p, y1: (y + 160) * this.ENT_A.p });
      }
      this.jellyFar = new JellyField(far, -40, 0.3, jr);
      this.entA.add(this.jellyFar.group);
      const near: ConstructorParameters<typeof JellyField>[0] = [];
      for (let i = 0; i < 11; i++) {
        const deep = i >= 5;
        const y = deep ? 1200 + jr() * 900 : 260 + jr() * 700;
        const col: [number, number, number] = deep
          ? pick(jr, [
              [0.4, 0.7, 1.0],
              [0.85, 0.4, 1.0],
              [0.3, 1.0, 0.8],
            ])
          : pick(jr, [
              [0.9, 0.93, 1.0],
              [1.0, 0.78, 0.88],
              [0.75, 0.92, 1.0],
            ]);
        near.push({ x: 200 + jr() * (WORLD_W - 400), y, s: 26 + jr() * 22, ph: jr() * 6.28, col, glow: deep ? 1.0 : 0.4, len: 2.6, y0: y - 180, y1: Math.min(FLOOR_TOP - 160, y + 180) });
      }
      this.jellyNear = new JellyField(near, 6, 0, jr);
      this.entB.add(this.jellyNear.group);
      this.disposables.push(this.jellyFar, this.jellyNear);
    }

    this.entA.position.z = -150;
    this.entB.position.z = -95;
    this.scenes[0].add(this.entA, this.entB);
    this.ENT_A.period = WORLD_W * this.ENT_A.p + 1050 * (1 - this.ENT_A.p) + 900;
    this.ENT_B.period = WORLD_W * this.ENT_B.p + 1050 * (1 - this.ENT_B.p) + 400;
  }

  // ------------------------------------------------------------------ per-frame
  update(canvas: HTMLCanvasElement, camLeft: number, camTop: number, vw: number, vh: number, t: number) {
    if (!this.ready) return;
    const w = canvas.width,
      h = canvas.height;
    if (w !== this.w || h !== this.h) {
      this.renderer.setSize(w, h, false);
      this.w = w;
      this.h = h;
    }
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    void dt;
    const cx = camLeft + vw / 2,
      cy = camTop + vh / 2;
    SHARED.uTime.value = t;
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

    // foreground
    this.fgGroup.position.set(cx * (1 - this.FG_P), 0, 0);
    const nearFloor = camTop + vh > WORLD_H - 320;
    this.fgGroup.visible = nearFloor;
    this.raysNear.visible = camTop < 1150;

    // residents
    const A = this.ENT_A,
      B = this.ENT_B;
    this.entA.position.x = cx * (1 - A.p);
    this.entA.position.y = -cy * (1 - A.p);
    this.entB.position.x = cx * (1 - B.p);
    this.entB.position.y = -cy * (1 - B.p);
    const xMinA = (-520 * (1 - A.p)) - 450;
    void B;
    for (const s of this.subs) {
      const x = ((((s.phase + t * s.speed * s.dir) % A.period) + A.period) % A.period) + xMinA;
      const bob = Math.sin(t * 0.45 + s.phase) * 3.5;
      s.wrap.position.set(x, -(s.yl + bob), 0);
      s.wrap.rotation.z = Math.sin(t * 0.3 + s.phase) * 0.025 * s.dir * -1;
      s.prop.rotation.z = t * 9;
      s.wrap.visible = Math.abs(x + this.entA.position.x - cx) < vw / 2 + 480 && Math.abs(-s.yl - bob + this.entA.position.y + cy) < vh / 2 + 160;
    }
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
    this.visible[3] = nearFloor || camTop < 1150;
  }

  /** divers hunt fish: called from the game loop with real dt */
  stepDivers(dt: number, fish: DiverTarget[], player: DiverTarget | null, hooks: DiverHooks, l: number, t: number, w: number, h: number) {
    if (!this.ready) return;
    this.squad?.step(dt, fish, player, hooks, { l, t, w, h });
    const tt = this.lastT;
    this.jellyFar?.step(dt, tt, WORLD_W * this.ENT_A.p + 1200);
    this.jellyNear?.step(dt, tt, WORLD_W);
  }

  /** near jellyfish (world coords) whose tentacles sting: bell radius s, tentacles hang ~2.4*s below */
  jellyHazards() {
    return this.jellyNear ? this.jellyNear.jellies : [];
  }

  /** the player bounced off a bell */
  bounceJelly(j: ReturnType<LautWorld["jellyHazards"]>[number], nx: number, ny: number, strength = 1) {
    this.jellyNear?.poke(j, nx, ny, strength);
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
