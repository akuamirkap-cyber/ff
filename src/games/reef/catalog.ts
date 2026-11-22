import { SKINS, type Skin } from "./game/species";

const featured = ["orange", "dori", "buntal", "leon", "hiu", "andy"];
export const catalog = [...featured.map(id => SKINS.find(s => s.id === id)!), ...SKINS.filter(s => !featured.includes(s.id))];
const predators = new Set(["hiu", "hiu_elegan", "hiu_totol", "orca", "hammerhead", "eddy", "snapturtle", "snapturtle_albino", "layaran", "pari", "tuna"]);
export const family = (s: Skin) => s.rare ? "Langka" : predators.has(s.id) ? "Predator" : "Terumbu";
const art: Record<string, { color: string; glow: string; name: string }> = {
  orange: { color: "#123b3a", glow: "#2c6154", name: "Clownfish" },
  dori: { color: "#142d49", glow: "#24516b", name: "Blue Tang" },
  buntal: { color: "#343a2e", glow: "#5c6040", name: "Ikan Buntal" },
  leon: { color: "#382b42", glow: "#624253", name: "Lionfish" },
  hiu: { color: "#203743", glow: "#3b5964", name: "Hiu Putih" },
  andy: { color: "#3c313d", glow: "#674b49", name: "Angelfish" },
};
export const fishArt = (skin: Skin) => art[skin.id] || { color: "#17333c", glow: skin.pal.dark, name: skin.subtitle.replace(/ FF2/g, "") };
export const format = (value: number) => Math.round(value).toLocaleString("id-ID");

export interface RunResult {
  score: number; coins: number; combo: number; depth: number; rank1: boolean; peak: number | null;
}