import { SPECIES, SKINS, FRY, skinToSpecies, BOT_NAMES } from "./species";
import type { Species, Skin } from "./species";
import { fishSprite, fishMouthOffset, coinSprite, beginSpriteFrame, spriteBudgetLeft } from "./sprites";
import type { EyeExpr, JawState } from "./sprites";
import { Ocean, WORLD_W, WORLD_H, DEEP_START, floorY, glowOrb, zoneAt, depthMeters } from "./ocean";
import type { ReefCave } from "./ocean";
import { fish3d, disposeFish3DShared, isSoftwareWebGL } from "./fish3d";
import { disposeReef3DRenderer } from "./reef3d";
import { LautWorld } from "./laut/world";
import { SHARED } from "./laut/glsl";

let bubbleStamp: HTMLCanvasElement | null = null;
/** a real-looking air bubble: clear centre, thin bright rim, refracted light pooling at the bottom, crisp specular */
function getBubbleStamp(): HTMLCanvasElement {
  if (bubbleStamp) return bubbleStamp;
  const S = 64;
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const c = cv.getContext("2d")!;
  const cx = S * 0.5,
    cy = S * 0.5,
    r = S * 0.44;
  // faint body tint (water seen through the bubble is a touch brighter)
  const body = c.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
  body.addColorStop(0, "rgba(220, 250, 255, 0.05)");
  body.addColorStop(0.72, "rgba(200, 245, 255, 0.08)");
  body.addColorStop(0.9, "rgba(190, 240, 255, 0.28)");
  body.addColorStop(1, "rgba(180, 235, 255, 0.0)");
  c.fillStyle = body;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
  // refraction: light collects along the lower-right inside edge
  c.save();
  c.beginPath();
  c.arc(cx, cy, r * 0.93, 0, Math.PI * 2);
  c.clip();
  const refr = c.createRadialGradient(cx + r * 0.25, cy + r * 0.3, r * 0.2, cx + r * 0.25, cy + r * 0.3, r * 0.95);
  refr.addColorStop(0, "rgba(255, 255, 255, 0)");
  refr.addColorStop(0.7, "rgba(230, 252, 255, 0.12)");
  refr.addColorStop(1, "rgba(255, 255, 255, 0.55)");
  c.fillStyle = refr;
  c.fillRect(0, 0, S, S);
  c.restore();
  // thin rim, brighter at top-left where the light hits
  const rim = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  rim.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  rim.addColorStop(0.5, "rgba(200, 245, 255, 0.5)");
  rim.addColorStop(1, "rgba(235, 252, 255, 0.85)");
  c.strokeStyle = rim;
  c.lineWidth = S * 0.045;
  c.beginPath();
  c.arc(cx, cy, r * 0.96, 0, Math.PI * 2);
  c.stroke();
  // main specular highlight (elongated) + small secondary glint opposite
  c.save();
  c.translate(cx - r * 0.38, cy - r * 0.4);
  c.rotate(-0.75);
  const hl = c.createRadialGradient(0, 0, 0, 0, 0, r * 0.3);
  hl.addColorStop(0, "rgba(255, 255, 255, 1)");
  hl.addColorStop(0.5, "rgba(255, 255, 255, 0.7)");
  hl.addColorStop(1, "rgba(255, 255, 255, 0)");
  c.fillStyle = hl;
  c.scale(1.6, 1);
  c.beginPath();
  c.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  c.fill();
  c.restore();
  c.fillStyle = "rgba(255, 255, 255, 0.8)";
  c.beginPath();
  c.arc(cx + r * 0.42, cy + r * 0.45, r * 0.07, 0, Math.PI * 2);
  c.fill();
  bubbleStamp = cv;
  return cv;
}

let pearlSprite: HTMLCanvasElement | null = null;
function getPearlSprite(): HTMLCanvasElement {
  if (pearlSprite) return pearlSprite;
  const S = 38; // 2x oversampled for crisp 19x19 draw
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const c = cv.getContext("2d")!;
  const cx = S * 0.5;
  const cy = S * 0.5;
  const pg = c.createRadialGradient(cx - 5.2, cy - 5.6, 1.6, cx, cy, 16.4);
  pg.addColorStop(0, "#ffffff");
  pg.addColorStop(0.42, "#fff7f2");
  pg.addColorStop(0.75, "#f3d8f4");
  pg.addColorStop(0.92, "#b8d4ec");
  pg.addColorStop(1, "#7c94be");
  c.fillStyle = pg;
  c.beginPath();
  c.arc(cx, cy, 15.6, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(255, 255, 255, 0.92)";
  c.lineWidth = 2.1;
  c.stroke();
  pearlSprite = cv;
  return cv;
}
import { sfx } from "./audio";

export const fishLen = (r: number) => r * 2.55 + 3;

export interface Upgrades {
  suck: number;
  speed: number;
  size: number;
}
export interface StartOpts {
  name: string;
  skin: Skin;
  upgrades: Upgrades;
  speedScale?: number;
  bulkScale?: number;
}
export interface LeaderRow {
  name: string;
  score: number;
  me: boolean;
  color: string;
}
export interface HudState {
  coins: number;
  score: number;
  mass: number;
  energy: number;
  combo: number;
  comboT: number;
  frenzyStage: number;
  level: number;
  growthPct: number;
  stageNum: number;
  zoneName: string;
  rank: number;
  total: number;
  leaderboard: LeaderRow[];
  alive: boolean;
  exhausted: boolean;
  boost: number;
  boostExhausted: boolean;
  sucking: boolean;
  boosting: boolean;
  shieldT: number;
  turboT: number;
  vortexT: number;
}
export interface DeathInfo {
  score: number;
  coins: number;
  killer: string;
  killerSpId: string;
  playerSkinId: string;
  playerMode3D: boolean;
  playerName: string;
  maxMass: number;
  eaten: number;
  botsEaten: number;
  maxCombo: number;
  maxDepth: number;
  deepestZone: string;
  stageNum: number;
  bestRank: number;
  schoolSweeps: number;
  time: number;
  reachedRank1: boolean;
  peakLevelTime: number | null;
}
export type GameEvent =
  | { type: "combo"; n: number }
  | { type: "frenzy"; n: number }
  | { type: "levelup"; text: string }
  | { type: "feed"; text: string }
  | { type: "bonus"; title: string; text: string }
  | { type: "coinbump" }
  | { type: "rank1" }
  | { type: "peaklevel"; timeSec: number };

type Kind = "npc" | "bot" | "player";
let NEXT_ID = 1;

class Fish {
  id = NEXT_ID++;
  kind: Kind;
  sp: Species;
  key: string;
  skinRef?: Skin;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  mass: number;
  r: number;
  face = 1;
  tilt = 0;
  tiltV = 0;
  bend = 0;
  bendV = 0;
  sq = 0;
  sqv = 0;
  tailPh = Math.random() * 6;
  jaw = 0;
  jawV = 0;
  mouthOpenT = 0;
  chompT = 0;
  chompQueue = 0; // queued rapid bite snaps (1 snap per fish eaten outside suction mode!)
  chompPhase = 0; // countdown for active snap in queue
  chompDur = 0.13;
  chompBitFired = false;
  biteLunge = 0; // dynamic visual strike lunge along swim heading
  biteLungeV = 0;
  wantOpen = false;
  wantOpenAmt = 0;
  sucking = false;
  suckVis = 0; // smooth 0..1 visual fade for suction mist
  turnFlip = 1; // smooth -1..+1 horizontal turn flip (zero instant mirror snap!)
  turnBend = 0; // signed elastic C-curve spine flex during 180-deg 3D turns
  turnBendV = 0;
  exhausted = false;
  energy = 1;
  boosting = false;
  boostVis = 0; // smooth 0..1 boost surge for rear-40% wiggle
  boost = 1;
  boostExhausted = false;
  boostTrail = 0;
  name = "";
  color = "#fff";
  eatenBy: Fish | null = null;
  eatT = 0;
  eatFromX = 0;
  eatFromY = 0;
  dead = false;
  combo = 0;
  comboT = 0;
  score = 0;
  invuln = 0;
  sucked = 0;
  speedMul = 1;
  suckMul = 1;
  maxR = 999;
  fry = false; // tiny schooling snack fish
  school: School | null = null;
  slotA = 0; // slot (angle / radius) inside the school formation
  speared = false; // stuck on a PENYELAM harpoon line, being reeled in
  slotR = 0;
  gulpT = 0; // 1 -> 0 while a swallowed bite travels down the body as a bulge
  gulpK = 0;
  swallowT = 0; // 1 -> 0 while 3D prey bolus glides past pharynx into esophagus
  gulpColor = "#ff8fa3";
  gulpTailColor = "#ffd166";
  munch = false; // chewing a big mouthful
  slurpCd = 0; // cooldown between two fry swallows (gives the slurp its rhythm)
  hiddenCave: ReefCave | null = null;
  inCaveId: number | null = null;
  ai = { tx: 0, ty: 0, timer: 0, target: null as Fish | null, chase: 0, rest: 0, flee: false };

  constructor(kind: Kind, sp: Species, key: string, x: number, y: number, mass: number) {
    this.kind = kind;
    this.sp = sp;
    this.key = key;
    this.x = x;
    this.y = y;
    this.mass = mass;
    this.r = Math.sqrt(mass);
    this.ai.tx = x;
    this.ai.ty = y;
  }

  mouthOff(): [number, number] {
    return fishMouthOffset(this.sp, fishLen(this.r));
  }
  mouthX() {
    const [ox, oy] = this.mouthOff();
    return this.x + this.face * (ox * Math.cos(this.tilt) - oy * Math.sin(this.tilt));
  }
  mouthY() {
    const [ox, oy] = this.mouthOff();
    return this.y + ox * Math.sin(this.tilt) + oy * Math.cos(this.tilt);
  }
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  type: "bubble" | "bit" | "spark" | "suck" | "ring" | "star" | "streak" | "chomp" | "glint" | "smoke" | "blast";
  color: string;
  size: number;
  dir?: number;
  target?: Fish;
}
interface Mine {
  x: number;
  y: number;
  baseY: number;
  r: number;
  rot: number;
  rotSp: number;
  ph: number;
  tether: number;
}
interface Txt {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  size: number;
}
interface FlyCoin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number; // < 0 while waiting for its staggered pop
  value: number;
  sx: number; // where the swoop to the HUD starts
  sy: number;
  bend: number; // sideways bulge of the swoop
  trail: number;
}
interface School {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  timer: number;
  members: Fish[];
  sp: Species;
  pref: "upper" | "any" | "deep";
  panic: number; // 0 calm .. 1 bait-ball
  swirl: number;
  dir: number;
  size0: number;
  byPlayer: number;
  speed: number;
  golden?: boolean;
}
interface WorldCoin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  value: number;
  settled: boolean;
}
type OrbKind = "pearl" | "turbo" | "vortex" | "shield";
interface OrbItem {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: OrbKind;
  t: number;
  ph: number;
}

