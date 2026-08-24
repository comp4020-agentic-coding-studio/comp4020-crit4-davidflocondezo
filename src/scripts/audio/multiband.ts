export interface MultibandBus {
  /** Bass, chords/leads, and their reverb sends connect here via the sidechain bus -- everything the kick pumps also gets split into independent bands. */
  input: GainNode;
}

const LOW_CROSSOVER_HZ = 400;
const HIGH_CROSSOVER_HZ = 2500;
const OUTPUT_TRIM = 0.5; // three independently-boosted bands summed is loud; trim back toward the existing mix balance

interface BandConfig {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  makeup: number;
}

// Low: carries the kick's sidechain duck and the bass -- kept the least
// squashed so it doesn't get pumpy on top of the duck it's already riding.
const LOW: BandConfig = { threshold: -20, ratio: 4, attack: 0.01, release: 0.25, makeup: 1.4 };
// Mid: the "forced forward" punch band -- melody/stab fundamentals live here.
const MID: BandConfig = { threshold: -30, ratio: 9, attack: 0.003, release: 0.15, makeup: 2.2 };
// High: the "sparkle" band -- reverb tails, stab's noise fizz, the melody
// pluck's click. Squashed hardest and boosted the most.
const HIGH: BandConfig = { threshold: -35, ratio: 10, attack: 0.001, release: 0.1, makeup: 3.2 };

function buildBand(ctx: AudioContext, source: AudioNode, config: BandConfig, output: AudioNode): void {
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = config.threshold;
  compressor.ratio.value = config.ratio;
  compressor.attack.value = config.attack;
  compressor.release.value = config.release;
  compressor.knee.value = 6;

  const makeup = ctx.createGain();
  makeup.gain.value = config.makeup;

  source.connect(compressor);
  compressor.connect(makeup);
  makeup.connect(output);
}

/**
 * True 3-band OTT-style multiband compressor: independent crossover +
 * compressor + makeup gain per band, summed. Unlike a single fullband
 * DynamicsCompressorNode, a loud low-end transient (kick/bass) can't duck
 * the highs here -- each band reacts only to its own energy, which is what
 * lets the high band get squashed and boosted hard enough to "sparkle"
 * without the low end also pumping in sympathy.
 */
export function createMultibandBus(ctx: AudioContext, destination: AudioNode): MultibandBus {
  const input = ctx.createGain();
  const outputGain = ctx.createGain();
  outputGain.gain.value = OUTPUT_TRIM;
  outputGain.connect(destination);

  const lowFilter = ctx.createBiquadFilter();
  lowFilter.type = "lowpass";
  lowFilter.frequency.value = LOW_CROSSOVER_HZ;
  input.connect(lowFilter);
  buildBand(ctx, lowFilter, LOW, outputGain);

  const midHighpass = ctx.createBiquadFilter();
  midHighpass.type = "highpass";
  midHighpass.frequency.value = LOW_CROSSOVER_HZ;
  const midLowpass = ctx.createBiquadFilter();
  midLowpass.type = "lowpass";
  midLowpass.frequency.value = HIGH_CROSSOVER_HZ;
  input.connect(midHighpass);
  midHighpass.connect(midLowpass);
  buildBand(ctx, midLowpass, MID, outputGain);

  const highFilter = ctx.createBiquadFilter();
  highFilter.type = "highpass";
  highFilter.frequency.value = HIGH_CROSSOVER_HZ;
  input.connect(highFilter);
  buildBand(ctx, highFilter, HIGH, outputGain);

  return { input };
}
