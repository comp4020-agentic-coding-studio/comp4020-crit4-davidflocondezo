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
import { attachKeyboard } from "./input/keyboard";
import { renderKeyboardOverlay } from "./ui/keyboardOverlay";

const overlayContainer = document.querySelector<HTMLElement>("#keyboard-overlay");
const openingPrompt = document.querySelector<HTMLElement>("#opening-prompt");
const overlay = overlayContainer ? renderKeyboardOverlay(overlayContainer) : null;

let foundationStarted = false;

// Bass and the chord/lead voices (plus their reverb sends) route through
// this bus so the kick can pump them on every beat. Riser and fx bypass it
// on purpose: a riser is an unbroken swell, and one-shot fx hits are too
// short for ducking to buy anything.
const sidechain = createSidechainBus(audioContext, masterGain);

// Melody (the lead) and stab (chords/plucks) are the two voices meant to cut
// through the mix, so they route through this waveshaper-distortion bus for
// harmonic density and aggression. Atmosphere and fx bypass it on purpose --
// distorting everything erases the contrast that makes the mix read as
// massive rather than a wall of fizz.
const saturation = createSaturationBus(audioContext, sidechain.input);

function startFoundation(): void {
  if (foundationStarted) return;
  foundationStarted = true;
  createKickVoice(audioContext, masterGain, scheduler, sidechain.duck);
  createBassVoice(audioContext, sidechain.input, scheduler);
}

const filterMacro = createFilterMacro();
const spaceBus = createSpaceBus(audioContext, sidechain.input);
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
  },
  () => {
    void unlockAudio(startFoundation);
    openingPrompt?.setAttribute("hidden", "");
  },
);
