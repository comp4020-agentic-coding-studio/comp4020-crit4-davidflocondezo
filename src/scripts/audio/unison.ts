import { releaseVoices } from "./voiceBudget";

export interface UnisonHandle {
  oscillators: OscillatorNode[];
  stop(time: number): void;
}

/**
 * Spreads `voiceCount` detune values symmetrically across
 * [-widthCents, +widthCents]. Odd counts land exactly on 0 in the middle
 * (a true center oscillator); even counts don't, which is normal for a
 * supersaw and not worth special-casing.
 */
export function detuneSpread(voiceCount: number, widthCents: number): number[] {
  if (voiceCount <= 1) return [0];
  const step = (2 * widthCents) / (voiceCount - 1);
  return Array.from({ length: voiceCount }, (_, i) => -widthCents + i * step);
}

/**
 * A "supersaw"-style unison stack: `voiceCount` detuned oscillators, each
 * panned in the same direction as its detune (sharp = right, flat = left),
 * feeding the shared `destination` (the caller's own filter/gain node).
 * Returns null for voiceCount <= 0 so a voice-budget-starved embellishment
 * layer can be skipped entirely by its caller. Callers should scale their
 * own gain envelope's peak by 1/sqrt(voiceCount) -- this never inserts a
 * gain node of its own.
 */
export function createUnisonStack(
  ctx: AudioContext,
  destination: AudioNode,
  freq: number,
  time: number,
  waveform: OscillatorType,
  voiceCount: number,
  detuneWidthCents: number,
): UnisonHandle | null {
  if (voiceCount <= 0) return null;

  const detunes = detuneSpread(voiceCount, detuneWidthCents);
  const oscillators = detunes.map((detune) => {
    const osc = ctx.createOscillator();
    osc.type = waveform;
    osc.frequency.setValueAtTime(freq, time);
    osc.detune.setValueAtTime(detune, time);

    const pan = detuneWidthCents === 0 ? 0 : Math.max(-1, Math.min(1, detune / detuneWidthCents)) * 0.8;
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, time);

    osc.connect(panner);
    panner.connect(destination);
    osc.start(time);
    return osc;
  });

  return {
    oscillators,
    stop(stopTime: number): void {
      let remaining = oscillators.length;
      for (const osc of oscillators) {
        osc.onended = () => {
          remaining -= 1;
          if (remaining === 0) releaseVoices(voiceCount);
        };
        osc.stop(stopTime);
      }
    },
  };
}
