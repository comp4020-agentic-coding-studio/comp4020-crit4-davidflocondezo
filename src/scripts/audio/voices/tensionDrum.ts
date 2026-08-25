import type { Scheduler } from "../scheduler";
import { TICKS_PER_BEAT, TICKS_PER_BAR } from "../scheduler";
import { createNoiseBuffer } from "../noise";
import type { ArrangementController } from "../arrangement";

const CRACK_HIGHPASS_HZ = 2200;
const CRACK_DECAY_SECONDS = 0.08;
const CRACK_PEAK_GAIN = 0.5;

const CLICK_START_HZ = 900;
const CLICK_END_HZ = 200;
const CLICK_DECAY_SECONDS = 0.06;
const CLICK_PEAK_GAIN = 0.4;

// A short "machine gun" fill fired the instant climax is requested, spaced
// at half a tick (a 32nd note) rather than adding a new grid to the
// scheduler.
const FILL_HIT_COUNT = 4;

/**
 * Replaces the kick during BUILDUP: a tight, punchy hit with no bass tail
 * (a highpassed noise "crack" plus a fast pitch-swept click) that
 * accelerates from quarters to sixteenths as the buildup progresses --
 * phased from the buildup's own start time, not the global tick grid, so the
 * acceleration always begins at bar 1 of *this* buildup. Fires one fast fill
 * the instant climax is requested, then falls silent for the "pre-drop" gap
 * via arrangement.isTriggerBlocked().
 */
export function createTensionDrumVoice(
  ctx: AudioContext,
  destination: AudioNode,
  scheduler: Scheduler,
  arrangement: ArrangementController,
): () => void {
  const noiseBuffer = createNoiseBuffer(ctx, 0.15);

  function triggerAt(time: number): void {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = "highpass";
    crackFilter.frequency.setValueAtTime(CRACK_HIGHPASS_HZ, time);
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(CRACK_PEAK_GAIN, time);
    crackGain.gain.exponentialRampToValueAtTime(0.001, time + CRACK_DECAY_SECONDS);
    noise.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(destination);
    noise.start(time);
    noise.stop(time + CRACK_DECAY_SECONDS + 0.02);

    const click = ctx.createOscillator();
    click.type = "triangle";
    click.frequency.setValueAtTime(CLICK_START_HZ, time);
    click.frequency.exponentialRampToValueAtTime(CLICK_END_HZ, time + CLICK_DECAY_SECONDS);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(CLICK_PEAK_GAIN, time);
    clickGain.gain.exponentialRampToValueAtTime(0.001, time + CLICK_DECAY_SECONDS);
    click.connect(clickGain);
    clickGain.connect(destination);
    click.start(time);
    click.stop(time + CLICK_DECAY_SECONDS + 0.02);
  }

  const unsubscribe = scheduler.onTick((_tickIndex, time) => {
    if (arrangement.getState() !== "buildup" || arrangement.isTriggerBlocked()) return;
    const startTime = arrangement.getBuildupStartTime();
    if (startTime === null) return;
    const secondsPerTick = scheduler.secondsPerTick();
    const barSeconds = secondsPerTick * TICKS_PER_BAR;
    const barsElapsed = Math.floor((time - startTime) / barSeconds);
    const step = barsElapsed < 4 ? TICKS_PER_BEAT : barsElapsed < 6 ? TICKS_PER_BEAT / 2 : 1;
    const ticksElapsed = Math.round((time - startTime) / secondsPerTick);
    if (ticksElapsed % step !== 0) return;
    triggerAt(time);
  });

  arrangement.onClimaxRequested(() => {
    const secondsPerTick = scheduler.secondsPerTick();
    const start = ctx.currentTime;
    for (let i = 0; i < FILL_HIT_COUNT; i++) {
      triggerAt(start + (i * secondsPerTick) / 2);
    }
  });

  return unsubscribe;
}
