import type { Scheduler } from "../scheduler";
import { TICKS_PER_BEAT } from "../scheduler";

/**
 * The kick IS the clock made audible: rhythm is perfectly rigid (every
 * quarter note, forever). Variation comes only from small per-hit jitter on
 * the pitch envelope and decay, so it never sounds like one looped sample.
 */
export function createKickVoice(
  ctx: AudioContext,
  destination: AudioNode,
  scheduler: Scheduler,
  duck: (time: number) => void,
): () => void {
  function triggerAt(time: number): void {
    duck(time);

    const startFreqJitter = 140 + Math.random() * 20; // 140-160 Hz
    const decayJitter = 0.28 + Math.random() * 0.14; // 0.28-0.42s

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(startFreqJitter, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.12);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decayJitter);

    osc.connect(gain);
    gain.connect(destination);
    osc.start(time);
    osc.stop(time + decayJitter + 0.05);
  }

  return scheduler.onTick((tickIndex, time) => {
    if (tickIndex % TICKS_PER_BEAT === 0) triggerAt(time);
  });
}
