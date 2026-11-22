export function surfaceNets(field: Float32Array, nx: number, ny: number, nz: number): {
  pos: Float32Array; idx: Uint32Array; nv: number; ni: number;
};
export function sampler3(field: Float32Array, nx: number, ny: number, nz: number): (x: number, y: number, z: number) => number;