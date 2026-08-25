import { analyser, audioContext, masterGain, scheduler, unlockAudio } from "./audio/context";
import { createFilterMacro } from "./audio/filterMacro";
import { createArrangementController, TENSION_MIN_HZ, type ArrangementState } from "./audio/arrangement";
import { createAtmosphereVoice } from "./audio/voices/atmosphere";
import { createBassVoice } from "./audio/voices/bass";
import { createFxVoice } from "./audio/voices/fx";
import { createKickVoice } from "./audio/voices/kick";
import { createMelodyVoice } from "./audio/voices/melody";
import { createRiserVoice } from "./audio/voices/riser";
import { createStabVoice } from "./audio/voices/stab";
import { createTensionDrumVoice } from "./audio/voices/tensionDrum";
import { createSpaceBus } from "./audio/space";
import { createSidechainBus } from "./audio/sidechain";
import { createSaturationBus } from "./audio/saturation";
import { createMultibandBus } from "./audio/multiband";
import { attachKeyboard } from "./input/keyboard";
import { renderKeyboardOverlay } from "./ui/keyboardOverlay";
import { renderArrangementControl } from "./ui/arrangementControl";
import { renderDjDeck } from "./ui/djDeck";
import { renderPitchShifter } from "./ui/pitchShifter";
import { renderAudioVisualizer } from "./ui/audioVisualizer";

const overlayContainer = document.querySelector<HTMLElement>("#keyboard-overlay");
const djDeckContainer = document.querySelector<HTMLElement>("#dj-deck");
const pitchShifterContainer = document.querySelector<HTMLElement>("#pitch-shifter");
const audioVisualizerContainer = document.querySelector<HTMLElement>("#audio-visualizer");
const instrumentHeader = document.querySelector<HTMLElement>("#instrument-header");
const mainEl = document.querySelector<HTMLElement>("main");
const openingPrompt = document.querySelector<HTMLElement>("#opening-prompt");
const tempoReadout = document.querySelector<HTMLElement>("#tempo-readout");
const dropReadout = document.querySelector<HTMLElement>("#drop-readout");
const arrangementReadout = document.querySelector<HTMLElement>("#arrangement-readout");
const arrangementControlContainer = document.querySelector<HTMLElement>("#arrangement-control");
const overlay = overlayContainer ? renderKeyboardOverlay(overlayContainer) : null;
const djDeck = djDeckContainer ? renderDjDeck(djDeckContainer) : null;
const pitchShifter = pitchShifterContainer ? renderPitchShifter(pitchShifterContainer) : null;
if (audioVisualizerContainer) renderAudioVisualizer(audioVisualizerContainer, analyser);

// .dj-deck__body's left edge is a moving target -- its width is clamped by
// both the viewport (50vw - 18rem) and the keyboard's own height, so there's
// no single CSS formula for "where dj-deck ends up" that's worth duplicating
// here. Measuring the real rendered box and translating the header by the
// difference tracks that clamp exactly, at every viewport width, for free.
const djDeckBody = djDeckContainer?.querySelector<HTMLElement>(".dj-deck__body") ?? null;

function alignHeaderToDjDeck(): void {
  if (!instrumentHeader || !djDeckBody || !mainEl) return;
  const delta = djDeckBody.getBoundingClientRect().left - mainEl.getBoundingClientRect().left;
  instrumentHeader.style.marginLeft = `${delta}px`;
}

alignHeaderToDjDeck();
window.addEventListener("resize", alignHeaderToDjDeck);

const TEMPO_STEP_BPM = 5;
const DROP_MUTE_RAMP_SECONDS = 0.05;
const BEAT_JUMP_INTERVAL_MS = 180;

let foundationStarted = false;
let foundationMuted = false;
// Per-key interval IDs so ArrowLeft/ArrowRight can each hold-repeat
// independently -- keydown fires once immediately then starts its own
// interval, keyup clears just that key's entry.
const beatJumpIntervals = new Map<string, number>();

// True 3-band OTT-style multiband compressor for the synth bus: an
// independent crossover + compressor + makeup gain per band, so a loud
// kick/bass transient can't duck the highs the way a single fullband
// compressor would. Sits upstream of the master glue compressor + limiter
// in context.ts, which remain the final safety-net stage.
const multiband = createMultibandBus(audioContext, masterGain);

