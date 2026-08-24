// F natural minor: F, G, Ab, Bb, C, Db, Eb (semitone offsets from F).
const SEMITONE_OFFSETS = [0, 2, 3, 5, 7, 8, 10];
const NOTE_NAMES = ["F", "G", "Ab", "Bb", "C", "Db", "Eb"];

// F3, so index 0 of octave 0 sits in a low-mid register; octaves stack above it.
const F3_HZ = 174.6141;
const OCTAVES = 4;

// Picked once per page load, so every key keeps its category and relative
// scale degree (Q is always the first stab, one step up from the second),
// but the actual key the instrument plays in -- and so how every voice
// sounds -- differs from one session to the next.
const ROOT_SEMITONE_OFFSET = Math.floor(Math.random() * 12);

// Non-scale voices (FX one-shots aren't diatonic, so they can't sit on a
// scale degree) key off this same offset instead, so the whole instrument
// shifts together each session rather than just the scale-constrained voices.
export const SESSION_PITCH_RATIO = 2 ** (ROOT_SEMITONE_OFFSET / 12);

function frequencyForDegree(degreeIndex: number): number {
  const octave = Math.floor(degreeIndex / SEMITONE_OFFSETS.length);
  const withinOctave = degreeIndex % SEMITONE_OFFSETS.length;
  const semitonesFromF3 = octave * 12 + SEMITONE_OFFSETS[withinOctave] + ROOT_SEMITONE_OFFSET;
  return F3_HZ * 2 ** (semitonesFromF3 / 12);
}

// How many scale-degree steps make up one octave in this table -- shared so
// voices that add an "octave up" shimmer layer don't each hardcode 7.
export const DEGREES_PER_OCTAVE = SEMITONE_OFFSETS.length;

export const SCALE_DEGREE_COUNT = SEMITONE_OFFSETS.length * OCTAVES;

export const SCALE_FREQUENCIES: readonly number[] = Array.from(
  { length: SCALE_DEGREE_COUNT },
  (_, i) => frequencyForDegree(i),
);

// Diatonic "stack of thirds": since the table is indexed by scale degree
// (not chromatic semitone), the note two degrees up is always the diatonic
// 3rd and four degrees up is always the diatonic 5th, so this comes out
// major/minor/diminished correctly for wherever rootDegree sits, with no
// chromatic interval math needed.
export function triadDegrees(rootDegree: number): number[] {
  return [0, 2, 4].map((step) => Math.min(rootDegree + step, SCALE_FREQUENCIES.length - 1));
}

/**
 * Snaps an arbitrary Hz value onto whichever scale tone it's closest to.
 * For voices that pick their frequencies from a fixed design palette rather
 * than a scale degree (FX's zap/reverse one-shots) -- since `SCALE_FREQUENCIES`
 * already bakes in this session's random transposition, this locks a
 * one-shot onto a note that's actually in key instead of an arbitrary Hz
 * value that only coincidentally lined up before the session shifted.
 */
export function nearestScaleFrequency(freq: number): number {
  return SCALE_FREQUENCIES.reduce((closest, candidate) =>
    Math.abs(candidate - freq) < Math.abs(closest - freq) ? candidate : closest,
  );
}

export function degreeName(degreeIndex: number): string {
  const octave = Math.floor(degreeIndex / SEMITONE_OFFSETS.length);
  const withinOctave = degreeIndex % SEMITONE_OFFSETS.length;
  return `${NOTE_NAMES[withinOctave]}${octave}`;
}

/**
 * Steps mostly by a small scale-degree interval so a sequence of these reads
 * as a melodic line rather than independent random picks. Clamped (not
 * wrapped) at the table's edges so it can't jump octave ranges unexpectedly.
 */
export function randomWalkStep(currentIndex: number): number {
  const roll = Math.random();
  let step: number;
  if (roll < 0.7) {
    step = Math.random() < 0.5 ? 1 : -1;
  } else if (roll < 0.9) {
    step = Math.random() < 0.5 ? 2 : -2;
  } else {
    step = Math.floor(Math.random() * 7) - 3;
  }
  const next = currentIndex + step;
  return Math.min(Math.max(next, 0), SCALE_DEGREE_COUNT - 1);
}
