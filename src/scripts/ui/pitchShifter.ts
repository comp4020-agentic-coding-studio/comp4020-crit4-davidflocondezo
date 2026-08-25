import { MIN_BPM, MAX_BPM } from "../audio/scheduler";

export interface PitchShifter {
  /** Moves the knob to reflect the current BPM, clamped to [MIN_BPM, MAX_BPM]. */
  setTempo(bpm: number): void;
}

/**
 * Purely decorative vertical fader, visually synced to the ArrowUp/ArrowDown
 * tempo transport keys. Duplicates no information not already on those
 * keys' own aria-labels, so its container is marked aria-hidden in the
 * markup rather than here.
 */
export function renderPitchShifter(container: HTMLElement): PitchShifter {
  const doc = container.ownerDocument;

  const track = doc.createElement("div");
  track.className = "pitch-shifter__track";

  const knob = doc.createElement("div");
  knob.className = "pitch-shifter__knob";

  track.appendChild(knob);
  container.appendChild(track);

  return {
    setTempo(bpm: number): void {
      const clamped = Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
      const pct = ((clamped - MIN_BPM) / (MAX_BPM - MIN_BPM)) * 100;
      knob.style.bottom = `${pct}%`;
    },
  };
}
