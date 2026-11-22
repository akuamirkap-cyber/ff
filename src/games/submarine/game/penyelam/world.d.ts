// Types for the PENYELAM (Abyssal Garden) procedural mesh builders copied from PENYELAM.zip
export interface PMeshBuilt {
  vb: ArrayBuffer;
  ib: Uint32Array;
  nv: number;
}
export interface PMesh {
  build(nrmFn?: unknown): PMeshBuilt;
}
export function meshCoral(fan: number, lo?: boolean): PMesh;
export function meshTubes(): PMesh;
export function meshCoralBloom(): PMesh;
export function meshCoralPlate(): PMesh;
export function meshChunk(sd: number, sub?: number, det?: boolean): PMesh;
