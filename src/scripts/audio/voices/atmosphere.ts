import type { Scheduler } from "../scheduler";
import type { FilterMacro } from "../filterMacro";
import { SCALE_FREQUENCIES } from "../scale";

const CHORD_STEPS = [0, 2, 4]; // stacked scale thirds: root, third, fifth
const FADE_TIME_CONSTANT = 0.6;
const MACRO_FOLLOW_TIME_CONSTANT = 0.3; // smooths mouse-driven sweeps, avoids zipper noise

interface ActiveVoicing {
  oscillators: OscillatorNode[];
  gain: GainNode;
  filter: BiquadFilterNode;
  localFactor: number; // fixed per-voicing offset so pads don't all sound identical
}

export interface AtmosphereVoice {
  setActive(variant: number, active: boolean): void;
}

/**
 * Sustained pads built from diatonic triads (stacked scale thirds), one per
 * home-row key. Turning on is quantized to the next bar so a pad always
 * enters on a strong beat; turning off fades immediately since there's no
 * musical reason to make a stranger wait for a grid line to release a key.
 */
export function createAtmosphereVoice(
  ctx: AudioContext,
  destination: AudioNode,
  scheduler: Scheduler,
  filterMacro: FilterMacro,
): AtmosphereVoice {
  const active = new Map<number, ActiveVoicing>();

  function startVoicing(variant: number, time: number): void {
    if (active.has(variant)) return;

    const localFactor = 0.85 + Math.random() * 0.3;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterMacro.getCutoff() * localFactor, time);
    filter.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.setTargetAtTime(0.18, time, FADE_TIME_CONSTANT);
    filter.connect(gain);
    gain.connect(destination);

    const oscillators = CHORD_STEPS.map((step) => {
      const degree = Math.min(variant + step, SCALE_FREQUENCIES.length - 1);
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(SCALE_FREQUENCIES[degree], time);
      osc.connect(filter);
      osc.start(time);
      return osc;
    });

    active.set(variant, { oscillators, gain, filter, localFactor });
  }

  function stopVoicing(variant: number): void {
    const voicing = active.get(variant);
    if (!voicing) return;
    active.delete(variant);

    const now = ctx.currentTime;
    voicing.gain.gain.cancelScheduledValues(now);
    voicing.gain.gain.setValueAtTime(voicing.gain.gain.value, now);
    voicing.gain.gain.setTargetAtTime(0, now, FADE_TIME_CONSTANT);
    const stopAt = now + FADE_TIME_CONSTANT * 4;
    for (const osc of voicing.oscillators) osc.stop(stopAt);
  }

  // Sustained pads follow the mouse-driven macro continuously, not just at
  // note-on, since a held pad can outlast many mouse movements.
  scheduler.onTick((_tickIndex, time) => {
    const base = filterMacro.getCutoff();
    for (const voicing of active.values()) {
      voicing.filter.frequency.setTargetAtTime(
        base * voicing.localFactor,
        time,
        MACRO_FOLLOW_TIME_CONSTANT,
      );
    }
  });

  return {
    setActive(variant: number, isActive: boolean): void {
      if (isActive) startVoicing(variant, scheduler.nextQuantizedTime("bar"));
      else stopVoicing(variant);
    },
  };
}
