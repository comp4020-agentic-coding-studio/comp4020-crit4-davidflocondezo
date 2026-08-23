import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { renderKeyboardOverlay } from "../src/scripts/ui/keyboardOverlay";

// Runs under vitest's node environment (no jsdom globals), matching
// spec/invariants.test.ts's convention. DOM-wiring code under test must
// derive `document`/`window` from an element, never the bare global -- see
// CLAUDE.md.

describe("built page: the opening screen", () => {
  const DIST = resolve("dist");
  const doc = new JSDOM(readFileSync(join(DIST, "index.html"), "utf8")).window.document;

  it("has an opening call-to-action, visible before the first keypress", () => {
    const prompt = doc.querySelector("#opening-prompt");
    expect(prompt, "a stranger needs an invitation to press a key at all").toBeTruthy();
    expect(prompt?.hasAttribute("hidden")).toBe(false);
    expect(prompt?.textContent?.trim()).not.toBe("");
  });

  it("mounts a keyboard overlay container", () => {
    expect(doc.querySelector("#keyboard-overlay")).toBeTruthy();
  });
});

describe("keyboard overlay: the rendered contract", () => {
  const dom = new JSDOM('<!doctype html><body><section id="keyboard-overlay"></section></body>');
  const container = dom.window.document.querySelector<HTMLElement>("#keyboard-overlay");
  if (!container) throw new Error("test fixture missing #keyboard-overlay");
  renderKeyboardOverlay(container);
  const keyElements = [...container.querySelectorAll(".keyboard-overlay__key")];

  it("renders all 36 keys", () => {
    expect(keyElements.length).toBe(36);
  });

  it("gives every key a visible label and a discoverable accessible name", () => {
    for (const el of keyElements) {
      expect(el.textContent?.trim()).not.toBe("");
      expect(el.getAttribute("aria-label")?.trim()).toBeTruthy();
    }
  });

  it("labels one key per physical key, with no duplicates", () => {
    const labels = keyElements.map((el) => el.textContent?.trim());
    expect(new Set(labels).size).toBe(36);
  });

  it("color-codes every key by its category", () => {
    const categories = ["fx", "stab", "atmosphere", "melody", "riser"];
    for (const el of keyElements) {
      const hasCategoryClass = categories.some((category) =>
        el.classList.contains(`keyboard-overlay__key--${category}`),
      );
      expect(hasCategoryClass, `${el.textContent} is missing a category class`).toBe(true);
    }
  });
});
