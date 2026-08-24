// Every unison stack across every voice draws from this one ceiling, so a
// stranger mashing several melody/atmosphere/stab keys at once thins out the
// oscillator count instead of clipping the master bus or crackling.
const MAX_CONCURRENT_OSCILLATORS = 96;

let active = 0;

/**
 * Tries each count in `ladder` (highest first) and reserves the first that
 * fits under the ceiling. The last entry in the ladder is always granted
 * even if it pushes past the ceiling, so a note is only ever thinned, never
 * silenced outright -- except a ladder that explicitly ends in 0 (an
 * embellishment layer), which is allowed to be skipped entirely.
 */
export function reserveVoices(ladder: readonly number[]): number {
  for (const count of ladder) {
    if (count === 0 || active + count <= MAX_CONCURRENT_OSCILLATORS) {
      active += count;
      return count;
    }
  }
  const fallback = ladder[ladder.length - 1] ?? 0;
  active += fallback;
  return fallback;
}

export function releaseVoices(count: number): void {
  active = Math.max(0, active - count);
}

export function activeVoiceCount(): number {
  return active;
}
