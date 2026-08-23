import type { Scheduler } from "../scheduler";
import type { FilterMacro } from "../filterMacro";
import { SCALE_FREQUENCIES, randomWalkStep } from "../scale";
import type { MelodyParams } from "../../input/keymap";

const REGISTER_BAND_BELOW = 4;
const REGISTER_BAND_ABOVE = 10;

interface ActiveLine {
  currentDegree: number;
  unsubscribe: () => void;
}

export interface MelodyVoice {
  setActive(params: MelodyParams, active: boolean): void;
}

/**
 * Each held melody key runs its own generative random-walk line, gated to
 * its own tick subdivision and clamped to a band around its own register,
 * so holding several at once layers distinct voices instead of five copies
 * of the same line. `registerOffset` is unique per key in the keymap, so it
 * doubles as this voice's identity for start/stop bookkeeping.
 */
export function createMelodyVoice(
  ctx: AudioContext,
  destination: AudioNode,
  scheduler: Scheduler,
  filterMacro: FilterMacro,
): MelodyVoice {
  const lines = new Map<number, ActiveLine>();

  function triggerNote(degree: number, time: number): void {
    const clamped = Math.min(Math.max(degree, 0), SCALE_FREQUENCIES.length - 1);
    const freq = SCALE_FREQUENCIES[clamped];

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, time);

    const base = filterMacro.getCutoff();
    const cutoff = Math.min(Math.max(base * (0.8 + Math.random() * 0.4), 200), 16000);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.35, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    osc.start(time);
    osc.stop(time + 0.3);
  }

  return {
    setActive(params: MelodyParams, active: boolean): void {
      if (active) {
        if (lines.has(params.registerOffset)) return;
        const line: ActiveLine = { currentDegree: params.registerOffset, unsubscribe: () => {} };
        line.unsubscribe = scheduler.onTick((tickIndex, time) => {
          if (tickIndex % params.tickSubdivision !== 0) return;
          const next = randomWalkStep(line.currentDegree);
          line.currentDegree = Math.min(
            Math.max(next, params.registerOffset - REGISTER_BAND_BELOW),
            params.registerOffset + REGISTER_BAND_ABOVE,
          );
          triggerNote(line.currentDegree, time);
        });
        lines.set(params.registerOffset, line);
      } else {
        const line = lines.get(params.registerOffset);
        if (!line) return;
        line.unsubscribe();
        lines.delete(params.registerOffset);
      }
    },
  };
}
