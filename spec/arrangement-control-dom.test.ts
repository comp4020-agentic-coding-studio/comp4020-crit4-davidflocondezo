import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { renderArrangementControl } from "../src/scripts/ui/arrangementControl";
import type { ArrangementState } from "../src/scripts/audio/arrangement";

// Runs under vitest's node environment (no jsdom globals), matching
// spec/instrument-dom.test.ts's convention. DOM-wiring code under test must
// derive `document`/`window` from an element, never the bare global -- see
// CLAUDE.md.

describe("arrangement control: the rendered contract", () => {
  function setup() {
    const dom = new JSDOM('<!doctype html><body><div id="arrangement-control"></div></body>');
    const container = dom.window.document.querySelector<HTMLElement>("#arrangement-control");
    if (!container) throw new Error("test fixture missing #arrangement-control");
    const selected: ArrangementState[] = [];
    const control = renderArrangementControl(container, (state) => selected.push(state));
    return { container, control, selected };
  }

  it("renders exactly 3 buttons with a discoverable accessible name", () => {
    const { container } = setup();
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons.length).toBe(3);
    for (const button of buttons) {
      expect(button.textContent?.trim()).not.toBe("");
    }
  });

  it("marks only the active state's button as pressed", () => {
    const { container, control } = setup();
    control.setActive("buildup");
    const buttons = [...container.querySelectorAll("button")];
    const pressed = buttons.filter((button) => button.getAttribute("aria-pressed") === "true");
    expect(pressed.length).toBe(1);
    expect(pressed[0]?.textContent?.trim()).toBe("Buildup");
  });

  it("calls back with the clicked state", () => {
    const { container, selected } = setup();
    const buttons = [...container.querySelectorAll("button")];
    const climaxButton = buttons.find((button) => button.textContent?.trim() === "Climax");
    climaxButton?.click();
    expect(selected).toEqual(["climax"]);
  });
});
