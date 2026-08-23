import type { Scheduler } from "../scheduler";
import { createNoiseBuffer } from "../noise";

type FxKind = "impact" | "zap" | "reverse";

interface FxDescriptor {
  kind: FxKind;
  freq: number;
}

// 10 one-shots spread across three characters so the number row reads as a
// small FX palette (impacts, zaps, reverse swells) rather than ten copies
// of the same hit.
const FX_DESCRIPTORS: readonly FxDescriptor[] = [
  { kind: "impact", freq: 400 },
  { kind: "impact", freq: 800 },
  { kind: "impact", freq: 1600 },
  { kind: "impact", freq: 3200 },
  { kind: "zap", freq: 1800 },
  { kind: "zap", freq: 2600 },
  { kind: "zap", freq: 3600 },
  { kind: "reverse", freq: 900 },
  { kind: "reverse", freq: 1800 },
  { kind: "reverse", freq: 3000 },
];

export interface FxVoice {
  trigger(variant: number): void;
}

/** One-shots quantized to the next 16th, same grid as the stabs. */
export function createFxVoice(ctx: AudioContext, destination: AudioNode, scheduler: Scheduler): FxVoice {
  const noiseBuffer = createNoiseBuffer(ctx, 1);

  function triggerImpact(freq: number, time: number): void {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq * (0.85 + Math.random() * 0.3), time);
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    noise.start(time);
    noise.stop(time + 0.16);
  }

  function triggerZap(freq: number, time: number): void {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.15, time + 0.12);

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(300, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  function triggerReverse(freq: number, time: number): void {
    const duration = 0.5 + Math.random() * 0.2;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq, time);
    filter.Q.value = 0.9;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.7, time + duration);
    gain.gain.setValueAtTime(0.001, time + duration + 0.02);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    noise.start(time);
    noise.stop(time + duration + 0.05);
  }

  function triggerAt(variant: number, time: number): void {
    const descriptor = FX_DESCRIPTORS[variant] ?? FX_DESCRIPTORS[0];
    if (descriptor.kind === "impact") triggerImpact(descriptor.freq, time);
    else if (descriptor.kind === "zap") triggerZap(descriptor.freq, time);
    else triggerReverse(descriptor.freq, time);
  }

  return {
    trigger(variant: number): void {
      triggerAt(variant, scheduler.nextQuantizedTime("16th"));
    },
  };
}
