export type KeyCategory = "fx" | "stab" | "atmosphere" | "melody" | "riser";

export interface MelodyParams {
  /** Scale-degree offset added to the current random-walk position. */
  registerOffset: number;
  /** How many scheduler ticks (16th notes) between generated notes. */
  tickSubdivision: number;
}

export type KeyDef =
  | { key: string; category: "fx"; variant: number }
  | { key: string; category: "stab"; scaleDegree: number }
  | { key: string; category: "atmosphere"; variant: number }
  | { key: string; category: "riser"; variant: number }
  | ({ key: string; category: "melody" } & MelodyParams);

const NUMBER_ROW = "1234567890".split("");
const TOP_ROW = "qwertyuiop".split("");
const HOME_ROW = "asdfghjkl".split("");
const MELODY_KEYS = "zxcvb".split("");
const RISER_KEYS = "nm".split("");

// Five distinct registers/subdivisions so holding several melody keys at
// once layers independent random-walk lines rather than duplicating one.
const MELODY_VARIANTS: MelodyParams[] = [
  { registerOffset: 14, tickSubdivision: 1 }, // high, 16ths
  { registerOffset: 7, tickSubdivision: 2 }, // mid-high, 8ths
  { registerOffset: 0, tickSubdivision: 4 }, // base register, quarters
  { registerOffset: 21, tickSubdivision: 2 }, // very high, 8ths
  { registerOffset: 3, tickSubdivision: 1 }, // mid, 16ths (different starting degree than the high 16th key)
];

export const KEYMAP: readonly KeyDef[] = [
  ...NUMBER_ROW.map((key, variant): KeyDef => ({ key, category: "fx", variant })),
  ...TOP_ROW.map((key, scaleDegree): KeyDef => ({ key, category: "stab", scaleDegree })),
  ...HOME_ROW.map((key, variant): KeyDef => ({ key, category: "atmosphere", variant })),
  ...MELODY_KEYS.map((key, i): KeyDef => ({ key, category: "melody", ...MELODY_VARIANTS[i] })),
  ...RISER_KEYS.map((key, variant): KeyDef => ({ key, category: "riser", variant })),
];

const KEYMAP_BY_KEY: ReadonlyMap<string, KeyDef> = new Map(
  KEYMAP.map((def) => [def.key, def]),
);

export function lookupKey(key: string): KeyDef | undefined {
  return KEYMAP_BY_KEY.get(key.toLowerCase());
}
