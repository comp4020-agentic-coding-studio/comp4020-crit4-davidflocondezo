import type { ArrangementState } from "../audio/arrangement";

const BUTTONS: ReadonlyArray<{ state: ArrangementState; label: string }> = [
  { state: "intro", label: "Intro" },
  { state: "buildup", label: "Buildup" },
  { state: "climax", label: "Climax" },
];

export interface ArrangementControl {
  setActive(state: ArrangementState): void;
}

/**
 * Mouse-first control for the global arrangement state: three buttons that
 * call back into main.ts on click. Selecting Climax and pressing Tab both
 * route through the same quantized request, so this control's `setActive`
 * only actually flips to "climax" once main.ts hears it land via
 * arrangement.onChange -- clicking it doesn't jump the button state early.
 */
export function renderArrangementControl(
  container: HTMLElement,
  onSelect: (state: ArrangementState) => void,
): ArrangementControl {
  const doc = container.ownerDocument;
  const buttonElements = new Map<ArrangementState, HTMLButtonElement>();

  for (const { state, label } of BUTTONS) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "arrangement-control__button";
    button.textContent = label;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => onSelect(state));
    container.appendChild(button);
    buttonElements.set(state, button);
  }

  return {
    setActive(state: ArrangementState): void {
      for (const [buttonState, button] of buttonElements) {
        button.setAttribute("aria-pressed", String(buttonState === state));
      }
    },
  };
}
