import { BPM } from "./scheduler";

const QUARTER_NOTE_SECONDS = 60 / BPM;

const DUCK_DEPTH = 0.05; // as close to silent as exponentialRampToValueAtTime allows (it can't target literal 0)
const DUCK_ATTACK_SECONDS = 0.01; // near-instant, in time with the kick's transient
const DUCK_RECOVERY_FRACTION = 0.875; // recovers to full by this fraction of the way to the next beat, leaving a brief moment at full volume before the next hit
const DUCK_RECOVERY_SECONDS = QUARTER_NOTE_SECONDS * DUCK_RECOVERY_FRACTION;

export interface SidechainBus {
  /** Bass, chords/leads, and their reverb sends connect here instead of the master bus directly -- everything the kick should pump. */
  input: GainNode;
  /** Call once per kick hit, with the kick's own trigger time, to pump the bus. */
  duck(time: number): void;
}

/**
 * Sidechain-compressor emulation via gain automation: a hard, obvious pump on
 * every kick hit is what reads as hardstyle rather than a flat wall of synths
 * clashing with the kick. The riser and one-shot fx layer deliberately don't
 * route through this bus -- a riser's job is an unbroken swell, and fx hits
 * are short enough that ducking them buys nothing.
 */
export function createSidechainBus(ctx: AudioContext, destination: AudioNode): SidechainBus {
  const input = ctx.createGain();
  input.connect(destination);

  return {
    input,
    duck(time: number): void {
      input.gain.cancelScheduledValues(time);
      input.gain.setValueAtTime(1, time);
      input.gain.exponentialRampToValueAtTime(DUCK_DEPTH, time + DUCK_ATTACK_SECONDS);
      input.gain.exponentialRampToValueAtTime(1, time + DUCK_RECOVERY_SECONDS);
    },
  };
}
