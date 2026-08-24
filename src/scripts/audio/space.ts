import { BPM } from "./scheduler";

// Dotted-eighth delay at the instrument's fixed 150 BPM: long enough to fill
// the gaps between stab hits and melody notes without smearing into the next
// downbeat, and rhythmically locked to the grid so the echoes reinforce the
// beat instead of fighting it.
const QUARTER_NOTE_SECONDS = 60 / BPM;
const DELAY_TIME_SECONDS = QUARTER_NOTE_SECONDS * 0.75; // dotted eighth = 3/4 of a quarter note
const DELAY_FEEDBACK = 0.38;
const DELAY_FEEDBACK_LOWPASS_HZ = 3500; // each repeat loses a bit more top end, like a real echo darkening as it decays
const DELAY_WET_GAIN = 0.5;

const REVERB_LENGTH_SECONDS = 2.8;
const REVERB_DECAY_EXPONENT = 3.2; // higher = faster initial decay, longer quiet tail
const REVERB_WET_GAIN = 0.45;

export interface SpaceBus {
  /** Voices connect a (reduced-level) send here to add echo/reverb ambience. */
  input: GainNode;
}

/**
 * Generates the convolution reverb's impulse response at runtime -- decaying
 * stereo noise, not a loaded file -- so the "stadium" ambience stays within
 * this week's live-synthesis-only constraint (no bundled or fetched audio
 * asset). Independent per-channel noise widens the tail instead of leaving
 * it mono.
 */
function createReverbImpulse(ctx: AudioContext): AudioBuffer {
  const length = Math.ceil(ctx.sampleRate * REVERB_LENGTH_SECONDS);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const decay = (1 - i / length) ** REVERB_DECAY_EXPONENT;
      data[i] = (Math.random() * 2 - 1) * decay;
    }
  }
  return impulse;
}

/**
 * Shared "stadium" send bus: a rhythmic feedback delay plus a convolution
 * reverb, both fed from the same input node. Voices that want ambience
 * connect a scaled-down copy of their own gain envelope here, in parallel
 * with (not instead of) their existing dry connection to the master bus.
 */
export function createSpaceBus(ctx: AudioContext, destination: AudioNode): SpaceBus {
  const input = ctx.createGain();

  const delay = ctx.createDelay(1);
  delay.delayTime.value = DELAY_TIME_SECONDS;
  const feedbackFilter = ctx.createBiquadFilter();
  feedbackFilter.type = "lowpass";
  feedbackFilter.frequency.value = DELAY_FEEDBACK_LOWPASS_HZ;
  const feedbackGain = ctx.createGain();
  feedbackGain.gain.value = DELAY_FEEDBACK;
  const delayWet = ctx.createGain();
  delayWet.gain.value = DELAY_WET_GAIN;

  input.connect(delay);
  delay.connect(feedbackFilter);
  feedbackFilter.connect(feedbackGain);
  feedbackGain.connect(delay); // feedback loop: each repeat passes back through the darkening filter
  delay.connect(delayWet);
  delayWet.connect(destination);

  const convolver = ctx.createConvolver();
  convolver.buffer = createReverbImpulse(ctx);
  const reverbWet = ctx.createGain();
  reverbWet.gain.value = REVERB_WET_GAIN;

  input.connect(convolver);
  convolver.connect(reverbWet);
  reverbWet.connect(destination);

  return { input };
}
