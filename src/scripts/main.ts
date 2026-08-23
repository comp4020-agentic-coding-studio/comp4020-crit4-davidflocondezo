import { audioContext, masterGain, scheduler, unlockAudio } from "./audio/context";
import { createBassVoice } from "./audio/voices/bass";
import { createKickVoice } from "./audio/voices/kick";
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

const stabVoice = createStabVoice(audioContext, masterGain, scheduler);

attachKeyboard(
  {
    onStabPress(scaleDegree) {
      stabVoice.trigger(scaleDegree);
    },
  },
  () => {
    void unlockAudio(startFoundation);
  },
);