export const EAT_RATIO = 0.88;
export const BOT_EAT_RATIO = 0.74; // rival duels (player vs bot / bot vs bot) require clear ~1.35x radius (~1.83x mass) advantage!
const SCHOOL_COUNT = 13;
const LOAD_BUDGET = 12; // ms of world generation per slice so menu UI stays responsive at 60 FPS
const SPRITE_BUDGET = 2;
const MAX_PIXELS = 960_000; // crisp HiDPI cap (~1280x750) for locked 60+ FPS fill-rate
const MENU_MAX_PIXELS = 320_000; // lighter background ocean resolution while main menu overlays the canvas
const Q_SCALE = [1, 0.85, 0.72, 0.58]; // smooth adaptive resolution steps
const GRID_CELL = 140;
const GRID_COLS = Math.ceil(WORLD_W / GRID_CELL) + 1;
const GRID_ROWS = Math.ceil(WORLD_H / GRID_CELL) + 1;
const COIN_POP = 0.42; // seconds a coin spends popping out of the mouth
const COIN_FLY = 0.5; // seconds of the swoop to the coin counter
const ZONE_LABELS = ["Zona Cahaya", "Zona Senja", "Zona Malam", "Palung Abisal"];
const GAIN = 0.115;
const NPC_TARGET = 380;
const NPC_SPEED = 1.0;
const BOT_COUNT = 49; // 49 rival players + you = 50 players in the ocean
const MINE_COUNT = 15; // Feeding Frenzy spiked naval sea mines scattered across all depths
const WORDS = ["NYAM!", "HAP!", "GULP!", "CHOMP!", "YUMMY!", "MANTAP!", "SLURP!"];

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  ocean: Ocean;
  fish: Fish[] = [];
  player: Fish | null = null;
  particles: Particle[] = [];
  texts: Txt[] = [];
  flyCoins: FlyCoin[] = [];
  worldCoins: WorldCoin[] = [];
  orbs: OrbItem[] = [];
  mines: Mine[] = [];
  mineTimers: number[] = [];
  blastFlash = 0;
  orbTimer = 6;
  goldenTimer = 36;
  shieldT = 0;
  stunT = 0; // jellyfish sting: dizzy & paralysed
  stingCd = 0;
  knockT = 0; // bounced off a jellyfish bell: free flight, no steering
  bounceCd = 0;
  turboT = 0;
  vortexT = 0;
  motes: { x: number; y: number; s: number; col: string; orb: HTMLCanvasElement }[] = [];
  respawnQueue: { t: number; name: string; skin: Skin }[] = [];
  schools: School[] = [];
  schoolTimers: number[] = [];
  schoolSeq = 0;
  streamPts = 0; // running totals of the current slurp chain (shown as one summary pop)
  streamCoins = 0;
  streamN = 0;
  streamT = 0;
  chainPop = 0;
  coinChain = 0;
  lastCoinT = 0;
  cam = { x: WORLD_W / 2, y: 520 };
  camLeft = 0;
  camTop = 0;
  zoom = 2.5;
  dpr = 1;
  pixelMode = false;
  reef3D = true;
  /** "Dunia Laut 3D": live three.js water + coral reef (PENYELAM look) behind the 2D arcade layer */
  lautOn = false;
  laut: LautWorld | null = null;
  bgStyle: "game1" | "game2" | "reef_g1" | "shipwreck" | "kelp" | "temple" | "lagoon" = "game1";
  private habitatImg: HTMLImageElement | null = null;
  private shipwreckImg: HTMLImageElement | null = null;
  private kelpImg: HTMLImageElement | null = null;
  private templeImg: HTMLImageElement | null = null;
  private lagoonImg: HTMLImageElement | null = null;
  mode3D = false;
  private live3DBudget = 16;
  vw = 320;
  vh = 180;
  mouse = { x: 0, y: 0, sx: 0, sy: 0, active: false };
  camVel = { x: 0, y: 0 };
  suckInput = false;
  boostInput = false;
  t = 0;
  shake = 0;
  freeze = 0;
  sessionCoins = 0;
  arcadeScore = 0;
  eatenCount = 0;
  botsEatenCount = 0;
  maxCombo = 0;
  maxDepthY = 0;
  bestRank = 99;
  reachedRank1 = false;
  peakLevelTime: number | null = null;
  schoolSweeps = 0;
  playerSkinId = "orange";
  playerMode3D = false;
  maxMass = 0;
  startMass = 58;
  startTime = 0;
  level = 0;
  deathTimer = -1;
  killerName = "";
  killerSpId = "";
  coinTimer = 0;
  hudTimer = 0;
  caveMsgCd = 0;
  caveZoom = 0;
  caveVisAlpha = 0;
  caveSightDir = 1;
  lastCave: ReefCave | null = null;
  private caveMaskCv: HTMLCanvasElement | null = null;
  private caveConeCv: HTMLCanvasElement | null = null;
  last = 0;
  raf = 0;
  minimap: HTMLCanvasElement | null = null;
  miniTimer = 0;
  spectate: Fish | null = null;
  leaderId = -1;
  onHud?: (h: HudState) => void;
  onDeath?: (d: DeathInfo) => void;
  onEvent?: (e: GameEvent) => void;
  /** loading progress 0..1; `ready` flips to true when the ocean is generated and populated */
  onLoad?: (pct: number, ready: boolean) => void;
  ready = false;
  loadPct = 0;
  private loadEmit = -1;
  private warm: (() => void)[] | null = null;
  private mc: MessageChannel | null = null;
  private disposed = false;
  private vis: Fish[] = []; // fish near the view this frame
  private grid: Fish[][] = Array.from({ length: GRID_COLS * GRID_ROWS }, () => []);
  private nearBuf: Fish[] = [];
  private predators: Fish[] = [];
  private labels = new Map<string, { cv: HTMLCanvasElement; w: number; h: number }>();
  private bg: (() => void)[] = []; // sprites still to be rasterised on idle frames
  private dtS = 1 / 60;
  private look = { x: 0, y: 0 }; // smoothed camera look-ahead
  private warmI = 0;
  // adaptive resolution: only engages on devices that cannot hold ~40 fps, and is kept only if it helps
  quality = 0;
  private qAcc = 0;
  private qN = 0;
  private qSlow = 0;
  private qBase = 0;
  private qTrying = false;
  private qLocked = false;
  private qHold = 3;
  menuActive = true;
  menuPaused = false;
  private lastLoadDrawPct = -1;
  private loadTimer: number | null = null;
  speedScale = 1.0;
  bulkScale = 1.7;
  coinHudPos = { x: 900, y: 26 };
  private prevZone = -1;
  private prevPlayerY = 999;

  constructor(canvas: HTMLCanvasElement, init?: { pixelMode?: boolean; reef3D?: boolean; laut?: boolean; bgStyle?: "game1" | "game2" | "reef_g1" | "shipwreck" | "kelp" | "temple" | "lagoon" }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    if (init?.pixelMode !== undefined) this.pixelMode = init.pixelMode;
    if (init?.reef3D !== undefined) this.reef3D = init.reef3D;
    if (init?.bgStyle !== undefined) this.bgStyle = init.bgStyle;
    SHARED.uBgStyle.value =
      this.bgStyle === "game1"
        ? 0
        : this.bgStyle === "shipwreck"
          ? 2
          : this.bgStyle === "kelp"
            ? 3
            : this.bgStyle === "temple"
              ? 4
              : this.bgStyle === "lagoon"
                ? 5
                : 1;
    SHARED.uWaterStyle.value = this.bgStyle === "game2" || this.bgStyle === "kelp" ? 1 : 0;
    if (this.bgStyle !== "game1") this.ensureReefBackdropAssets();
    this.lautOn = !!init?.laut && LautWorld.supported();
    // the painted 3D reef bake is skipped while the live 3D sea is active (it is built lazily if the mode is switched off)
    this.ocean = new Ocean({ pixelMode: this.pixelMode, reef3D: this.reef3D && !this.lautOn, bgStyle: this.bgStyle });
    this.ocean.laut = this.lautOn;
    // make sure the pixel font used by the depth-level HUD is loaded even if no DOM element uses it yet
    try {
      const fonts = (document as unknown as { fonts?: { load: (f: string) => unknown; addEventListener?: (e: string, cb: () => void) => void } }).fonts;
      fonts?.load("8px 'Press Start 2P'");
      // cached text sprites must be redrawn once the web fonts have arrived
      fonts?.addEventListener?.("loadingdone", () => {
        this.labels.clear();
        this.ocean.clearText();
      });
    } catch {
      /* font loading is best-effort */
    }
    const moteCols = ["#cffafe", "#a5f3fc", "#f5d0fe", "#fde68a"];
    const moteOrbs = moteCols.map((col) => glowOrb(col, true));
    for (let i = 0; i < 150; i++) {
      const ci = i % moteCols.length;
      this.motes.push({
        x: Math.random() * 2000,
        y: Math.random() * 1800,
        s: Math.random(),
        col: moteCols[ci],
        orb: moteOrbs[ci],
      });
    }
    // NOTE: the ocean is NOT generated here. loadStep() builds it a few milliseconds per frame (with a
    // progress bar) and then populates it, so opening the page never locks up the browser.
    this.resize(true);
    this.drawLoading();
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    this.pumpLoad();
  }

  /**
   * Schedules the next loading slice. When the interactive menu is open, yields briefly between chunks
   * so carousel scrolling & animations keep a locked 60 FPS while the ocean builds in the background.
   */
  private pumpLoad() {
    if (this.ready || this.disposed) return;
    if (this.menuActive) {
      if (this.loadTimer !== null) clearTimeout(this.loadTimer);
      const sliceBudget = isSoftwareWebGL() ? 16 : 24;
      this.loadTimer = window.setTimeout(() => {
        this.loadTimer = null;
        if (this.ready || this.disposed) return;
        this.loadStep(sliceBudget);
        this.pumpLoad();
      }, 0);
      return;
    }
    if (typeof MessageChannel !== "undefined") {
      if (!this.mc) {
        this.mc = new MessageChannel();
        this.mc.port1.onmessage = () => {
          if (this.ready || this.disposed) return;
          this.loadStep();
          this.pumpLoad();
        };
      }
      this.mc.port2.postMessage(0);
    } else {
      setTimeout(() => {
        if (this.ready || this.disposed) return;
        this.loadStep();
        this.pumpLoad();
      }, 0);
    }
  }

  /** One slice of loading: world generation, then a few essential sprites, then the fish population. */
  loadStep(budgetMs = LOAD_BUDGET) {
    if (this.ready) return;
    const t0 = performance.now();
    if (this.ocean.step(budgetMs)) {
      if (this.lautOn && !this.laut) this.laut = new LautWorld(this.ocean, this.bgStyle);
      let lautDone = true;
      if (this.laut && this.lautOn && !this.laut.ready && !this.laut.failed) lautDone = this.laut.step(Math.max(4, budgetMs - (performance.now() - t0)));
      if (this.laut?.failed) this.lautFailed();
      if (lautDone) {
        if (!this.warm) this.warm = this.warmList();
        beginSpriteFrame(1e9);
        while (this.warmI < this.warm.length && performance.now() - t0 < budgetMs) this.warm[this.warmI++]();
        if (this.warmI >= this.warm.length) this.finishInit();
      }
    }
    const lautP = this.laut && this.lautOn ? this.laut.progress : 1;
    const pct = this.ready
      ? 1
      : this.ocean.progress * 0.85 + lautP * (this.ocean.progress >= 1 ? 0.1 : 0) + (this.warm ? (this.warmI / Math.max(1, this.warm.length)) * 0.05 : 0);
    this.loadPct = pct;
    const ip = Math.floor(pct * 50);
    if (ip !== this.loadEmit || this.ready) {
      this.loadEmit = ip;
      this.onLoad?.(pct, this.ready);
    }
  }

  /** minimal essential sprites needed on frame 0; remaining fish rasterise seamlessly in background idle frames */
  private warmList(): (() => void)[] {
    const jobs: (() => void)[] = [];
    const add = (sp: Species, key: string, r: number) => jobs.push(() => void fishSprite(sp, fishLen(r), 0, 0, key, this.pixelMode, "normal", true));
    for (const sp of FRY) add(sp, sp.id, sp.minR);
    for (let i = 0; i < Math.min(6, SPECIES.length); i++) {
      const sp = SPECIES[i];
      add(sp, sp.id, sp.minR);
    }
    const starterSkin = SKINS.find((s) => s.id === this.playerSkinId) || SKINS[0];
    if (starterSkin) {
      add(skinToSpecies(starterSkin), "bot-" + starterSkin.id, 8);
    }
    if (SKINS[0] && SKINS[0].id !== starterSkin?.id) {
      add(skinToSpecies(SKINS[0]), "bot-" + SKINS[0].id, 8);
    }
    return jobs;
  }

  private finishInit() {
    while (this.fish.length < NPC_TARGET) this.spawnNPC(true);
    for (let i = 0; i < SCHOOL_COUNT; i++) this.spawnSchool(true);
    for (let i = 0; i < MINE_COUNT; i++) this.spawnMine(true);
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < BOT_COUNT; i++) {
      const botSkin = SKINS[i % SKINS.length];
      // skewed toward small fry so a 50-player ocean is still fair to a fresh spawn
      this.spawnBot(names[i % names.length], botSkin, 56 + Math.pow(Math.random(), 2.4) * 640);
    }
    // background queue: base poses & swim frames of every fish type, rasterised smoothly on idle frames
    for (const sp of SPECIES) {
      this.bg.push(() => void fishSprite(sp, fishLen(sp.minR), 0, 0, sp.id, this.pixelMode, "normal", true));
      this.bg.push(() => void fishSprite(sp, fishLen(sp.maxR), 0, 0, sp.id, this.pixelMode, "normal", true));
    }
    for (const sk of SKINS) {
      const sp = skinToSpecies(sk);
      this.bg.push(() => void fishSprite(sp, fishLen(8), 0, 0, "bot-" + sk.id, this.pixelMode, "normal", true));
      this.bg.push(() => void fishSprite(sp, fishLen(14), 0, 0, "bot-" + sk.id, this.pixelMode, "normal", true));
    }
    const q = (sp: Species, key: string, r: number) => {
      for (let tf = 0; tf < 8; tf++) this.bg.push(() => void fishSprite(sp, fishLen(r), 0, (tf + 0.5) * (Math.PI / 4), key, this.pixelMode, "normal", true));
    };
    for (const sk of SKINS) {
      const sp = skinToSpecies(sk);
      q(sp, "bot-" + sk.id, 14);
      q(sp, "bot-" + sk.id, 8);
    }
    for (const sp of SPECIES) {
      q(sp, sp.id, sp.maxR);
      q(sp, sp.id, sp.minR);
    }
    for (const sp of FRY) q(sp, sp.id, sp.minR);
    this.resize(true);
    this.ready = true;
    this.last = performance.now();
    this.mc?.port1.close();
    this.mc = null;
  }

  /** Simple loading screen drawn straight on the game canvas while the ocean is being generated. */
  drawLoading() {
    const ctx = this.ctx,
      W = this.canvas.width,
      H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#49d6f5");
    g.addColorStop(0.45, "#1376cc");
    g.addColorStop(1, "#0b2a7a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const p = this.loadPct;
    const u = Math.max(1, Math.round(H / 240));
    const bw = Math.min(W * 0.6, 150 * u * 2),
      bh = 6 * u,
      bx = Math.round((W - bw) / 2),
      by = Math.round(H * 0.93);
    ctx.fillStyle = "#06143c";
    ctx.fillRect(bx - 2 * u, by - 2 * u, bw + 4 * u, bh + 4 * u);
    ctx.fillStyle = "#123a86";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = "#ffe14a";
    ctx.fillRect(bx, by, Math.round(bw * p), bh);
    ctx.fillStyle = "#fff8c0";
    ctx.fillRect(bx, by, Math.round(bw * p), u);
    const label = p < 0.12 ? "Menumbuhkan karang" : p < 0.43 ? "Memahat tebing laut" : p < 0.8 ? "Menanam terumbu" : p < 0.95 ? "Menata dasar laut" : "Melepas ikan";
    ctx.font = `700 ${7 * u}px 'Fredoka', system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(4, 12, 40, 0.75)";
    ctx.fillText(`${label}… ${Math.floor(p * 100)}%`, W / 2 + u, by - 4 * u + u);
    ctx.fillStyle = "#eaf8ff";
    ctx.fillText(`${label}… ${Math.floor(p * 100)}%`, W / 2, by - 4 * u);
  }

  /**
   * Adaptive resolution. If the device averages under ~40 fps for a few seconds, render fewer pixels.
   * The step is kept only when it measurably helps (otherwise it is reverted and never tried again),
   * so capped / CPU-bound devices do not lose sharpness for nothing.
   */
  trackPerf(rawMs: number) {
    if (this.pixelMode || rawMs <= 0 || rawMs > 250) return; // pixel mode is already tiny; ignore tab switches
    if (this.qHold > 0) {
      this.qHold -= rawMs / 1000; // settle time after loading / after a change
      return;
    }
    this.qAcc += rawMs;
    this.qN++;
    if (this.qAcc < 1500) return;
    const avg = this.qAcc / this.qN;
    this.qAcc = 0;
    this.qN = 0;
    if (this.qTrying) {
      this.qTrying = false;
      if (avg > this.qBase * 0.87) {
        this.quality--; // it did not help: restore full sharpness and stop experimenting
        this.qLocked = true;
        this.qHold = 0.5;
      }
      return;
    }
    if (this.qLocked || this.quality >= Q_SCALE.length - 1) return;
    this.qSlow = avg > 21 ? this.qSlow + 1 : 0;
    if (this.qSlow >= 2) {
      this.qSlow = 0;
      this.qBase = avg;
      this.quality++;
      this.qTrying = true;
      this.qHold = 0.5;
    }
  }

  setPixelMode(pm: boolean) {
    this.pixelMode = pm;
    this.ocean.pixelMode = pm;
    this.ocean.laut = this.lautOn && !pm;
    if (this.ready) this.ocean.ensureMode(this.pixelMode, this.ocean.reef3D);
    const use3D = this.mode3D && !pm;
    this.playerMode3D = use3D;
    for (const f of this.fish) {
      f.sp = { ...f.sp, is3D: use3D };
    }
    this.resize(true);
  }

  setReef3D(v: boolean) {
    this.reef3D = v;
    this.applyReefMode();
  }

  /** switch the live 3D "Dunia Laut" sea on/off (the painted reef underneath is kept in sync) */
  setLaut(v: boolean) {
    v = v && LautWorld.supported();
    this.lautOn = v;
    this.ocean.laut = v && !this.pixelMode;
    if (v && !this.laut && this.ready) this.laut = new LautWorld(this.ocean, this.bgStyle);
    this.applyReefMode();
  }

  setBgStyle(style: "game1" | "game2" | "reef_g1" | "shipwreck" | "kelp" | "temple" | "lagoon") {
    this.bgStyle = style;
    this.ocean.setBgStyle(style);
    SHARED.uBgStyle.value =
      style === "game1" ? 0 : style === "shipwreck" ? 2 : style === "kelp" ? 3 : style === "temple" ? 4 : style === "lagoon" ? 5 : 1;
    SHARED.uWaterStyle.value = style === "game2" || style === "kelp" ? 1 : 0;
    this.laut?.setBgStyle(style);
    if (style !== "game1") this.ensureReefBackdropAssets();
  }

  private ensureReefBackdropAssets() {
    if (typeof Image === "undefined") return;
    if (!this.habitatImg) {
      this.habitatImg = new Image();
      this.habitatImg.src = "/images/reef-habitat.webp";
    }
    if (!this.shipwreckImg) {
      this.shipwreckImg = new Image();
      this.shipwreckImg.src = "/src/assets/images/ancient_shipwreck_bg_1795254425429.jpg";
    }
    if (!this.kelpImg) {
      this.kelpImg = new Image();
      this.kelpImg.src = "/src/assets/images/kelp_cathedral_bg_1795322568135.jpg";
    }
    if (!this.templeImg) {
      this.templeImg = new Image();
      this.templeImg.src = "/src/assets/images/sunken_temple_bg_1795322569079.jpg";
    }
    if (!this.lagoonImg) {
      this.lagoonImg = new Image();
      this.lagoonImg.src = "/src/assets/images/crystal_lagoon_bg_1795322569691.jpg";
    }
  }

  private applyReefMode() {
    const eff = this.reef3D && !this.lautOn;
    this.ocean.reef3D = eff;
    this.ocean.laut = this.lautOn && !this.pixelMode;
    if (this.ready) this.ocean.ensureMode(this.pixelMode, eff);
  }

  /** the 3D sea, once it is fully built and usable for this frame */
  lautActive(): LautWorld | null {
    const l = this.laut;
    if (!this.lautOn || this.pixelMode || !l || !l.ready || l.failed) return null;
    return l;
  }

  setMode3D(on: boolean) {
    this.mode3D = on;
    const use3D = on && !this.pixelMode;
    this.playerMode3D = use3D;
    for (const f of this.fish) {
      f.sp = { ...f.sp, is3D: use3D };
    }
  }

  setMenuMode(on: boolean) {
    if (this.menuActive === on) return;
    this.menuActive = on;
    if (!on) {
      this.menuPaused = false;
      this.last = performance.now();
    } else {
      sfx.setSuck(false);
    }
    this.resize(true);
    if (!this.ready && !on) {
      this.pumpLoad();
    }
  }

  setMenuPaused(paused: boolean) {
    this.menuPaused = paused;
  }

  destroy() {
    this.disposed = true;
    if (this.loadTimer !== null) {
      clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }
    this.mc?.port1.close();
    this.mc = null;
    cancelAnimationFrame(this.raf);
    sfx.setSuck(false);
    sfx.updateAmbience({ inPlay: false, playerY: 500, camTop: 200, sucking: false, boosting: false, ventProx: 0 });
    disposeFish3DShared();
    disposeReef3DRenderer();
    this.laut?.dispose();
    this.laut = null;
  }

  isInsideRock(x: number, y: number, pad: number): boolean {
    for (const form of this.ocean.formations) {
      if (
        x < form.x - pad ||
        x > form.x + form.w + pad ||
        y < form.y - pad ||
        y > form.y + form.h + pad
      ) {
        continue;
      }
      if (this.ocean.sampleRockSDF(form, x, y, false).dist < pad) return true;
    }
    return false;
  }

  pickSpecies(): Species {
    const p = this.player;
    if (p && !p.dead && Math.random() < 0.52) {
      const r = p.r;
      const ok = SPECIES.filter((s) => s.maxR > r * 0.35 && s.minR < r * 1.1);
      if (ok.length) return ok[Math.floor(Math.random() * ok.length)];
    }
    const total = SPECIES.reduce((a, s) => a + s.weight, 0);
    let k = Math.random() * total;
    for (const s of SPECIES) {
      k -= s.weight;
      if (k <= 0) return s;
    }
    return SPECIES[0];
  }

  randomSpawnPos(margin: number, offscreen: boolean, pref: "upper" | "any" | "deep" = "any") {
    const near = offscreen && Math.random() < 0.55;
    for (let i = 0; i < 28; i++) {
      const x = near
        ? clamp(this.cam.x + (Math.random() < 0.5 ? -1 : 1) * (this.vw / 2 + 40 + Math.random() * 380), 50, WORLD_W - 50)
        : 50 + Math.random() * (WORLD_W - 100);
      const fy = floorY(x);
      let yMin = 50 + margin;
      let yMax = fy - 45 - margin;
      if (pref === "upper") yMax = Math.min(yMax, DEEP_START + 80);
      else if (pref === "deep") yMin = Math.max(yMin, DEEP_START + 60);
      if (yMax <= yMin) yMax = yMin + 40;
      const y = yMin + Math.random() * (yMax - yMin);

      if (this.isInsideRock(x, y, margin + 12)) continue;
      if (!offscreen) return { x, y };
      if (Math.abs(x - this.cam.x) > this.vw / 2 + 40 || Math.abs(y - this.cam.y) > this.vh / 2 + 40) return { x, y };
    }
    return { x: 180 + Math.random() * (WORLD_W - 360), y: 240 };
  }

  spawnNPC(initial = false) {
    const baseSp = this.pickSpecies();
    const sp = this.mode3D && !this.pixelMode ? { ...baseSp, is3D: true } : baseSp;
    const r = sp.minR + Math.random() * (sp.maxR - sp.minR);
    const pos = this.randomSpawnPos(r, !initial, sp.deepPref || "any");
    const f = new Fish("npc", sp, sp.id, pos.x, pos.y, r * r);
    f.face = Math.random() < 0.5 ? 1 : -1;
    f.maxR = sp.maxR * 1.25;
    this.fish.push(f);

    const school =
      sp.id === "minnow"
        ? 4 + Math.floor(Math.random() * 6)
        : sp.id === "boris_npc" || sp.id === "andy_npc"
          ? Math.random() < 0.5
            ? 2 + Math.floor(Math.random() * 3)
            : 0
          : 0;
    if (school > 0) {
      for (let i = 0; i < school; i++) {
        const gr = r * (0.88 + Math.random() * 0.24);
        const gx = pos.x + (Math.random() - 0.5) * 42;
        const gy = pos.y + (Math.random() - 0.5) * 28;
        if (this.isInsideRock(gx, gy, gr + 6)) continue;
        const g = new Fish("npc", sp, sp.id, gx, gy, gr * gr);
        g.face = f.face;
        this.fish.push(g);
      }
    }
  }

  // ==========================================================================
  // SNACK SCHOOLS: tight shoals of tiny fish that swirl, flee as a bait-ball and can be vacuumed up
  // ==========================================================================
  spawnSchool(initial = false, golden = false, nearY?: number) {
    const baseSp = FRY[this.schoolSeq++ % FRY.length];
    const sp = this.mode3D && !this.pixelMode ? { ...baseSp, is3D: true } : baseSp;
    const pref = nearY !== undefined ? (nearY > DEEP_START ? "deep" : "upper") : sp.deepPref || "any";
    const pos = this.randomSpawnPos(46, !initial, pref);
    if (nearY !== undefined) {
      pos.y = clamp(nearY + (Math.random() - 0.5) * 140, 65, floorY(pos.x) - 65);
    }
    const n = golden ? 22 : 18 + Math.floor(Math.random() * 13);
    const s: School = {
      x: pos.x,
      y: pos.y,
      vx: (Math.random() < 0.5 ? -1 : 1) * 30,
      vy: 0,
      tx: pos.x,
      ty: pos.y,
      timer: 0,
      members: [],
      sp,
      pref,
      panic: 0,
      swirl: Math.random() * 6.28,
      dir: Math.random() < 0.5 ? 1 : -1,
      size0: n,
      byPlayer: 0,
      speed: sp.speed * (golden ? 0.92 : 0.8),
      golden,
    };
    for (let i = 0; i < n; i++) {
      const r = sp.minR + Math.random() * (sp.maxR - sp.minR);
      const a = i * 2.39996 + Math.random() * 0.4; // golden-angle disc
      const rad = 4 + Math.sqrt((i + 0.5) / n) * 27;
      const f = new Fish("npc", sp, sp.id, pos.x + Math.cos(a) * rad, pos.y + Math.sin(a) * rad * 0.6, r * r);
      f.fry = true;
      f.school = s;
      f.slotA = a;
      f.slotR = rad;
      f.face = s.vx > 0 ? 1 : -1;
      f.maxR = sp.maxR;
      s.members.push(f);
      this.fish.push(f);
    }
    this.schools.push(s);
  }

  spawnOrb(kind?: OrbKind, nearCam = true) {
    const pick: OrbKind =
      kind ?? (Math.random() < 0.4 ? "pearl" : (["turbo", "vortex", "shield"] as const)[Math.floor(Math.random() * 3)]);
    const x = nearCam
      ? clamp(this.cam.x + (Math.random() - 0.5) * this.vw * 1.45, 70, WORLD_W - 70)
      : 70 + Math.random() * (WORLD_W - 140);
    const fy = floorY(x);
    let y =
      pick === "pearl"
        ? clamp(this.cam.y + (Math.random() - 0.25) * this.vh * 0.85, 180, fy - 24)
        : clamp(this.cam.y + (Math.random() - 0.5) * this.vh * 0.9, 85, fy - 75);
    if (this.isInsideRock(x, y, 24)) {
      y = Math.max(85, y - 55);
    }
    this.orbs.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.5) * 8,
      kind: pick,
      t: 0,
      ph: Math.random() * Math.PI * 2,
    });
  }

  spawnMine(initial = false) {
    const r = 13.5 + Math.random() * 2.5;
    for (let attempt = 0; attempt < 36; attempt++) {
      const pos = this.randomSpawnPos(r + 22, !initial, "any");
      const fy = floorY(pos.x);
      const y = clamp(pos.y, 130, fy - 75);
      if (this.isInsideRock(pos.x, y, r + 24)) continue;
      if (this.player && !this.player.dead && Math.hypot(pos.x - this.player.x, y - this.player.y) < 380) continue;
      let tooClose = false;
      for (const m of this.mines) {
        if (Math.hypot(pos.x - m.x, y - m.baseY) < 220) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      this.mines.push({
        x: pos.x,
        y,
        baseY: y,
        r,
        rot: Math.random() * Math.PI * 2,
        rotSp: (Math.random() < 0.5 ? -1 : 1) * (0.14 + Math.random() * 0.14),
        ph: Math.random() * Math.PI * 2,
        tether: Math.min(240, Math.max(45, fy - y)),
      });
      return;
    }
  }

  spawnExplosion(x: number, y: number, rad: number) {
    // 1. Expanding white-gold & orange concussive shockwave rings
    this.spawnRing(x, y, "#ffffff", rad * 1.45);
    this.spawnRing(x, y, "#ff8c2e", rad * 1.05);
    this.spawnRing(x, y, "#ef4444", rad * 0.72);

    // 2. Fiery core explosion puffs (orange -> yellow -> crimson)
    const fireCols = ["#fff7c2", "#fde047", "#fb923c", "#ef4444"];
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 24 + Math.random() * (rad * 2.6);
      const life = 0.28 + Math.random() * 0.28;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        max: life,
        type: "blast",
        color: fireCols[i % fireCols.length],
        size: 8 + Math.random() * 14,
      });
    }

    // 3. Dark smoky soot clouds billowing underwater
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 18 + Math.random() * 88;
      const life = 0.65 + Math.random() * 0.55;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 16,
        life,
        max: life,
        type: "smoke",
        color: i % 3 === 0 ? "#475569" : "#1e293b",
        size: 10 + Math.random() * 14,
      });
    }

    // 4. Shrapnel sparks & rapid blast bubbles
    this.spawnSparks(x, y, "#fde047", 24);
    this.spawnSparks(x, y, "#f97316", 18);
    for (let i = 0; i < 18; i++) {
      const bb = this.bubble(x + (Math.random() - 0.5) * 18, y + (Math.random() - 0.5) * 18, 1.5 + Math.random() * 2.8);
      bb.vx = (Math.random() - 0.5) * 110;
      bb.vy = -40 - Math.random() * 80;
      this.particles.push(bb);
    }
  }

  updateSchools(dt: number, threats: Fish[], attract = false) {
    const nearX = this.vw * 0.85 + 160;
    const nearY = this.vh * 0.85 + 160;
    for (const s of this.schools) {
      s.members = s.members.filter((m) => !m.dead);
      if (!s.members.length) continue;
      if (attract && (Math.abs(s.x - this.cam.x) > nearX || Math.abs(s.y - this.cam.y) > nearY)) continue;
      // anything big enough to eat them makes the whole school bolt and ball up
      let fx = 0,
        fy = 0,
        danger = 0;
      for (const o of threats) {
        if (o.fry || o.r < 3.6) continue;
        const dx = s.x - o.x,
          dy = s.y - o.y;
        const R = 62 + o.r * 2.2;
        if (Math.abs(dx) > R || Math.abs(dy) > R) continue;
        const d = Math.hypot(dx, dy);
        if (d < R) {
          const k = 1 - d / R;
          fx += (dx / (d || 1)) * k;
          fy += (dy / (d || 1)) * k;
          if (k > danger) danger = k;
        }
      }
      const scared = danger > 0.05;
      s.panic += ((scared ? 1 : 0) - s.panic) * Math.min(1, dt * (scared ? 5 : 1.1));
      s.timer -= dt;
      if (scared) {
        const d = Math.hypot(fx, fy) || 1;
        s.tx = clamp(s.x + (fx / d) * 170, 60, WORLD_W - 60);
        s.ty = s.y + (fy / d) * 120;
        s.timer = 0.8;
      } else if (s.timer <= 0 || Math.hypot(s.tx - s.x, s.ty - s.y) < 26) {
        s.tx = clamp(s.x + (Math.random() - 0.5) * 560, 80, WORLD_W - 80);
        const yMin = s.pref === "deep" ? DEEP_START + 80 : 70;
        const yMax = s.pref === "upper" ? DEEP_START + 40 : floorY(s.tx) - 80;
        s.ty = clamp(s.y + (Math.random() - 0.5) * 240, yMin, Math.max(yMin + 10, Math.min(yMax, floorY(s.tx) - 80)));
        s.timer = 3.5 + Math.random() * 4;
      }
      const dx = s.tx - s.x,
        dy = s.ty - s.y,
        d = Math.hypot(dx, dy) || 1;
      const sp = s.speed * (1 + s.panic * 0.55);
      const k = Math.min(1, dt * 1.7);
      s.vx += ((dx / d) * sp - s.vx) * k;
      s.vy += ((dy / d) * sp * 0.75 - s.vy) * k;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      for (const form of this.ocean.formations) {
        const pad = 34;
        if (
          s.x < form.x - pad ||
          s.x > form.x + form.w + pad ||
          s.y < form.y - pad ||
          s.y > form.y + form.h + pad
        ) {
          continue;
        }
        const hit = this.ocean.sampleRockSDF(form, s.x, s.y, false);
        if (hit.dist < pad) {
          const pen = pad - hit.dist;
          s.x += hit.nx * pen;
          s.y += hit.ny * pen;
        }
      }
      s.x = clamp(s.x, 50, WORLD_W - 50);
      s.y = clamp(s.y, 44, floorY(s.x) - 56);
      s.swirl += dt * (0.45 + s.panic * 2.4) * s.dir;
    }
    // emptied (or nearly emptied & far away) schools are replaced somewhere off-screen
    for (let i = this.schools.length - 1; i >= 0; i--) {
      const s = this.schools[i];
      const far = Math.abs(s.x - this.cam.x) > this.vw * 0.9 || Math.abs(s.y - this.cam.y) > this.vh * 0.9;
      if (s.members.length === 0 || (s.members.length < 5 && far)) {
        for (const m of s.members) m.dead = true;
        this.schools.splice(i, 1);
        this.schoolTimers.push(3 + Math.random() * 5);
      }
    }
    for (let i = this.schoolTimers.length - 1; i >= 0; i--) {
      this.schoolTimers[i] -= dt;
      if (this.schoolTimers[i] <= 0) {
        this.schoolTimers.splice(i, 1);
        this.spawnSchool();
      }
    }
  }

  /** Each fry holds a slot on a slowly swirling ellipse (stretched along the heading) around the school centre. */
  fryAI(f: Fish, dt: number) {
    const s = f.school;
    if (!s || f.sucked > 0) return; // being vacuumed: pure physics
    const hs = Math.hypot(s.vx, s.vy) || 1,
      ux = s.vx / hs,
      uy = s.vy / hs;
    const ang = f.slotA + s.swirl,
      spread = 1 + s.panic * 0.3;
    const lx = Math.cos(ang) * f.slotR * 1.45 * spread,
      ly = Math.sin(ang) * f.slotR * 0.72 * spread;
    const tx = s.x + ux * lx - uy * ly + s.vx * 0.25,
      ty = s.y + uy * lx + ux * ly + s.vy * 0.25 + Math.sin(this.t * 2.6 + f.id) * 1.5;
    const ax = tx - f.x,
      ay = ty - f.y,
      d = Math.hypot(ax, ay) || 1;
    const ms = s.speed * (1.05 + s.panic * 0.6) * Math.min(1.35, 0.45 + d / 22);
    const near = clamp(1 - d / 14, 0, 1);
    let vx = (ax / d) * ms * (1 - near) + s.vx * near,
      vy = (ay / d) * ms * (1 - near) + s.vy * near;
    // cheap stochastic separation so the shoal never clumps into one blob
    for (let k = 0; k < 2; k++) {
      const o = s.members[(Math.random() * s.members.length) | 0];
      if (!o || o === f) continue;
      const ex = f.x - o.x,
        ey = f.y - o.y,
        dd = ex * ex + ey * ey;
      if (dd < 30 && dd > 0.01) {
        const q = Math.sqrt(dd);
        vx += (ex / q) * (5.5 - q) * 10;
        vy += (ey / q) * (5.5 - q) * 10;
      }
    }
    const k2 = Math.min(1, dt * 4);
    f.vx += (vx - f.vx) * k2;
    f.vy += (vy - f.vy) * k2;
  }

  /** Clean sweep: the player vacuumed (almost) a whole school -> coin shower + banner */
  schoolBonus(s: School, x: number, y: number) {
    this.schoolSweeps++;
    const bonus = 5 + Math.round(s.size0 * 0.3);
    const n = Math.min(bonus, 14);
    for (let i = 0; i < n; i++) this.addFlyCoin(x, y, Math.floor(bonus / n) + (i < bonus % n ? 1 : 0), 0.15 + i * 0.05, 0);
    this.arcadeScore += s.size0 * 60;
    this.texts.push({ x, y: y - 30, text: "SAPU BERSIH!", color: "#7dffb0", life: 1.6, max: 1.6, size: 13 });
    this.texts.push({ x, y: y - 16, text: "+" + bonus + " koin", color: "#ffe14a", life: 1.6, max: 1.6, size: 9 });
    this.spawnSparks(x, y, "#7dffb0", 20);
    this.spawnSparks(x, y, "#ffe14a", 14);
    this.spawnRing(x, y, "#ffffff", 26);
    this.shake = Math.min(3.5, this.shake + 2);
    sfx.bonus();
    this.onEvent?.({ type: "bonus", title: "SAPU BERSIH!", text: `Segerombolan ${s.sp.name} habis disedot · +${bonus} koin` });
  }

  spawnBot(name: string, skin: Skin, mass: number) {
    const sp = skinToSpecies(skin, this.mode3D && !this.pixelMode);
    const pos = this.randomSpawnPos(24, true, "any");
    const f = new Fish("bot", sp, "bot-" + skin.id, pos.x, pos.y, mass);
    f.skinRef = skin;
    f.name = name;
    f.color = skin.pal.body;
    f.speedMul = 0.9;
    f.maxR = 62;
    f.invuln = 2;
    this.fish.push(f);
  }

  start(opts: StartOpts) {
    if (!this.ready) return; // still generating the ocean
    if (this.player) this.player.dead = true;
    const want3D = opts.skin.is3D !== undefined ? !!opts.skin.is3D : this.mode3D;
    if (want3D !== this.mode3D) this.setMode3D(want3D);
    const sp = skinToSpecies(opts.skin, this.mode3D && !this.pixelMode);
    const pos = this.randomSpawnPos(65, false, "upper");
    pos.y = clamp(pos.y, 180, 660);
    if (this.isInsideRock(pos.x, pos.y, 65)) {
      pos.x = 980;
      pos.y = 320;
    }
    const mass = 58 + opts.upgrades.size * 14;
    const p = new Fish("player", sp, "player-" + opts.skin.id, pos.x, pos.y, mass);
    p.skinRef = opts.skin;
    p.name = opts.name || "Kamu";
    p.color = "#ffffff";
    this.speedScale = clamp(opts.speedScale ?? this.speedScale ?? 1.0, 0.7, 1.8);
    this.bulkScale = clamp(opts.bulkScale ?? this.bulkScale ?? 1.7, 0.7, 2.5);
    p.speedMul = (1 + opts.upgrades.speed * 0.07) * this.speedScale;
    p.suckMul = 1 + opts.upgrades.suck * 0.16;
    p.invuln = 3.5;
    p.maxR = 68;
    this.player = p;
    p.turnFlip = p.face;
    this.fish.push(p);
    this.resize(true);
    this.camVel.x = 0;
    this.camVel.y = 0;
    if (this.mouse.active) {
      this.mouse.sx = this.mouse.x;
      this.mouse.sy = this.mouse.y;
      const W = Math.max(1, window.innerWidth);
      const H = Math.max(1, window.innerHeight);
      const initOffX = clamp((this.mouse.sx / W - 0.5) * this.vw, -this.vw * 0.35, this.vw * 0.35);
      const initOffY = clamp((this.mouse.sy / H - 0.5) * this.vh, -this.vh * 0.35, this.vh * 0.35);
      const minCamX = this.vw >= WORLD_W ? WORLD_W / 2 : this.vw / 2;
      const maxCamX = this.vw >= WORLD_W ? WORLD_W / 2 : WORLD_W - this.vw / 2;
      this.cam.x = clamp(p.x - initOffX, minCamX, maxCamX);
      this.cam.y = clamp(p.y - initOffY, -34 + this.vh / 2, WORLD_H + 35 - this.vh / 2);
    } else {
      this.cam.x = p.x;
      this.cam.y = p.y;
    }
    this.look.x = this.look.y = 0;
    this.sessionCoins = 0;
    this.arcadeScore = 0;
    this.eatenCount = 0;
    this.botsEatenCount = 0;
    this.maxCombo = 0;
    this.maxDepthY = p.y;
    this.bestRank = 50;
    this.reachedRank1 = false;
    this.peakLevelTime = null;
    this.schoolSweeps = 0;
    this.playerSkinId = opts.skin.id;
    this.playerMode3D = !!opts.skin.is3D;
    this.killerName = "";
    this.killerSpId = "";
    this.stunT = 0;
    this.stingCd = 0;
    this.knockT = 0;
    this.bounceCd = 0;
    this.startMass = mass;
    this.maxMass = mass;
    this.startTime = this.t;
    this.deathTimer = -1;
    this.level = this.calcLevel(p.r);
    this.prevZone = zoneAt(p.y);
    this.prevPlayerY = p.y;
    this.flyCoins = [];
    this.orbs = [];
    this.mines = [];
    this.mineTimers = [];
    this.blastFlash = 0;
    this.orbTimer = 5;
    this.goldenTimer = 36;
    this.shieldT = 0;
    this.turboT = 0;
    this.vortexT = 0;
    this.caveZoom = 0;
    this.caveVisAlpha = 0;
    this.caveSightDir = 1;
    this.lastCave = null;
    this.streamPts = this.streamCoins = this.streamN = 0;
    this.coinChain = 0;
    for (let i = 0; i < MINE_COUNT; i++) this.spawnMine(true);
    for (const f of this.fish) {
      if (f !== p && f.r > p.r && Math.hypot(f.x - p.x, f.y - p.y) < 480) {
        const np = this.randomSpawnPos(f.r, true);
        f.x = np.x;
        f.y = np.y;
      }
    }
    this.spawnOrb("pearl", true);
    this.spawnOrb("shield", true);
    this.spawnRing(p.x, p.y, "#a5f3fc", 16);
    this.emitHud();
    sfx.spawn();
  }

  calcLevel(r: number) {
    return SPECIES.filter((s) => s.minR < r * EAT_RATIO).length;
  }

  calcGrowthPct(r: number): number {
    let prevR = 6.5;
    for (let i = 0; i < SPECIES.length; i++) {
      const needR = SPECIES[i].minR / EAT_RATIO;
      if (r < needR) {
        const prevMass = prevR * prevR;
        const needMass = needR * needR;
        const curMass = r * r;
        return clamp((curMass - prevMass) / Math.max(1, needMass - prevMass), 0, 1);
      }
      prevR = needR;
    }
    return 1;
  }

  setSuck(on: boolean) {
    this.suckInput = on;
  }

  setBoost(on: boolean) {
    this.boostInput = on;
  }

  setSpeedScale(s: number, upgradeLv = 0) {
    this.speedScale = clamp(s, 0.7, 1.8);
    if (this.player && !this.player.dead) {
      this.player.speedMul = (1 + upgradeLv * 0.07) * this.speedScale;
    }
  }

  setBulkScale(s: number) {
    this.bulkScale = clamp(s, 0.7, 2.5);
  }

  applyBoost(f: Fish, want: boolean, dt: number) {
    const wasBoost = f.boosting;
    const freeTurbo = f === this.player && this.turboT > 0;
    if (freeTurbo) {
      f.boost = 1;
      f.boostExhausted = false;
    }
    if (want && !f.boostExhausted && f.boost > 0) {
      f.boosting = true;
      if (!freeTurbo) f.boost -= dt * 0.55;
      if (f.boost <= 0) {
        f.boost = 0;
        f.boostExhausted = true;
        f.boosting = false;
      }
    } else {
      f.boosting = false;
      f.boost = Math.min(1, f.boost + dt * 0.24);
      if (f.boostExhausted && f.boost > 0.35) f.boostExhausted = false;
    }
    if (f.boosting && !wasBoost) {
      f.sqv -= 6;
      const onScreen = !this.menuActive && Math.abs(f.x - this.cam.x) < this.vw / 2 + 20 && Math.abs(f.y - this.cam.y) < this.vh / 2 + 20;
      if (onScreen) {
        sfx.whoosh(f === this.player);
        const bx = f.x - f.face * f.r;
        for (let i = 0; i < 8; i++) {
          this.particles.push(this.bubble(bx + (Math.random() - 0.5) * f.r, f.y + (Math.random() - 0.5) * f.r, 1 + Math.random() * 2));
        }
        this.spawnRing(bx, f.y, "#bff8ff", f.r * 0.65);
      }
    }
  }

  /** WebGL refused to build the live 3D sea: fall back to the painted reef */
  private lautFailed() {
    this.lautOn = false;
    this.ocean.laut = false;
    this.laut = null;
    this.applyReefMode();
    this.onLautFailed?.();
  }
  onLautFailed?: () => void;

  loop(now: number) {
    const ts = Number.isFinite(now) ? now : performance.now();
    const raw = ts - this.last;
    if (!this.ready) {
      this.last = ts;
      if (!this.menuActive || Math.abs(this.loadPct - this.lastLoadDrawPct) >= 0.06 || this.lastLoadDrawPct < 0) {
        this.lastLoadDrawPct = this.loadPct;
        this.drawLoading();
      }
      this.raf = requestAnimationFrame(this.loop);
      return;
    }
    if (this.lautOn && this.laut && !this.laut.ready && !this.laut.failed) {
      // finish (or lazily build) the 3D sea in small slices while the painted reef keeps the game alive
      this.laut.step(5);
      if (this.laut.failed) this.lautFailed();
    }
    if (this.menuActive) {
      if (this.menuPaused || document.hidden) {
        this.last = ts;
        this.raf = requestAnimationFrame(this.loop);
        return;
      }
      // Smooth ~28 FPS live ocean attract mode behind the wooden menu so fish & reefs stay alive without starving 60 FPS UI
      if (raw < 36) {
        this.raf = requestAnimationFrame(this.loop);
        return;
      }
      const dtMenu = clamp(raw / 1000, 0.008, 0.05);
      this.last = ts;
      this.update(dtMenu);
      this.render();
      this.raf = requestAnimationFrame(this.loop);
      return;
    }
    let dt = Number.isFinite(raw) ? raw / 1000 : 1 / 60;
    this.last = ts;
    this.trackPerf(raw);
    if (dt < 0) dt = 0;
    else if (dt > 0.05) dt = 0.05;
    // frame-time smoothing: responsive yet smooth against timer jitter
    if (!Number.isFinite(this.dtS) || this.dtS < 0) this.dtS = dt;
    else this.dtS += (dt - this.dtS) * 0.48;
    dt = Math.max(0, this.dtS);
    if (this.freeze > 0) {
      this.freeze -= dt;
    } else {
      this.update(dt);
    }
    this.render();
    // idle-time sprite warming during gameplay
    if (this.bg.length && spriteBudgetLeft() > 0) this.bg.pop()!();
    this.raf = requestAnimationFrame(this.loop);
  }

  resize(instant = false) {
    const focus = this.player && !this.player.dead ? this.player : this.spectate;
    const r = focus ? focus.r : 9;
    const zoomBoost = 1 + this.caveZoom * 0.44;
    const viewH = clamp(275 + (r - 7.6) * 4.5, 275, 650) / zoomBoost;
    const W = Math.max(1, window.innerWidth);
    const H = Math.max(1, window.innerHeight);
    const targetZoom = Math.max(1, Math.min(H / viewH, W / (viewH * 1.25)));
    this.zoom = instant ? targetZoom : this.zoom + (targetZoom - this.zoom) * 0.1;

    this.coinHudPos = { x: Math.min(W - 38, W / 2 + 465), y: 26 };

    if (this.pixelMode) {
      const qps = Math.max(1, Math.round(this.zoom * 20) / 20);
      const cw = Math.ceil(W / qps);
      const ch = Math.ceil(H / qps);
      if (this.canvas.width !== cw || this.canvas.height !== ch) {
        this.canvas.width = cw;
        this.canvas.height = ch;
      }
      this.dpr = 1;
      this.vw = cw;
      this.vh = ch;
    } else {
      const capPx = this.menuActive ? MENU_MAX_PIXELS : MAX_PIXELS;
      const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(capPx / (W * H))) * Q_SCALE[this.quality];
      const cw = Math.round(W * dpr);
      const ch = Math.round(H * dpr);
      if (this.canvas.width !== cw || this.canvas.height !== ch) {
        this.canvas.width = cw;
        this.canvas.height = ch;
      }
      this.dpr = dpr;
      this.vw = W / this.zoom;
      this.vh = H / this.zoom;
    }
  }

  // Exact gap-free SDF collision against every rock formation & cave ceiling/floor/walls
  resolveRockCollisions(f: Fish) {
    const fr = Math.max(4, f.r * 0.72);
    for (const form of this.ocean.formations) {
      const margin = fr + 46;
      if (
        f.x < form.x - margin ||
        f.x > form.x + form.w + margin ||
        f.y < form.y - margin ||
        f.y > form.y + form.h + margin
      ) {
        continue;
      }
      const cave = form.cave;
      // Keep cave passable if fish fits maxR OR is already inside this cave (growing inside never traps!)
      const useCave = !!cave && (f.r <= cave.maxR || f.inCaveId === cave.id);
      for (let pass = 0; pass < 3; pass++) {
        const hit = this.ocean.sampleRockSDF(form, f.x, f.y, useCave);
        if (hit.dist < fr) {
          const pen = fr - hit.dist;
          f.x += hit.nx * pen;
          f.y += hit.ny * pen;
          const vn = f.vx * hit.nx + f.vy * hit.ny;
          if (vn < 0) {
            f.vx -= hit.nx * vn * 1.08;
            f.vy -= hit.ny * vn * 1.08;
          }
        } else {
          break;
        }
      }
    }
  }

  update(dt: number) {
    this.t += dt;
    this.caveMsgCd = Math.max(0, this.caveMsgCd - dt);
    this.resize();
    const p = this.player;

    if (!p || p.dead) {
      if (!this.spectate || this.spectate.dead || (!p && this.spectate.y > 560)) {
        const bots = this.fish.filter((f) => f.kind === "bot" && !f.dead && (!p ? f.y < 500 : true));
        const pool = bots.length ? bots : this.fish.filter((f) => f.kind === "bot" && !f.dead);
        pool.sort((a, b) => b.mass - a.mass);
        this.spectate = pool[Math.floor(Math.random() * Math.min(4, pool.length))] || null;
      }
    }

    if (p && !p.dead && !p.eatenBy) {
      this.applyBoost(p, this.boostInput, dt);
      const W = Math.max(1, window.innerWidth);
      const H = Math.max(1, window.innerHeight);

      // Direct zero-latency mouse coordinates so cursor tracking never lags behind fast flicks
      if (this.mouse.active) {
        this.mouse.sx = this.mouse.x;
        this.mouse.sy = this.mouse.y;
      }

      const ms = this.maxSpeed(p);
      const minCamX = this.vw >= WORLD_W ? WORLD_W / 2 : this.vw / 2;
      const maxCamX = this.vw >= WORLD_W ? WORLD_W / 2 : WORLD_W - this.vw / 2;
      const minCamY = -34 + this.vh / 2;
      const maxCamY = WORLD_H + 35 - this.vh / 2;

      // 0. STUNG BY A JELLYFISH / STUCK ON A HARPOON: no control, twitching drift
      const lost = this.stunT > 0 || p.speared || this.knockT > 0;
      if (lost) {
        if (this.knockT > 0 && this.stunT <= 0 && !p.speared) {
          // ballistic bounce: keep flying, slow water drag, spin the face with the motion
          p.vx *= Math.exp(-1.1 * dt);
          p.vy *= Math.exp(-1.1 * dt);
          p.vy += 30 * dt;
          if (Math.abs(p.vx) > 20) p.face = p.vx > 0 ? 1 : -1;
        } else if (!p.speared) {
          p.vx += (Math.sin(this.t * 37) * 26 - p.vx) * Math.min(1, dt * 4);
          p.vy += (Math.cos(this.t * 29) * 20 + 14 - p.vy) * Math.min(1, dt * 4);
          p.face = Math.sin(this.t * 2.3) > 0 ? 1 : -1;
        }
        p.sucking = false;
        p.boosting = false;
      } else if (this.mouse.active) {
        const baseCamLeft = this.vw >= WORLD_W ? (WORLD_W - this.vw) / 2 : clamp(this.cam.x - this.vw / 2, 0, WORLD_W - this.vw);
        const baseCamTop = clamp(this.cam.y - this.vh / 2, -34, WORLD_H + 35 - this.vh);
        const tx = clamp(baseCamLeft + (this.mouse.sx / W) * this.vw, p.r, WORLD_W - p.r);
        const ty = clamp(baseCamTop + (this.mouse.sy / H) * this.vh, 14 + p.r * 0.5, floorY(tx) - p.r * 0.6);
        const dx = tx - p.x,
          dy = ty - p.y;
        const dist = Math.hypot(dx, dy);
        const dead = 1.2;
        const full = this.vw * 0.05;
        // High-response spring velocity + smooth cruise curve: moves as fast & crisp as the mouse!
        const catchUp = Math.min(ms * 3.1, Math.max(0, dist - dead) * 11.5);
        const cruise = ms * Math.pow(Math.min(1, Math.max(0, dist - dead) / full), 0.52);
        const want = dist <= dead ? 0 : Math.max(cruise, catchUp);
        const tvx = dist > 0.01 ? (dx / dist) * want : 0;
        const tvy = dist > 0.01 ? (dy / dist) * want : 0;
        const vMag = Math.hypot(p.vx, p.vy);
        const turning = want > 1 && vMag > 6 && (tvx * p.vx + tvy * p.vy) / (want * vMag) < 0.5;
        const rate = want === 0 ? 24 : turning ? (p.boosting ? 50 : 44) : p.boosting ? 38 : 34;
        const acc = 1 - Math.exp(-rate * dt);
        p.vx += (tvx - p.vx) * acc;
        p.vy += (tvy - p.vy) * acc;

        const stepX = p.vx * dt,
          stepY = p.vy * dt;
        const steps = Math.min(10, Math.max(1, Math.ceil(Math.hypot(stepX, stepY) / 4.5)));
        for (let k = 0; k < steps; k++) {
          p.x += stepX / steps;
          p.y += stepY / steps;
          this.resolveRockCollisions(p);
          const fy = floorY(p.x) - p.r * 0.6;
          if (p.y > fy) p.y = fy;
          if (p.y < 14 + p.r * 0.5) p.y = 14 + p.r * 0.5;
          p.x = clamp(p.x, p.r, WORLD_W - p.r);
        }

        const flipDeadX = Math.max(1.2, Math.abs(dy) * 0.045);
        if (dx > flipDeadX || (Math.abs(dx) > 0.6 && p.vx > 12)) p.face = 1;
        else if (dx < -flipDeadX || (Math.abs(dx) > 0.6 && p.vx < -12)) p.face = -1;
      } else if (p.boosting) {
        p.vx = p.face * ms;
        p.vy = 0;
        p.x = clamp(p.x + p.vx * dt, p.r, WORLD_W - p.r);
        this.resolveRockCollisions(p);
      } else {
        p.vx *= Math.exp(-8 * dt);
        p.vy *= Math.exp(-8 * dt);
      }

      const prevCave = p.hiddenCave;
      p.hiddenCave = this.getCaveAt(p.x, p.y, p.r, p.inCaveId);
      if (p.hiddenCave) {
        p.inCaveId = p.hiddenCave.id;
        this.lastCave = p.hiddenCave;
        p.energy = Math.min(1, p.energy + dt * 0.22);
        p.boost = Math.min(1, p.boost + dt * 0.2);
        if (!prevCave && this.caveMsgCd <= 0) {
          this.caveMsgCd = 2.4;
          this.texts.push({ x: p.x, y: p.y - p.r - 14, text: "TERSEMBUNYI!", color: "#5eead4", life: 1.1, max: 1.1, size: 9.5 });
        }
      } else if (p.inCaveId !== null) {
        const fm = this.ocean.formations.find((form) => form.cave?.id === p.inCaveId);
        if (!fm || this.ocean.sampleRockSDF(fm, p.x, p.y, false).dist > p.r * 0.85) {
          p.inCaveId = null;
        }
      }

      const hiding = !!p.hiddenCave;
      const zRate = 1 - Math.exp(-(hiding ? 4.8 : 3.4) * dt);
      this.caveZoom += ((hiding ? 1 : 0) - this.caveZoom) * zRate;
      if (!hiding && this.caveZoom < 0.002) this.caveZoom = 0;
      const vRate = 1 - Math.exp(-(hiding ? 6.5 : 4.2) * dt);
      this.caveVisAlpha += ((hiding ? 1 : 0) - this.caveVisAlpha) * vRate;
      if (!hiding && this.caveVisAlpha < 0.002) {
        this.caveVisAlpha = 0;
        this.lastCave = null;
      }
      if (this.lastCave) {
        const targetDir =
          this.lastCave.kind === "alcove"
            ? this.lastCave.dir >= 0
              ? 1
              : -1
            : Math.abs(p.x - this.lastCave.x) > 12
              ? p.x >= this.lastCave.x
                ? 1
                : -1
              : p.face;
        this.caveSightDir += (targetDir - this.caveSightDir) * (1 - Math.exp(-8.5 * dt));
      }

      // 2. CAMERA: silky locked-on follow + subtle framing toward cave entrance while hiding
      const lk = 1 - Math.exp(-10 * dt);
      this.look.x += (p.vx * 0.09 - this.look.x) * lk;
      this.look.y += (p.vy * 0.07 - this.look.y) * lk;
      const mouthBiasX = this.lastCave ? this.caveSightDir * Math.min(46, this.vw * 0.14) * this.caveZoom : 0;
      const follow = 1 - Math.exp(-16 * dt);
      this.cam.x += (clamp(p.x + this.look.x + mouthBiasX, minCamX, maxCamX) - this.cam.x) * follow;
      this.cam.y += (clamp(p.y + this.look.y, minCamY, maxCamY) - this.cam.y) * follow;

      this.applySuckState(p, this.suckInput, dt);
      sfx.setSuck(p.sucking);
    } else {
      if (p) {
        p.hiddenCave = null;
        p.inCaveId = null;
      }
      this.caveZoom += (0 - this.caveZoom) * Math.min(1, dt * 4);
      this.caveVisAlpha += (0 - this.caveVisAlpha) * Math.min(1, dt * 5);
      if (this.caveVisAlpha < 0.002) {
        this.caveVisAlpha = 0;
        this.lastCave = null;
      }
      sfx.setSuck(false);
    }

    const attract = this.menuActive;
    const nearX = this.vw * 0.8 + 140;
    const nearY = this.vh * 0.8 + 140;

    this.rebuildGrid(attract, nearX, nearY);
    const predators = this.predators;
    predators.length = 0;
    for (let i = 0; i < this.fish.length; i++) {
      const f = this.fish[i];
      if (!f.dead && !f.eatenBy && (f.kind !== "npc" || f.sp.predator)) {
        if (attract && (Math.abs(f.x - this.cam.x) > nearX || Math.abs(f.y - this.cam.y) > nearY)) continue;
        predators.push(f);
      }
    }
    this.updateSchools(dt, predators, attract);
    for (const f of this.fish) {
      if (f.dead || f.eatenBy || f.kind === "player") continue;
      if (attract && (Math.abs(f.x - this.cam.x) > nearX || Math.abs(f.y - this.cam.y) > nearY)) continue;
      f.ai.timer -= dt;
      if (f.kind === "bot") this.botAI(f, dt);
      else if (f.fry) this.fryAI(f, dt);
      else this.npcAI(f, dt, predators);
    }

    for (const f of this.fish) {
      if (f.sucking && !f.dead && !f.eatenBy) {
        if (attract && (Math.abs(f.x - this.cam.x) > nearX || Math.abs(f.y - this.cam.y) > nearY)) continue;
        this.doSuck(f, dt);
      }
    }

    for (const f of this.fish) {
      if (f.dead) continue;
      if (attract && !f.eatenBy && (Math.abs(f.x - this.cam.x) > nearX || Math.abs(f.y - this.cam.y) > nearY)) continue;
      if (f.eatenBy) {
        f.eatT += dt / (f.fry ? 0.105 : 0.165);
        if (f.eatT >= 1) this.finishEat(f.eatenBy, f);
        continue;
      }
      if (f.speared) {
        // dragged along the harpoon line by the diver
        f.vx = 0;
        f.vy = 0;
        f.sq = Math.sin(this.t * 30) * 0.2;
        continue;
      }
      const isDirectPlayer = f === p && this.mouse.active && this.stunT <= 0 && this.knockT <= 0;
      if (!isDirectPlayer) {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        this.resolveRockCollisions(f);

        const fy = floorY(f.x) - f.r * 0.6;
        if (f.y > fy) {
          f.y = fy;
          f.vy = Math.min(0, f.vy);
        }
        if (f.y < 14 + f.r * 0.5) {
          f.y = 14 + f.r * 0.5;
          f.vy = Math.max(0, f.vy);
        }
        if (f.x < f.r) {
          f.x = f.r;
          f.vx = Math.abs(f.vx);
        }
        if (f.x > WORLD_W - f.r) {
          f.x = WORLD_W - f.r;
          f.vx = -Math.abs(f.vx);
        }
      }
      const sp = Math.hypot(f.vx, f.vy);
      if (!isDirectPlayer && Math.abs(f.vx) > 6 && !(f.kind === "npc" && f.sucked > 0)) f.face = f.vx > 0 ? 1 : -1;

      // Smooth 3D-like turn flip (-1 .. +1), C1-smooth spring pitch angle, and ragdoll spine curvature
      const flipSpeed = f.sp.is3D
        ? (f.kind === "player" ? 7.8 : 7.0) + (f.boosting ? 2.2 : 0)
        : f.kind === "player"
          ? 20
          : 10;
      const flipRate = 1 - Math.exp(-flipSpeed * dt);
      f.turnFlip += (f.face - f.turnFlip) * flipRate;

      const boostTarget = f.boosting ? 1 : 0;
      f.boostVis += (boostTarget - f.boostVis) * (1 - Math.exp(-(f.boosting ? 14 : 9) * dt));

      const uSp = clamp((sp - 3) / 36, 0, 1);
      const speedFactor = uSp * uSp * (3 - 2 * uSp);
      const horiz = Math.hypot(f.vx, 12);
      const rawSlope = Math.atan2(f.vy, horiz) * 0.92;
      const turnLevel = 0.78 + 0.22 * Math.abs(f.turnFlip);
      const idlePitch = (1 - speedFactor) * Math.sin(this.t * 1.35 + f.id * 1.37) * 0.055;
      const targTilt = clamp(rawSlope, -1.02, 1.02) * speedFactor * turnLevel + idlePitch;

      const wTilt = f.kind === "player" ? 13.5 : f.kind === "bot" ? 9.0 : f.fry ? 11.5 : 7.8;
      const tiltAcc = wTilt * wTilt * (targTilt - f.tilt) - 1.78 * wTilt * f.tiltV;
      f.tiltV = clamp(f.tiltV + tiltAcc * dt, -10, 10);
      f.tilt = clamp(f.tilt + f.tiltV * dt, -1.08, 1.08);

      // Elastic ragdoll spine bend + signed C-curve whip on 3D turns
      const turnGap = Math.abs(f.face - f.turnFlip);
      const turnMid = Math.sqrt(Math.max(0, 1 - f.turnFlip * f.turnFlip));
      const signedTurnTarget = clamp(-(f.face - f.turnFlip) * (0.65 + turnMid * 0.85), -1.15, 1.15);
      const wTB = f.kind === "player" ? 13.0 : 11.0;
      const tbAcc = wTB * wTB * (signedTurnTarget - f.turnBend) - 1.38 * wTB * f.turnBendV;
      f.turnBendV = clamp(f.turnBendV + tbAcc * dt, -10, 10);
      f.turnBend = clamp(f.turnBend + f.turnBendV * dt, -1.25, 1.25);

      const turnSway = turnGap > 0.04 ? Math.sin(this.t * 13 + f.id) * 0.052 * Math.min(1, turnGap) : 0;
      const targBend = clamp(-f.tiltV * 0.1 - f.tilt * 0.042 * speedFactor + turnSway, -0.42, 0.42);
      const wBend = f.kind === "player" ? 11.5 : 9.2;
      const bendAcc = wBend * wBend * (targBend - f.bend) - 1.42 * wBend * f.bendV;
      f.bendV = clamp(f.bendV + bendAcc * dt, -6.5, 6.5);
      f.bend = clamp(f.bend + f.bendV * dt, -0.48, 0.48);

      const speedNorm = Math.min(1.4, sp / 170);
      const turnWhip = Math.min(1.3, turnGap * 1.1) + Math.min(0.6, Math.abs(f.tiltV) * 0.11);
      f.tailPh += dt * (3.2 + speedNorm * 8.6 + f.boostVis * 13.5 + turnWhip * 4.8);
      if (f.sucked > 0) f.tailPh += dt * 9; // faster tail beats while being vacuumed
      if (f.gulpT > 0) f.gulpT = Math.max(0, f.gulpT - dt / 0.62);
      if (f.swallowT > 0) f.swallowT = Math.max(0, f.swallowT - dt / 0.34);
      if (f.slurpCd > 0) f.slurpCd -= dt;

      // Gentle breathing suction squash + eager anticipation stretch when opening wide
      const targetSq = f.sucking
        ? 0.12 + Math.sin(this.t * 9) * 0.025
        : f.wantOpen && f.chompPhase <= 0
          ? -0.06 * Math.min(1, f.wantOpenAmt)
          : 0;
      // Bouncy underdamped cartoon jelly spring (squish -> stretch rebound -> settle)
      f.sqv += (-260 * (f.sq - targetSq) - 11.5 * f.sqv) * dt;
      f.sq = clamp(f.sq + f.sqv * dt, -0.35, 0.55);
      const suckFade = 1 - Math.exp(-(f.sucking ? 14 : 10) * dt);
      f.suckVis += ((f.sucking ? 1 : 0) - f.suckVis) * suckFade;

      f.mouthOpenT -= dt;
      f.chompT -= dt;
      f.invuln -= dt;
      f.sucked -= dt;
      f.comboT -= dt;
      if (f.comboT <= 0) f.combo = 0;

      // Pop next queued chomp snap when eating multiple fish rapidly without suction!
      if (f.chompPhase <= 0 && f.chompQueue > 0) {
        f.chompQueue--;
        f.chompDur = f.chompQueue >= 5 ? 0.095 : f.chompQueue >= 2 ? 0.115 : 0.14;
        f.chompPhase = f.chompDur;
        f.chompBitFired = false;
        // Quick anticipatory jaw flare & slight elastic recoil stretch before slamming shut
        f.jawV = Math.max(f.jawV, 24);
        f.biteLungeV -= f.r * 2.6;
        f.tiltV -= 2.0;
        f.sqv -= 8.5;
      }

      let jawTarget = 0;
      let jawK = 320;
      let jawDamp = 20;

      if (f.chompPhase > 0) {
        f.chompPhase -= dt;
        const u = clamp(1 - f.chompPhase / Math.max(0.04, f.chompDur), 0, 1);
        if (u < 0.38) {
          // Anticipatory Mangap! Snaps mouth extra wide open
          jawTarget = 1.38;
          jawK = 920;
          jawDamp = 20;
        } else {
          // Explosive Ngehap! Slams jaw shut with juicy cartoon squash & lunge
          jawTarget = -0.44;
          jawK = 1080;
          jawDamp = 16;
          if (!f.chompBitFired) {
            f.chompBitFired = true;
            f.jawV = -26;
            f.biteLungeV += Math.min(310, Math.max(64, f.r * 11.8));
            f.sqv += f.chompQueue > 0 ? 15.5 : 19.5;
            f.tiltV += 3.2;
            f.vx += f.face * Math.cos(f.tilt) * 20;
            f.vy += Math.sin(f.tilt) * 20;
            const bmx = f.mouthX(),
              bmy = f.mouthY();
            if (
              (f.chompQueue > 0 || f.kind === "player") &&
              Math.abs(bmx - this.cam.x) < this.vw &&
              Math.abs(bmy - this.cam.y) < this.vh
            ) {
              this.particles.push({
                x: bmx + f.face * f.r * 0.16,
                y: bmy,
                vx: f.face * 12,
                vy: 0,
                life: 0.16,
                max: 0.16,
                type: "chomp",
                color: "#e0f7ff",
                size: Math.max(5, f.r * 0.56),
                dir: f.face,
              });
              this.particles.push(this.bubble(bmx, bmy, 0.9 + Math.random() * 1.1));
            }
          }
        }
      } else if (f.chompT > 0.04 && f.munch) {
        // Lively rhythmic cartoon chew on big mouthfuls while gulp bulge travels down body
        jawTarget = 0.08 + Math.sin((f.chompT / 0.15) * Math.PI * 2) * 0.52;
        jawK = 520;
        jawDamp = 18;
      } else if (f.sucking) {
        jawTarget = 1.08 + Math.sin(this.t * 18 + f.id) * 0.14;
        jawK = 400;
        jawDamp = 20;
      } else if (f.mouthOpenT > 0 || f.wantOpen) {
        // Dynamic Mangap anticipation: scales extra wide with prey proximity + hungry jaw quiver
        const eager = Math.max(f.wantOpenAmt, f.mouthOpenT > 0 ? 1.08 : 0.84);
        jawTarget = 0.96 + eager * 0.38 + Math.sin(this.t * 24 + f.id) * 0.08;
        jawK = 520;
        jawDamp = 18;
        if (f.wantOpen) f.tailPh += dt * 4.8 * eager;
      } else if (Math.sin(this.t * 2.1 + f.id) > 0.88) {
        jawTarget = 0.24;
      } else {
        jawK = 360;
        jawDamp = 22;
      }
      f.jawV += (jawK * (jawTarget - f.jaw) - jawDamp * f.jawV) * dt;
      f.jaw = clamp(f.jaw + f.jawV * dt, -0.48, 1.42);

      // Spring-integrate forward bite strike lunge
      f.biteLungeV += (-260 * f.biteLunge - 18 * f.biteLungeV) * dt;
      f.biteLunge = clamp(f.biteLunge + f.biteLungeV * dt, -f.r * 0.38, f.r * 0.62);

      const tr = Math.sqrt(f.mass);
      f.r += (tr - f.r) * Math.min(1, dt * 3.2);
      f.wantOpen = false;
      f.wantOpenAmt = 0;
      if (f.kind !== "player" && !f.sucking) {
        f.energy = Math.min(1, f.energy + dt * 0.3);
      }
      if (f.boosting) {
        f.boostTrail -= dt;
        if (f.boostTrail <= 0 && Math.abs(f.x - this.cam.x) < this.vw && Math.abs(f.y - this.cam.y) < this.vh) {
          f.boostTrail = 0.032;
          const bx = f.x - f.face * f.r * 1.15,
            by = f.y + (Math.random() - 0.5) * f.r * 0.75;
          this.particles.push(this.bubble(bx, by, 0.9 + Math.random() * 1.4));
          // Juicy hydrodynamic wake streak behind boosting fish
          this.particles.push({
            x: bx,
            y: by,
            vx: -f.vx * 0.35 + (Math.random() - 0.5) * 18,
            vy: -f.vy * 0.35 + (Math.random() - 0.5) * 18,
            life: 0.22,
            max: 0.22,
            type: "streak",
            color: "#d2fcff",
            size: 1.4,
          });
        }
      }
      if (f.kind === "npc" && Math.random() < dt * (attract ? 0.04 : 0.15)) this.particles.push(this.bubble(f.mouthX(), f.mouthY(), 1));
      if (f !== p) {
        f.hiddenCave = this.getCaveAt(f.x, f.y, f.r, f.inCaveId);
        if (f.hiddenCave) {
          f.inCaveId = f.hiddenCave.id;
        } else if (f.inCaveId !== null) {
          const fm = this.ocean.formations.find((form) => form.cave?.id === f.inCaveId);
          if (!fm || this.ocean.sampleRockSDF(fm, f.x, f.y, false).dist > f.r * 0.85) {
            f.inCaveId = null;
          }
        }
      }
    }

    {
      const laut = this.lautActive();
      if (laut) {
        const pl = this.player && !this.player.dead && !this.player.eatenBy && !this.menuActive ? this.player : null;
        laut.stepDivers(
          dt,
          this.fish as any,
          pl as any,
          {
            onHit: (tf: any, hx: number, hy: number) => {
              const f = tf as Fish;
              if (f === this.player) {
                if (this.shieldT > 0) {
                  this.shieldT = 0;
                  f.invuln = 1.5;
                  sfx.shieldBreak();
                  this.spawnSparks(hx, hy, "#7dd3fc", 18);
                  this.texts.push({ x: hx, y: hy - 16, text: "PERISAI PECAH!", color: "#7dd3fc", life: 1.3, max: 1.3, size: 13 });
                  this.emitHud();
                  return false;
                }
                sfx.setSuck(false);
                this.shake = 8;
                this.spawnSparks(hx, hy, "#ff4d4d", 20);
                this.texts.push({ x: hx, y: hy - 18, text: "KENA TOMBAK!", color: "#ff5a36", life: 1.6, max: 1.6, size: 15 });
                this.emitHud();
                return true;
              }
              this.spawnSparks(hx, hy, "#ff6b6b", 8);
              return true;
            },
            onKill: (tf: any, hx: number, hy: number) => {
              const f = tf as Fish;
              f.speared = false;
              if (f.dead) return;
              f.dead = true;
              this.spawnSparks(hx, hy, "#ff6b6b", 10);
              if (f === this.player) {
                f.vx = 0;
                f.vy = 0;
                sfx.die();
                this.shake = 10;
                this.texts.push({ x: hx, y: hy - 18, text: "DITANGKAP PENYELAM!", color: "#ff5a36", life: 1.8, max: 1.8, size: 15 });
                this.killerName = "Penyelam Pemburu";
                this.killerSpId = "diver";
                this.deathTimer = 1.75;
                this.spectate = null;
                this.emitHud();
                return;
              }
              if (f.kind === "bot") {
                this.respawnQueue.push({ t: 2 + Math.random() * 2.5, name: f.name, skin: f.skinRef || SKINS[0] });
                if (!this.menuActive) this.onEvent?.({ type: "feed", text: `Penyelam menombak ${f.name}!` });
              }
            },
            onRelease: (tf: any) => {
              (tf as Fish).speared = false;
            },
          },
          this.camLeft,
          this.camTop,
          this.vw,
          this.vh,
        );
      }
    }
    this.checkEating(attract, nearX, nearY);

    {
      let w = 0;
      for (let i = 0; i < this.fish.length; i++) {
        const f = this.fish[i];
        if (!f.dead) this.fish[w++] = f;
      }
      this.fish.length = w;
    }
    let npcCount = 0;
    for (const f of this.fish) if (f.kind === "npc" && !f.fry) npcCount++;
    if (npcCount < NPC_TARGET) for (let i = 0; i < Math.min(8, NPC_TARGET - npcCount); i++) this.spawnNPC();
    if (p && !p.dead && Math.random() < dt * 2) {
      const cand = this.fish[Math.floor(Math.random() * this.fish.length)];
      if (cand && cand.kind === "npc" && !cand.fry && cand.r < p.r * 0.25 && Math.abs(cand.x - p.x) > this.vw) cand.dead = true;
    }
    for (const q of this.respawnQueue) q.t -= dt;
    const ready = this.respawnQueue.filter((q) => q.t <= 0);
    this.respawnQueue = this.respawnQueue.filter((q) => q.t > 0);
    for (const q of ready) this.spawnBot(q.name, q.skin, 58 + Math.random() * 140);

    // Spawn coins both from surface and inside glowing deep crevices!
    if (!attract) {
      this.coinTimer -= dt;
      if (this.coinTimer <= 0) {
      this.coinTimer = 1.1 + Math.random() * 1.3;
      const x = this.cam.x + (Math.random() - 0.5) * this.vw * 1.4;
      this.worldCoins.push({
        x: clamp(x, 20, WORLD_W - 20),
        y: Math.random() < 0.35 ? DEEP_START + 120 + Math.random() * 550 : -4,
        vx: 0,
        vy: 16 + Math.random() * 14,
        t: 0,
        value: Math.random() < 0.35 ? 3 : 1 + Math.floor(Math.random() * 2),
        settled: false,
      });
      if (Math.random() < 0.35) {
        const c = this.ocean.chestPos;
        this.worldCoins.push({
          x: c.x,
          y: c.y - 6,
          vx: (Math.random() - 0.5) * 45,
          vy: -45 - Math.random() * 30,
          t: 0,
          value: 3,
          settled: false,
        });
      }
    }
    for (const c of this.worldCoins) {
      c.t += dt;
      if (!c.settled) {
        c.vy += (24 - c.vy) * dt * 0.8;
        c.vx *= 1 - dt * 1.5;
        c.x += c.vx * dt + Math.sin(c.t * 3) * 0.3;
        c.y += c.vy * dt;
        if (c.y > floorY(c.x) - 3) {
          c.y = floorY(c.x) - 3;
          c.settled = true;
        }
      }
      if (p && !p.dead && !p.eatenBy) {
        const mx = p.mouthX(),
          my = p.mouthY();
        const d = Math.hypot(c.x - mx, c.y - my);
        const magnet = (p.r * 2.4 + 26) * 1.4;
        if (d < magnet && d > 0.5) {
          // coin magnet: nearby coins curve into the mouth on their own (1.4x stronger)
          const pull = (70 + 260 * (1 - d / magnet)) * 1.4 * dt;
          c.settled = false;
          c.vx = 0;
          c.vy = 0;
          c.x += ((mx - c.x) / d) * Math.min(d, pull);
          c.y += ((my - c.y) / d) * Math.min(d, pull);
        }
        if (d < p.r * 0.9 + 6) {
          c.t = 999;
          for (let i = 0; i < c.value; i++) this.addFlyCoin(c.x, c.y, 1, i * 0.05, 0);
          this.arcadeScore += c.value * 50;
          this.texts.push({ x: c.x, y: c.y - 6, text: "+" + c.value, color: "#ffe14a", life: 0.8, max: 0.8, size: 9 });
          this.spawnSparks(c.x, c.y, "#ffe14a", 8);
          this.spawnRing(c.x, c.y, "#fff3a1", 7);
          p.sqv += 2.5;
        }
      }
    }
      this.worldCoins = this.worldCoins.filter((c) => c.t < 24 && c.y < WORLD_H + 10);
    } else {
      this.coinTimer = 0;
    }

    // Active power-up timers + Pearls / Power-Up Orbs + Golden Sardine Frenzy
    if (this.shieldT > 0) this.shieldT = Math.max(0, this.shieldT - dt);
    if (this.stunT > 0) this.stunT = Math.max(0, this.stunT - dt);
    if (this.stingCd > 0) this.stingCd = Math.max(0, this.stingCd - dt);
    if (this.turboT > 0) this.turboT = Math.max(0, this.turboT - dt);
    if (this.knockT > 0) this.knockT = Math.max(0, this.knockT - dt);
    if (this.bounceCd > 0) this.bounceCd = Math.max(0, this.bounceCd - dt);
    // 3D jellyfish (Dunia Laut): the bell is a springy trampoline, the tentacles sting (4 s stun)
    if (p && !p.dead && !p.eatenBy && !p.speared && !this.menuActive) {
      const lj = this.lautActive();
      if (lj) {
        for (const j of lj.jellyHazards()) {
          if (Math.abs(j.x - p.x) > 200 || Math.abs(j.y - p.y) > 260) continue;
          const dx = p.x - j.x,
            dy = p.y - j.y;
          const d = Math.hypot(dx, dy) || 1;
          const bellR = j.s * 0.95 + p.r * 0.55;
          // the dome: above the bell's equator (game y grows downward)
          const onBell = d < bellR && dy < j.s * 0.25;
          if (onBell && this.bounceCd <= 0) {
            const nx = dx / d,
              ny = dy / d;
            const vin = p.vx * nx + p.vy * ny; // approach speed along the normal (negative = into the bell)
            const speed = Math.hypot(p.vx, p.vy);
            // reflect, keep most of the energy and add a springy kick: harder hits fly further
            const kick = 170 + Math.min(260, speed * 0.75);
            const rvx = p.vx - 2 * Math.min(0, vin) * nx,
              rvy = p.vy - 2 * Math.min(0, vin) * ny;
            p.vx = rvx * 0.55 + nx * kick;
            p.vy = rvy * 0.55 + ny * kick - 40;
            // push out of the dome
            p.x = j.x + nx * (bellR + 2);
            p.y = j.y + ny * (bellR + 2);
            p.sqv += 9; // cartoon squash on impact
            p.tiltV += (nx > 0 ? -1 : 1) * 6;
            this.knockT = 0.42 + Math.min(0.3, speed / 900);
            this.bounceCd = 0.35;
            this.shake = Math.max(this.shake, 3 + Math.min(5, speed / 80));
            lj.bounceJelly(j, nx, ny, Math.min(1, 0.5 + speed / 400));
            sfx.pop(2);
            sfx.whoosh(true);
            this.spawnRing(p.x, p.y, "#dff9ff", p.r * 1.6);
            this.spawnSparks(j.x + nx * j.s * 0.8, j.y + ny * j.s * 0.6, "#c7f0ff", 8);
            for (let k = 0; k < 5; k++) this.particles.push(this.bubble(p.x + (Math.random() - 0.5) * p.r, p.y + (Math.random() - 0.5) * p.r, 0.8 + Math.random() * 1.6));
            const words = ["BOING!", "DUK!", "MENTAL!", "PLOK!"];
            this.texts.push({ x: p.x, y: p.y - p.r - 12, text: words[(Math.random() * words.length) | 0], color: "#fde68a", life: 0.9, max: 0.9, size: 14 });
            break;
          }
          if (this.stingCd > 0) continue;
          const tent = Math.abs(dx) < j.s * 0.6 + p.r * 0.4 && dy > j.s * 0.25 && dy < j.s * 2.5 + p.r * 0.4;
          if (!tent) continue;
          if (this.shieldT > 0) {
            this.shieldT = 0;
            this.stingCd = 2.5;
            sfx.shieldBreak();
            this.spawnSparks(p.x, p.y, "#7dd3fc", 16);
            this.texts.push({ x: p.x, y: p.y - p.r - 14, text: "PERISAI PECAH!", color: "#7dd3fc", life: 1.3, max: 1.3, size: 13 });
          } else {
            this.stunT = 4;
            this.stingCd = 6.5;
            this.knockT = 0;
            this.shake = 7;
            this.blastFlash = Math.max(this.blastFlash, 0.35);
            sfx.explode();
            this.spawnSparks(p.x, p.y, "#a5f3fc", 22);
            this.spawnSparks(p.x, p.y, "#fef08a", 10);
            this.texts.push({ x: p.x, y: p.y - p.r - 16, text: "KESETRUM UBUR-UBUR! PUSING 4 DETIK", color: "#a5f3fc", life: 1.8, max: 1.8, size: 12 });
            this.onEvent?.({ type: "feed", text: `${p.name} tersengat ubur-ubur!` });
          }
          this.emitHud();
          break;
        }
      }
    }
    if (this.vortexT > 0) this.vortexT = Math.max(0, this.vortexT - dt);

    if (p && !p.dead && !p.eatenBy) {
      this.orbTimer -= dt;
      if (this.orbTimer <= 0) {
        this.orbTimer = 9 + Math.random() * 5;
        if (this.orbs.length < 5) this.spawnOrb(undefined, true);
      }
      this.goldenTimer -= dt;
      if (this.goldenTimer <= 0) {
        this.goldenTimer = 42 + Math.random() * 14;
        this.spawnSchool(false, true, p.y);
        sfx.bonus();
        this.onEvent?.({ type: "bonus", title: "GEROMBOLAN EMAS!", text: "Kejar ikan sarden emas di dekatmu untuk 2× Koin!" });
      }
    }

    for (const o of this.orbs) {
      o.t += dt;
      o.x = clamp(o.x + o.vx * dt, 40, WORLD_W - 40);
      o.y = clamp(o.y + (o.vy + Math.sin(this.t * 2.2 + o.ph) * 8) * dt, 50, floorY(o.x) - 18);
      if (Math.random() < dt * 2.2 && Math.abs(o.x - this.cam.x) < this.vw) {
        const gcol = o.kind === "pearl" ? "#fff3a1" : o.kind === "turbo" ? "#67e8f9" : o.kind === "vortex" ? "#fdba74" : "#6ee7b7";
        this.particles.push({ x: o.x + (Math.random() - 0.5) * 14, y: o.y + (Math.random() - 0.5) * 14, vx: 0, vy: -8, life: 0.45, max: 0.45, type: "glint", color: gcol, size: 1 });
      }
      if (p && !p.dead && !p.eatenBy) {
        const mx = p.mouthX(),
          my = p.mouthY();
        const d = Math.hypot(o.x - mx, o.y - my);
        if (d < p.r * 1.15 + 14) {
          o.t = 999;
          sfx.powerup();
          p.sqv += 6;
          if (o.kind === "pearl") {
            for (let i = 0; i < 8; i++) this.addFlyCoin(o.x, o.y, i < 2 ? 2 : 1, i * 0.04, p.face);
            this.arcadeScore += 400;
            if (p.combo > 0) p.comboT = Math.min(2.6, p.comboT + 1.5);
            this.texts.push({ x: o.x, y: o.y - 10, text: "MUTIARA! +10 Koin", color: "#fff3a1", life: 1.25, max: 1.25, size: 10 });
            this.spawnSparks(o.x, o.y, "#ffe14a", 18);
            this.spawnRing(o.x, o.y, "#fff7c2", 18);
          } else if (o.kind === "turbo") {
            this.turboT = 8;
            p.boost = 1;
            p.boostExhausted = false;
            this.texts.push({ x: o.x, y: o.y - 10, text: "SIRIP TURBO!", color: "#67e8f9", life: 1.2, max: 1.2, size: 10 });
            this.spawnSparks(o.x, o.y, "#67e8f9", 16);
            this.spawnRing(o.x, o.y, "#a5f3fc", 16);
            this.onEvent?.({ type: "bonus", title: "SIRIP TURBO!", text: "Kecepatan +35% & Boost tak terbatas selama 8 detik!" });
          } else if (o.kind === "vortex") {
            this.vortexT = 8;
            p.energy = 1;
            p.exhausted = false;
            this.texts.push({ x: o.x, y: o.y - 10, text: "PUSARAN MEGA!", color: "#fdba74", life: 1.2, max: 1.2, size: 10 });
            this.spawnSparks(o.x, o.y, "#fdba74", 16);
            this.spawnRing(o.x, o.y, "#fed7aa", 16);
            this.onEvent?.({ type: "bonus", title: "PUSARAN MEGA!", text: "Jangkauan hisap 55% lebih luas selama 8 detik!" });
          } else {
            this.shieldT = 14;
            this.texts.push({ x: o.x, y: o.y - 10, text: "PERISAI GELEMBUNG!", color: "#6ee7b7", life: 1.2, max: 1.2, size: 10 });
            this.spawnSparks(o.x, o.y, "#6ee7b7", 16);
            this.spawnRing(o.x, o.y, "#a7f3d0", 16);
            this.onEvent?.({ type: "bonus", title: "PERISAI AKTIF!", text: "Melindungi dari 1 serangan predator selama 14 detik!" });
          }
        }
      }
    }
    this.orbs = this.orbs.filter((o) => o.t < 42);

    // Naval Sea Mine bombs (Feeding Frenzy style): bobbing in current, lethal on single contact with player!
    if (this.blastFlash > 0) this.blastFlash = Math.max(0, this.blastFlash - dt * 2.2);
    for (let i = this.mineTimers.length - 1; i >= 0; i--) {
      this.mineTimers[i] -= dt;
      if (this.mineTimers[i] <= 0) {
        this.mineTimers.splice(i, 1);
        this.spawnMine(false);
      }
    }
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      m.y = m.baseY + Math.sin(this.t * 1.45 + m.ph) * 8.5;
      m.rot += m.rotSp * dt;
      if (p && !p.dead && !p.eatenBy && this.t - this.startTime > 0.5) {
        const d = Math.hypot(p.x - m.x, p.y - m.y);
        if (d < p.r * 0.78 + m.r * 0.84) {
          // Single-hit lethal detonation!
          this.mines.splice(i, 1);
          this.mineTimers.push(7 + Math.random() * 5);
          this.shieldT = 0;
          this.turboT = 0;
          this.vortexT = 0;
          p.dead = true;
          p.vx = 0;
          p.vy = 0;
          sfx.setSuck(false);
          sfx.explode();
          this.shake = 18;
          this.blastFlash = 1.0;
          this.freeze = 0.06;
          this.spawnExplosion(m.x, m.y, Math.max(30, p.r * 2.2 + 16));
          this.texts.push({ x: m.x, y: m.y - 18, text: "DUAR!!", color: "#ff5a36", life: 1.5, max: 1.5, size: 15 });
          this.killerName = "Bom Ranjau Laut";
          this.killerSpId = "bomb";
          this.deathTimer = 1.75;
          this.spectate = null;
          this.emitHud();
          break;
        }
      }
    }

    const hx = this.camLeft + (this.coinHudPos.x / Math.max(1, window.innerWidth)) * this.vw;
    const hy = this.camTop + (this.coinHudPos.y / Math.max(1, window.innerHeight)) * this.vh;
    for (const c of this.flyCoins) {
      c.t += dt;
      if (c.t < 0) continue; // staggered: this coin has not popped out yet
      if (c.t < COIN_POP) {
        // 1) pop out of the mouth in a little fountain arc
        c.vy += 260 * dt;
        c.vx *= 1 - dt * 3.2;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.sx = c.x;
        c.sy = c.y;
      } else {
        // 2) swoop to the coin counter along a curved, accelerating path, shedding gold glints
        const u = Math.min(1, (c.t - COIN_POP) / COIN_FLY),
          e = u * u * (1.6 - 0.6 * u);
        const ex = hx - c.sx,
          ey = hy - c.sy,
          L = Math.hypot(ex, ey) || 1;
        const arc = Math.sin(e * Math.PI) * c.bend;
        c.x = c.sx + ex * e + (-ey / L) * arc;
        c.y = c.sy + ey * e + (ex / L) * arc;
        c.trail -= dt;
        if (c.trail <= 0) {
          c.trail = 0.03;
          this.particles.push({ x: c.x, y: c.y, vx: (Math.random() - 0.5) * 10, vy: 6 + Math.random() * 8, life: 0.3, max: 0.3, type: "glint", color: "#ffe14a", size: 1 });
        }
        if (u >= 1) {
          c.t = 999;
          this.sessionCoins += c.value;
          if (this.t - this.lastCoinT > 0.7) this.coinChain = 0;
          this.lastCoinT = this.t;
          sfx.coin(this.coinChain++);
          this.onEvent?.({ type: "coinbump" });
        }
      }
    }
    this.flyCoins = this.flyCoins.filter((c) => c.t < 999);

    if (Math.random() < dt * (attract ? 4.5 : 11)) {
      const v = this.ocean.vents[Math.floor(Math.random() * this.ocean.vents.length)];
      if (v && Math.abs(v.x - this.cam.x) < this.vw) {
        const count = 1 + (Math.random() < 0.45 ? 1 : 0);
        for (let b = 0; b < count; b++) {
          const bb = this.bubble(v.x + (Math.random() - 0.5) * 11, v.y - Math.random() * 4, 1.1 + Math.random() * 2.5);
          bb.vy -= 18 + Math.random() * 16;
          this.particles.push(bb);
        }
        if (Math.random() < 0.28) {
          this.particles.push({
            x: v.x + (Math.random() - 0.5) * 10,
            y: v.y - 2,
            vx: (Math.random() - 0.5) * 10,
            vy: -26 - Math.random() * 14,
            life: 0.55,
            max: 0.55,
            type: "glint",
            color: Math.random() < 0.35 ? "#ffd480" : "#aef4ff",
            size: 1.1,
          });
        }
      }
    }

    for (const pt of this.particles) {
      pt.life -= dt;
      if (pt.type === "bubble") {
        // bigger bubbles rise faster and wobble more; small ones zig-zag quickly
        const term = 22 + pt.size * 16;
        pt.vy += (-term - pt.vy) * Math.min(1, dt * 1.6);
        const age = pt.max - pt.life;
        pt.vx = Math.sin(age * (7.5 - Math.min(4, pt.size)) + pt.size * 7) * (3 + pt.size * 3) + Math.sin(age * 1.3 + pt.size) * 2;
        pt.size += dt * 0.08; // expands slightly as pressure drops
        if (pt.y < 6) {
          // pops at the surface: tiny ring of droplets
          pt.life = 0;
          if (Math.random() < 0.5) this.particles.push({ x: pt.x, y: 4, vx: 0, vy: 0, life: 0.3, max: 0.3, type: "ring", color: "#e8feff", size: pt.size * 1.6 });
        }
      } else if (pt.type === "bit") {
        pt.vy += 45 * dt;
        pt.vx *= 1 - dt * 2.2;
        pt.vy *= 1 - dt * 1.2;
      } else if (pt.type === "suck" && pt.target) {
        const tx = pt.target.mouthX(),
          ty = pt.target.mouthY();
        const dx = tx - pt.x,
          dy = ty - pt.y;
        const d = Math.hypot(dx, dy) || 1;
        // Soft curved inward spiral converging directly into mouth center
        const tangX = -dy / d,
          tangY = dx / d;
        const s = (145 + (pt.max - pt.life) * 290) * 1.4;
        const swirl = 26 * Math.sin(pt.size * 5) * Math.min(1, d / 34);
        pt.vx = (dx / d) * s + tangX * swirl;
        pt.vy = (dy / d) * s + tangY * swirl;
        if (d < 4 || pt.target.suckVis < 0.05) pt.life = 0;
      } else if (pt.type === "spark" || pt.type === "star") {
        pt.vx *= 1 - dt * 4;
        pt.vy *= 1 - dt * 4;
      } else if (pt.type === "blast") {
        pt.vx *= 1 - dt * 4.5;
        pt.vy *= 1 - dt * 4.5;
      } else if (pt.type === "smoke") {
        pt.vx *= 1 - dt * 2.4;
        pt.vy = pt.vy * (1 - dt * 2.2) - 18 * dt;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
    {
      let w = 0;
      for (let i = 0; i < this.particles.length; i++) {
        const pt = this.particles[i];
        if (pt.life > 0) this.particles[w++] = pt;
      }
      this.particles.length = w;
      if (w > 550) this.particles.splice(0, w - 550);
    }
    {
      let w = 0;
      for (let i = 0; i < this.texts.length; i++) {
        const tx = this.texts[i];
        tx.life -= dt;
        tx.y -= dt * 18;
        if (tx.life > 0) this.texts[w++] = tx;
      }
      this.texts.length = w;
    }

    // one juicy summary pop when a slurp chain ends
    this.chainPop = Math.max(0, this.chainPop - dt * 5);
    if (this.streamN > 0) {
      this.streamT -= dt;
      if (this.streamT <= 0) {
        if (p && !p.dead) {
          this.texts.push({ x: p.x, y: p.y - p.r * 1.15 - 44, text: "+" + this.streamPts, color: "#fff3a1", life: 1.1, max: 1.1, size: 9 + Math.min(6, this.streamN * 0.35) });
          this.texts.push({ x: p.x, y: p.y - p.r * 1.15 - 33, text: this.streamN + " ikan  +" + this.streamCoins + " koin", color: "#ffe14a", life: 1.1, max: 1.1, size: 7 });
        }
        this.streamPts = this.streamCoins = this.streamN = 0;
      }
    }

    // Camera smooth-follow only when spectating or during death animation (live player camera is driven above!)
    if (!p || p.dead || p.eatenBy) {
      const focus = p && !p.dead ? p.eatenBy || p : this.deathTimer >= 0 ? null : this.spectate;
      if (focus) {
        const lead = focus.vx * 0.22;
        const targetCamY = attract ? clamp(focus.y + focus.vy * 0.14, 195, 420) : focus.y + focus.vy * 0.14;
        this.cam.x += (focus.x + lead - this.cam.x) * Math.min(1, dt * (attract ? 2.6 : 4.5));
        this.cam.y += (targetCamY - this.cam.y) * Math.min(1, dt * (attract ? 2.6 : 4.5));
      }
    }
    this.shake *= Math.exp(-9 * dt);
    if (this.shake < 0.05) this.shake = 0;

    if (this.deathTimer >= 0) {
      this.deathTimer -= dt;
      if (this.deathTimer < 0) {
        this.deathTimer = -1;
        for (const c of this.flyCoins) this.sessionCoins += c.value;
        this.flyCoins = [];
        this.onDeath?.({
          score: this.arcadeScore,
          coins: this.sessionCoins,
          killer: this.killerName,
          killerSpId: this.killerSpId,
          playerSkinId: this.playerSkinId,
          playerMode3D: this.playerMode3D,
          playerName: this.player?.name || "Kamu",
          maxMass: Math.round(this.maxMass),
          eaten: this.eatenCount,
          botsEaten: this.botsEatenCount,
          maxCombo: this.maxCombo,
          maxDepth: depthMeters(this.maxDepthY),
          deepestZone: ZONE_LABELS[zoneAt(this.maxDepthY)],
          stageNum: Math.max(1, this.level - 1),
          bestRank: Math.max(1, this.bestRank),
          schoolSweeps: this.schoolSweeps,
          time: Math.max(1, Math.round(this.t - this.startTime)),
          reachedRank1: this.reachedRank1,
          peakLevelTime: this.peakLevelTime,
        });
      }
    }

    if (p && !p.dead) {
      this.maxMass = Math.max(this.maxMass, p.mass);
      this.maxDepthY = Math.max(this.maxDepthY, p.y);
      const lv = this.calcLevel(p.r);
      if (lv > this.level) {
        this.level = lv;
        const sp = SPECIES[Math.min(lv - 1, SPECIES.length - 1)];
        this.onEvent?.({ type: "levelup", text: "Ukuran naik! Bisa makan " + sp.name + "!" });
        if (lv >= SPECIES.length) {
          sfx.stageClear(0.8);
          if (this.peakLevelTime === null) {
            this.peakLevelTime = Math.max(1, Math.round(this.t - this.startTime));
            this.onEvent?.({ type: "peaklevel", timeSec: this.peakLevelTime });
          }
        } else {
          sfx.levelUp();
        }
        this.spawnRing(p.x, p.y, "#fff6a0", p.r * 2.1);
        this.spawnSparks(p.x, p.y, "#ffffff", 18);
      }
    }

    const inPlay = !!(p && !p.dead && !p.eatenBy && this.deathTimer < 0);
    const ambY = p && !p.dead ? p.y : this.cam.y;
    if (inPlay) {
      const z = zoneAt(ambY);
      if (this.prevZone >= 0 && z !== this.prevZone) {
        sfx.onZoneChange(z > this.prevZone);
      }
      this.prevZone = z;
      if (this.prevPlayerY >= 34 && ambY < 34) {
        sfx.surfaceSplash();
      }
      this.prevPlayerY = ambY;
    }
    if (!attract) {
      let ventProx = 0;
      for (let i = 0; i < this.ocean.vents.length; i++) {
        const v = this.ocean.vents[i];
        const d = Math.hypot(v.x - this.cam.x, v.y - this.cam.y);
        if (d < 260) {
          const prox = 1 - d / 260;
          if (prox > ventProx) ventProx = prox;
        }
      }
      sfx.updateAmbience({
        inPlay,
        playerY: ambY,
        camTop: this.camTop,
        sucking: Boolean(inPlay && p?.sucking),
        boosting: Boolean(inPlay && p?.boosting),
        ventProx,
      });

      this.hudTimer -= dt;
      if (this.hudTimer <= 0) {
        this.hudTimer = 0.12;
        this.emitHud();
      }
      this.miniTimer -= dt;
      if (this.miniTimer <= 0) {
        this.miniTimer = 0.3;
        this.drawMinimap();
      }
    }
  }

  getCaveAt(x: number, y: number, r: number, prevCaveId: number | null = null): ReefCave | null {
    for (const form of this.ocean.formations) {
      const c = form.cave;
      if (!c) continue;
      if (r > c.maxR && prevCaveId !== c.id) continue;
      if (x < form.x || x > form.x + form.w || y < form.y || y > form.y + form.h) continue;
      const solidD = this.ocean.sampleRockSDF(form, x, y, false).dist;
      const caveD = this.ocean.sampleRockSDF(form, x, y, true).dist;
      if (solidD < 3 && caveD >= -1) return c;
    }
    return null;
  }

  /** Fish tucked inside a reef cave are shielded & hidden from outside or larger predators. */
  isProtectedInCave(predator: Fish, prey: Fish): boolean {
    const c = prey.hiddenCave;
    if (!c) return false;
    if (predator.r > c.maxR) return true;
    if (prey.kind === "player") return true;
    return predator.hiddenCave !== c;
  }

  /** Fair size check: player<->bot and bot<->bot duels require a clear size difference (BOT_EAT_RATIO = 0.74) */
  canEat(e: Fish, o: Fish): boolean {
    const ratio = e.kind !== "npc" && o.kind !== "npc" ? BOT_EAT_RATIO : EAT_RATIO;
    return o.r < e.r * ratio;
  }

  rebuildGrid(attract = false, nearX = 0, nearY = 0) {
    const g = this.grid;
    for (let i = 0; i < g.length; i++) g[i].length = 0;
    for (const f of this.fish) {
      if (f.dead || f.eatenBy) continue;
      if (attract && (Math.abs(f.x - this.cam.x) > nearX || Math.abs(f.y - this.cam.y) > nearY)) continue;
      const cx = Math.max(0, Math.min(GRID_COLS - 1, (f.x / GRID_CELL) | 0));
      const cy = Math.max(0, Math.min(GRID_ROWS - 1, (f.y / GRID_CELL) | 0));
      g[cy * GRID_COLS + cx].push(f);
    }
  }

  queryNear(x: number, y: number, rad: number): Fish[] {
    const out = this.nearBuf;
    out.length = 0;
    const x0 = Math.max(0, ((x - rad) / GRID_CELL) | 0);
    const x1 = Math.min(GRID_COLS - 1, ((x + rad) / GRID_CELL) | 0);
    const y0 = Math.max(0, ((y - rad) / GRID_CELL) | 0);
    const y1 = Math.min(GRID_ROWS - 1, ((y + rad) / GRID_CELL) | 0);
    const g = this.grid;
    for (let cy = y0; cy <= y1; cy++) {
      const row = cy * GRID_COLS;
      for (let cx = x0; cx <= x1; cx++) {
        const cell = g[row + cx];
        for (let k = 0; k < cell.length; k++) out.push(cell[k]);
      }
    }
    return out;
  }

  maxSpeed(f: Fish) {
    if (f.kind === "npc") return f.sp.speed * NPC_SPEED;
    const base = f.kind === "player" ? 190 : 126;
    const turboMul = f === this.player && this.turboT > 0 ? 1.35 : 1;
    return base * Math.pow(8 / Math.max(8, f.r), 0.14) * f.speedMul * turboMul * (f.boosting ? 1.6 : 1);
  }

  applySuckState(f: Fish, want: boolean, dt: number) {
    const freeVortex = f === this.player && this.vortexT > 0;
    if (freeVortex) {
      f.energy = 1;
      f.exhausted = false;
    }
    if (want && !f.exhausted && f.energy > 0) {
      f.sucking = true;
      if (!freeVortex) f.energy -= (dt * 0.42) / (0.85 + f.suckMul * 0.15);
      if (f.energy <= 0) {
        f.energy = 0;
        f.exhausted = true;
        f.sucking = false;
      }
    } else {
      f.sucking = false;
      f.energy = Math.min(1, f.energy + dt * 0.28);
      if (f.exhausted && f.energy > 0.3) f.exhausted = false;
    }
  }

  suckRange(f: Fish) {
    const megaMul = f === this.player && this.vortexT > 0 ? 1.55 : 1;
    return (f.r * 3.2 + 28) * f.suckMul * 1.4 * megaMul;
  }

  doSuck(f: Fish, dt: number) {
    const mx = f.mouthX(),
      my = f.mouthY();
    const dirx = f.face * Math.cos(f.tilt),
      diry = Math.sin(f.tilt);
    const range = this.suckRange(f);
    const near = this.queryNear(mx, my, range + 54);
    for (const o of near) {
      if (o === f || o.dead || o.eatenBy || o.invuln > 0) continue;
      if (!this.canEat(f, o) || this.isProtectedInCave(f, o)) continue;
      const dx = o.x - mx,
        dy = o.y - my;
      if (Math.abs(dx) > range + o.r || Math.abs(dy) > range + o.r) continue;
      const d = Math.hypot(dx, dy);
      if (d > range + o.r || d < 0.1) continue;
      const cos = (dx * dirx + dy * diry) / d;
      const smallPrey = o.fry || o.r < f.r * 0.48;
      // Already-captured or close small fish stay locked inside the intake flow instead of slipping out
      const minCos = o.sucked > 0 || d < f.r * 1.5 + 16 ? -0.08 : smallPrey ? 0.12 : 0.26;
      if (cos < minCos) continue;

      const rx = -dx / d,
        ry = -dy / d;
      // Uniform intake floor across the whole cone so outer shoal members pull in just as evenly as center fish
      const distFactor = Math.max(0.45, 1.14 - (d / (range + o.r)) * 0.68);
      const sizeFactor = clamp((f.r / o.r) * 0.45, 0.42, 1.5);
      const strength = 370 * 1.4 * f.suckMul * distFactor * sizeFactor;

      // Centering force guides off-axis small fish smoothly onto the mouth streamline
      const cross = dx * diry - dy * dirx;
      const tx = -ry,
        ty = rx;
      const centerPull = -Math.sign(cross) * Math.min(1, Math.abs(cross) / Math.max(12, range * 0.35)) * strength * 0.36;
      // Subtle fading spiral only at outer distance so fish never orbit past the lips
      const swirlAmp = (o.id & 1 ? 1 : -1) * strength * 0.28 * clamp((d - f.r * 0.8) / (range * 0.55), 0, 1);

      const pull = strength * 3.15 * dt;
      o.vx += rx * pull + tx * (centerPull + swirlAmp) * dt;
      o.vy += ry * pull + ty * (centerPull + swirlAmp) * dt;

      // Dampen lateral slip and partially match eater swim velocity so moving while sucking pulls shoals evenly
      const vDotR = o.vx * rx + o.vy * ry;
      const latX = o.vx - rx * vDotR;
      const latY = o.vy - ry * vDotR;
      const latDamp = Math.exp(-5.5 * dt);
      o.vx = rx * vDotR + latX * latDamp + (f.vx * 0.28 - o.vx * 0.08) * Math.min(1, dt * 4);
      o.vy = ry * vDotR + latY * latDamp + (f.vy * 0.28 - o.vy * 0.08) * Math.min(1, dt * 4);

      o.sucked = 0.24;
      if (o.kind === "npc") {
        o.face = dx >= 0 ? 1 : -1;
        const targetTilt = clamp(Math.atan2(ry, Math.abs(rx) + 0.35) * 0.5, -0.45, 0.45);
        o.tilt += (targetTilt - o.tilt) * Math.min(1, dt * 7);
      }
      f.wantOpen = true;
    }
    if (f.kind === "player") {
      for (const c of this.worldCoins) {
        const dx = c.x - mx,
          dy = c.y - my;
        const d = Math.hypot(dx, dy);
        if (d < range * 1.25 && (dx * dirx + dy * diry) / (d || 1) > 0.14) {
          c.settled = false;
          c.vx = (-dx / d) * (165 * 1.45);
          c.vy = (-dy / d) * (165 * 1.45);
        }
      }
    }
    const onScreen = Math.abs(mx - this.cam.x) < this.vw && Math.abs(my - this.cam.y) < this.vh;
    if (onScreen && Math.random() < 0.65) {
      const a = Math.atan2(diry, dirx) + (Math.random() - 0.5) * 1.05;
      const dd = range * (0.34 + Math.random() * 0.58);
      this.particles.push({
        x: mx + Math.cos(a) * dd,
        y: my + Math.sin(a) * dd,
        vx: 0,
        vy: 0,
        life: 0.58,
        max: 0.58,
        type: "suck",
        color: Math.random() < 0.35 ? "#ffffff" : "#bae6fd",
        size: 0.65 + Math.random() * 0.65,
        target: f,
      });
    }
  }

  botAI(f: Fish, dt: number) {
    if (f.ai.timer <= 0) {
      f.ai.timer = 0.2 + Math.random() * 0.15;
      let threat: Fish | null = null,
        td = 1e9;
      let best: Fish | null = null,
        bv = 0;
      const near = this.queryNear(f.x, f.y, 300);
      for (const o of near) {
        if (o === f || o.dead || o.eatenBy) continue;
        const dx = o.x - f.x,
          dy = o.y - f.y;
        if (Math.abs(dx) > 300 || Math.abs(dy) > 300) continue;
        const d = Math.hypot(dx, dy);
        if (this.canEat(o, f) && (o.kind !== "npc" || o.sp.predator)) {
          if (d < 80 + o.r * 2.2 && d < td) {
            td = d;
            threat = o;
          }
        } else if (this.canEat(f, o) && !this.isProtectedInCave(f, o) && o.invuln <= 0 && d < 260) {
          const pw = o.kind === "player" ? (this.t - this.startTime < 12 ? 0.25 : o.mass < 160 ? 0.6 : 1.1) : 1;
          const v = (o.mass * pw) / (d + 40);
          if (v > bv) {
            bv = v;
            best = o;
          }
        }
      }
      f.ai.flee = !!threat;
      if (threat) {
        const dx = f.x - threat.x,
          dy = f.y - threat.y;
        const d = Math.hypot(dx, dy) || 1;
        f.ai.tx = f.x + (dx / d) * 200;
        f.ai.ty = f.y + (dy / d) * 200;
        f.ai.target = null;
      } else if (best) {
        f.ai.target = best;
      } else {
        f.ai.target = null;
        if (Math.hypot(f.ai.tx - f.x, f.ai.ty - f.y) < 30 || Math.random() < 0.05) {
          const p = this.randomSpawnPos(f.r, false);
          f.ai.tx = clamp(f.x + (Math.random() - 0.5) * 600, 40, WORLD_W - 40);
          f.ai.ty = p.y;
        }
      }
    }
    let tx = f.ai.tx,
      ty = f.ai.ty;
    const tgt = f.ai.target;
    if (tgt && !tgt.dead && !tgt.eatenBy && !this.isProtectedInCave(f, tgt)) {
      tx = tgt.x + tgt.vx * 0.3;
      ty = tgt.y + tgt.vy * 0.3;
    } else if (tgt && this.isProtectedInCave(f, tgt)) {
      f.ai.target = null;
    }
    const dx = tx - f.x,
      dy = ty - f.y;
    const d = Math.hypot(dx, dy) || 1;
    let wantBoost = false;
    if (f.ai.flee && f.boost > 0.25) wantBoost = true;
    if (tgt && !tgt.dead && d < 90 && d > this.suckRange(f) * 0.5 && f.boost > 0.5 && Math.random() < 0.6) wantBoost = true;
    this.applyBoost(f, wantBoost, dt);
    // Gentle mine avoidance so bots steer smoothly around sea mines
    let avx = 0,
      avy = 0;
    for (const m of this.mines) {
      const mdx = f.x - m.x,
        mdy = f.y - m.y;
      const safe = m.r + f.r + 48;
      if (Math.abs(mdx) > safe || Math.abs(mdy) > safe) continue;
      const d = Math.hypot(mdx, mdy) || 1;
      if (d < safe) {
        const push = (1 - d / safe) * 1.45;
        avx += (mdx / d) * push;
        avy += (mdy / d) * push;
      }
    }
    const ms = this.maxSpeed(f) * (f.ai.flee || f.boosting ? 1 : 0.85);
    const steerX = dx / d + avx,
      steerY = dy / d + avy;
    const steerL = Math.hypot(steerX, steerY) || 1;
    // softer steering: rivals turn in arcs instead of snapping onto a new heading
    f.vx += ((steerX / steerL) * ms - f.vx) * Math.min(1, dt * 3.4);
    f.vy += ((steerY / steerL) * ms - f.vy) * Math.min(1, dt * 3.4);
    if (tgt && !tgt.dead && !tgt.eatenBy && d < f.r * 5 + tgt.r * 2) f.wantOpen = true;
    const wantSuck = !!tgt && !tgt.dead && d < this.suckRange(f) * 0.9 && Math.sign(dx) === f.face && f.energy > 0.2;
    this.applySuckState(f, wantSuck, dt);
    if (f.mass > 3200) f.mass -= dt * 14;
  }

  npcAI(f: Fish, dt: number, predators: Fish[]) {
    if (f.ai.timer <= 0) {
      f.ai.timer = 0.25 + Math.random() * 0.25;
      f.ai.flee = false;
      let threat: Fish | null = null,
        td = 1e9;
      for (const o of predators) {
        if (o === f || o.r * EAT_RATIO <= f.r) continue;
        const dx = o.x - f.x,
          dy = o.y - f.y;
        if (Math.abs(dx) > 150 || Math.abs(dy) > 150) continue;
        const d = Math.hypot(dx, dy);
        if (d < 50 + o.r * 1.6 && d < td) {
          td = d;
          threat = o;
        }
      }
      if (threat && Math.random() < 0.85) {
        const dx = f.x - threat.x,
          dy = f.y - threat.y;
        const d = Math.hypot(dx, dy) || 1;
        f.ai.tx = f.x + (dx / d) * 120;
        f.ai.ty = f.y + (dy / d) * 120;
        f.ai.flee = true;
      } else if (f.sp.predator) {
        f.ai.rest -= 0.3;
        if (f.ai.chase > 0) f.ai.chase -= 0.3;
        if (f.ai.target && (f.ai.target.dead || f.ai.target.eatenBy || f.ai.chase <= 0 || this.isProtectedInCave(f, f.ai.target))) {
          f.ai.target = null;
          f.ai.rest = 2.6;
        }
        if (!f.ai.target && f.ai.rest <= 0) {
          let best: Fish | null = null,
            bd = 170;
          const near = this.queryNear(f.x, f.y, 175);
          for (const o of near) {
            if (o === f || o.dead || !this.canEat(f, o) || this.isProtectedInCave(f, o) || o.invuln > 0) continue;
            if (o.kind === "npc" && o.r < f.r * 0.25) continue;
            const d = Math.hypot(o.x - f.x, o.y - f.y);
            const w = o.kind === "npc" ? d * 1.5 : d;
            if (w < bd) {
              bd = w;
              best = o;
            }
          }
          if (best) {
            f.ai.target = best;
            f.ai.chase = 3.5;
          }
        }
        if (!f.ai.target && (Math.hypot(f.ai.tx - f.x, f.ai.ty - f.y) < 20 || Math.random() < 0.04)) {
          f.ai.tx = clamp(f.x + (Math.random() - 0.5) * 500, 40, WORLD_W - 40);
          f.ai.ty = clamp(f.y + (Math.random() - 0.5) * 240, 80, floorY(f.x) - 50);
        }
      } else if (Math.hypot(f.ai.tx - f.x, f.ai.ty - f.y) < 15 || Math.random() < 0.06) {
        f.ai.tx = clamp(f.x + (Math.random() - 0.5) * 260, 20, WORLD_W - 20);
        f.ai.ty = clamp(f.y + (Math.random() - 0.5) * 140, 30, floorY(f.x) - 25);
      }
    }
    if (f.sucked > 0) return;
    let tx = f.ai.tx,
      ty = f.ai.ty;
    const tgt = f.ai.target;
    let boost = f.ai.flee ? 1.3 : 0.55;
    if (tgt && !tgt.dead) {
      tx = tgt.x;
      ty = tgt.y;
      boost = 1.2;
    }
    const dx = tx - f.x,
      dy = ty - f.y;
    const d = Math.hypot(dx, dy) || 1;
    if (tgt && !tgt.dead && !tgt.eatenBy && d < f.r * 5 + tgt.r * 2) f.wantOpen = true;
    // glide: never brake to a dead stop at a waypoint, and steer in wide, soft arcs
    const ms = f.sp.speed * NPC_SPEED * boost * (d < 14 ? 0.4 + (d / 14) * 0.6 : 1);
    const steer = Math.min(1, dt * (f.ai.flee ? 3.6 : 2.3));
    f.vx += ((dx / d) * ms - f.vx) * steer;
    f.vy += ((dy / d) * ms - f.vy) * steer;
  }

  checkEating(attract = false, nearX = 0, nearY = 0) {
    const list = this.fish;
    for (const e of list) {
      if (e.dead || e.eatenBy) continue;
      if (e.kind === "npc" && !e.sp.predator) continue;
      if (attract && (Math.abs(e.x - this.cam.x) > nearX || Math.abs(e.y - this.cam.y) > nearY)) continue;
      const busy = e.chompT > (e.munch ? 0.26 : 0.1);
      const mx = e.mouthX(),
        my = e.mouthY();
      const scanR = e.r * 3.1 + 58;
      const near = this.queryNear(e.x, e.y, scanR);
      const maxBatch = e.sucking ? 4 : e.kind === "player" || e.kind === "bot" ? 8 : 3;
      let eatenNow = 0;
      for (const o of near) {
        if (o === e || o.dead || o.eatenBy || o.invuln > 0) continue;
        const duel = e.kind !== "npc" && o.kind !== "npc";
        if (!this.canEat(e, o) || this.isProtectedInCave(e, o)) {
          // Similar-size rival fish gently bump/deflect off each other instead of overlapping or unfairly eating!
          if (duel && e.id < o.id && !this.canEat(o, e) && !this.isProtectedInCave(o, e)) {
            const bdx = o.x - e.x,
              bdy = o.y - e.y;
            const minD = (e.r + o.r) * 0.68;
            if (Math.abs(bdx) < minD && Math.abs(bdy) < minD) {
              const bd = Math.hypot(bdx, bdy) || 0.01;
              if (bd < minD) {
                const nx = bdx / bd,
                  ny = bdy / bd;
                const push = (minD - bd) * 0.5;
                e.x -= nx * push;
                e.y -= ny * push;
                o.x += nx * push;
                o.y += ny * push;
                e.vx -= nx * 24;
                e.vy -= ny * 24;
                o.vx += nx * 24;
                o.vy += ny * 24;
              }
            }
          }
          continue;
        }
        if (e.kind === "npc" && o.kind === "npc" && o.r < e.r * 0.25) continue;
        const streamGulp = o.fry || (e.sucking && o.r < e.r * 0.48);
        const multiBite = !e.sucking && (o.fry || o.r < e.r * 0.68);
        if (e.sucking) {
          if (streamGulp ? e.slurpCd > 0 : busy) continue;
        } else if (!multiBite && busy) {
          continue;
        }
        const dx = o.x - mx,
          dy = o.y - my;
        const reach = duel ? o.r * 0.84 + e.r * 0.42 : o.r + e.r * 0.56;
        if (Math.abs(dx) > reach * 5.2 || Math.abs(dy) > reach * 5.2) continue;
        const d = Math.hypot(dx, dy);
        if (d < reach * 5.2) {
          e.wantOpen = true;
          e.wantOpenAmt = Math.max(e.wantOpenAmt, clamp(1.08 - (d - reach) / Math.max(1, reach * 4.2), 0.35, 1.15));
        }
        if (d < reach || (!duel && Math.hypot(o.x - e.x, o.y - e.y) < e.r * 0.58)) {
          this.startEat(e, o);
          eatenNow++;
          if (e.sucking) {
            if (!streamGulp || eatenNow >= maxBatch) break;
            e.slurpCd = 0.014;
          } else {
            if (!multiBite || eatenNow >= maxBatch) break;
          }
        }
      }
    }
  }

  startEat(e: Fish, o: Fish) {
    if (o === this.player && this.shieldT > 0) {
      this.shieldT = 0;
      o.invuln = 2.4;
      const dx = e.x - o.x;
      const dy = e.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      e.vx = (dx / d) * 165;
      e.vy = (dy / d) * 165;
      e.ai.target = null;
      e.ai.rest = 1.4;
      this.shake = Math.min(5, this.shake + 3.5);
      sfx.shieldBreak();
      this.spawnRing(o.x, o.y, "#5eead4", o.r * 2.6);
      this.spawnSparks(o.x, o.y, "#a7f3d0", 18);
      this.texts.push({ x: o.x, y: o.y - o.r - 14, text: "PERISAI MENAHAN!", color: "#6ee7b7", life: 1.25, max: 1.25, size: 10 });
      this.onEvent?.({ type: "feed", text: `Perisai gelembung menahan gigitan ${e.name || e.sp.name}!` });
      return;
    }
    o.eatenBy = e;
    o.eatT = 0;
    o.eatFromX = o.x;
    o.eatFromY = o.y;
    o.sucking = false;
    o.boosting = false;
    e.gulpColor = o.sp.pal.body;
    e.gulpTailColor = o.sp.pal.fin || o.sp.pal.tail || o.sp.pal.belly;
    if (e.sucking) {
      e.chompT = 0;
      e.jawV = Math.max(e.jawV, 16);
      e.mouthOpenT = Math.max(e.mouthOpenT, 0.28);
    } else if (e.chompPhase <= 0 && e.chompQueue === 0) {
      e.chompT = 0;
      e.jawV = Math.max(e.jawV, 24);
      e.mouthOpenT = Math.max(e.mouthOpenT, o.fry ? 0.24 : 0.28);
      e.biteLungeV -= Math.min(62, Math.max(16, e.r * 2.1));
      e.sqv -= 4.5;
    }
    if (o === this.player) {
      sfx.setSuck(false);
    }
  }

  finishEat(e: Fish, o: Fish) {
    o.dead = true;
    o.eatenBy = null;
    const mx = e.mouthX(),
      my = e.mouthY();
    const tiny = o.fry;
    const big = o.r > e.r * 0.4;

    if (e.kind === "npc") {
      e.mass += o.mass * 0.025;
    } else {
      const taper = 1 / (1 + Math.max(0, e.r - 8) * 0.04);
      const rawGain = o.mass * GAIN * taper;
      const maxStep = e.mass * 0.055 + 2.0;
      e.mass += Math.min(rawGain, maxStep);
    }
    if (e.r > e.maxR) e.mass = e.maxR * e.maxR;

    e.swallowT = 1;
    e.gulpColor = o.sp.pal.body;
    e.gulpTailColor = o.sp.pal.fin || o.sp.pal.tail || o.sp.pal.belly;
    const biteGain = tiny ? 0.34 : 0.42 + Math.min(0.36, (o.r / e.r) * 0.58);
    e.gulpK = Math.min(0.88, (e.gulpT > 0 ? e.gulpK * 0.80 : 0) + biteGain * (e.gulpT > 0 ? 0.34 : 1.0));
    e.gulpT = 1;
    if (e.sucking && (tiny || o.r < e.r * 0.48)) {
      // Rapid suction slurp: mouth stays lively wide open while prey enters throat
      e.sqv += tiny ? 2.5 : 4.2;
    } else {
      // Non-suction bite mode: brief wide-open throat entry window, then crisp snap-chomp while throat-to-belly swells
      if (e.chompPhase <= 0 && e.chompQueue === 0) {
        e.chompDur = big ? 0.24 : 0.16;
        // Start Bite #1 just before SLAM (u=0.28) so jaw stays wide open as food enters pharynx, then slams!
        e.chompPhase = e.chompDur * 0.72;
        e.chompBitFired = false;
      } else {
        // Additional fish eaten in the same cluster/school queue 1 extra rapid snap each!
        e.chompQueue = Math.min(12, e.chompQueue + 1);
      }
      e.munch = e.munch || big;
      e.chompT = big ? 0.58 : 0.32;
    }
    e.score += Math.round(o.mass * 12);

    const onScreen = Math.abs(mx - this.cam.x) < this.vw && Math.abs(my - this.cam.y) < this.vh;
    if (onScreen) {
      const gx = e.x + e.face * e.r * 0.16,
        gy = e.y + e.r * 0.08;
      const gCnt = tiny ? 1 : 2;
      for (let i = 0; i < gCnt; i++) {
        const b = this.bubble(gx + (Math.random() - 0.5) * e.r * 0.18, gy + (Math.random() - 0.5) * e.r * 0.18, 0.8 + Math.random() * 1.1);
        b.vx -= e.face * (12 + Math.random() * 14);
        this.particles.push(b);
      }
      const cols = [o.sp.pal.body, o.sp.pal.belly, o.sp.pal.fin];
      if (tiny) {
        this.spawnRing(mx, my, o.sp.pal.fin, 3.4);
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = 16 + Math.random() * 34;
          this.particles.push({
            x: mx,
            y: my,
            vx: Math.cos(a) * s + e.face * 12,
            vy: Math.sin(a) * s - 10,
            life: 0.3 + Math.random() * 0.25,
            max: 0.55,
            type: "bit",
            color: cols[i],
            size: 1.1 + Math.random() * 0.8,
          });
        }
        if (Math.random() < 0.5) this.particles.push(this.bubble(mx, my, 0.9 + Math.random() * 1.2));
      } else {
        this.particles.push({
          x: mx + e.face * e.r * 0.15,
          y: my,
          vx: e.face * 10,
          vy: 0,
          life: 0.22,
          max: 0.22,
          type: "chomp",
          color: "#e0f7ff",
          size: Math.max(6, e.r * 0.65),
          dir: e.face,
        });
        const n = 7 + Math.min(12, Math.round(o.r));
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = 20 + Math.random() * 58;
          this.particles.push({
            x: mx,
            y: my,
            vx: Math.cos(a) * s + e.face * 18,
            vy: Math.sin(a) * s - 16,
            life: 0.5 + Math.random() * 0.4,
            max: 0.9,
            type: "bit",
            color: cols[i % 3],
            size: 1.6 + Math.random() * 1.6,
          });
        }
        for (let i = 0; i < 4; i++) this.particles.push(this.bubble(mx + (Math.random() - 0.5) * 8, my, 1.2 + Math.random() * 2.2));
        this.spawnRing(mx, my, "#bae6fd", Math.max(5, o.r));
        // impact speed-lines + a second, wider shock ring
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
          const s = 95 + Math.random() * 75;
          this.particles.push({ x: mx + Math.cos(a) * 3, y: my + Math.sin(a) * 3, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.2, max: 0.2, type: "streak", color: "#ffffff", size: 1 });
        }
        this.spawnRing(mx, my, "#ffffff", Math.max(8, o.r * 1.7));
      }
    }

    if (e === this.player) {
      e.combo++;
      this.maxCombo = Math.max(this.maxCombo, e.combo);
      e.comboT = 2.6;
      this.chainPop = 1;
      const mult = e.combo >= 10 ? 3 : e.combo >= 5 ? 2 : 1;
      const pts = Math.round((45 + o.mass * 3.5 + (o.kind === "bot" ? 500 : 0)) * mult);
      this.arcadeScore += pts;

      let coins = tiny ? (o.school?.golden ? 2 : 1) : Math.max(1, Math.round(o.r / 2.6)) * mult;
      if (o.kind === "bot") {
        coins += 15;
        this.botsEatenCount++;
      }
      const n = Math.min(coins, 10);
      for (let i = 0; i < n; i++) {
        const v = Math.floor(coins / n) + (i < coins % n ? 1 : 0);
        this.addFlyCoin(mx, my, v, i * 0.045, e.face);
      }
      this.eatenCount++;
      if (tiny) {
        // no text spam per fry: pops climb in pitch and the chain is summed up when it ends
        this.streamPts += pts;
        this.streamCoins += coins;
        this.streamN++;
        this.streamT = 0.5;
        sfx.pop(e.combo);
        this.shake = Math.min(1.2, this.shake + 0.18);
        const s = o.school;
        if (s) {
          s.byPlayer++;
          if (!s.members.some((m) => !m.dead) && s.byPlayer >= s.size0 * 0.7) this.schoolBonus(s, mx, my);
        }
      } else {
        this.texts.push({ x: mx, y: my - e.r * 0.8, text: "+" + pts, color: "#fff3a1", life: 0.85, max: 0.85, size: 8 });
        if (Math.random() < 0.55 || o.r > e.r * 0.5) {
          this.texts.push({
            x: mx + (Math.random() - 0.5) * 10,
            y: my - e.r * 1.4 - 8,
            text: WORDS[Math.floor(Math.random() * WORDS.length)],
            color: "#ffffff",
            life: 0.7,
            max: 0.7,
            size: 9,
          });
        }
        this.spawnSparks(mx, my - e.r * 0.3, "#fff7c2", 5);
        sfx.gulp(o.r / 6, true, e.combo);
        this.shake = Math.min(3, this.shake + 0.5 + o.r / 10);
        // hit-stop: a few frozen frames sell the weight of a big bite
        // hit-stop only for genuinely big bites (it used to fire on almost every bite of a small fish,
        // which read as stutter rather than impact)
        this.freeze = o.kind === "bot" ? 0.045 : 0;
      }
      if (e.combo === 7 || e.combo === 14 || e.combo === 22) {
        this.onEvent?.({ type: "frenzy", n: e.combo });
        sfx.frenzy();
        this.spawnSparks(e.x, e.y, "#ffe14a", 22);
      } else if (e.combo >= 3) {
        this.onEvent?.({ type: "combo", n: e.combo });
        if (!tiny) sfx.combo(e.combo);
      }
      if (o.kind === "bot") this.onEvent?.({ type: "feed", text: `${e.name} memakan ${o.name}!` });
    } else if (!this.menuActive && onScreen && !tiny && Math.abs(mx - this.cam.x) < this.vw / 2) {
      sfx.gulp(o.r / 6, false);
    }

    if (o.kind === "bot") {
      this.respawnQueue.push({ t: 1.5 + Math.random() * 2.5, name: o.name, skin: o.skinRef || SKINS[0] });
      if (!this.menuActive && e.kind === "bot") this.onEvent?.({ type: "feed", text: `${e.name} memakan ${o.name}!` });
    }
    if (o === this.player) {
      this.killerName = e.name || e.sp.name;
      this.killerSpId = e.skinRef?.id || e.sp.id;
      this.deathTimer = 1.6;
      this.shake = 6;
      sfx.die();
      sfx.setSuck(false);
      this.texts.push({ x: mx, y: my - e.r - 10, text: "DIMAKAN!", color: "#ff5a6a", life: 1.5, max: 1.5, size: 16 });
      this.onEvent?.({ type: "feed", text: `${this.killerName} memakan ${o.name}!` });
      this.spectate = e;
    }
  }

  /** A coin pops out of the mouth (staggered by `delay`), then swoops to the coin counter. */
  addFlyCoin(x: number, y: number, value: number, delay = 0, dir = 0) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9 + dir * 0.3;
    const s = 70 + Math.random() * 90;
    this.flyCoins.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: -delay, value, sx: x, sy: y, bend: (Math.random() < 0.5 ? -1 : 1) * (16 + Math.random() * 30), trail: 0 });
  }

  bubble(x: number, y: number, size: number): Particle {
    return { x, y, vx: 0, vy: -10 - Math.random() * 10, life: 2.2 + Math.random() * 2, max: 4.2, type: "bubble", color: "#e8ffff", size };
  }

  spawnRing(x: number, y: number, color: string, size: number) {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0.36, max: 0.36, type: "ring", color, size });
  }

  spawnSparks(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 38 + Math.random() * 85;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.55 + Math.random() * 0.4,
        max: 0.95,
        type: Math.random() < 0.5 ? "star" : "spark",
        color,
        size: 1.8,
      });
    }
  }

  emitHud() {
    const p = this.player;
    const ranked = this.fish.filter((f) => (f.kind === "bot" || f.kind === "player") && !f.dead).sort((a, b) => b.mass - a.mass);
    this.leaderId = ranked[0]?.id ?? -1;
    const rank = p && !p.dead ? ranked.indexOf(p) + 1 : 0;
    if (rank > 0) {
      this.bestRank = Math.min(this.bestRank, rank);
      if (rank === 1 && !this.reachedRank1) {
        this.reachedRank1 = true;
        this.onEvent?.({ type: "rank1" });
      }
    }
    const frenzyStage = p ? Math.min(7, p.combo) : 0;
    const py = p ? p.y : this.cam.y;
    const zoneName = `${ZONE_LABELS[zoneAt(py)]} (${depthMeters(py)} m)`;
    this.onHud?.({
      coins: this.sessionCoins,
      score: this.arcadeScore,
      mass: p ? Math.round(p.mass) : 0,
      energy: p ? p.energy : 0,
      combo: p ? p.combo : 0,
      comboT: p ? p.comboT : 0,
      frenzyStage,
      level: this.level,
      growthPct: p ? this.calcGrowthPct(p.r) : 0,
      stageNum: Math.max(1, this.level - 1),
      zoneName,
      rank,
      total: ranked.length + this.respawnQueue.length, // rivals waiting to respawn still count: always 50 players
      leaderboard: ranked.slice(0, 6).map((f) => ({ name: f.name, score: Math.round(f.mass), me: f === p, color: f.sp.pal.body })),
      alive: !!p && !p.dead && this.deathTimer < 0,
      exhausted: p ? p.exhausted : false,
      boost: p ? p.boost : 0,
      boostExhausted: p ? p.boostExhausted : false,
      sucking: p ? p.sucking : false,
      boosting: p ? p.boosting : false,
      shieldT: this.shieldT,
      turboT: this.turboT,
      vortexT: this.vortexT,
    });
  }

  drawMinimap() {
    const m = this.minimap;
    if (!m) return;
    const c = m.getContext("2d")!;
    const w = m.width,
      h = m.height;
    const mg = c.createLinearGradient(0, 0, 0, h);
    mg.addColorStop(0, "#155e8a");
    mg.addColorStop(0.45, "#0c2d5e");
    mg.addColorStop(1, "#050d28");
    c.fillStyle = mg;
    c.fillRect(0, 0, w, h);

    const sx = w / WORLD_W,
      sy = h / WORLD_H;

    // Show cavern rock islands & cave shelters on minimap!
    c.fillStyle = "rgba(38, 95, 145, 0.7)";
    for (const col of this.ocean.colliders) {
      if (col.maxPassR !== undefined) continue;
      c.beginPath();
      c.arc(col.x * sx, col.y * sy, Math.max(1.5, col.r * sx * 1.2), 0, Math.PI * 2);
      c.fill();
    }
    for (const cv of this.ocean.caves) {
      c.fillStyle = "rgba(4, 12, 34, 0.92)";
      c.beginPath();
      c.ellipse(cv.x * sx, cv.y * sy, Math.max(2, cv.rx * sx * 0.72), Math.max(1.6, cv.ry * sy * 0.75), 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#5eead4";
      c.beginPath();
      c.arc(cv.x * sx, cv.y * sy, 1.35, 0, Math.PI * 2);
      c.fill();
    }

    c.fillStyle = "#4c2882";
    for (let x = 0; x < w; x++) {
      const fy = (floorY((x / w) * WORLD_W) / WORLD_H) * h;
      c.fillRect(x, fy, 1, h - fy);
    }

    c.strokeStyle = "rgba(255,245,190,0.75)";
    c.lineWidth = 1;
    c.strokeRect(this.camLeft * sx + 0.5, this.camTop * sy + 0.5, this.vw * sx, this.vh * sy);
    const p = this.player;
    for (const f of this.fish) {
      if (f.dead) continue;
      if (f.kind === "bot") {
        c.fillStyle = p && !p.dead && this.canEat(f, p) ? "#ff4a5a" : f.sp.pal.body;
        c.beginPath();
        c.arc(f.x * sx, f.y * sy, 1.9, 0, Math.PI * 2);
        c.fill();
      } else if (f.kind === "npc" && f.sp.predator) {
        c.fillStyle = "#ff8a8a";
        c.fillRect(f.x * sx - 1, f.y * sy - 1, 2, 2);
      }
    }
    // pearls & power-up orbs show as twinkling beacons on minimap
    for (const o of this.orbs) {
      c.fillStyle = o.kind === "pearl" ? "#ffe96b" : o.kind === "turbo" ? "#67e8f9" : o.kind === "vortex" ? "#fdba74" : "#6ee7b7";
      c.beginPath();
      c.arc(o.x * sx, o.y * sy, 2.1, 0, Math.PI * 2);
      c.fill();
    }
    // snack schools show up as little shimmering clusters
    c.fillStyle = "rgba(200, 245, 255, 0.95)";
    for (const s of this.schools) {
      if (s.members.length < 4) continue;
      c.fillStyle = s.golden ? "rgba(255, 226, 90, 0.98)" : "rgba(200, 245, 255, 0.95)";
      const qx = s.x * sx,
        qy = s.y * sy;
      c.fillRect(qx - 2, qy - 0.5, 1, 1);
      c.fillRect(qx, qy - 1.5, 1, 1);
      c.fillRect(qx + 1.5, qy + 0.5, 1, 1);
      c.fillRect(qx - 0.5, qy + 1, 1, 1);
    }
    // sea mine bombs blink crimson on minimap
    c.fillStyle = Math.floor(this.t * 4) % 2 === 0 ? "#ff3b4e" : "#fca5a5";
    for (const mn of this.mines) {
      c.beginPath();
      c.arc(mn.x * sx, mn.y * sy, 1.9, 0, Math.PI * 2);
      c.fill();
    }
    if (p && !p.dead) {
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(p.x * sx, p.y * sy, 3.2, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#ffa22a";
      c.beginPath();
      c.arc(p.x * sx, p.y * sy, 2, 0, Math.PI * 2);
      c.fill();
    }
  }

  // Draws 100% Seamless, Line-Free, Velvety Water Suction Mist (zero lines, zero triangle cone borders!)
  drawSoftSuctionVortex(f: Fish, camLeft: number, camTop: number, vw: number, vh: number) {
    if (f.suckVis < 0.02) return;
    const mx = f.mouthX() - camLeft,
      my = f.mouthY() - camTop;
    if (mx < -180 || mx > vw + 180 || my < -180 || my > vh + 180) return;
    const ctx = this.ctx;
    const range = this.suckRange(f);
    const ang = Math.atan2(Math.sin(f.tilt), f.face * Math.cos(f.tilt));
    const vis = f.suckVis;
    const S = this.pixelMode ? 1 : this.zoom * this.dpr;
    const cs = Math.cos(ang) * S,
      sn = Math.sin(ang) * S;
    const orb = glowOrb("rgba(170, 240, 255, 0.5)", false);
    ctx.globalCompositeOperation = "lighter";
    ctx.setTransform(cs, sn, -sn, cs, mx * S, my * S);
    // Soft air/water suction vortex field + silky converging hydro-ribbons
    const rc = range * 0.48;
    ctx.globalAlpha = 0.22 * vis;
    ctx.drawImage(orb, range * 0.4 - rc, -rc * 0.46, rc * 2, rc * 0.92);
    // Subtle intake mouth glow
    ctx.globalAlpha = 0.28 * vis;
    ctx.drawImage(orb, -f.r * 0.35, -f.r * 0.5, f.r * 1.1, f.r);

    // Subtle inward-moving crescent intake ripples
    for (let w = 0; w < 2; w++) {
      const wp = (this.t * 1.65 + w * 0.5) % 1;
      const wAlpha = Math.sin(wp * Math.PI) * 0.24 * vis;
      const wx = range * (0.86 - wp * 0.72);
      const wy = Math.max(4, wx * 0.48);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(215, 248, 255, ${wAlpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(1.0, f.r * 0.08);
      ctx.beginPath();
      ctx.arc(wx * 0.25, 0, Math.hypot(wx * 0.75, wy), -0.42, 0.42);
      ctx.stroke();
    }

    // 6 smooth translucent airflow ribbons curving evenly into the mouth (zero per-frame gradient allocations)
    ctx.lineCap = "round";
    const tracks = [-0.36, 0.36, -0.21, 0.21, -0.08, 0.08];
    for (let i = 0; i < tracks.length; i++) {
      const prog = (this.t * 1.55 + i * 0.17) % 1;
      const fade = Math.sin(prog * Math.PI) * vis;
      if (fade <= 0.01) continue;
      const side = tracks[i];
      const x1 = range * (0.98 - prog * 0.68);
      const x0 = Math.max(range * 0.04, x1 - range * 0.36);
      const y1 = side * range * (1 - prog * 0.58);
      const y0 = side * range * 0.16 * (1 - prog * 0.55);
      const xm = (x0 + x1) * 0.48;
      const ym = y1 * 0.48;
      const baseW = Math.max(1.05, f.r * (Math.abs(side) < 0.15 ? 0.11 : 0.085));
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(215, 248, 255, ${(0.14 * fade).toFixed(3)})`;
      ctx.lineWidth = baseW * 1.35;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(xm, ym, x0, y0);
      ctx.stroke();

      ctx.strokeStyle = `rgba(232, 253, 255, ${(0.28 * fade).toFixed(3)})`;
      ctx.lineWidth = baseW * 0.72;
      ctx.beginPath();
      ctx.moveTo(x1 * 0.92 + x0 * 0.08, y1 * 0.92 + y0 * 0.08);
      ctx.quadraticCurveTo(xm, ym, x0 * 0.88 + x1 * 0.12, y0 * 0.88 + y1 * 0.12);
      ctx.stroke();
    }
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /** Feeding Frenzy iconic spiked iron naval sea mine with anchor chain & pulsing red danger light */
  drawMines(camLeft: number, camTop: number, vw: number, vh: number, t: number) {
    const ctx = this.ctx;
    const redGlow = glowOrb("rgba(255, 62, 62, 0.72)", false);
    for (const m of this.mines) {
      const x = m.x - camLeft;
      const y = m.y - camTop;
      if (x < -45 || x > vw + 45 || y < -45 || y > vh + 260) continue;

      // 1. Anchored steel link chain down toward seafloor
      const botY = Math.min(vh + 12, y + m.tether);
      ctx.save();
      ctx.strokeStyle = "rgba(18, 28, 46, 0.78)";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      let cy = y + m.r * 0.95;
      while (cy < botY) {
        const sway = Math.sin(t * 1.3 + m.ph + (cy - y) * 0.04) * 2.2;
        ctx.beginPath();
        ctx.ellipse(x + sway, cy + 3, 1.9, 3.3, 0, 0, Math.PI * 2);
        ctx.stroke();
        cy += 6.2;
      }

      // 2. Pulsing red danger halo
      const blink = 0.5 + 0.5 * Math.sin(t * 7.5 + m.ph);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.25 + blink * 0.45;
      const gR = m.r * (2.35 + blink * 0.45);
      ctx.drawImage(redGlow, x - gR, y - gR, gR * 2, gR * 2);
      ctx.restore();

      // 3. Spiked naval mine sphere
      ctx.translate(x, y);
      ctx.rotate(m.rot);

      // 8 metallic detonator horns / spikes radiating around the iron sphere
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        ctx.save();
        ctx.rotate(ang);
        ctx.fillStyle = "#475569";
        ctx.strokeStyle = "#0b1220";
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(-2.7, -m.r + 1.5);
        ctx.lineTo(-1.3, -m.r - 6.8);
        ctx.lineTo(1.3, -m.r - 6.8);
        ctx.lineTo(2.7, -m.r + 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Rounded red-tipped primer cap on each spike
        ctx.fillStyle = "#b91c1c";
        ctx.beginPath();
        ctx.arc(0, -m.r - 7.1, 1.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 3D cast-iron shaded main sphere
      const mg = ctx.createRadialGradient(-m.r * 0.34, -m.r * 0.36, 1.2, 0, 0, m.r * 1.05);
      mg.addColorStop(0, "#94a3b8");
      mg.addColorStop(0.28, "#475569");
      mg.addColorStop(0.7, "#1e293b");
      mg.addColorStop(1, "#090f1d");
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(0, 0, m.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#070b14";
      ctx.lineWidth = 1.65;
      ctx.stroke();

      // Seam band & rivets
      ctx.strokeStyle = "rgba(148, 163, 184, 0.36)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(0, 0, m.r * 0.92, m.r * 0.34, 0.25, 0, Math.PI * 2);
      ctx.stroke();

      // Central blinking warning fuse lamp
      ctx.fillStyle = blink > 0.45 ? "#ff3b30" : "#7f1d1d";
      ctx.beginPath();
      ctx.arc(0, 0, m.r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#090f1d";
      ctx.lineWidth = 1;
      ctx.stroke();
      if (blink > 0.45) {
        ctx.fillStyle = "#fef08a";
        ctx.beginPath();
        ctx.arc(-0.8, -0.8, m.r * 0.11, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /** Outlined text drawn once into a small canvas and then reused as a sprite (stroking glyphs per frame is slow). */
  label(text: string, col: string, size: number): { cv: HTMLCanvasElement; w: number; h: number } {
    const q = Math.min(4, Math.max(1, Math.ceil(this.pxs() * 2) / 2)); // device px per world unit, in half steps
    const key = text + "|" + col + "|" + size + "|" + q + (this.pixelMode ? "p" : "");
    let e = this.labels.get(key);
    if (!e) {
      const font = this.pixelMode ? `${Math.max(5, size - 2)}px 'Press Start 2P', monospace` : `700 ${size}px 'Fredoka', system-ui, sans-serif`;
      const cv = document.createElement("canvas");
      const c = cv.getContext("2d")!;
      c.font = font;
      const w = c.measureText(text).width + 6.4,
        h = size * 1.5 + 6.4;
      cv.width = Math.max(2, Math.ceil(w * q));
      cv.height = Math.max(2, Math.ceil(h * q));
      c.setTransform(q, 0, 0, q, 0, 0);
      c.font = font;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.lineJoin = "round";
      c.miterLimit = 2;
      c.strokeStyle = "rgba(8, 22, 52, 0.9)";
      c.lineWidth = 2.6;
      c.strokeText(text, w / 2, h / 2);
      c.fillStyle = col;
      c.fillText(text, w / 2, h / 2);
      e = { cv, w: cv.width / q, h: cv.height / q };
      if (this.labels.size > 260) this.labels.clear();
      this.labels.set(key, e);
    }
    return e;
  }

  private pxs() {
    return this.pixelMode ? 1 : this.zoom * this.dpr;
  }

  render() {
    if (!this.ocean.ready) return;
    beginSpriteFrame(SPRITE_BUDGET);
    this.live3DBudget = this.menuActive ? 0 : isSoftwareWebGL() ? 2 : 5;
    if (!this.menuActive) fish3d.beginFrame(isSoftwareWebGL() ? 1 : 2);
    const ctx = this.ctx;
    const scale = this.pixelMode ? 1 : this.zoom * this.dpr;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = !this.pixelMode;

    const vw = this.vw,
      vh = this.vh;
    let camLeft = this.cam.x - vw / 2;
    let camTop = this.cam.y - vh / 2;
    camLeft = vw >= WORLD_W ? (WORLD_W - vw) / 2 : clamp(camLeft, 0, WORLD_W - vw);
    camTop = clamp(camTop, -34, WORLD_H + 35 - vh);
    if (this.shake > 0) {
      // a smooth decaying wobble instead of random per-frame jitter
      camLeft += Math.sin(this.t * 58) * this.shake * 0.45;
      camTop += Math.cos(this.t * 47) * this.shake * 0.45;
    }
    // one camera, snapped to the device-pixel grid, for EVERYTHING drawn this frame: sprites and pixel-art
    // backgrounds then move in lockstep (no 1px wobble of fish against the reef)
    camLeft = Math.round(camLeft * scale) / scale;
    camTop = Math.round(camTop * scale) / scale;
    this.camLeft = camLeft;
    this.camTop = camTop;
    const t = this.t;
    const oc = this.ocean;
    oc.time = t;
    oc.pxs = scale;
    const focus = this.player && !this.player.dead ? this.player : null;
    oc.focusX = focus ? focus.x : -9999;
    oc.focusY = focus ? focus.y : -9999;

    const laut = this.lautActive();
    if (laut) {
      // "Dunia Laut 3D": live water volume, god-rays and far canyon walls, then the painted sea life
      laut.update(this.canvas, camLeft, camTop, vw, vh, t);
      oc.tickLaut();
      laut.drawPass(0, ctx);
      oc.drawLautLife(ctx, camLeft, camTop, vw, vh);
    } else if (this.bgStyle !== "game1") {
      this.ensureReefBackdropAssets();
      const isCustom169 =
        this.bgStyle === "shipwreck" || this.bgStyle === "kelp" || this.bgStyle === "temple" || this.bgStyle === "lagoon";
      const brightWater = this.bgStyle !== "game2" && this.bgStyle !== "kelp";
      const img =
        this.bgStyle === "shipwreck"
          ? this.shipwreckImg
          : this.bgStyle === "kelp"
            ? this.kelpImg
            : this.bgStyle === "temple"
              ? this.templeImg
              : this.bgStyle === "lagoon"
                ? this.lagoonImg
                : this.habitatImg;
      const maxTop = isCustom169 ? 1150 : 900;
      const matte = !!img?.complete && !!img.naturalWidth && camTop < maxTop;
      if (brightWater || !matte || camTop > 480) oc.drawWater(ctx, camLeft, camTop, vw, vh);
      if (matte && img) {
        const aspect = img.naturalWidth / img.naturalHeight;
        const width = Math.max(vw * 1.14, vh * aspect * (isCustom169 ? 1.12 : 1.22));
        const height = width / aspect;
        const dx = -(width - vw) * (0.5 + 0.35 * Math.sin(camLeft * 0.0008));
        const dy = -(height - vh) * clamp(0.25 + camTop / 1150, 0, 1);
        const fade = isCustom169 ? clamp(1 - (camTop - 620) / 560, 0, 1) : clamp(1 - (camTop - 480) / 490, 0, 1);
        ctx.save();
        if (isCustom169) {
          ctx.globalAlpha = fade * 0.9;
          ctx.drawImage(img, dx, dy, width, height);
        } else if (brightWater) {
          ctx.globalAlpha = fade * 0.48;
          ctx.drawImage(img, dx, dy, width, height);
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = fade * 0.56;
          ctx.drawImage(img, dx, dy, width, height);
        } else {
          ctx.globalAlpha = fade;
          ctx.drawImage(img, dx, dy, width, height);
        }
        ctx.restore();
        if (brightWater) oc.drawLight(ctx, 0, camLeft, camTop, vw, vh, t);
        if (camTop <= 480) oc.tickLaut();
        oc.drawHabitatLife(ctx, camLeft, camTop, vw, vh);
      } else {
        oc.drawLight(ctx, 0, camLeft, camTop, vw, vh, t);
        oc.drawLayers(ctx, camLeft, camTop, vw, vh, true);
      }
    } else {
      oc.drawWater(ctx, camLeft, camTop, vw, vh);
      oc.drawLight(ctx, 0, camLeft, camTop, vw, vh, t); // sun bloom, far shafts, caustics
      oc.drawLayers(ctx, camLeft, camTop, vw, vh, true);
    }

    // Soft glowing floating plankton & bioluminescent deep-sea dust (pre-cached orbs!)
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const deepAmt = clamp((camTop - 680) / 720, 0, 1);
    ctx.globalAlpha = 0.38 + deepAmt * 0.36;
    for (const m of this.motes) {
      const p = 0.6 + m.s * 0.5;
      const x = ((((m.x - camLeft * p + t * 3.5 * m.s) % 2000) + 2000) % 2000) - 100;
      const y = ((((m.y - camTop * p + Math.sin(t + m.x) * 6) % 1800) + 1800) % 1800) - 100;
      if (x < -10 || x > vw + 10 || y < -10 || y > vh + 10) continue;
      const rad = (m.s > 0.7 ? 2.6 : 1.6) * (1 + deepAmt * 0.45);
      ctx.drawImage(m.orb, x - rad, y - rad, rad * 2, rad * 2);
    }
    ctx.restore();

    // Scenic Rock Overhangs, Stalactite Arches & Glowing Bioluminescent Crevices!
    if (laut) {
      laut.drawPass(1, ctx); // rock pinnacles, coral reef, sea floor, vents, treasure, residents
      oc.drawLautDecor(ctx, camLeft, camTop, vw, vh, t);
    } else {
      oc.drawRockFormations(ctx, camLeft, camTop, vw, vh, t);
      oc.drawFloor(ctx, camLeft, camTop, vw, vh);
      oc.drawBackDecor(ctx, camLeft, camTop, vw, vh, t);
    }

    for (const c of this.worldCoins) {
      const x = c.x - camLeft,
        y = c.y - camTop;
      if (x < -12 || x > vw + 12 || y < -12 || y > vh + 12) continue;
      const blink = c.t > 20 && Math.floor(c.t * 8) % 2 === 0;
      if (blink) continue;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.45 + Math.sin(t * 5 + c.x) * 0.18;
      ctx.drawImage(glowOrb("rgba(255, 214, 80, 0.55)", false), x - 11, y - 11, 22, 22);
      ctx.restore();
      ctx.drawImage(coinSprite(Math.floor(c.t * 10 + c.x)), x - 5.5, y - 5.5, 11, 11);
    }

    // Giant Clam Pearls & Glowing Power-Up Bubbles
    for (const o of this.orbs) {
      const x = o.x - camLeft;
      const y = o.y - camTop;
      if (x < -24 || x > vw + 24 || y < -24 || y > vh + 24) continue;
      const pulse = 1 + Math.sin(t * 4.5 + o.ph) * 0.08;
      const glowCol =
        o.kind === "pearl"
          ? "rgba(255, 232, 130, 0.7)"
          : o.kind === "turbo"
            ? "rgba(80, 232, 255, 0.72)"
            : o.kind === "vortex"
              ? "rgba(255, 175, 80, 0.72)"
              : "rgba(95, 242, 185, 0.72)";
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.55 + Math.sin(t * 3.5 + o.ph) * 0.16;
      ctx.drawImage(glowOrb(glowCol, false), x - 18 * pulse, y - 18 * pulse, 36 * pulse, 36 * pulse);
      ctx.restore();

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pulse, pulse);
      if (o.kind === "pearl") {
        // Cached iridescent mother-of-pearl sprite + dynamic specular star glint
        ctx.drawImage(getPearlSprite(), -9.5, -9.5, 19, 19);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(-2.5, -2.5, 1.9, 0, Math.PI * 2);
        ctx.fill();
        const gl = 3.2 + Math.sin(t * 6 + o.ph) * 0.8;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(-2.5 - gl, -2.5);
        ctx.lineTo(-2.5 + gl, -2.5);
        ctx.moveTo(-2.5, -2.5 - gl);
        ctx.lineTo(-2.5, -2.5 + gl);
        ctx.stroke();
      } else {
        const coreCol = o.kind === "turbo" ? "#22d3ee" : o.kind === "vortex" ? "#fb923c" : "#34d399";
        ctx.fillStyle = "rgba(10, 32, 68, 0.55)";
        ctx.beginPath();
        ctx.arc(0, 0, 8.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = coreCol;
        ctx.lineWidth = 1.7;
        ctx.stroke();
        ctx.fillStyle = coreCol;
        if (o.kind === "turbo") {
          ctx.beginPath();
          ctx.moveTo(1.5, -5.2);
          ctx.lineTo(-3.5, 0.5);
          ctx.lineTo(0, 0.5);
          ctx.lineTo(-1.5, 5.2);
          ctx.lineTo(3.8, -0.5);
          ctx.lineTo(0.2, -0.5);
          ctx.closePath();
          ctx.fill();
        } else if (o.kind === "vortex") {
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(0, 0, 4.4, 0, Math.PI * 1.55);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -5);
          ctx.lineTo(4.4, -2.5);
          ctx.quadraticCurveTo(4.2, 2.8, 0, 5.4);
          ctx.quadraticCurveTo(-4.2, 2.8, -4.4, -2.5);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.beginPath();
        ctx.arc(-3.5, -3.5, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Spiked Feeding Frenzy Naval Sea Mines
    this.drawMines(camLeft, camTop, vw, vh, t);

    // only fish near the view are sorted & drawn (the ocean holds ~650)
    const sorted = this.vis;
    sorted.length = 0;
    for (const f of this.fish) {
      if (f.dead) continue;
      const m = f.r * 3 + 70;
      const fx = f.eatenBy ? f.eatFromX : f.x,
        fy = f.eatenBy ? f.eatFromY : f.y;
      if (fx < camLeft - m || fx > camLeft + vw + m || fy < camTop - m || fy > camTop + vh + m) continue;
      sorted.push(f);
    }
    sorted.sort((a, b) => (a.eatenBy ? 1 : 0) - (b.eatenBy ? 1 : 0) || a.r - b.r);

    // 3D Stage-Aware Player Lighting: sunlit caustic shimmer up high -> multi-cone volumetric headlamp in deep zones
    const p = this.player;
    if (p && !p.dead && !p.eatenBy) {
      if (p.y < 520 && !this.pixelMode) {
        const sunK = clamp(1 - p.y / 520, 0, 1);
        const haloR = p.r * 3.8 + 26;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.22 * sunK;
        ctx.drawImage(glowOrb("rgba(195, 252, 255, 0.58)", false), p.x - camLeft - haloR, p.y - camTop - haloR, haloR * 2, haloR * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
      if (p.y > DEEP_START - 160) {
        const kDeep = clamp((p.y - (DEEP_START - 160)) / 340, 0, 1);
        const outerOrb = glowOrb("rgba(65, 195, 255, 0.48)", false);
        const coreOrb = glowOrb("rgba(205, 252, 255, 0.65)", false);
        const haloR = p.r * 5.8 + 52;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.44 * kDeep;
        ctx.drawImage(outerOrb, p.x - camLeft - haloR, p.y - camTop - haloR, haloR * 2, haloR * 2);
        const ang = Math.atan2(Math.sin(p.tilt), p.face * Math.cos(p.tilt));
        const cs = Math.cos(ang) * scale,
          sn = Math.sin(ang) * scale;
        ctx.setTransform(cs, sn, -sn, cs, (p.mouthX() - camLeft) * scale, (p.mouthY() - camTop) * scale);
        // Wide volumetric outer cone
        const wideRx = p.r * 4.4 + 62,
          wideRy = wideRx * 0.46;
        ctx.globalAlpha = 0.34 * kDeep;
        ctx.drawImage(outerOrb, -wideRx * 0.22, -wideRy, wideRx * 2, wideRy * 2);
        // Bright focused inner volumetric cone
        const innerRx = p.r * 3.0 + 40,
          innerRy = innerRx * 0.28;
        ctx.globalAlpha = 0.48 * kDeep;
        ctx.drawImage(coreOrb, -innerRx * 0.14, -innerRy, innerRx * 2, innerRy * 2);
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    }

    // Soft Suction Vortex Cones & Gossamer Ribbons
    for (const f of sorted) {
      if (f.sucking && !f.eatenBy) {
        this.drawSoftSuctionVortex(f, camLeft, camTop, vw, vh);
      }
    }

    // Draw Fish
    for (const f of sorted) this.drawFish(f, camLeft, camTop);

    // Foreground cave upper arch lips & stalactites drawn over fish tucked inside caves
    if (laut) laut.drawPass(2, ctx); // 3D cave lips over fish tucked inside the caves
    oc.drawCaveForeground(ctx, camLeft, camTop, vw, vh, t, p && !p.dead && !p.eatenBy && p.hiddenCave ? p.hiddenCave.id : null, !!laut);

    // ---------- particles in two passes (normal, then additive): the blend mode is switched twice per
    // frame instead of save/restore around every single particle ----------
    const parts = this.particles;
    const bub = getBubbleStamp();
    const gold = glowOrb("rgba(255, 196, 40, 0.98)", false);
    ctx.lineCap = "round";
    for (const pt of parts) {
      const ty = pt.type;
      if (ty !== "bubble" && ty !== "bit" && ty !== "streak" && ty !== "glint" && ty !== "smoke") continue;
      const x = pt.x - camLeft,
        y = pt.y - camTop;
      if (x < -45 || x > vw + 45 || y < -45 || y > vh + 45) continue;
      const k = clamp(pt.life / pt.max, 0, 1);
      if (ty === "bubble") {
        const r = Math.max(1.4, pt.size * 1.35);
        const age = pt.max - pt.life;
        const sq = 1 + Math.sin(age * 9 + pt.size * 5) * Math.min(0.18, 0.05 + pt.size * 0.03); // oblate wobble
        ctx.globalAlpha = Math.min(1, age * 6) * Math.min(1, k * 8);
        ctx.drawImage(bub, x - r * sq, y - r / sq, r * 2 * sq, (r * 2) / sq);
        ctx.globalAlpha = 1;
      } else if (ty === "smoke") {
        const r = pt.size * (0.75 + (1 - k) * 1.45);
        ctx.globalAlpha = k * 0.62;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (ty === "bit") {
        const rad = pt.size * (0.8 + k * 0.8);
        ctx.globalAlpha = k;
        ctx.drawImage(glowOrb(pt.color, true), x - rad, y - rad, rad * 2, rad * 2);
        ctx.globalAlpha = 1;
      } else if (ty === "glint") {
        const rad = 2.4 * k + 0.4;
        ctx.drawImage(gold, x - rad, y - rad, rad * 2, rad * 2);
      } else {
        const d = Math.hypot(pt.vx, pt.vy) || 1;
        const len = 6 + k * 10;
        ctx.globalAlpha = k * 0.5;
        ctx.strokeStyle = "#d2fcff";
        ctx.lineWidth = 1.8 * k;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (pt.vx / d) * len, y + (pt.vy / d) * len);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.globalCompositeOperation = "lighter";
    const mistOrb = glowOrb("#7dd3fc", true);
    for (const pt of parts) {
      const ty = pt.type;
      if (ty === "bubble" || ty === "bit" || ty === "streak" || ty === "glint" || ty === "smoke") continue;
      const x = pt.x - camLeft,
        y = pt.y - camTop;
      if (x < -45 || x > vw + 45 || y < -45 || y > vh + 45) continue;
      const k = clamp(pt.life / pt.max, 0, 1);
      if (ty === "chomp") {
        // silky bite ripple: two crescents closing on each other
        const r = pt.size * (0.65 + (1 - k) * 0.48);
        const oy = r * (0.42 - (1 - k) * 0.45);
        const a0 = (pt.dir || 1) > 0 ? -0.5 : Math.PI - 0.5;
        ctx.globalAlpha = k * 0.75;
        ctx.strokeStyle = "rgba(224, 248, 255, 0.9)";
        ctx.lineWidth = 2.0 * k + 0.6;
        ctx.beginPath();
        ctx.arc(x, y - oy, r, a0, a0 + 1);
        ctx.moveTo(x + Math.cos(a0) * r, y + oy + Math.sin(a0) * r);
        ctx.arc(x, y + oy, r, a0, a0 + 1);
        ctx.stroke();
      } else if (ty === "suck") {
        const rad = pt.size * 1.45;
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.36;
        ctx.drawImage(mistOrb, x - rad, y - rad, rad * 2, rad * 2);
      } else if (ty === "blast") {
        const rad = pt.size * (0.65 + (1 - k) * 1.35);
        ctx.globalAlpha = k * 0.9;
        ctx.drawImage(glowOrb(pt.color, true), x - rad, y - rad, rad * 2, rad * 2);
      } else if (ty === "ring") {
        const r = pt.size * (0.9 + (1 - k) * 1.5);
        ctx.globalAlpha = k * 0.52;
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 2.2 * k;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const rad = 3.8 * k + 1.2;
        ctx.globalAlpha = 1;
        ctx.drawImage(glowOrb(pt.color, true), x - rad, y - rad, rad * 2, rad * 2);
      }
    }
    // coins flying to the counter: all glows (still additive), then the coins themselves
    const coinGlow = glowOrb("rgba(255, 214, 80, 0.55)", false);
    const coinSc = (c: FlyCoin) => {
      // elastic pop-in, then the coin shrinks a little while it swoops into the counter
      const k = c.t / COIN_POP;
      return k < 0.45 ? 0.3 + k * 2.3 : k < 1 ? 1.34 - (k - 0.45) * 0.62 : 1 - Math.min(1, (c.t - COIN_POP) / COIN_FLY) * 0.3;
    };
    ctx.globalAlpha = 0.6;
    for (const c of this.flyCoins) {
      if (c.t < 0) continue;
      const sc = coinSc(c);
      ctx.drawImage(coinGlow, c.x - camLeft - 10 * sc, c.y - camTop - 10 * sc, 20 * sc, 20 * sc);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    for (const c of this.flyCoins) {
      if (c.t < 0) continue;
      const sc = coinSc(c);
      ctx.drawImage(coinSprite(Math.floor(c.t * 22)), c.x - camLeft - 5.5 * sc, c.y - camTop - 5.5 * sc, 11 * sc, 11 * sc);
    }

    // ---------- names, warnings & floating numbers: cached text sprites ----------
    if (!this.menuActive) {
      for (const f of sorted) {
        if (f.eatenBy) continue;
        const x = f.x - camLeft,
          y = f.y - camTop - f.r * 1.15 - 8;
        if (x < -60 || x > vw + 60 || y < -25 || y > vh + 40) continue;
        if (f.kind !== "npc") {
          if (f === p && this.caveVisAlpha > 0.01) continue;
          const col =
            f.kind === "player"
              ? "#ffffff"
              : p && !p.dead && this.canEat(f, p)
                ? "#ff9494"
                : p && !p.dead && this.canEat(p, f)
                  ? "#a8ffbe"
                  : "#e8f4ff";
          const L = this.label(f.name, col, 9);
          ctx.drawImage(L.cv, x - L.w / 2, y - L.h / 2, L.w, L.h);
          if (f.id === this.leaderId) this.drawCrown(x, y - 9);
        }
        if (p && !p.dead && !p.hiddenCave && f !== p && this.canEat(f, p) && p.invuln <= 0) {
          const d = Math.hypot(f.x - p.x, f.y - p.y);
          const hunting = f.ai.target === p || (f.kind === "bot" && d < 160);
          if (d < 200 && hunting && Math.floor(t * 6) % 2 === 0) {
            const L = this.label("!", "#ff3b4e", 11);
            ctx.drawImage(L.cv, x - L.w / 2, y - (f.kind === "npc" ? 0 : 11) - L.h / 2, L.w, L.h);
          }
        }
      }
    }

    // slurp-chain counter riding next to the player: pops on every bite, with a draining combo timer
    if (p && !p.dead && !p.eatenBy && p.combo >= 2 && p.comboT > 0) {
      const kT = clamp(p.comboT / 2.6, 0, 1);
      const col = p.combo >= 10 ? "#ff7ad9" : p.combo >= 5 ? "#ffb347" : "#fff066";
      const L = this.label("x" + p.combo, col, 10 + Math.min(5, Math.round(p.combo * 0.22)));
      const sc = 1 + this.chainPop * 0.55;
      const cx = p.x - camLeft - p.face * (p.r * 0.9 + 13),
        cy = p.y - camTop - p.r * 1.15 - 22;
      ctx.globalAlpha = Math.min(1, kT * 5);
      ctx.drawImage(L.cv, cx - (L.w * sc) / 2, cy - (L.h * sc) / 2, L.w * sc, L.h * sc);
      ctx.fillStyle = "rgba(8, 22, 52, 0.75)";
      ctx.fillRect(cx - 8, cy + 7, 16, 2);
      ctx.fillStyle = col;
      ctx.fillRect(cx - 8, cy + 7, 16 * kT, 2);
      ctx.globalAlpha = 1;
    }

    for (const tx of this.texts) {
      const k = tx.life / tx.max;
      // squash-in pop: starts small, overshoots, settles
      const pop = k > 0.86 ? 0.5 + ((1 - k) / 0.14) * 0.78 : k > 0.72 ? 1.28 - ((0.86 - k) / 0.14) * 0.28 : 1;
      const L = this.label(tx.text, tx.color, tx.size + 2);
      ctx.globalAlpha = k < 0.3 ? k / 0.3 : 1;
      ctx.drawImage(L.cv, tx.x - camLeft - (L.w * pop) / 2, tx.y - camTop - (L.h * pop) / 2, L.w * pop, L.h * pop);
    }
    ctx.globalAlpha = 1;

    if (laut) {
      laut.drawPass(3, ctx); // crisp light shafts + foreground coral & kelp silhouettes
    } else {
      oc.drawLight(ctx, 1, camLeft, camTop, vw, vh, t); // light shafts falling in front of the reef and the fish
      // Layer 6 (1.24x): Foreground Parallax Coral, Crystal & Giant Kelp Silhouettes!
      oc.drawForegroundParallax(ctx, camLeft, camTop, vw, vh, t);
    }
    oc.drawSurface(ctx, camLeft, camTop, vw, t);
    oc.drawVignette(ctx, camTop, vw, vh);

    // Directional cave darkness & sight-cone mask (limits sight strictly to cave interior + outside of entrance!)
    this.drawCaveSightMask(ctx, camLeft, camTop, vw, vh);

    // Keep player name, TERSEMBUNYI indicator, and crown sharp & legible above the cave visibility veil
    if (p && !p.dead && !p.eatenBy && this.caveVisAlpha > 0.01) {
      const px = p.x - camLeft;
      const py = p.y - camTop - p.r * 1.15 - 8;
      if (px >= -60 && px <= vw + 60 && py >= -25 && py <= vh + 40) {
        const L = this.label(p.name, "#ffffff", 9);
        ctx.drawImage(L.cv, px - L.w / 2, py - L.h / 2, L.w, L.h);
        if (p.hiddenCave) {
          const S = this.label("TERSEMBUNYI", "#7efce8", 7.5);
          ctx.drawImage(S.cv, px - S.w / 2, py - L.h * 0.5 - S.h * 0.65 - 2, S.w, S.h);
        }
        if (p.id === this.leaderId) this.drawCrown(px, py - (p.hiddenCave ? 19 : 9));
      }
    }

    // Depth-level gauge + zone title card
    if (focus && !focus.eatenBy) oc.drawHud(ctx, vw, vh, focus.y, t);

    // Off-screen predator edge-of-screen warning chevrons
    if (p && !p.dead && !p.eatenBy && !p.hiddenCave && p.invuln <= 0) {
      for (const f of this.predators) {
        if (f === p || f.dead || f.eatenBy || !this.canEat(f, p)) continue;
        const sx = f.x - camLeft;
        const sy = f.y - camTop;
        if (sx >= -12 && sx <= vw + 12 && sy >= -12 && sy <= vh + 12) continue;
        const d = Math.hypot(f.x - p.x, f.y - p.y);
        if (d > 330) continue;
        const ang = Math.atan2(sy - vh * 0.5, sx - vw * 0.5);
        const pad = 16;
        const edgeX = clamp(sx, pad, vw - pad);
        const edgeY = clamp(sy, pad + 26, vh - pad);
        const pulse = 0.65 + 0.35 * Math.sin(t * 11);
        ctx.save();
        ctx.translate(edgeX, edgeY);
        ctx.rotate(ang);
        ctx.globalAlpha = pulse * clamp(1 - (d - 110) / 220, 0.35, 1);
        ctx.fillStyle = "#ff4757";
        ctx.strokeStyle = "#fff5f5";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4.5, -4.5);
        ctx.lineTo(-2.2, 0);
        ctx.lineTo(-4.5, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    // Jellyfish shock: crackling arcs + dizzy stars orbiting the head
    if (p && !p.dead && !p.eatenBy && this.stunT > 0) {
      const px = p.x - camLeft,
        py = p.y - camTop;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const nB = 5;
      for (let b = 0; b < nB; b++) {
        const seed = Math.floor(this.t * 24) * 7 + b * 13;
        const a0 = (b / nB) * Math.PI * 2 + this.t * 3;
        const R = p.r * 1.3;
        ctx.strokeStyle = b % 2 ? "#e0f2fe" : "#67e8f9";
        ctx.lineWidth = b % 2 ? 1 : 1.8;
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(this.t * 40 + b);
        ctx.beginPath();
        let x = px + Math.cos(a0) * R * 0.3,
          y = py + Math.sin(a0) * R * 0.3;
        ctx.moveTo(x, y);
        for (let k = 1; k <= 5; k++) {
          const h = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
          const jit = (h - Math.floor(h) - 0.5) * R * 0.6;
          const ang = a0 + (k / 5) * 0.8;
          x = px + Math.cos(ang) * (R * (0.3 + 0.7 * (k / 5))) + Math.cos(ang + 1.57) * jit;
          y = py + Math.sin(ang) * (R * (0.3 + 0.7 * (k / 5))) + Math.sin(ang + 1.57) * jit;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(this.t * 30);
      ctx.drawImage(glowOrb("rgba(140, 230, 255, 0.5)", false), px - p.r * 2.2, py - p.r * 2.2, p.r * 4.4, p.r * 4.4);
      // dizzy stars
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      for (let k = 0; k < 4; k++) {
        const a = this.t * 4.2 + (k / 4) * Math.PI * 2;
        const sx = px + Math.cos(a) * p.r * 1.25,
          sy = py - p.r * 1.1 + Math.sin(a) * p.r * 0.35;
        ctx.fillStyle = k % 2 ? "#fde047" : "#fef9c3";
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const rr = i % 2 ? 1.5 : 3.6;
          const aa = (i / 10) * Math.PI * 2 + this.t * 6;
          ctx.lineTo(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Fiery blast screen flash on mine detonation
    if (this.blastFlash > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255, 165, 65, ${(this.blastFlash * 0.55).toFixed(3)})`;
      ctx.fillRect(0, 0, vw + 2, vh + 2);
      ctx.restore();
    }
  }

  drawCrown(x: number, y: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(-4.5, 2.5);
    ctx.lineTo(-5.2, -2.5);
    ctx.lineTo(-2, 0.2);
    ctx.lineTo(0, -3.5);
    ctx.lineTo(2, 0.2);
    ctx.lineTo(5.2, -2.5);
    ctx.lineTo(4.5, 2.5);
    ctx.closePath();
    ctx.fillStyle = "#ffd43b";
    ctx.fill();
    ctx.strokeStyle = "#4a2500";
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
  }

  outlinedText(s: string, x: number, y: number, col: string, strokeW = 2.5) {
    const ctx = this.ctx;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = "rgba(8, 22, 52, 0.88)";
    ctx.lineWidth = strokeW;
    ctx.strokeText(s, x, y);
    ctx.fillStyle = col;
    ctx.fillText(s, x, y);
  }

  drawFish(f: Fish, camLeft: number, camTop: number) {
    const ctx = this.ctx;
    let x = f.x,
      y = f.y,
      sc = 1;
    let rot = f.tilt;
    let face = f.face;
    if (!f.eatenBy && f.biteLunge !== 0) {
      const wr = (f.turnFlip >= 0 ? 1 : -1) * rot;
      x += Math.cos(wr) * f.turnFlip * f.biteLunge;
      y += Math.sin(wr) * f.turnFlip * f.biteLunge;
    }
    const spd = Math.hypot(f.vx, f.vy);
    let sx = 1 - f.sq * 0.56 + Math.min(0.08, spd * 0.0005) + (f.boosting ? 0.12 : 0);
    let sy = 1 + f.sq * 0.82 - Math.min(0.05, spd * 0.00035) - (f.boosting ? 0.06 : 0);

    if (f.jaw > 0.18 && !f.eatenBy) {
      sy += (f.jaw - 0.18) * 0.18;
      sx -= (f.jaw - 0.18) * 0.07;
    }

    if (f.sp.style === "puffer" && !f.eatenBy) {
      // the pufferfish balloons up while it vacuums and right after a gulp
      const pf = f.suckVis * 0.16 + Math.max(0, f.gulpT) * 0.06;
      sx *= 1 + pf * 0.5;
      sy *= 1 + pf;
    }

    if (f.eatenBy) {
      const e = f.eatenBy;
      const mx = e.mouthX() - e.face * e.r * 0.14 * f.eatT,
        my = e.mouthY();
      const k = Math.pow(f.eatT, 1.45);
      x = f.eatFromX + (mx - f.eatFromX) * k;
      y = f.eatFromY + (my - f.eatFromY) * k - Math.sin(f.eatT * Math.PI) * Math.min(8, e.r * 0.22);
      const lateShrink = f.eatT < 0.42 ? 0 : (f.eatT - 0.42) / 0.58;
      sc = Math.max(0.08, 1 - Math.pow(lateShrink, 1.35) * 0.86);
      sx *= 1 + f.eatT * 0.64;
      sy *= 1 - f.eatT * 0.4;
      const dx = mx - f.eatFromX,
        dy = my - f.eatFromY;
      face = dx >= 0 ? -1 : 1;
      rot = Math.atan2(dy, Math.abs(dx) + 8) * (dx >= 0 ? -0.85 : 0.85);
    }

    const scrX = x - camLeft,
      scrY = y - camTop;
    const reach = f.r * 2.6;
    if (scrX < -reach || scrX > this.vw + reach || scrY < -reach || scrY > this.vh + reach) return;

    // Soft bioluminescent lure light pool for the anglerfish in deep water (pre-rendered glow)
    if (f.sp.lure && !f.eatenBy && f.y > DEEP_START - 200) {
      const lr = f.r * 2.6 + 18;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.7;
      ctx.drawImage(glowOrb("rgba(40, 215, 255, 0.58)", false), scrX + face * f.r * 1.15 - lr, scrY - f.r * 0.95 - lr, lr * 2, lr * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    // lanternfish fry carry their own little light
    if (f.fry && f.sp.pal.lure && !f.eatenBy && f.id % 3 === 0) {
      // one shared glow for every third fish of the shoal (same look, a third of the blending)
      const gr = f.r * 5.2;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.55;
      ctx.drawImage(glowOrb("rgba(111, 240, 255, 0.5)", false), scrX - gr, scrY - gr, gr * 2, gr * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    if (f.sucked > 0 && !f.eatenBy) {
      y += Math.sin(this.t * 28 + f.id * 1.7) * 0.55;
      sx *= 1.14;
      sy *= 0.88;
    }

    let jawState: JawState = 0;
    if (f.eatenBy) jawState = 6;
    else if (f.jaw <= -0.12) jawState = -1;
    else if (f.jaw >= 0.08) jawState = Math.min(6, Math.max(1, Math.round(f.jaw * 6))) as JawState;

    let expr: EyeExpr = "normal";
    if (f.eatenBy || f.sucked > 0) expr = "panic";
    else if ((f.chompPhase > 0 && f.chompBitFired) || (f.chompPhase <= 0 && f.chompT > 0.02)) expr = "happy";

    const spr = fishSprite(f.sp, fishLen(f.r), jawState, f.tailPh, f.key, this.pixelMode, expr, f.kind === "player");

    // Golden Sardine Frenzy aura on shimmering golden schools
    if (f.fry && f.school?.golden && !f.eatenBy) {
      const gr = f.r * 3.8;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.55 + Math.sin(this.t * 8 + f.id) * 0.2;
      ctx.drawImage(glowOrb("rgba(255, 224, 80, 0.72)", false), scrX - gr, scrY - gr, gr * 2, gr * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    // Soft dreamy shield / cave-shelter aura when invulnerable, Bubble Shield active, or hidden in cave
    if ((f.invuln > 0 || (f === this.player && (this.shieldT > 0 || f.hiddenCave))) && !f.eatenBy) {
      const hasBubble = f === this.player && this.shieldT > 0;
      const inCave = f === this.player && !!f.hiddenCave;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = hasBubble ? 0.45 + Math.sin(this.t * 6) * 0.14 : inCave ? 0.28 + Math.sin(this.t * 4.5) * 0.08 : 0.35 + Math.sin(this.t * 8) * 0.15;
      const hr = f.r * (hasBubble ? 2.35 : 2.1);
      ctx.drawImage(
        glowOrb(hasBubble || inCave ? "rgba(80, 248, 195, 0.56)" : "rgba(190, 248, 255, 0.5)", false),
        x - camLeft - hr,
        y - camTop - hr,
        hr * 2,
        hr * 2
      );
      if (hasBubble) {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = this.shieldT < 3 && Math.floor(this.t * 8) % 2 === 0 ? 0.35 : 0.75;
        ctx.strokeStyle = "#6ee7b7";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(x - camLeft, y - camTop, f.r * 1.48, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    const flipX = f.eatenBy ? face : Math.abs(f.turnFlip) < 0.24 ? (f.turnFlip >= 0 ? 0.24 : -0.24) : f.turnFlip;
    const yaw = f.eatenBy ? 0 : 1 - Math.abs(flipX); // 0 = full side profile, ~0.76 = 3D front-angle turn!
    ctx.globalAlpha = 1;
    // idle fish hover gently instead of hanging frozen in the water
    const swim = Math.min(1, spd / 110);
    const hover = f.eatenBy ? 0 : (1 - swim) * Math.sin(this.t * 1.7 + f.id * 1.3) * Math.min(1.2, f.r * 0.06);
    const S0 = this.pxs(),
      worldRot = (flipX >= 0 ? 1 : -1) * rot,
      co = Math.cos(worldRot),
      si = Math.sin(worldRot),
      kx = sx * sc,
      ky = sy * sc;

    // Subtle 3D bioluminescent rim aura for rare luminous fish or deep-sea hunters
    if (
      !f.eatenBy &&
      !this.pixelMode &&
      (f.sp.style === "aurora" ||
        f.sp.style === "mandarin" ||
        f.sp.style === "narwhal" ||
        f.sp.style === "seadragon" ||
        f.sp.style === "axolotl" ||
        f.sp.style === "whaleshark" ||
        f.sp.id === "skin-lumba_pink" ||
        f.sp.id === "skin-snapturtle_albino")
    ) {
      const rCol =
        f.sp.id === "skin-snapturtle_albino"
          ? "rgba(255, 224, 232, 0.5)"
          : f.sp.id === "skin-lumba_pink"
          ? "rgba(255, 165, 220, 0.48)"
          : f.sp.style === "aurora"
            ? "rgba(110, 245, 255, 0.48)"
            : f.sp.style === "narwhal"
              ? "rgba(185, 228, 255, 0.44)"
              : f.sp.style === "seadragon"
                ? "rgba(158, 255, 198, 0.48)"
                : f.sp.style === "axolotl"
                  ? "rgba(255, 150, 215, 0.46)"
                  : f.sp.style === "whaleshark"
                    ? "rgba(92, 230, 255, 0.48)"
                    : "rgba(255, 168, 92, 0.42)";
      const rr = f.r * 2.15;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (f.y > DEEP_START - 120 ? 0.55 : 0.26) + Math.sin(this.t * 3.4 + f.id) * 0.08;
      ctx.drawImage(glowOrb(rCol, false), x - camLeft - rr, y - camTop + hover - rr, rr * 2, rr * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    const sprW = fishLen(f.r) * 1.4;
    const sprH = sprW * 0.82;
    const px = S0 * (x - camLeft);
    const py = S0 * (y - camTop + hover);

    let drew3D = false;
    if (!this.menuActive && f.sp.is3D && !this.pixelMode) {
      const worldSpan = sprW * 1.14;
      ctx.setTransform(S0 * sc, 0, 0, S0 * sc, px, py);
      const pose = {
        jaw: f.eatenBy ? 1 : f.jaw,
        chompPhase: f.chompPhase,
        chompDur: f.chompDur,
        chompBitFired: f.chompBitFired,
        biteLunge: 0,
        tailPh: f.tailPh,
        wag2: this.t * 6.0 + f.id,
        bend: f.bend,
        turnFlip: f.eatenBy ? face : f.turnFlip,
        turnVel: f.eatenBy ? 0 : f.turnBend,
        boostAmt: f.eatenBy ? 0 : f.boostVis,
        tilt: rot,
        gulpT: f.gulpT,
        gulpK: f.gulpK * this.bulkScale,
        swallowT: f.swallowT,
        gulpColor: f.gulpColor,
        gulpTailColor: f.gulpTailColor,
        sq: f.sq,
        expr,
        puff: f.munch || jawState === -1,
        sucking: f.sucking,
        swimSpeed: swim,
        depthFactor: clamp((f.y - 350) / 1400, 0, 1),
      };
      const useLive3D = f === this.player || (!f.fry && (f.r >= 14.0 || f.gulpT > 0.02 || f.swallowT > 0.02 || f.jaw > 0.35) && this.live3DBudget > 0);
      if (useLive3D) {
        if (f !== this.player) this.live3DBudget--;
        drew3D = fish3d.renderToCanvas(
          f.sp,
          ctx,
          -worldSpan * 0.5,
          -worldSpan * 0.5,
          worldSpan,
          worldSpan,
          pose,
          worldSpan * S0 * 1.15
        );
      } else {
        drew3D = fish3d.renderCached3D(
          f.sp,
          ctx,
          worldSpan,
          pose,
          worldSpan * S0 * 1.15,
          false
        );
      }
      if (drew3D && !f.eatenBy && !this.pixelMode && f.y < 680 && (f.kind !== "npc" || f.r > 8)) {
        const sunVis = clamp(1 - f.y / 680, 0, 1);
        const shimmer = 0.58 + 0.42 * Math.sin(this.t * 3.2 + f.x * 0.035 + f.id);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.24 * sunVis * shimmer;
        ctx.drawImage(glowOrb("rgba(220, 253, 255, 0.72)", false), -sprW * 0.28, -sprH * 0.42, sprW * 0.56, sprH * 0.34);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    }

    if (!drew3D) {
      // Smooth articulated multi-segment ragdoll spine + traveling swim S-wave + localized gulp bulge
      const gulpProg = 1 - clamp(f.gulpT, 0, 1);
      const gulpAmp = f.gulpT > 0 && !f.eatenBy ? f.gulpK * this.bulkScale * Math.sin(Math.pow(gulpProg, 0.72) * Math.PI) * Math.pow(1 - gulpProg * 0.42, 0.8) * 0.38 : 0;
      const gulpPos = 0.20 + (1 - Math.pow(1 - gulpProg, 2.2)) * 0.44;
      const roll = f.eatenBy ? 0 : si * yaw * 0.14;
      const gKx = kx * Math.max(0.74, 1 - gulpAmp * 0.14);
      const a0 = S0 * flipX * co * gKx;
      const b0 = S0 * flipX * (si + roll) * gKx;
      const c0 = -S0 * si * ky;
      const d0 = S0 * co * ky;

      const devLen = spr.w * S0;
      const segs = f.eatenBy || devLen < 14 ? 1 : devLen >= 68 ? 12 : devLen >= 28 ? 7 : 5;

      if (segs === 1) {
        const gKy = ky * (1 + gulpAmp * 0.55);
        ctx.setTransform(
          a0,
          b0,
          -S0 * si * gKy,
          S0 * co * gKy,
          px,
          py
        );
        ctx.drawImage(spr.canvas, -spr.w / 2, -spr.h / 2, spr.w, spr.h);
      } else {
        const cw = spr.canvas.width;
        const ch = spr.canvas.height;
        const turnWhip = Math.min(1, yaw * 1.15);
        const waveAmp = spr.h * (0.036 + swim * 0.056 + (f.boosting ? 0.034 : 0) + turnWhip * 0.042);
        const bendAmp = f.bend * spr.w * 0.34;
        const spineAt = (s: number) => {
          // Head/snout (s < 0.12) stays locked cleanly onto mouth & eye; body/tail flows with C1 continuity
          const t = clamp((s - 0.12) / 0.88, 0, 1);
          if (t <= 0) return 0;
          const w = Math.pow(t, 1.55) * waveAmp * Math.sin(f.tailPh - s * 3.85);
          const b = Math.pow(t, 1.65) * bendAmp;
          return w + b;
        };

        const segW = spr.w / segs;
        const devSeg = Math.hypot(a0, b0) * segW;
        const ovLocal = Math.min(segW * 0.45, 1.25 / Math.max(0.45, devSeg / segW));
        const ovU = ovLocal / spr.w;

        let prevDy = spineAt(1);
        for (let i = 0; i < segs; i++) {
          const u0 = i / segs;
          const u1 = (i + 1) / segs;
          const s1 = 1 - u1;
          const dy0 = prevDy;
          const dy1 = spineAt(s1);
          prevDy = dy1;

          const lx0 = (u0 - 0.5) * spr.w;
          const slope = (dy1 - dy0) / segW;
          let gy = 1;
          if (gulpAmp > 0.005) {
            const dG = (1 - 0.5 * (u0 + u1) - gulpPos) / 0.16;
            gy += gulpAmp * Math.exp(-dG * dG);
          }

          const uDrawEnd = i < segs - 1 ? Math.min(1, u1 + ovU) : 1;
          const srcX = u0 * cw;
          const srcW = Math.min(cw - srcX, (uDrawEnd - u0) * cw);
          const dstW = (uDrawEnd - u0) * spr.w;

          ctx.setTransform(
            a0 + c0 * slope,
            b0 + d0 * slope,
            c0 * gy,
            d0 * gy,
            px + a0 * lx0 + c0 * dy0,
            py + b0 * lx0 + d0 * dy0
          );
          ctx.drawImage(spr.canvas, srcX, 0, srcW, ch, 0, -spr.h / 2, dstW, spr.h);
        }

        // Restore centered torso matrix so dorsal caustic rim aligns cleanly on the back
        const midDy = spineAt(0.5);
        ctx.setTransform(a0, b0, c0, d0, px + c0 * midDy, py + d0 * midDy);
      }

      // 3D Dorsal Caustic Specular Rim on fish swimming in sunlit/twilight upper waters
      if (!f.eatenBy && !this.pixelMode && f.y < 680 && (f.kind !== "npc" || f.r > 8)) {
        const sunVis = clamp(1 - f.y / 680, 0, 1);
        const shimmer = 0.58 + 0.42 * Math.sin(this.t * 3.2 + f.x * 0.035 + f.id);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.28 * sunVis * shimmer;
        ctx.drawImage(glowOrb("rgba(220, 253, 255, 0.72)", false), -spr.w * 0.28, -spr.h * 0.42, spr.w * 0.56, spr.h * 0.34);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    }
    ctx.setTransform(S0, 0, 0, S0, 0, 0);

    if (f.kind === "player" && !f.eatenBy && f.r < 14) {
      const yy = y - camTop - f.r * 1.18 - 16 + Math.sin(this.t * 6) * 2;
      const xx = x - camLeft;
      ctx.save();
      ctx.fillStyle = "#ffe14a";
      ctx.strokeStyle = "rgba(8, 22, 52, 0.8)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(xx - 3.2, yy - 2);
      ctx.lineTo(xx + 3.2, yy - 2);
      ctx.lineTo(xx, yy + 2.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  private getCaveConeMask(): HTMLCanvasElement {
    if (this.caveConeCv) return this.caveConeCv;
    const size = 256;
    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    const c = cv.getContext("2d")!;
    const img = c.createImageData(size, size);
    const d = img.data;
    const ax = 32;
    const ay = 128;
    const maxR = 224;
    const qStep = (a: number, b: number, v: number) => {
      const t = clamp((v - a) / (b - a), 0, 1);
      return t * t * t * (t * (t * 6 - 15) + 10);
    };
    for (let y = 0; y < size; y++) {
      const dy = y - ay;
      for (let x = 0; x < size; x++) {
        const dx = x - ax;
        const dist = Math.hypot(dx, dy);
        const u = dist / maxR;
        if (u >= 1) continue;
        const ang = Math.abs(Math.atan2(dy, dx));
        const maxAng = 0.54 + 0.38 * (1 - qStep(0.06, 0.42, u));
        const innerAng = maxAng * 0.2;
        const angFade = 1 - qStep(innerAng, maxAng, ang);
        if (angFade <= 0) continue;
        const radFade = 1 - qStep(0.32, 0.98, u);
        const backFade = qStep(-24, 14, dx);
        const alpha = Math.round(255 * angFade * radFade * backFade);
        if (alpha > 0) {
          const i = (y * size + x) * 4;
          d[i + 3] = alpha;
        }
      }
    }
    c.putImageData(img, 0, 0);
    this.caveConeCv = cv;
    return cv;
  }

  /**
   * When hiding inside a cave, shrouds everything behind/above/below the solid rock walls in darkness,
   * revealing ONLY the cave interior and a silky-smooth directional visibility cone facing out the entrance.
   */
  drawCaveSightMask(ctx: CanvasRenderingContext2D, camLeft: number, camTop: number, vw: number, vh: number) {
    if (this.caveVisAlpha <= 0.01 || !this.lastCave) return;
    const cave = this.lastCave;
    const mw = Math.max(4, Math.ceil(vw));
    const mh = Math.max(4, Math.ceil(vh));
    if (!this.caveMaskCv) {
      this.caveMaskCv = document.createElement("canvas");
    }
    const cv = this.caveMaskCv;
    if (cv.width !== mw || cv.height !== mh) {
      cv.width = mw;
      cv.height = mh;
    }
    const mc = cv.getContext("2d")!;
    mc.setTransform(1, 0, 0, 1, 0, 0);
    mc.globalCompositeOperation = "source-over";
    mc.globalAlpha = 1;
    mc.imageSmoothingEnabled = true;
    mc.clearRect(0, 0, mw, mh);

    // Deep atmospheric cavern rock darkness outside visible sight cone
    mc.fillStyle = "rgba(2, 6, 18, 0.90)";
    mc.fillRect(0, 0, mw, mh);

    mc.globalCompositeOperation = "destination-out";

    const dirSign = cave.kind === "alcove" ? (cave.dir >= 0 ? 1 : -1) : this.caveSightDir >= 0 ? 1 : -1;
    const coneFade = cave.kind === "tunnel" ? clamp(Math.abs(this.caveSightDir) * 1.35, 0.1, 1) : 1;

    // 1. Cut out the cave chamber interior with an ultra-gradual quintic radial feather (no hard oval rim)
    const cx = cave.x - camLeft;
    const cy = cave.y - camTop;
    const chamRx = cave.rx * 1.18;
    const chamRy = cave.ry * 1.36;
    mc.save();
    mc.translate(cx - dirSign * cave.rx * 0.04, cy);
    mc.scale(chamRx, chamRy);
    const cg = mc.createRadialGradient(0, 0, 0.05, 0, 0, 1);
    cg.addColorStop(0, "rgba(0, 0, 0, 1)");
    cg.addColorStop(0.28, "rgba(0, 0, 0, 0.98)");
    cg.addColorStop(0.48, "rgba(0, 0, 0, 0.88)");
    cg.addColorStop(0.64, "rgba(0, 0, 0, 0.66)");
    cg.addColorStop(0.78, "rgba(0, 0, 0, 0.38)");
    cg.addColorStop(0.9, "rgba(0, 0, 0, 0.14)");
    cg.addColorStop(1, "rgba(0, 0, 0, 0)");
    mc.fillStyle = cg;
    mc.beginPath();
    mc.arc(0, 0, 1, 0, Math.PI * 2);
    mc.fill();
    mc.restore();

    // 2. Soft local clarity pool around player fish inside the cave
    const p = this.player;
    if (p && !p.dead && !p.eatenBy) {
      const px = p.x - camLeft;
      const py = p.y - camTop - p.r * 0.25;
      const pr = Math.max(44, p.r * 2.35 + 24);
      const pg = mc.createRadialGradient(px, py, pr * 0.1, px, py, pr);
      pg.addColorStop(0, "rgba(0, 0, 0, 1)");
      pg.addColorStop(0.35, "rgba(0, 0, 0, 0.9)");
      pg.addColorStop(0.6, "rgba(0, 0, 0, 0.56)");
      pg.addColorStop(0.82, "rgba(0, 0, 0, 0.2)");
      pg.addColorStop(1, "rgba(0, 0, 0, 0)");
      mc.fillStyle = pg;
      mc.beginPath();
      mc.arc(px, py, pr, 0, Math.PI * 2);
      mc.fill();
    }

    // 3. Silky-smooth directional visibility cone radiating outward from the cave entrance
    const apexX = (cave.kind === "alcove" ? cave.x - dirSign * cave.rx * 0.16 : cave.x) - camLeft;
    const apexY = cy;
    const halfAng = Math.atan2(cave.ry * 1.05, cave.rx * 0.78);
    const sightLen = Math.hypot(mw, mh) * 0.98;
    const scaleX = sightLen / 224;
    const scaleY = scaleX * clamp(Math.tan(halfAng) / 0.6, 0.72, 1.35);
    const coneMask = this.getCaveConeMask();

    mc.save();
    mc.globalAlpha = coneFade;
    mc.translate(apexX, apexY);
    if (dirSign < 0) mc.scale(-1, 1);
    mc.scale(scaleX, scaleY);
    mc.drawImage(coneMask, -32, -128);
    mc.restore();

    // 4. Soft diffused threshold pool right at the cave doorway
    const mouthX = cave.x + dirSign * cave.rx * 0.88 - camLeft;
    mc.save();
    mc.globalAlpha = coneFade * 0.78;
    mc.translate(mouthX, cy);
    mc.scale(cave.rx * 0.65, cave.ry * 1.35);
    const mg = mc.createRadialGradient(0, 0, 0.08, 0, 0, 1);
    mg.addColorStop(0, "rgba(0, 0, 0, 1)");
    mg.addColorStop(0.38, "rgba(0, 0, 0, 0.76)");
    mg.addColorStop(0.68, "rgba(0, 0, 0, 0.36)");
    mg.addColorStop(0.88, "rgba(0, 0, 0, 0.1)");
    mg.addColorStop(1, "rgba(0, 0, 0, 0)");
    mc.fillStyle = mg;
    mc.beginPath();
    mc.arc(0, 0, 1, 0, Math.PI * 2);
    mc.fill();
    mc.restore();

    ctx.save();
    const prevSm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = this.caveVisAlpha;
    ctx.drawImage(cv, 0, 0, mw, mh);
    ctx.imageSmoothingEnabled = prevSm;
    ctx.restore();
  }
}
