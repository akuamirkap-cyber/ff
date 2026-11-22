// Types for the PENYELAM (Abyssal Garden) entity mesh builders (diver & Jules-Verne submarine)
export interface PEntityBuilt {
  vb: ArrayBuffer;
  ib: Uint32Array;
  nv: number;
}
export function buildDiverMesh(): PEntityBuilt;
export function buildSubmarineMesh(): PEntityBuilt;
export function buildCockpitMesh(): PEntityBuilt;
export const HELMET_SCALE: number;
export const HEAD_SCALE: number;
