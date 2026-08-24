import { audioContext, masterGain, scheduler, unlockAudio } from "./audio/context";
import { createFilterMacro } from "./audio/filterMacro";
import { createAtmosphereVoice } from "./audio/voices/atmosphere";
import { createBassVoice } from "./audio/voices/bass";
import { createFxVoice } from "./audio/voices/fx";
import { createKickVoice } from "./audio/voices/kick";
import { createMelodyVoice } from "./audio/voices/melody";
import { createRiserVoice } from "./audio/voices/riser";
import { createStabVoice } from "./audio/voices/stab";
import { createSpaceBus } from "./audio/space";
import { createSidechainBus } from "./audio/sidechain";
import { createSaturationBus } from "./audio/saturation";
import { createMultibandBus } from "./audio/multiband";
import { attachKeyboard } from "./input/keyboard";
import { renderKeyboardOverlay } from "./ui/keyboardOverlay";

const overlayContainer = document.querySelector<HTMLElement>("#keyboard-overlay");
const openingPrompt = document.querySelector<HTMLElement>("#opening-prompt");
const tempoReadout = document.querySelector<HTMLElement>("#tempo-readout");
const dropReadout = document.querySelector<HTMLElement>("#drop-readout");
const overlay = overlayContainer ? renderKeyboardOverlay(overlayContainer) : null;

const TEMPO_STEP_BPM = 5;
const DROP_MUTE_RAMP_SECONDS = 0.05;

let foundationStarted = false;
let foundationMuted = false;

// True 3-band OTT-style multiband compressor for the synth bus: an
// independent crossover + compressor + makeup gain per band, so a loud
// kick/bass transient can't duck the highs the way a single fullband
// compressor would. Sits upstream of the master glue compressor + limiter
// in context.ts, which remain the final safety-net stage.
const multiband = createMultibandBus(audioContext, masterGain);

// Bass and the chord/lead voices (plus their reverb sends) route through
// this bus so the kick can pump them on every beat. Riser and fx bypass it
// on purpose: a riser is an unbroken swell, and one-shot fx hits are too
// short for ducking to buy anything.
const sidechain = createSidechainBus(audioContext, multiband.input, () => scheduler.getBpm());

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
kickMuteGain.connect(masterGain);
const bassMuteGain = audioContext.createGain();
bassMuteGain.connect(sidechain.input);

function startFoundation(): void {
  if (foundationStarted) return;
  foundationStarted = true;
  // Ducking is skipped while dropped: a duck rhythm with no audible kick to
  // justify it would read as the mix pumping for no reason instead of the
  // pads/leads swelling freely during the drop.
  createKickVoice(audioContext, kickMuteGain, scheduler, (time) => {
    if (!foundationMuted) sidechain.duck(time);
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
const melodyVoice = createMelodyVoice(audioContext, saturation.input, scheduler, filterMacro, spaceBus);
const riserVoice = createRiserVoice(audioContext, masterGain, scheduler);

attachKeyboard(
  {
    onStabPress(scaleDegree, key) {
      stabVoice.trigger(scaleDegree);
      overlay?.flashKey(key);
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
  },
  () => {
    void unlockAudio(startFoundation);
    openingPrompt?.setAttribute("hidden", "");
  },
);
