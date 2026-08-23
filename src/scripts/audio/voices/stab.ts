import type { Scheduler } from "../scheduler";
import type { FilterMacro } from "../filterMacro";
import { SCALE_FREQUENCIES } from "../scale";

// Stabs sit an octave above the scale table's base register so they read
// as a lead, not a bass note, at any scale-degree index the keymap sends.
const STAB_OCTAVE_OFFSET = 7;

export interface StabVoice {
  trigger(scaleDegree: number): void;
}

/**
 * One synth stab per press, quantized to the next 16th note so mashing the
 * top row never lands off-beat. Filter cutoff jitters per-trigger so
 * repeated notes on the same key don't sound identical.
 */
export function createStabVoice(
  ctx: AudioContext,
  destination: AudioNode,
  scheduler: Scheduler,
  filterMacro: FilterMacro,
): StabVoice {
  function triggerAt(scaleDegree: number, time: number): void {
    const degree = Math.min(scaleDegree + STAB_OCTAVE_OFFSET, SCALE_FREQUENCIES.length - 1);
    const freq = SCALE_FREQUENCIES[degree];

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);

    // Global macro sets the base cutoff; per-trigger jitter (+/-30%) on top
    // so repeated notes on the same key never sound identical.
    const base = filterMacro.getCutoff();
    const cutoff = Math.min(Math.max(base * (0.7 + Math.random() * 0.6), 200), 16000);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, time);
    filter.Q.value = 4 + Math.random() * 4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.7, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  return {
    trigger(scaleDegree: number): void {
      triggerAt(scaleDegree, scheduler.nextQuantizedTime("16th"));
    },
  };
}
