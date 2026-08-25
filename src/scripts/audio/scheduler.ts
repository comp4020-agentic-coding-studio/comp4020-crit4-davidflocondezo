// Lookahead scheduler ("a tale of two clocks"): a coarse JS interval looks a
// short window ahead and schedules audio events precisely against
// AudioContext.currentTime, so timing accuracy comes from the audio clock,
// never from setTimeout/setInterval drift.

const DEFAULT_BPM = 150;
const MIN_BPM = 140;
const MAX_BPM = 190;
export const TICKS_PER_BEAT = 4; // 16th-note resolution
export const TICKS_PER_BAR = TICKS_PER_BEAT * 4; // 4/4 time

const SCHEDULE_AHEAD_SECONDS = 0.1;
const LOOKAHEAD_INTERVAL_MS = 25;

export type QuantizeUnit = "16th" | "beat" | "bar";

type TickListener = (tickIndex: number, time: number) => void;
// isNewPress distinguishes the initial keydown jump from the ones a held
// arrow key auto-repeats every BEAT_JUMP_INTERVAL_MS (see main.ts) -- a
// listener that wants to reset per-hold state (see melody.ts's echo) needs
// to know when a fresh hold has begun versus the same one continuing.
type BarJumpListener = (direction: 1 | -1, isNewPress: boolean) => void;

export class Scheduler {
  private readonly ctx: AudioContext;
  private nextTickTime = 0;
  private tickIndex = 0;
  private timerId: number | undefined;
  private readonly listeners = new Set<TickListener>();
  private readonly barJumpListeners = new Set<BarJumpListener>();
  private started = false;
  private bpm = DEFAULT_BPM;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  getBpm(): number {
    return this.bpm;
  }

  /** Nudge tempo by deltaBpm (may be negative), clamped to [MIN_BPM, MAX_BPM]. Returns the new value. Takes effect starting the next tick since nextTickTime already accumulates via +=, so no snap or discontinuity. */
  adjustBpm(deltaBpm: number): number {
    this.bpm = Math.min(MAX_BPM, Math.max(MIN_BPM, this.bpm + deltaBpm));
    return this.bpm;
  }

  /**
   * Beat-jump: relocate the pattern position by one bar without touching
   * nextTickTime or tempo, so it's a CDJ-style relabeling of which tick is
   * coming up next rather than a change in playback speed. Clamped at 0 --
   * tickIndex feeds `% TICKS_PER_BEAT`/`% TICKS_PER_BAR` checks elsewhere,
   * and JS's `%` doesn't wrap negative numbers the way those checks need.
   *
   * A jump by an exact multiple of TICKS_PER_BAR leaves every tick-modulo
   * check (kick's beat, bass's pattern lookup) unchanged -- by design, so the
   * rhythmic pocket never glitches -- so barJumpListeners exist as the hook
   * for anything that should audibly react to a jump's direction instead
   * (see bass.ts's root-note walk).
   */
  jumpBar(direction: 1 | -1, isNewPress: boolean): void {
    this.tickIndex = Math.max(0, this.tickIndex + direction * TICKS_PER_BAR);
    for (const listener of this.barJumpListeners) listener(direction, isNewPress);
  }

  onBarJump(listener: BarJumpListener): () => void {
    this.barJumpListeners.add(listener);
    return () => this.barJumpListeners.delete(listener);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.tickIndex = 0;
    this.nextTickTime = this.ctx.currentTime;
    this.timerId = window.setInterval(() => this.advance(), LOOKAHEAD_INTERVAL_MS);
  }

  stop(): void {
    if (this.timerId !== undefined) window.clearInterval(this.timerId);
    this.timerId = undefined;
    this.started = false;
  }

  onTick(listener: TickListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** For on-demand (keypress-triggered) events: the next valid time on the given grid. */
  nextQuantizedTime(unit: QuantizeUnit): number {
    if (!this.started) return this.ctx.currentTime;
    const ticksPerUnit =
      unit === "16th" ? 1 : unit === "beat" ? TICKS_PER_BEAT : TICKS_PER_BAR;
    const ticksElapsed = Math.max(
      0,
      Math.round((this.ctx.currentTime - this.nextTickTime) / this.secondsPerTick()) +
        this.tickIndex,
    );
    const nextGridTick = Math.ceil((ticksElapsed + 1) / ticksPerUnit) * ticksPerUnit;
    return this.nextTickTime + (nextGridTick - this.tickIndex) * this.secondsPerTick();
  }

  secondsPerTick(): number {
    return 60 / this.bpm / TICKS_PER_BEAT;
  }

  ticksPerBar(): number {
    return TICKS_PER_BAR;
  }

  private advance(): void {
    while (this.nextTickTime < this.ctx.currentTime + SCHEDULE_AHEAD_SECONDS) {
      for (const listener of this.listeners) listener(this.tickIndex, this.nextTickTime);
      this.tickIndex += 1;
      this.nextTickTime += this.secondsPerTick();
    }
  }
}
