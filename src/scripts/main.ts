import { audioContext, masterGain, scheduler, unlockAudio } from "./audio/context";
import { createFilterMacro } from "./audio/filterMacro";
import { createAtmosphereVoice } from "./audio/voices/atmosphere";
import { createBassVoice } from "./audio/voices/bass";
import { createFxVoice } from "./audio/voices/fx";
import { createKickVoice } from "./audio/voices/kick";
import { createMelodyVoice } from "./audio/voices/melody";
import { createRiserVoice } from "./audio/voices/riser";
import { createStabVoice } from "./audio/voices/stab";
import { attachKeyboard } from "./input/keyboard";

const intro = document.querySelector<HTMLElement>('[data-testid="intro"]');
if (intro) {
  intro.dataset.ready = "true";
}

let foundationStarted = false;

function startFoundation(): void {
  if (foundationStarted) return;
  foundationStarted = true;
  createKickVoice(audioContext, masterGain, scheduler);
  createBassVoice(audioContext, masterGain, scheduler);
}

const filterMacro = createFilterMacro();
const stabVoice = createStabVoice(audioContext, masterGain, scheduler, filterMacro);
const fxVoice = createFxVoice(audioContext, masterGain, scheduler, filterMacro);
const atmosphereVoice = createAtmosphereVoice(audioContext, masterGain, scheduler, filterMacro);
const melodyVoice = createMelodyVoice(audioContext, masterGain, scheduler, filterMacro);
const riserVoice = createRiserVoice(audioContext, masterGain, scheduler);

attachKeyboard(
  {
    onStabPress(scaleDegree) {
      stabVoice.trigger(scaleDegree);
    },
    onFxPress(variant) {
      fxVoice.trigger(variant);
    },
    onAtmosphereToggle(variant, active) {
      atmosphereVoice.setActive(variant, active);
    },
    onMelodyHold(params, active) {
      melodyVoice.setActive(params, active);
    },
    onRiserPress(variant) {
      riserVoice.trigger(variant);
    },
  },
  () => {
    void unlockAudio(startFoundation);
  },
);
