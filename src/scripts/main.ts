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
import { attachKeyboard } from "./input/keyboard";
import { renderKeyboardOverlay } from "./ui/keyboardOverlay";

const overlayContainer = document.querySelector<HTMLElement>("#keyboard-overlay");
const openingPrompt = document.querySelector<HTMLElement>("#opening-prompt");
const overlay = overlayContainer ? renderKeyboardOverlay(overlayContainer) : null;

let foundationStarted = false;

function startFoundation(): void {
  if (foundationStarted) return;
  foundationStarted = true;
  createKickVoice(audioContext, masterGain, scheduler);
  createBassVoice(audioContext, masterGain, scheduler);
}

const filterMacro = createFilterMacro();
const spaceBus = createSpaceBus(audioContext, masterGain);
const stabVoice = createStabVoice(audioContext, masterGain, scheduler, filterMacro, spaceBus);
const fxVoice = createFxVoice(audioContext, masterGain, scheduler, filterMacro);
const atmosphereVoice = createAtmosphereVoice(audioContext, masterGain, scheduler, filterMacro, spaceBus);
const melodyVoice = createMelodyVoice(audioContext, masterGain, scheduler, filterMacro, spaceBus);
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
