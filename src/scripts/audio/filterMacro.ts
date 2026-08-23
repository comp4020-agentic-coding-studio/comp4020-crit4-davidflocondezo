const MIN_CUTOFF = 300;
const MAX_CUTOFF = 12000;

export interface FilterMacro {
  /** Current shared base cutoff in Hz, driven by mouse Y. */
  getCutoff(): number;
}

/**
 * Global tier of the two-tier filter design: mouse Y (top of the viewport =
 * bright/open, bottom = dark/closed, the gesture most players expect from a
 * hardstyle build) drives one shared base cutoff on a log scale, since
 * frequency perception is logarithmic. Individual voices read this as their
 * *base* and layer their own local jitter/envelope on top -- this module
 * never touches an audio node directly.
 */
export function createFilterMacro(): FilterMacro {
  let normalizedY = 0.5; // centered until the first mouse move

  function handlePointerMove(event: PointerEvent): void {
    normalizedY = Math.min(Math.max(event.clientY / window.innerHeight, 0), 1);
  }

  window.addEventListener("pointermove", handlePointerMove);

  return {
    getCutoff(): number {
      const openness = 1 - normalizedY;
      return MIN_CUTOFF * (MAX_CUTOFF / MIN_CUTOFF) ** openness;
    },
  };
}
