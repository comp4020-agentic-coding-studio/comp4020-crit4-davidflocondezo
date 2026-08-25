import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { renderPitchShifter } from "../src/scripts/ui/pitchShifter";

// Runs under vitest's node environment (no jsdom globals), matching
// spec/instrument-dom.test.ts's convention. DOM-wiring code under test must
// derive `document`/`window` from an element, never the bare global -- see
// CLAUDE.md.

describe("pitch shifter: the rendered contract", () => {
  function setup() {
    const dom = new JSDOM('<!doctype html><body><div id="pitch-shifter"></div></body>');
    const container = dom.window.document.querySelector<HTMLElement>("#pitch-shifter");
    if (!container) throw new Error("test fixture missing #pitch-shifter");
    const shifter = renderPitchShifter(container);
    const knob = container.querySelector<HTMLElement>(".pitch-shifter__knob");
    if (!knob) throw new Error("renderPitchShifter did not create a .pitch-shifter__knob element");
    return { shifter, knob };
  }

  it("places the knob at the bottom of the track at the minimum BPM", () => {
    const { shifter, knob } = setup();
    shifter.setTempo(140);
    expect(knob.style.bottom).toBe("0%");
  });

  it("places the knob at the top of the track at the maximum BPM", () => {
    const { shifter, knob } = setup();
    shifter.setTempo(190);
    expect(knob.style.bottom).toBe("100%");
  });

  it("places the knob partway up the track at a mid-range BPM", () => {
    const { shifter, knob } = setup();
    shifter.setTempo(150);
    expect(knob.style.bottom).toBe("20%");
  });

  it("clamps out-of-range BPM values to the track's ends", () => {
    const { shifter, knob } = setup();
    shifter.setTempo(1000);
    expect(knob.style.bottom).toBe("100%");
    shifter.setTempo(-1000);
    expect(knob.style.bottom).toBe("0%");
  });
});
