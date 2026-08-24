import type { Scheduler } from "../scheduler";
import type { FilterMacro } from "../filterMacro";
import { DEGREES_PER_OCTAVE, SCALE_FREQUENCIES, triadDegrees } from "../scale";
import { createUnisonStack, type UnisonHandle } from "../unison";
import { reserveVoices } from "../voiceBudget";
import { createNoiseBuffer } from "../noise";
import type { SpaceBus } from "../space";

// Stabs sit an octave above the scale table's base register so they read
// as a lead, not a bass note, at any scale-degree index the keymap sends.
const STAB_OCTAVE_OFFSET = 7;

const UNISON_LADDER = [5, 3, 1]; // degrades under voice-budget pressure, never to 0 -- the chord itself must always sound
const SHIMMER_LADDER = [3, 1, 0]; // the octave-up layer is an embellishment -- fine to skip entirely under load
const UNISON_DETUNE_CENTS = 35; // bright, aggressive spread for a euphoric-lead supersaw
const SHIMMER_GAIN_SCALE = 0.4;

// A quiet layer of highpassed white noise on top of the supersaw -- the
// classic hardstyle-lead "fizz" that reads as air/brightness rather than a
// distinct sound. Bypasses the per-trigger lowpass filter entirely (that
// filter's cutoff can jitter well below this band, which would otherwise
// silence the whole point of it) and isn't gated by the voice budget --
// it's a buffer source, not an oscillator, and costs nothing from that pool.
const NOISE_HIGHPASS_HZ = 8000;
const NOISE_PEAK_GAIN = 0.15;

// How much of each stab sends to the shared delay/reverb bus for the
// "stadium echo" ambience -- the dry connection below is untouched, this is
// purely additive.
const SPACE_SEND_LEVEL = 0.35;

export interface StabVoice {
  trigger(scaleDegree: number): void;
}

/**
 * One synth stab per press: a full diatonic triad (root/3rd/5th), each tone
 * a detuned-unison "supersaw" stack rather than a lone oscillator, plus a
 * quieter octave-up shimmer layer of the same triad. All of it shares one
 * filter + gain envelope per hit -- it's still one musical event, just a
 * much bigger one. Quantized to the next 16th note so mashing the top row
 * never lands off-beat. Filter cutoff jitters per-trigger so repeated notes
 * on the same key don't sound identical.
 */
export function createStabVoice(
  ctx: AudioContext,
  destination: AudioNode,
  scheduler: Scheduler,
  filterMacro: FilterMacro,
  spaceBus: SpaceBus,
): StabVoice {
  const noiseBuffer = createNoiseBuffer(ctx, 1);

  function triggerAt(scaleDegree: number, time: number): void {
    const rootDegree = Math.min(scaleDegree + STAB_OCTAVE_OFFSET, SCALE_FREQUENCIES.length - 1);
    const chordDegrees = triadDegrees(rootDegree);
    const shimmerRoot = Math.min(rootDegree + DEGREES_PER_OCTAVE, SCALE_FREQUENCIES.length - 1);
    const shimmerDegrees = triadDegrees(shimmerRoot);

    const base = filterMacro.getCutoff();
    const cutoff = Math.min(Math.max(base * (0.7 + Math.random() * 0.6), 200), 16000);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, time);
    filter.Q.value = 4 + Math.random() * 4;

    const gain = ctx.createGain();
    filter.connect(gain);
    gain.connect(destination);

    const send = ctx.createGain();
    send.gain.value = SPACE_SEND_LEVEL;
    gain.connect(send);
    send.connect(spaceBus.input);

    const handles: UnisonHandle[] = [];
    let chordOscillatorCount = 0;
    for (const degree of chordDegrees) {
      const voiceCount = reserveVoices(UNISON_LADDER);
      const handle = createUnisonStack(ctx, filter, SCALE_FREQUENCIES[degree], time, "sawtooth", voiceCount, UNISON_DETUNE_CENTS);
      if (handle) {
        handles.push(handle);
        chordOscillatorCount += voiceCount;
      }
    }

    // Shimmer layer feeds its own quiet gain stage into the shared filter,
    // so it's always audibly under the main triad regardless of how many
    // oscillators either layer ends up with.
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = SHIMMER_GAIN_SCALE;
    shimmerGain.connect(filter);
    for (const degree of shimmerDegrees) {
      const voiceCount = reserveVoices(SHIMMER_LADDER);
      const handle = createUnisonStack(ctx, shimmerGain, SCALE_FREQUENCIES[degree], time, "sawtooth", voiceCount, UNISON_DETUNE_CENTS);
      if (handle) handles.push(handle);
    }

    // Equal-power compensation across the main triad's oscillators so a
    // thick stack isn't also a loud one.
    const peak = 0.7 / Math.sqrt(Math.max(chordOscillatorCount, 1));
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    const stopTime = time + 0.2;
    for (const handle of handles) handle.stop(stopTime);

    // Fizz layer: same attack/decay shape as the main envelope so it reads
    // as part of the same hit, not a separate sound.
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.setValueAtTime(NOISE_HIGHPASS_HZ, time);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, time);
    noiseGain.gain.exponentialRampToValueAtTime(NOISE_PEAK_GAIN, time + 0.005);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(destination);
    noise.start(time);
    noise.stop(stopTime);
  }

  return {
    trigger(scaleDegree: number): void {
      triggerAt(scaleDegree, scheduler.nextQuantizedTime("16th"));
    },
  };
}