// Shared highpass that the arrangement controller sweeps 20Hz->1000Hz over
// BUILDUP, starving the low end ("vacuum cleaner" effect) from everything
// that already routes through sidechain -- bass, stab, melody, atmosphere --
// while automatically excluding kick, fx, and riser, which never pass
// through this chain. Starts fully open (TENSION_MIN_HZ), matching INTRO.
const tensionFilter = audioContext.createBiquadFilter();
tensionFilter.type = "highpass";
tensionFilter.frequency.value = TENSION_MIN_HZ;
tensionFilter.connect(multiband.input);

// Bass and the chord/lead voices (plus their reverb sends) route through
// this bus so the kick can pump them on every beat. Riser and fx bypass it
// on purpose: a riser is an unbroken swell, and one-shot fx hits are too
// short for ducking to buy anything.
const sidechain = createSidechainBus(audioContext, tensionFilter, () => scheduler.getBpm());

// Melody (the lead) and stab (chords/plucks) are the two voices meant to cut
// through the mix, so they route through this waveshaper-distortion bus for
// harmonic density and aggression. Atmosphere and fx bypass it on purpose --
// distorting everything erases the contrast that makes the mix read as
// massive rather than a wall of fizz.
const saturation = createSaturationBus(audioContext, sidechain.input);

// Kick and bass -- the drop-able "foundation" -- route through their own
// gain nodes rather than straight to their usual destinations, so Space can
// ramp both to silence for a hardstyle-style drop while every keypress-
// triggered voice (stab, fx, atmosphere, melody, riser) keeps sounding,
// still perfectly quantized, because the scheduler itself never stops.
const kickMuteGain = audioContext.createGain();
const bassMuteGain = audioContext.createGain();

// A second, independent multiplier downstream of each mute gain: the
// arrangement controller drives these to silence kick+bass during
// INTRO/BUILDUP and bring them back full for CLIMAX, without fighting
// Space's own automation on kickMuteGain/bassMuteGain above. Both start
// silent -- kick/bass are silent by default until climax is reached.
const kickArrangementGain = audioContext.createGain();
kickArrangementGain.gain.value = 0;
kickMuteGain.connect(kickArrangementGain);
kickArrangementGain.connect(masterGain);

const bassArrangementGain = audioContext.createGain();
bassArrangementGain.gain.value = 0;
bassMuteGain.connect(bassArrangementGain);
bassArrangementGain.connect(sidechain.input);

const arrangement = createArrangementController(
  audioContext,
  scheduler,
  kickArrangementGain,
  bassArrangementGain,
  tensionFilter,
);
createTensionDrumVoice(audioContext, masterGain, scheduler, arrangement);

function startFoundation(): void {
  if (foundationStarted) return;
  foundationStarted = true;
  // Ducking is skipped while dropped, or while the kick isn't the audible
  // foundation (INTRO/BUILDUP use the tension-drum instead): a duck rhythm
  // with no audible kick to justify it would read as the mix pumping for no
  // reason instead of the pads/leads swelling freely.
  createKickVoice(audioContext, kickMuteGain, scheduler, (time) => {
    if (!foundationMuted && arrangement.getState() === "climax") sidechain.duck(time);
  });
  createBassVoice(audioContext, bassMuteGain, scheduler);
}

function setFoundationMuted(muted: boolean): void {
  foundationMuted = muted;
  const target = muted ? 0 : 1;
  const now = audioContext.currentTime;
  for (const gainNode of [kickMuteGain, bassMuteGain]) {
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(target, now + DROP_MUTE_RAMP_SECONDS);
  }
}

const filterMacro = createFilterMacro();
const spaceBus = createSpaceBus(audioContext, sidechain.input, () => scheduler.getBpm());
const stabVoice = createStabVoice(audioContext, saturation.input, scheduler, filterMacro, spaceBus);
const fxVoice = createFxVoice(audioContext, masterGain, scheduler, filterMacro);
const atmosphereVoice = createAtmosphereVoice(audioContext, sidechain.input, scheduler, filterMacro, spaceBus);
const melodyVoice = createMelodyVoice(audioContext, saturation.input, scheduler, filterMacro, spaceBus, arrangement);
const riserVoice = createRiserVoice(audioContext, masterGain, scheduler, arrangement);

