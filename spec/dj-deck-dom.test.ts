import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { renderDjDeck } from "../src/scripts/ui/djDeck";

// Runs under vitest's node environment (no jsdom globals), matching
// spec/instrument-dom.test.ts's convention. DOM-wiring code under test must
// derive `document`/`window` from an element, never the bare global -- see
// CLAUDE.md.

describe("dj deck: the rendered contract", () => {
  function setup() {
    const dom = new JSDOM('<!doctype html><body><div id="dj-deck"></div></body>');
    const container = dom.window.document.querySelector<HTMLElement>("#dj-deck");
    if (!container) throw new Error("test fixture missing #dj-deck");
    const deck = renderDjDeck(container);
    const disc = container.querySelector<HTMLElement>(".dj-deck__disc");
    if (!disc) throw new Error("renderDjDeck did not create a .dj-deck__disc element");
    return { deck, disc };
  }

  it("spinning right adds the spin-right class", () => {
    const { deck, disc } = setup();
    deck.spin(1, true);
    expect(disc.classList.contains("dj-deck__disc--spin-right")).toBe(true);
    expect(disc.classList.contains("dj-deck__disc--spin-left")).toBe(false);
  });

  it("spinning left adds the spin-left class", () => {
    const { deck, disc } = setup();
    deck.spin(-1, true);
    expect(disc.classList.contains("dj-deck__disc--spin-left")).toBe(true);
    expect(disc.classList.contains("dj-deck__disc--spin-right")).toBe(false);
  });

  it("stopping clears the spin class", () => {
    const { deck, disc } = setup();
    deck.spin(1, true);
    deck.spin(1, false);
    expect(disc.classList.contains("dj-deck__disc--spin-right")).toBe(false);
    expect(disc.classList.contains("dj-deck__disc--spin-left")).toBe(false);
  });

  it("holding both directions at once cancels out to idle", () => {
    const { deck, disc } = setup();
    deck.spin(1, true);
    deck.spin(-1, true);
    expect(disc.classList.contains("dj-deck__disc--spin-right")).toBe(false);
    expect(disc.classList.contains("dj-deck__disc--spin-left")).toBe(false);
  });

  it("releasing one of two held directions resumes spinning the other way", () => {
    const { deck, disc } = setup();
    deck.spin(1, true);
    deck.spin(-1, true);
    deck.spin(1, false);
    expect(disc.classList.contains("dj-deck__disc--spin-left")).toBe(true);
    expect(disc.classList.contains("dj-deck__disc--spin-right")).toBe(false);
  });
});
