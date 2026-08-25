export interface AudioVisualizer {}

const WAVEFORM_COLOR = "#ff6b6b";

/**
 * Purely decorative real-time waveform display. Reads from an AnalyserNode
 * tapped off the final master output (see audio/context.ts) so it reflects
 * everything actually audible, not any single voice.
 */
export function renderAudioVisualizer(container: HTMLElement, analyser: AnalyserNode): AudioVisualizer {
  // Derived from the container/canvas, not the bare global -- keeps this
  // testable via `new JSDOM()` under vitest's node environment, and jsdom
  // implements neither a 2d canvas context nor requestAnimationFrame without
  // extra packages, so both are feature-detected before use.
  const doc = container.ownerDocument;
  const view = doc.defaultView;

  const canvas = doc.createElement("canvas");
  canvas.className = "audio-visualizer__canvas";
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const waveform = new Float32Array(analyser.fftSize);

  function resize(): void {
    const rect = container.getBoundingClientRect();
    const dpr = view?.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }

  function draw(): void {
    if (!ctx) return;
    analyser.getFloatTimeDomainData(waveform);
    const { width, height } = canvas;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = WAVEFORM_COLOR;
    ctx.lineWidth = Math.max(1, height * 0.008);
    ctx.beginPath();
    const sliceWidth = width / waveform.length;
    for (let i = 0; i < waveform.length; i++) {
      const x = i * sliceWidth;
      const y = height / 2 + waveform[i] * height * 0.45;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (typeof view?.requestAnimationFrame === "function") view.requestAnimationFrame(draw);
  }

  resize();
  if (typeof view?.addEventListener === "function") view.addEventListener("resize", resize);
  if (ctx) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (ctx && typeof view?.requestAnimationFrame === "function") view.requestAnimationFrame(draw);

  return {};
}