const ARRANGEMENT_LABELS: Record<ArrangementState, string> = {
  intro: "Intro",
  buildup: "Buildup",
  climax: "Climax",
};

function updateArrangementReadout(state: ArrangementState): void {
  if (!arrangementReadout) return;
  arrangementReadout.textContent = `Arrangement: ${ARRANGEMENT_LABELS[state]} (Tab to cycle)`;
}

const arrangementControl = arrangementControlContainer
  ? renderArrangementControl(arrangementControlContainer, (target) => {
      if (target === "climax") arrangement.requestClimax();
      else arrangement.setState(target);
    })
  : null;

arrangement.onChange((state) => {
  arrangementControl?.setActive(state);
  updateArrangementReadout(state);
});
arrangementControl?.setActive(arrangement.getState());
updateArrangementReadout(arrangement.getState());
pitchShifter?.setTempo(scheduler.getBpm());

attachKeyboard(
  {
    onStabPress(scaleDegree) {
      stabVoice.trigger(scaleDegree);
    },
    onStabHoldStart(scaleDegree, key) {
      stabVoice.setHeld(scaleDegree, true);
      overlay?.setKeyActive(key, true);
    },
    onStabHoldStop(scaleDegree, key) {
      stabVoice.setHeld(scaleDegree, false);
      overlay?.setKeyActive(key, false);
    },
    onFxPress(variant, key) {
      fxVoice.trigger(variant);
      overlay?.flashKey(key);
    },
    onAtmosphereToggle(variant, active, key) {
      atmosphereVoice.setActive(variant, active);
      overlay?.setKeyActive(key, active);
    },
    onMelodyHold(params, active, key) {
      melodyVoice.setActive(params, active);
      overlay?.setKeyActive(key, active);
    },
    onRiserPress(variant, key) {
      riserVoice.trigger(variant);
      overlay?.flashKey(key);
    },
    onTempoNudge(direction, key) {
      const bpm = scheduler.adjustBpm(direction * TEMPO_STEP_BPM);
      spaceBus.setBpm(bpm);
      if (tempoReadout) tempoReadout.textContent = `Tempo: ${bpm} BPM (↑/↓ to adjust)`;
      overlay?.flashKey(key);
      pitchShifter?.setTempo(bpm);
    },
    onDropToggle() {
      setFoundationMuted(!foundationMuted);
      if (dropReadout) {
        dropReadout.textContent = foundationMuted
          ? "Dropped -- kick & bass muted (Space to bring them back)"
          : "Space to drop the kick & bass";
      }
      overlay?.setKeyActive(" ", foundationMuted);
    },
    onBeatJumpStart(direction, key) {
      scheduler.jumpBar(direction, true);
      overlay?.flashKey(key);
      djDeck?.spin(direction, true);
      if (beatJumpIntervals.has(key)) return;
      const intervalId = window.setInterval(() => {
        scheduler.jumpBar(direction, false);
        overlay?.flashKey(key);
      }, BEAT_JUMP_INTERVAL_MS);
      beatJumpIntervals.set(key, intervalId);
    },
    onBeatJumpStop(key) {
      // Not gated behind the interval-map check below -- onBeatJumpStart
      // fires unconditionally on every non-repeat keydown (see
      // keyboard.ts), so the deck's held state must always clear on the
      // matching keyup regardless of the interval bookkeeping.
      djDeck?.spin(key === "ArrowLeft" ? -1 : 1, false);
      const intervalId = beatJumpIntervals.get(key);
      if (intervalId === undefined) return;
      window.clearInterval(intervalId);
      beatJumpIntervals.delete(key);
    },
    onArrangementCycle() {
      const state = arrangement.getState();
      if (state === "intro") arrangement.setState("buildup");
      else if (state === "buildup") arrangement.requestClimax();
      else arrangement.setState("intro");
    },
  },
  () => {
    void unlockAudio(startFoundation);
    openingPrompt?.setAttribute("hidden", "");
  },
);
