import { Scheduler } from "./scheduler";

export const audioContext = new AudioContext();

export const masterGain = audioContext.createGain();
masterGain.gain.value = 0.9;

// Safety net: no combination of stacked keys should ever clip or sound
// broken, no matter how many layers a player stacks at once.
const masterCompressor = audioContext.createDynamicsCompressor();
masterCompressor.threshold.value = -12;
masterCompressor.knee.value = 12;
masterCompressor.ratio.value = 6;
masterCompressor.attack.value = 0.003;
masterCompressor.release.value = 0.25;

// Brickwall limiter: sits after the glue compressor above and catches any
// remaining peaks with a near-instant attack and a hard ratio, the way a
// mastered track's final limiting stage does -- lets the mix sit at a
// consistently loud, dense level without audibly clipping.
const masterLimiter = audioContext.createDynamicsCompressor();
masterLimiter.threshold.value = -1;
masterLimiter.knee.value = 0;
masterLimiter.ratio.value = 20;
masterLimiter.attack.value = 0.001;
masterLimiter.release.value = 0.1;

masterGain.connect(masterCompressor);
masterCompressor.connect(masterLimiter);

// Tapped after the limiter so the visualiser reflects the actual mastered
// output (everything audible, already glued and peak-capped) rather than any
// single voice's pre-limiter signal. An analyser node passes audio through
// unchanged, so it's just inserted inline ahead of the destination.
export const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048;
masterLimiter.connect(analyser);
analyser.connect(audioContext.destination);

export const scheduler = new Scheduler(audioContext);

let unlocked = false;

/** Call from the first user gesture handler. Idempotent. */
export async function unlockAudio(onFirstUnlock: () => void): Promise<void> {
  if (unlocked) return;
  unlocked = true;
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  scheduler.start();
  onFirstUnlock();
}

export function isUnlocked(): boolean {
  return unlocked;
}
