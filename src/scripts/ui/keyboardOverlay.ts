import { KEYMAP } from "../input/keymap";
import type { KeyCategory } from "../input/keymap";

const CATEGORY_LABELS: Record<KeyCategory, string> = {
  fx: "FX",
  stab: "Stab",
  atmosphere: "Atmosphere",
  melody: "Melody",
  riser: "Riser",
};

// The bottom physical row mixes two categories (zxcvb = melody, nm = riser),
// so sections are grouped by category rather than by physical row -- each
// gets its own heading and divider, making the boundary a stranger actually
// needs to see (e.g. "where does melody end and riser begin") explicit.
const SECTIONS: ReadonlyArray<{ category: KeyCategory; keys: string }> = [
  { category: "fx", keys: "1234567890" },
  { category: "stab", keys: "qwertyuiop" },
  { category: "atmosphere", keys: "asdfghjkl" },
  { category: "melody", keys: "zxcvb" },
  { category: "riser", keys: "nm" },
];

const FLASH_DURATION_MS = 150;

export interface KeyboardOverlay {
  /** Brief highlight for one-shot categories (fx, stab, riser). */
  flashKey(key: string): void;
  /** Persistent highlight for toggle/hold categories (atmosphere, melody). */
  setKeyActive(key: string, active: boolean): void;
}

/**
 * Renders every mapped key as an on-screen QWERTY layout, color-coded by
 * category. Required scope, not decoration: at 36 keys, a stranger can only
 * play this uninstructed if they can see the instrument's shape first.
 */
export function renderKeyboardOverlay(container: HTMLElement): KeyboardOverlay {
  // Derived from the container, not the bare global -- keeps this testable
  // via `new JSDOM()` under vitest's node environment.
  const doc = container.ownerDocument;
  const keymapByKey = new Map(KEYMAP.map((def) => [def.key, def]));
  const keyElements = new Map<string, HTMLElement>();

  for (const section of SECTIONS) {
    const sectionEl = doc.createElement("div");
    sectionEl.className = `keyboard-overlay__section keyboard-overlay__section--${section.category}`;

    const heading = doc.createElement("div");
    heading.className = "keyboard-overlay__section-heading";
    const label = doc.createElement("span");
    label.className = "keyboard-overlay__section-label";
    label.textContent = CATEGORY_LABELS[section.category];
    const divider = doc.createElement("span");
    divider.className = "keyboard-overlay__section-divider";
    divider.setAttribute("aria-hidden", "true");
    heading.appendChild(label);
    heading.appendChild(divider);

    const rowEl = doc.createElement("div");
    rowEl.className = "keyboard-overlay__row";
    for (const key of section.keys) {
      const def = keymapByKey.get(key);
      if (!def) continue;
      const keyEl = doc.createElement("div");
      keyEl.className = `keyboard-overlay__key keyboard-overlay__key--${def.category}`;
      keyEl.textContent = key.toUpperCase();
      keyEl.setAttribute("role", "img");
      keyEl.setAttribute("aria-label", `${key.toUpperCase()}: ${CATEGORY_LABELS[def.category]}`);
      rowEl.appendChild(keyEl);
      keyElements.set(key, keyEl);
    }

    sectionEl.appendChild(heading);
    sectionEl.appendChild(rowEl);
    container.appendChild(sectionEl);
  }

  return {
    flashKey(key: string): void {
      const el = keyElements.get(key.toLowerCase());
      if (!el) return;
      el.classList.add("keyboard-overlay__key--active");
      el.ownerDocument.defaultView?.setTimeout(() => {
        el.classList.remove("keyboard-overlay__key--active");
      }, FLASH_DURATION_MS);
    },
    setKeyActive(key: string, active: boolean): void {
      const el = keyElements.get(key.toLowerCase());
      if (!el) return;
      el.classList.toggle("keyboard-overlay__key--active", active);
    },
  };
}
