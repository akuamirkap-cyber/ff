import type { Upgrades } from "./game/engine";
import { SKINS } from "./game/species";

// every fish is unlocked from the start
const ALL_SKINS = () => SKINS.map((s) => s.id);

export interface TrophyUnlockRecord {
  unlockedAt: number;
  bestMetric?: number;
}

export type BgStyle = "game1" | "game2" | "reef_g1" | "shipwreck" | "kelp" | "temple" | "lagoon";

export interface SaveData {
  coins: number;
  upgrades: Upgrades;
  owned: string[];
  skin: string;
  name: string;
  best: number;
  speedPref: number;
  bulkPref: number;
  rank1Count: number;
  peakLevelCount: number;
  bestPeakTimeSec: number | null;
  bestCombo: number;
  bestDepth: number;
  totalRuns: number;
  unlockedTrophies: Record<string, TrophyUnlockRecord>;
  equippedTitle: string | null;
  mode3D: boolean;
  reef3D: boolean;
  /** "Dunia Laut 3D": live 3D water + coral reef (PENYELAM style) */
  laut: boolean;
  /** Latar belakang & tema air laut */
  bgStyle: BgStyle;
}

const KEY = "ffio-save-reef-v1";
const VALID_BG_STYLES = new Set<string>(["game1", "game2", "reef_g1", "shipwreck", "kelp", "temple", "lagoon"]);

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      const owned = ALL_SKINS();
      const rawSkin = d.skin === "boris_3d" ? "boris" : d.skin;
      return {
        coins: Number.isFinite(d.coins) ? Math.max(0, Math.floor(d.coins)) : 0,
        upgrades: Object.fromEntries(["suck", "speed", "size"].map(key => [key, Math.max(0, Math.min(5, Math.floor(Number(d.upgrades?.[key]) || 0)))])) as unknown as Upgrades,
        owned,
        skin: owned.includes(rawSkin) ? rawSkin : "andy",
        name: typeof d.name === "string" ? d.name.slice(0, 18) : "",
        best: d.best ?? 0,
        speedPref: typeof d.speedPref === "number" ? Math.max(0.7, Math.min(1.8, d.speedPref)) : 1.0,
        bulkPref: typeof d.bulkPref === "number" ? Math.max(0.7, Math.min(2.5, d.bulkPref)) : 1.7,
        rank1Count: typeof d.rank1Count === "number" ? d.rank1Count : 0,
        peakLevelCount: typeof d.peakLevelCount === "number" ? d.peakLevelCount : 0,
        bestPeakTimeSec: typeof d.bestPeakTimeSec === "number" ? d.bestPeakTimeSec : null,
        bestCombo: typeof d.bestCombo === "number" ? d.bestCombo : 0,
        bestDepth: typeof d.bestDepth === "number" ? d.bestDepth : 0,
        totalRuns: typeof d.totalRuns === "number" ? d.totalRuns : 0,
        unlockedTrophies: d.unlockedTrophies && typeof d.unlockedTrophies === "object" ? d.unlockedTrophies : {},
        equippedTitle: typeof d.equippedTitle === "string" ? d.equippedTitle : null,
        mode3D: d.skin === "boris_3d" ? true : !!d.mode3D,
        reef3D: d.reef3D === undefined ? true : !!d.reef3D,
        laut: d.laut === undefined ? true : !!d.laut,
        bgStyle: VALID_BG_STYLES.has(d.bgStyle) ? (d.bgStyle as BgStyle) : "game2",
      };
    }
  } catch {
    /* ignore */
  }
  return {
    coins: 0,
    upgrades: { suck: 0, speed: 0, size: 0 },
    owned: ALL_SKINS(),
    skin: "orange",
    name: "",
    best: 0,
    speedPref: 1.0,
    bulkPref: 1.7,
    rank1Count: 0,
    peakLevelCount: 0,
    bestPeakTimeSec: null,
    bestCombo: 0,
    bestDepth: 0,
    totalRuns: 0,
    unlockedTrophies: {},
    equippedTitle: null,
    mode3D: false,
    reef3D: true,
    laut: true,
    bgStyle: "game2",
  };
}

export function writeSave(d: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

export const UPGRADE_COSTS = [40, 100, 220, 450, 800];
export const MAX_UPGRADE = UPGRADE_COSTS.length;
