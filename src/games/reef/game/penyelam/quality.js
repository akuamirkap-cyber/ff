// ============================================================================
// quality level, chosen before anything is built (from Noniv/abyssal-garden)
// ============================================================================
export const mob = typeof matchMedia !== 'undefined' && matchMedia('(pointer:coarse)').matches;
const mem = typeof navigator !== 'undefined' ? navigator.deviceMemory : 8;
export const keep = (k, v) => { try { localStorage[k] = v; } catch {} };

let SV = [], _lv, bad;
try { SV = (localStorage.abyssal || '').split(','); bad = localStorage.abyssalLoad; } catch {}
_lv = SV[0] !== '' && SV[0] !== undefined ? +SV[0] : mob ? (mem > 7 ? 1 : 2) : mem <= 4 ? 2 : 0;
if (!(_lv === 0 || _lv === 1 || _lv === 2)) _lv = 0;
if (bad && _lv < 2) { SV = [++_lv]; keep('abyssal', _lv); }

export const SAVED = SV;
export const LV = _lv;
export const THIN = 1 << LV;
export const SHADOW = LV ? 2048 : 4096;
export const AA = LV > 1 ? 1 : 4;
export const WATER = LV > 1 ? 256 : 512;
export const RAYN = LV > 1 ? 12 : 34;
