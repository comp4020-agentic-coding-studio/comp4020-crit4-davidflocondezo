import type { Scheduler } from "../scheduler";
import { TICKS_PER_BAR, TICKS_PER_BEAT } from "../scheduler";
import { SCALE_FREQUENCIES, randomWalkStep } from "../scale";

const BASS_MAX_DEGREE = 6; // stay within the lowest octave of the scale table
const SUB_OCTAVES_DOWN = 4; // divide frequency to land in true sub-bass range

/**
 * Reverse bass in the pocket between kicks (the 8th-note off-beat), so it
 * doesn't fight the kick's low end. Rhythm is as rigid as the kick; only the
 * root note evolves, roughly once a bar, via the same scale-constrained
 * random walk used by the melody voices.
 */
export function createBassVoice(ctx: AudioContext, destination: AudioNode, scheduler: Scheduler): () => void {
  let rootDegree = 0;

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
    if (tickIndex % TICKS_PER_BEAT === TICKS_PER_BEAT / 2) triggerAt(time);
  });
}
