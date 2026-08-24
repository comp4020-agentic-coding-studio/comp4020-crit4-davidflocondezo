export interface SaturationBus {
  /** Melody and stab connect here for waveshaper distortion; atmosphere and fx bypass this bus entirely to stay clean. */
  input: GainNode;
}

/**
 * Classic soft-clip "amount"-parameterized distortion curve: higher amount
 * bends the response into a harder knee, adding the harmonic density and
 * "fizz" that glues a detuned-unison stack into one aggressive sound.
 */
function makeSaturationCurve(amount: number, samples = 2048): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

const DRIVE_GAIN = 2.5; // pushes the signal harder into the curve's nonlinearity
const SATURATION_AMOUNT = 50; // curve aggressiveness -- heavy, per the brief
const OUTPUT_TRIM = 0.55; // saturation adds perceived loudness; trims back toward the existing mix balance

/**
 * Shared distortion bus for the two voices meant to cut through the mix
 * (melody's lead, stab's chords/plucks) -- atmosphere and fx connect straight
 * to their own destination instead, so the mix keeps contrast rather than
 * distorting everything into a wall of fizz.
 */
export function createSaturationBus(ctx: AudioContext, destination: AudioNode): SaturationBus {
  const input = ctx.createGain();
  input.gain.value = DRIVE_GAIN;

  const shaper = ctx.createWaveShaper();
  shaper.curve = makeSaturationCurve(SATURATION_AMOUNT);
  shaper.oversample = "4x"; // suppresses clipping-induced aliasing/harshness

  const outputTrim = ctx.createGain();
  outputTrim.gain.value = OUTPUT_TRIM;

  input.connect(shaper);
  shaper.connect(outputTrim);
  outputTrim.connect(destination);

  return { input };
}
