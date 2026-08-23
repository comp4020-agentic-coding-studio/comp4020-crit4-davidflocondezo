import { KEYMAP } from "../input/keymap";
import type { KeyCategory } from "../input/keymap";

const CATEGORY_LABELS: Record<KeyCategory, string> = {
  fx: "FX",
  stab: "Stab",
  atmosphere: "Atmosphere",
  melody: "Melody",
  riser: "Riser",
};

// Mirrors the physical keyboard's own row shapes, which happen to line up
// exactly with the five categories (10 + 10 + 9 + 7 = 36).
const ROWS: readonly string[] = ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

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
  const keymapByKey = new Map(KEYMAP.map((def) => [def.key, def]));
  const keyElements = new Map<string, HTMLElement>();

  for (const row of ROWS) {
    const rowEl = document.createElement("div");
    rowEl.className = "keyboard-overlay__row";
    for (const key of row) {
      const def = keymapByKey.get(key);
      if (!def) continue;
      const keyEl = document.createElement("div");
      keyEl.className = `keyboard-overlay__key keyboard-overlay__key--${def.category}`;
      keyEl.textContent = key.toUpperCase();
      keyEl.setAttribute("role", "img");
      keyEl.setAttribute("aria-label", `${key.toUpperCase()}: ${CATEGORY_LABELS[def.category]}`);
      rowEl.appendChild(keyEl);
      keyElements.set(key, keyEl);
    }
    container.appendChild(rowEl);
  }

  return {
    flashKey(key: string): void {
      const el = keyElements.get(key.toLowerCase());
      if (!el) return;
      el.classList.add("keyboard-overlay__key--active");
      window.setTimeout(() => {
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
