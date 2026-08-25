import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { renderAudioVisualizer } from "../src/scripts/ui/audioVisualizer";

// Runs under vitest's node environment (no jsdom globals), matching
// spec/dj-deck-dom.test.ts's convention. DOM-wiring code under test must
// derive `document`/`window` from an element, never the bare global -- see
// CLAUDE.md.
//
// jsdom implements neither a 2d canvas context nor requestAnimationFrame
// without extra packages, so a real render here exercises exactly the
// feature-detected, non-throwing path renderAudioVisualizer falls back to --
// it just can't verify actual pixels get drawn.

function setup() {
  const dom = new JSDOM('<!doctype html><body><div id="audio-visualizer"></div></body>');
  const container = dom.window.document.querySelector<HTMLElement>("#audio-visualizer");
  if (!container) throw new Error("test fixture missing #audio-visualizer");
  const fakeAnalyser = {
    fftSize: 2048,
    getFloatTimeDomainData: () => {},
  } as unknown as AnalyserNode;
  return { container, fakeAnalyser };
}

describe("audio visualiser: the rendered contract", () => {
  it("mounts a canvas element", () => {
    const { container, fakeAnalyser } = setup();
    renderAudioVisualizer(container, fakeAnalyser);
    expect(container.querySelector("canvas.audio-visualizer__canvas")).toBeTruthy();
  });

  it("does not throw when the canvas 2d context is unavailable", () => {
    const { container, fakeAnalyser } = setup();
    expect(() => renderAudioVisualizer(container, fakeAnalyser)).not.toThrow();
  });
});
