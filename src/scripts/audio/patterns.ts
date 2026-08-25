// Tick positions (within one 16-tick bar) where a held stab repeats. Same
// representation as bass.ts's BASS_RHYTHM_PATTERNS -- a set of "on"
// positions -- picked once per session and shared by every stab key so
// several held at once interlock into one groove instead of colliding.
export const STAB_RHYTHM_MASKS: readonly (readonly number[])[] = [
  [0, 3, 6, 10, 12], // tresillo -- the classic EDM anthem rhythm
  [0, 2, 4, 8, 10, 12], // driving, doubled up on beats 1 and 3
  [0, 6, 8, 14], // syncopated half-time
  [0, 4, 7, 8, 12, 15], // off-kilter, hits just ahead of beats 2 and 4
];

// One step per 16th note in a bar; null is a rest, a number is a
// scale-degree offset from the held key's own register (params.registerOffset
// in melody.ts). Each melody key draws one of these at random, once per
// session, so a held key plays a consistent composed riff instead of a
// random walk -- see melody.ts.
export type Motif = readonly (number | null)[];

export const MELODY_MOTIFS: readonly Motif[] = [
  // a tresillo-shaped riff outlining root/3rd/5th
  [0, null, 3, null, 0, null, 2, 3, null, 0, null, null, -2, null, 0, null],
  // rolling triad arpeggio
  [0, null, 2, null, 4, null, 2, null, 0, null, 2, null, -1, null, 0, null],
  // syncopated call-and-response
  [0, null, null, 2, 0, null, null, -2, 0, null, null, 3, 2, null, 0, null],
  // sparse, half-time landing points
  [0, null, null, null, 2, null, null, null, -2, null, null, null, 3, null, null, null],
  // dense driving 16ths, triplet-feel neighbour tones
  [0, 1, 0, -1, 0, 2, 0, 1, 0, -1, 0, 2, 0, 1, 0, -1],
];
