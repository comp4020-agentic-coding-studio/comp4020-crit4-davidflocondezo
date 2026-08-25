import { KEYMAP } from "../input/keymap";
import type { KeyCategory } from "../input/keymap";

const CATEGORY_LABELS: Record<KeyCategory, string> = {
  fx: "FX",
  stab: "Stab",
  atmosphere: "Atmosphere",
  melody: "Melody",
  riser: "Riser",
};

// One entry per physical keyboard row, top to bottom, so the on-screen
// layout mirrors the real keyboard's shape (CSS staggers each row to match).
// The bottom physical row mixes two categories (zxcvb = melody, nm = riser),
// so it renders as two groups sharing one row -- melody on the left, riser
// on the right -- instead of each getting its own full-width row.
const ROWS: ReadonlyArray<{
  rowIndex: 1 | 2 | 3 | 4;
  groups: ReadonlyArray<{ category: KeyCategory; keys: string }>;
}> = [
  { rowIndex: 1, groups: [{ category: "fx", keys: "1234567890" }] },
  { rowIndex: 2, groups: [{ category: "stab", keys: "qwertyuiop" }] },
  { rowIndex: 3, groups: [{ category: "atmosphere", keys: "asdfghjkl" }] },
  {
    rowIndex: 4,
    groups: [
      { category: "melody", keys: "zxcvb" },
      { category: "riser", keys: "nm" },
    ],
  },
];

// Transport controls (arrows/space) sit below the letter rows, same as on a
// real keyboard -- rendered last, centered. Not part of KEYMAP (arrows/space
// aren't musical keys), so they get their own section, but register into the
// same keyElements map so flashKey/setKeyActive work on them exactly like
// any musical key -- lookup is by event.key.toLowerCase().
const TRANSPORT_KEYS: ReadonlyArray<{ key: string; label: string; ariaLabel: string; wide?: boolean }> = [
  { key: "ArrowLeft", label: "←", ariaLabel: "Left arrow: jump back one bar (hold to keep jumping)" },
  { key: "ArrowDown", label: "↓", ariaLabel: "Down arrow: tempo down" },
  { key: "ArrowUp", label: "↑", ariaLabel: "Up arrow: tempo up" },
  { key: "ArrowRight", label: "→", ariaLabel: "Right arrow: jump forward one bar (hold to keep jumping)" },
  { key: " ", label: "Space", ariaLabel: "Space: drop the kick and bass", wide: true },
];

const FLASH_DURATION_MS = 150;

export interface KeyboardOverlay {
  /** Brief highlight for one-shot categories (fx, stab, riser, tempo nudges). */
  flashKey(key: string): void;
  /** Persistent highlight for toggle/hold categories (atmosphere, melody, drop). */
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

  // `reverse` puts the divider before the label (divider fills the space to
  // its left instead of its right), so a heading sharing a row with another
  // -- e.g. riser's, next to melody's -- reads with its label at the outer
  // edge, aligned above where that group's keys actually sit.
  function createHeading(category: KeyCategory, reverse = false): HTMLElement {
    const heading = doc.createElement("div");
    heading.className = `keyboard-overlay__section-heading keyboard-overlay__section--${category}`;
    const label = doc.createElement("span");
    label.className = "keyboard-overlay__section-label";
    label.textContent = CATEGORY_LABELS[category];
    const divider = doc.createElement("span");
    divider.className = "keyboard-overlay__section-divider";
    divider.setAttribute("aria-hidden", "true");
    if (reverse) {
      heading.appendChild(divider);
      heading.appendChild(label);
    } else {
      heading.appendChild(label);
      heading.appendChild(divider);
    }
    return heading;
  }

  function createKeyGroup(keys: string): HTMLElement {
    const group = doc.createElement("div");
    group.className = "keyboard-overlay__key-group";
    for (const key of keys) {
      const def = keymapByKey.get(key);
      if (!def) continue;
      const keyEl = doc.createElement("div");
      keyEl.className = `keyboard-overlay__key keyboard-overlay__key--${def.category}`;
      keyEl.textContent = key.toUpperCase();
      keyEl.setAttribute("role", "img");
      keyEl.setAttribute("aria-label", `${key.toUpperCase()}: ${CATEGORY_LABELS[def.category]}`);
      group.appendChild(keyEl);
      keyElements.set(key, keyEl);
    }
    return group;
  }

  for (const row of ROWS) {
    const rowEl = doc.createElement("div");
    rowEl.className = `keyboard-overlay__physical-row keyboard-overlay__physical-row--${row.rowIndex}`;

    if (row.groups.length === 1) {
      const [{ category, keys }] = row.groups;
      rowEl.appendChild(createHeading(category));
      const keysRow = doc.createElement("div");
      keysRow.className = "keyboard-overlay__row";
      keysRow.appendChild(createKeyGroup(keys));
      rowEl.appendChild(keysRow);
    } else {
      const headingRow = doc.createElement("div");
      headingRow.className = "keyboard-overlay__row-heading";
      const keysRow = doc.createElement("div");
      keysRow.className = "keyboard-overlay__row keyboard-overlay__row--split";
      row.groups.forEach(({ category, keys }, i) => {
        headingRow.appendChild(createHeading(category, i > 0));
        keysRow.appendChild(createKeyGroup(keys));
      });
      rowEl.appendChild(headingRow);
      rowEl.appendChild(keysRow);
    }

    container.appendChild(rowEl);
  }

  const transportSection = doc.createElement("div");
  transportSection.className = "keyboard-overlay__section keyboard-overlay__section--transport";
  const transportHeading = doc.createElement("div");
  transportHeading.className = "keyboard-overlay__section-heading";
  const transportLabel = doc.createElement("span");
  transportLabel.className = "keyboard-overlay__section-label";
  transportLabel.textContent = "Transport";
  const transportDivider = doc.createElement("span");
  transportDivider.className = "keyboard-overlay__section-divider";
  transportDivider.setAttribute("aria-hidden", "true");
  transportHeading.appendChild(transportLabel);
  transportHeading.appendChild(transportDivider);
  transportSection.appendChild(transportHeading);

  const transportRow = doc.createElement("div");
  transportRow.className = "keyboard-overlay__row keyboard-overlay__row--center";
  for (const def of TRANSPORT_KEYS) {
    const keyEl = doc.createElement("div");
    keyEl.className = `keyboard-overlay__key keyboard-overlay__key--transport${def.wide ? " keyboard-overlay__key--wide" : ""}`;
    keyEl.textContent = def.label;
    keyEl.setAttribute("role", "img");
    keyEl.setAttribute("aria-label", def.ariaLabel);
    transportRow.appendChild(keyEl);
    keyElements.set(def.key.toLowerCase(), keyEl);
  }
  transportSection.appendChild(transportRow);
  container.appendChild(transportSection);

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
