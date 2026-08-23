import type { Scheduler } from "../scheduler";
import { TICKS_PER_BAR } from "../scheduler";
import { SCALE_FREQUENCIES, randomWalkStep } from "../scale";

const BASS_MAX_DEGREE = 6; // stay within the lowest octave of the scale table
const SUB_OCTAVES_DOWN = 4; // divide frequency to land in true sub-bass range

// Every pattern is a set of 16th-note tick positions within one bar
// (0-15) where the bass hits. The kick stays an unbroken four-on-the-floor
// pulse every session -- that rigid pulse is what makes this read as
// hardstyle at all -- but the bass sitting in its pocket is free to vary,
// same as any hardstyle track's groove differs from the next one's. One
// pattern is picked once per session so a reload can open on a different
// groove while the bar stays internally consistent for as long as it plays.
const BASS_RHYTHM_PATTERNS: readonly (readonly number[])[] = [
  [2, 6, 10, 14], // straight off-beat 8ths, the original reverse-bass pocket
  [2, 6, 9, 14], // syncopated: one hit nudged a 16th early
  [2, 4, 6, 10, 12, 14], // gallop: doubled hits in two of the four beats
  [2, 10], // half-time: once every two beats
];

/**
 * Reverse bass in the pocket between kicks, so it doesn't fight the kick's
 * low end. Timing always snaps to the scheduler's own tick grid -- so it can
 * never land off-beat -- but which ticks it hits is chosen once per session;
 * the root note evolves on top of that, roughly once a bar, via the same
 * scale-constrained random walk used by the melody voices.
 */
export function createBassVoice(ctx: AudioContext, destination: AudioNode, scheduler: Scheduler): () => void {
  // Starting degree is randomized per session too -- otherwise every reload
  // opens on the same root and only reveals a different one after the first
  // bar's random walk.
  let rootDegree = Math.floor(Math.random() * (BASS_MAX_DEGREE + 1));
  const pattern = new Set(
    BASS_RHYTHM_PATTERNS[Math.floor(Math.random() * BASS_RHYTHM_PATTERNS.length)],
  );

  function triggerAt(time: number): void {
    const freq = SCALE_FREQUENCIES[rootDegree] / SUB_OCTAVES_DOWN;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(220 + Math.random() * 40, time);
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    osc.start(time);
    osc.stop(time + 0.3);
  }

  return scheduler.onTick((tickIndex, time) => {
    if (tickIndex % TICKS_PER_BAR === 0) {
      rootDegree = Math.min(randomWalkStep(rootDegree), BASS_MAX_DEGREE);
    }
    if (pattern.has(tickIndex % TICKS_PER_BAR)) triggerAt(time);
  });
}
