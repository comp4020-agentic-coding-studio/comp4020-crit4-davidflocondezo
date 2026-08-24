import { describe, expect, it } from "vitest";
import { SCALE_DEGREE_COUNT, triadDegrees } from "../src/scripts/audio/scale";
import { detuneSpread } from "../src/scripts/audio/unison";
import { activeVoiceCount, releaseVoices, reserveVoices } from "../src/scripts/audio/voiceBudget";

// The wall-of-sound rework: full diatonic triads instead of single notes,
// detuned-unison "supersaw" stacks instead of lone oscillators, and a shared
// voice budget so mashing many keys thins the stack instead of clipping or
// dropping notes. None of this touches the AudioContext directly, so it's
// unit-testable without a browser.

describe("triadDegrees: diatonic root/3rd/5th", () => {
  it("stacks two scale-thirds on top of the root", () => {
    expect(triadDegrees(0)).toEqual([0, 2, 4]);
    expect(triadDegrees(3)).toEqual([3, 5, 7]);
  });

  it("clamps at the top of the scale table rather than going out of bounds", () => {
    const nearEdge = SCALE_DEGREE_COUNT - 2;
    for (const degree of triadDegrees(nearEdge)) {
      expect(degree).toBeGreaterThanOrEqual(0);
      expect(degree).toBeLessThan(SCALE_DEGREE_COUNT);
    }
    expect(triadDegrees(nearEdge)[2]).toBe(SCALE_DEGREE_COUNT - 1);
  });
});

describe("detuneSpread: symmetric unison detune", () => {
  it("returns a single centered oscillator for voiceCount 1", () => {
    expect(detuneSpread(1, 35)).toEqual([0]);
  });

  it("is symmetric around 0 and spans exactly +/-width at the endpoints", () => {
    const spread = detuneSpread(5, 35);
    expect(spread).toHaveLength(5);
    expect(spread[0]).toBe(-35);
    expect(spread[spread.length - 1]).toBe(35);
    expect(spread[2]).toBe(0); // odd count lands a true center oscillator on 0
    expect(spread.reduce((sum, v) => sum + v, 0)).toBeCloseTo(0);
  });

  it("still spans the full width for an even voice count, without a true center", () => {
    const spread = detuneSpread(4, 35);
    expect(spread).toHaveLength(4);
    expect(spread[0]).toBe(-35);
    expect(spread[spread.length - 1]).toBe(35);
    expect(spread).not.toContain(0);
  });
});

describe("voiceBudget: reserve/release ladder", () => {
  it("grants the first ladder entry when there's plenty of headroom", () => {
    expect(reserveVoices([5, 3, 1])).toBe(5);
    releaseVoices(5);
  });

  it("degrades down the ladder as the ceiling is approached", () => {
    const reserved: number[] = [];
    // Exhaust most of the budget with big reservations, then confirm the
    // next request degrades instead of failing outright.
    for (let i = 0; i < 25; i++) reserved.push(reserveVoices([5, 3, 1]));
    expect(activeVoiceCount()).toBe(reserved.reduce((a, b) => a + b, 0));
    expect(Math.min(...reserved)).toBeLessThan(5); // at least one request had to degrade
    for (const count of reserved) releaseVoices(count);
    expect(activeVoiceCount()).toBe(0);
  });

  it("an embellishment ladder ending in 0 can be skipped entirely once exhausted", () => {
    const reserved: number[] = [];
    for (let i = 0; i < 40; i++) reserved.push(reserveVoices([5, 3, 1]));
    const shimmer = reserveVoices([3, 1, 0]);
    expect(shimmer).toBe(0);
    for (const count of reserved) releaseVoices(count);
  });

  it("never leaves the active count negative", () => {
    releaseVoices(1000);
    expect(activeVoiceCount()).toBe(0);
  });
});
