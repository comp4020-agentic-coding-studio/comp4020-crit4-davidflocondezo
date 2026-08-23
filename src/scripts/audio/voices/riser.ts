import type { Scheduler } from "../scheduler";
import { createNoiseBuffer } from "../noise";

const RISER_DURATION = 3; // seconds, roughly a 1.5-bar sweep at 150 BPM

export interface RiserVoice {
  trigger(variant: number): void;
}

/**
 * Builds tension toward the next phrase. Quantized to the next bar, not the
 * finer 16th grid the one-shots use, since a riser only makes musical sense
 * starting on a strong beat.
 */
export function createRiserVoice(
  ctx: AudioContext,
  destination: AudioNode,
  scheduler: Scheduler,
): RiserVoice {
  function triggerNoise(time: number): void {
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, RISER_DURATION);
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1;
    filter.frequency.setValueAtTime(300, time);
    filter.frequency.exponentialRampToValueAtTime(6000, time + RISER_DURATION);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.6, time + RISER_DURATION);
    gain.gain.setValueAtTime(0.001, time + RISER_DURATION + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    noise.start(time);
    noise.stop(time + RISER_DURATION + 0.1);
  }

  function triggerTone(time: number): void {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(110, time);
    osc.frequency.exponentialRampToValueAtTime(1600, time + RISER_DURATION);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(400, time);
    filter.frequency.exponentialRampToValueAtTime(8000, time + RISER_DURATION);
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.5, time + RISER_DURATION);
    gain.gain.setValueAtTime(0.001, time + RISER_DURATION + 0.05);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    osc.start(time);
    osc.stop(time + RISER_DURATION + 0.1);
  }

  return {
    trigger(variant: number): void {
      const time = scheduler.nextQuantizedTime("bar");
      if (variant === 0) triggerNoise(time);
      else triggerTone(time);
    },
  };
}
