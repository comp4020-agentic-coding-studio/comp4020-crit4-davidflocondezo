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

masterGain.connect(masterCompressor);
masterCompressor.connect(audioContext.destination);

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
