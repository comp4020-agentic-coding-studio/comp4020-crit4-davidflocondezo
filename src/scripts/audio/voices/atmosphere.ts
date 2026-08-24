import type { Scheduler } from "../scheduler";
import type { FilterMacro } from "../filterMacro";
import { DEGREES_PER_OCTAVE, SCALE_FREQUENCIES, triadDegrees } from "../scale";
import { createUnisonStack, type UnisonHandle } from "../unison";
import { reserveVoices } from "../voiceBudget";
import type { SpaceBus } from "../space";

const FADE_TIME_CONSTANT = 0.6;
const MACRO_FOLLOW_TIME_CONSTANT = 0.3; // smooths mouse-driven sweeps, avoids zipper noise

const UNISON_LADDER = [5, 3, 1]; // degrades under voice-budget pressure, never to 0 -- a held pad must never suddenly drop out
const SHIMMER_LADDER = [3, 1, 0]; // the octave-up layer is an embellishment -- fine to skip entirely under load
const UNISON_DETUNE_CENTS = 18; // narrower than stab's -- a long-held pad shouldn't beat unpleasantly
const SHIMMER_GAIN_SCALE = 0.35;

// Calibrated against the original single-oscillator-per-tone design (3
// triangle oscillators, peak 0.18) via equal-power scaling, so the full
// unison stack reads as thicker without being outright louder. The extra
// 0.35 factor is a straight volume trim -- pads kept reading as too loud
// through two earlier passes (0.7, then 0.45) before landing here.
const PEAK_GAIN = 0.18 * Math.sqrt(3) * 0.35;

// Lower than stab's -- a pad already sustains on its own, so a heavy send
// here would wash into indistinct mud rather than add space.
const SPACE_SEND_LEVEL = 0.22;

interface ActiveVoicing {
  handles: UnisonHandle[];
  gain: GainNode;
  filter: BiquadFilterNode;
  localFactor: number; // fixed per-voicing offset so pads don't all sound identical
}

export interface AtmosphereVoice {
  setActive(variant: number, active: boolean): void;
}

/**
 * Sustained pads built from diatonic triads (root/3rd/5th), one per
 * home-row key, now each chord tone a detuned-unison stack instead of a
 * lone triangle oscillator, plus a quieter octave-up shimmer layer. Turning
 * on is quantized to the next bar so a pad always enters on a strong beat;
 * turning off fades immediately since there's no musical reason to make a
 * stranger wait for a grid line to release a key.
 */
export function createAtmosphereVoice(
  ctx: AudioContext,
  destination: AudioNode,
  scheduler: Scheduler,
  filterMacro: FilterMacro,
  spaceBus: SpaceBus,
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
    gain.gain.setTargetAtTime(PEAK_GAIN, time, FADE_TIME_CONSTANT);
    filter.connect(gain);
    gain.connect(destination);

    const send = ctx.createGain();
    send.gain.value = SPACE_SEND_LEVEL;
    gain.connect(send);
    send.connect(spaceBus.input);

    const handles: UnisonHandle[] = [];
    for (const degree of triadDegrees(variant)) {
      const voiceCount = reserveVoices(UNISON_LADDER);
      const handle = createUnisonStack(
        ctx,
        filter,
        SCALE_FREQUENCIES[degree],
        time,
        "triangle",
        voiceCount,
        UNISON_DETUNE_CENTS,
      );
      if (handle) handles.push(handle);
    }

    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = SHIMMER_GAIN_SCALE;
    shimmerGain.connect(filter);
    const shimmerRoot = Math.min(variant + DEGREES_PER_OCTAVE, SCALE_FREQUENCIES.length - 1);
    for (const degree of triadDegrees(shimmerRoot)) {
      const voiceCount = reserveVoices(SHIMMER_LADDER);
      const handle = createUnisonStack(
        ctx,
        shimmerGain,
        SCALE_FREQUENCIES[degree],
        time,
        "triangle",
        voiceCount,
        UNISON_DETUNE_CENTS,
      );
      if (handle) handles.push(handle);
    }

    active.set(variant, { handles, gain, filter, localFactor });
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
    for (const handle of voicing.handles) handle.stop(stopAt);
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
