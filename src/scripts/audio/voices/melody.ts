import type { Scheduler } from "../scheduler";
import type { FilterMacro } from "../filterMacro";
import { SCALE_FREQUENCIES } from "../scale";
import { createUnisonStack } from "../unison";
import { reserveVoices } from "../voiceBudget";
import type { SpaceBus } from "../space";
import type { MelodyParams } from "../../input/keymap";

const REGISTER_BAND_BELOW = 4;
const REGISTER_BAND_ABOVE = 10;

// A pure random walk retriggering on every subdivision reads as chattering
// noise rather than a line: no silence to breathe, no sense of where it's
// "going." These two fix that without touching bass's own walk (scale.ts's
// randomWalkStep), which doesn't need either behavior.
const REST_PROBABILITY = 0.2; // skip firing roughly 1 in 5 ticks
const PULL_RANGE = REGISTER_BAND_ABOVE; // drift beyond this makes returning home near-certain

/**
 * Same small-step-biased distribution as scale.ts's randomWalkStep, but
 * direction is weighted back toward `center` the further the line has
 * drifted, so a held line traces an arc around its home register instead of
 * wandering indefinitely.
 */
function steppedTowardCenter(current: number, center: number): number {
  const roll = Math.random();
  const magnitude = roll < 0.7 ? 1 : roll < 0.9 ? 2 : Math.floor(Math.random() * 3) + 3;
  const distance = current - center;
  const pullChance = Math.min(Math.abs(distance) / PULL_RANGE, 0.85);
  const movesTowardCenter = Math.random() < pullChance;
  const goingUp = distance <= 0 ? movesTowardCenter : !movesTowardCenter;
  return current + (goingUp ? magnitude : -magnitude);
}

// Thinner than stab/atmosphere's ladders -- melody retriggers fast and up to
// five held keys each generate their own line, so it's the biggest risk to
// the shared voice budget. Deliberately kept single-note (not a triad) too:
// it's the generative lead line, and chording every fast note would erase
// that identity as well as multiply the oscillator count further.
const UNISON_LADDER = [3, 1];
const UNISON_DETUNE_CENTS = 20;
const PEAK_GAIN = 0.35 * 1.2 * 1.15 * 1.15; // calibrated for a single oscillator, scaled by 1/sqrt(voiceCount) below -- three rounds of volume bumps (1.2, 1.15, 1.15) on top of the original calibration

// A pitched, filter-swept "pluck" layered under the sine unison's attack --
// a square oscillator through its own lowpass, cutoff sweeping bright-to-dark
// in ~50ms, gives the note a percussive "snap" the smeary supersaw attack
// doesn't have on its own. An embellishment, not the note itself, so it's the
// one thing here allowed to be skipped entirely under voice-budget pressure.
const PLUCK_LADDER = [1, 0];
const PLUCK_FILTER_START_HZ = 7000;
const PLUCK_FILTER_END_HZ = 900;
const PLUCK_FILTER_SWEEP_SECONDS = 0.05;
const PLUCK_FILTER_Q = 8;
const PLUCK_PEAK_GAIN = 0.4;
const PLUCK_DECAY_SECONDS = 0.12;

// Melody benefits most from the stadium send of any voice here: the rests
// added above leave real gaps in the line, and the echo/reverb tail is what
// fills them rather than leaving dead air.
const SPACE_SEND_LEVEL = 0.4;

// A tap shorter than one tick would otherwise cut a line off after zero or
// one note. Guaranteeing this many notes before a release actually stops
// the line means even the quickest tap still reads as a short musical run,
// while a genuine hold keeps sustaining exactly as before.
const MIN_NOTES_ON_RELEASE = 4;

interface ActiveLine {
  currentDegree: number;
  noteCount: number;
  releasing: boolean;
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
  spaceBus: SpaceBus,
): MelodyVoice {
  const lines = new Map<number, ActiveLine>();

  function triggerNote(degree: number, time: number): void {
    const clamped = Math.min(Math.max(degree, 0), SCALE_FREQUENCIES.length - 1);
    const freq = SCALE_FREQUENCIES[clamped];

    const base = filterMacro.getCutoff();
    const cutoff = Math.min(Math.max(base * (0.8 + Math.random() * 0.4), 200), 16000);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, time);

    const gain = ctx.createGain();
    filter.connect(gain);
    gain.connect(destination);

    const send = ctx.createGain();
    send.gain.value = SPACE_SEND_LEVEL;
    gain.connect(send);
    send.connect(spaceBus.input);

    const voiceCount = reserveVoices(UNISON_LADDER);
    const handle = createUnisonStack(ctx, filter, freq, time, "sine", voiceCount, UNISON_DETUNE_CENTS);

    const peak = PEAK_GAIN / Math.sqrt(Math.max(voiceCount, 1));
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    handle?.stop(time + 0.3);

    const pluckVoiceCount = reserveVoices(PLUCK_LADDER);
    if (pluckVoiceCount > 0) {
      const pluckFilter = ctx.createBiquadFilter();
      pluckFilter.type = "lowpass";
      pluckFilter.Q.value = PLUCK_FILTER_Q;
      pluckFilter.frequency.setValueAtTime(PLUCK_FILTER_START_HZ, time);
      pluckFilter.frequency.exponentialRampToValueAtTime(PLUCK_FILTER_END_HZ, time + PLUCK_FILTER_SWEEP_SECONDS);

      const pluckGain = ctx.createGain();
      pluckGain.gain.setValueAtTime(PLUCK_PEAK_GAIN, time);
      pluckGain.gain.exponentialRampToValueAtTime(0.001, time + PLUCK_DECAY_SECONDS);

      pluckFilter.connect(pluckGain);
      pluckGain.connect(destination);

      const pluckHandle = createUnisonStack(ctx, pluckFilter, freq, time, "square", pluckVoiceCount, 0);
      pluckHandle?.stop(time + 0.3);
    }
  }

  return {
    setActive(params: MelodyParams, active: boolean): void {
      const id = params.registerOffset;
      if (active) {
        const existing = lines.get(id);
        if (existing) {
          // Re-pressed while its post-release tail was still playing out --
          // resume sustaining instead of letting it stop on schedule.
          existing.releasing = false;
          return;
        }
        const line: ActiveLine = {
          currentDegree: id,
          noteCount: 0,
          releasing: false,
          unsubscribe: () => {},
        };
        line.unsubscribe = scheduler.onTick((tickIndex, time) => {
          if (tickIndex % params.tickSubdivision !== 0) return;
          if (Math.random() < REST_PROBABILITY) return; // rest: hold the current pitch, don't sound it
          const next = steppedTowardCenter(line.currentDegree, params.registerOffset);
          line.currentDegree = Math.min(
            Math.max(next, params.registerOffset - REGISTER_BAND_BELOW),
            params.registerOffset + REGISTER_BAND_ABOVE,
          );
          triggerNote(line.currentDegree, time);
          line.noteCount += 1;
          if (line.releasing && line.noteCount >= MIN_NOTES_ON_RELEASE) {
            line.unsubscribe();
            lines.delete(id);
          }
        });
        lines.set(id, line);
      } else {
        const line = lines.get(id);
        if (!line) return;
        if (line.noteCount >= MIN_NOTES_ON_RELEASE) {
          line.unsubscribe();
          lines.delete(id);
        } else {
          line.releasing = true;
        }
      }
    },
  };
}
