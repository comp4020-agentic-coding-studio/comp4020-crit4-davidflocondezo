import { lookupKey } from "./keymap";
import type { MelodyParams } from "./keymap";

export interface KeyboardHandlers {
  onFxPress?(variant: number, key: string): void;
  onStabPress?(scaleDegree: number, key: string): void;
  onStabHoldStart?(scaleDegree: number, key: string): void;
  onStabHoldStop?(scaleDegree: number, key: string): void;
  onAtmosphereToggle?(variant: number, active: boolean, key: string): void;
  onMelodyHold?(params: MelodyParams, active: boolean, key: string): void;
  onRiserPress?(variant: number, key: string): void;
  onTempoNudge?(direction: 1 | -1, key: string): void;
  onDropToggle?(): void;
  onBeatJumpStart?(direction: 1 | -1, key: string): void;
  onBeatJumpStop?(key: string): void;
}

/**
 * Document-level so no element needs focus. OS auto-repeat (event.repeat)
 * is ignored everywhere -- it would otherwise re-fire one-shots on a long
 * press and desync toggle/hold state.
 */
export function attachKeyboard(handlers: KeyboardHandlers, onFirstKey: () => void): () => void {
  const activeAtmosphere = new Set<string>();
  const activeMelody = new Set<string>();
  const activeStab = new Set<string>();
  let firstKeySeen = false;

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      if (event.repeat) return; // deliberate per-press nudge, not a held ramp
      event.preventDefault(); // stop the page from scrolling
      handlers.onTempoNudge?.(event.key === "ArrowUp" ? 1 : -1, event.key);
      return;
    }
    if (event.key === " ") {
      if (event.repeat) return; // one toggle per press, not a held ramp
      event.preventDefault(); // stop the page from scrolling / activating a focused link
      handlers.onDropToggle?.();
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      if (event.repeat) return; // our own interval drives the repeat, not the OS's
      event.preventDefault();
      handlers.onBeatJumpStart?.(event.key === "ArrowRight" ? 1 : -1, event.key);
      return;
    }
    const def = lookupKey(event.key);
    if (!def) return;
    if (!firstKeySeen) {
      firstKeySeen = true;
      onFirstKey();
    }
    if (event.repeat) return;

    switch (def.category) {
      case "fx":
        handlers.onFxPress?.(def.variant, def.key);
        break;
      case "stab":
        handlers.onStabPress?.(def.scaleDegree, def.key);
        if (!activeStab.has(def.key)) {
          activeStab.add(def.key);
          handlers.onStabHoldStart?.(def.scaleDegree, def.key);
        }
        break;
      case "riser":
        handlers.onRiserPress?.(def.variant, def.key);
        break;
      case "atmosphere": {
        const nowActive = !activeAtmosphere.has(def.key);
        if (nowActive) activeAtmosphere.add(def.key);
        else activeAtmosphere.delete(def.key);
        handlers.onAtmosphereToggle?.(def.variant, nowActive, def.key);
        break;
      }
      case "melody":
        if (activeMelody.has(def.key)) return;
        activeMelody.add(def.key);
        handlers.onMelodyHold?.(
          { registerOffset: def.registerOffset, tickSubdivision: def.tickSubdivision },
          true,
          def.key,
        );
        break;
    }
  }

  function handleKeyup(event: KeyboardEvent): void {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      handlers.onBeatJumpStop?.(event.key);
      return;
    }
    const def = lookupKey(event.key);
    if (!def) return;
    if (def.category === "stab") {
      if (!activeStab.has(def.key)) return;
      activeStab.delete(def.key);
      handlers.onStabHoldStop?.(def.scaleDegree, def.key);
      return;
    }
    if (def.category !== "melody") return;
    if (!activeMelody.has(def.key)) return;
    activeMelody.delete(def.key);
    handlers.onMelodyHold?.(
      { registerOffset: def.registerOffset, tickSubdivision: def.tickSubdivision },
      false,
      def.key,
    );
  }

  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("keyup", handleKeyup);

  return () => {
    document.removeEventListener("keydown", handleKeydown);
    document.removeEventListener("keyup", handleKeyup);
  };
}
