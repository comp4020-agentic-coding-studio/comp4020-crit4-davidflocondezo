import type { Scheduler } from "./scheduler";
import { TICKS_PER_BEAT, TICKS_PER_BAR } from "./scheduler";

export type ArrangementState = "intro" | "buildup" | "climax";

export const TENSION_MIN_HZ = 20;
export const TENSION_MAX_HZ = 1000;

const STATE_GAIN_RAMP_SECONDS = 0.05; // mirrors main.ts's DROP_MUTE_RAMP_SECONDS
const CLIMAX_SNAP_SECONDS = 0.03; // fast enough to read as a hit landing, not a fade
const FILTER_RAMP_BARS = 6; // bars 1-6 sweep the highpass open->closed, bars 7+ hold at TENSION_MAX_HZ

export interface ArrangementReader {
  getState(): ArrangementState;
  /** This buildup's start time on the audio clock; null outside buildup. Voices compute bars-elapsed from this rather than a tick index. */
  getBuildupStartTime(): number | null;
  /** True only between requestClimax() and the quantized landing -- gates the tension-drum/riser/melody "pre-drop" silence. */
  isTriggerBlocked(): boolean;
}

export interface ArrangementController extends ArrangementReader {
  setState(state: "intro" | "buildup"): void;
  requestClimax(): void;
  onChange(listener: (state: ArrangementState) => void): () => void;
  onClimaxRequested(listener: () => void): () => void;
}

/**
 * Owns the rhythmic foundation's arc so kick/bass automate themselves: INTRO
 * (silent), BUILDUP (tension-drum + rising highpass, cap-and-hold once it
 * reaches the sixteenth tier), CLIMAX (kick+bass full volume, filter snapped
 * open). This is a second, independent multiplier on the same kick/bass gain
 * nodes Space's mute toggle already drives in main.ts -- the two never fight
 * over one AudioParam.
 */
export function createArrangementController(
  ctx: AudioContext,
  scheduler: Scheduler,
  kickGain: GainNode,
  bassGain: GainNode,
  tensionFilter: BiquadFilterNode,
): ArrangementController {
  let state: ArrangementState = "intro";
  let buildupStartTime: number | null = null;
  let climaxPending = false;
  let climaxRequestTime: number | null = null;
  const changeListeners = new Set<(state: ArrangementState) => void>();
  const climaxRequestedListeners = new Set<() => void>();

  function rampGain(gainNode: GainNode, target: number, time: number, duration: number): void {
    gainNode.gain.cancelScheduledValues(time);
    gainNode.gain.setValueAtTime(gainNode.gain.value, time);
    gainNode.gain.linearRampToValueAtTime(target, time + duration);
  }

  function rampGains(kickTarget: number, bassTarget: number, time: number, duration: number): void {
    rampGain(kickGain, kickTarget, time, duration);
    rampGain(bassGain, bassTarget, time, duration);
  }

  function openFilter(time: number, duration: number): void {
    tensionFilter.frequency.cancelScheduledValues(time);
    tensionFilter.frequency.setValueAtTime(tensionFilter.frequency.value, time);
    tensionFilter.frequency.linearRampToValueAtTime(TENSION_MIN_HZ, time + duration);
  }

  function startBuildupFilterRamp(time: number): void {
    const barSeconds = scheduler.secondsPerTick() * TICKS_PER_BAR;
    tensionFilter.frequency.cancelScheduledValues(time);
    tensionFilter.frequency.setValueAtTime(TENSION_MIN_HZ, time);
    tensionFilter.frequency.linearRampToValueAtTime(TENSION_MAX_HZ, time + barSeconds * FILTER_RAMP_BARS);
  }

  // Always subscribed, registered here at construction -- before
  // startFoundation() ever registers the kick's own onTick listener (see
  // main.ts) -- so once a climax is pending, the state flip below and the
  // kick's next hit land in the very same tick pass with no extra sync code:
  // both gate on the same `tickIndex % TICKS_PER_BEAT === 0` check.
  scheduler.onTick((tickIndex, time) => {
    if (!climaxPending || climaxRequestTime === null) return;
    if (time <= climaxRequestTime) return;
    if (tickIndex % TICKS_PER_BEAT !== 0) return;
    climaxPending = false;
    climaxRequestTime = null;
    state = "climax";
    buildupStartTime = null;
    rampGains(1, 1, time, CLIMAX_SNAP_SECONDS);
    openFilter(time, CLIMAX_SNAP_SECONDS);
    for (const listener of changeListeners) listener(state);
  });

  return {
    getState(): ArrangementState {
      return state;
    },
    getBuildupStartTime(): number | null {
      return buildupStartTime;
    },
    isTriggerBlocked(): boolean {
      return climaxPending;
    },
    setState(next: "intro" | "buildup"): void {
      climaxPending = false;
      climaxRequestTime = null;
      state = next;
      const time = ctx.currentTime;
      if (next === "intro") {
        buildupStartTime = null;
        rampGains(0, 0, time, STATE_GAIN_RAMP_SECONDS);
        openFilter(time, STATE_GAIN_RAMP_SECONDS);
      } else {
        buildupStartTime = time;
        rampGains(0, 1, time, STATE_GAIN_RAMP_SECONDS);
        startBuildupFilterRamp(time);
      }
      for (const listener of changeListeners) listener(state);
    },
    requestClimax(): void {
      if (state !== "buildup" || climaxPending) return;
      climaxPending = true;
      climaxRequestTime = ctx.currentTime;
      for (const listener of climaxRequestedListeners) listener();
    },
    onChange(listener: (state: ArrangementState) => void): () => void {
      changeListeners.add(listener);
      return () => changeListeners.delete(listener);
    },
    onClimaxRequested(listener: () => void): () => void {
      climaxRequestedListeners.add(listener);
      return () => climaxRequestedListeners.delete(listener);
    },
  };
}
