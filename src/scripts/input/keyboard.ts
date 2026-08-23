import { lookupKey } from "./keymap";
import type { MelodyParams } from "./keymap";

export interface KeyboardHandlers {
  onFxPress?(variant: number, key: string): void;
  onStabPress?(scaleDegree: number, key: string): void;
  onAtmosphereToggle?(variant: number, active: boolean, key: string): void;
  onMelodyHold?(params: MelodyParams, active: boolean, key: string): void;
  onRiserPress?(variant: number, key: string): void;
}

/**
 * Document-level so no element needs focus. OS auto-repeat (event.repeat)
 * is ignored everywhere -- it would otherwise re-fire one-shots on a long
 * press and desync toggle/hold state.
 */
export function attachKeyboard(handlers: KeyboardHandlers, onFirstKey: () => void): () => void {
  const activeAtmosphere = new Set<string>();
  const activeMelody = new Set<string>();
  let firstKeySeen = false;

  function handleKeydown(event: KeyboardEvent): void {
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
    const def = lookupKey(event.key);
    if (!def || def.category !== "melody") return;
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
