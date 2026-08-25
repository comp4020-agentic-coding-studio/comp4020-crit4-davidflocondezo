export interface DjDeck {
  /**
   * direction: 1 = ArrowRight, -1 = ArrowLeft, matching onBeatJumpStart's
   * first argument so main.ts can forward it directly. Left/right are
   * tracked independently; holding both at once cancels out to idle since
   * there's no principled way to prefer either arrow.
   */
  spin(direction: 1 | -1, active: boolean): void;
}

/**
 * Purely decorative vinyl-disc spinner, visually synced to the ArrowLeft/
 * ArrowRight beat-jump transport keys. Duplicates no information not already
 * on those keys' own aria-labels, so its container is marked aria-hidden in
 * the markup rather than here.
 */
export function renderDjDeck(container: HTMLElement): DjDeck {
  // Derived from the container, not the bare global -- keeps this testable
  // via `new JSDOM()` under vitest's node environment.
  const doc = container.ownerDocument;

  const body = doc.createElement("div");
  body.className = "dj-deck__body";

  const platter = doc.createElement("div");
  platter.className = "dj-deck__platter";

  const disc = doc.createElement("div");
  disc.className = "dj-deck__disc";

  const tonearm = doc.createElement("div");
  tonearm.className = "dj-deck__tonearm";

  platter.appendChild(disc);
  body.appendChild(platter);
  body.appendChild(tonearm);
  container.appendChild(body);

  let rightHeld = false;
  let leftHeld = false;

  function update(): void {
    disc.classList.toggle("dj-deck__disc--spin-right", rightHeld && !leftHeld);
    disc.classList.toggle("dj-deck__disc--spin-left", leftHeld && !rightHeld);
  }

  return {
    spin(direction: 1 | -1, active: boolean): void {
      if (direction === 1) rightHeld = active;
      else leftHeld = active;
      update();
    },
  };
}
