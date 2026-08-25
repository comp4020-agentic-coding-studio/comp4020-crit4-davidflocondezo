# Process overview

A reading-guide to how the work came together.

## What I built

A browser-based hardstyle instrument, live-tempo-adjustable between 140–190
BPM: all 36 alphanumeric keys layer live-synthesized stabs, pads, a
generative melody, risers, and FX over a kick/bass foundation. 
Tab cycles an intro/buildup/climax arrangement that sweeps a
shared filter and gates the foundation toward a drop. The UI uses a color-coded keyboard overlay, a real-time waveform visualiser, a spinning DJ-deck disc, and a pitch-shifter fader give visual feedback for
every one of those systems without needing instructions.

## The moments that mattered

1. **I realised that the keys were not random** After creating the hardstyle player keys. By reloading the page and trying out the sounds. I realised that it was not playing random sounds, and would sound very similar on diffferent session loads. What I did to fix this was choose a random root transposition once per page load and made sure every voice would read from this same table, so the whole instrument shifts into a different key each session.
[`9f6de08`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-davidflocondezo/commit/9f6de08)

2. **From simple hardstyle to euphoric hardstyle** Trying to create good sounding hardstyle sounds was impossible. I played some hardstyle songs to figure out how I could make mine sound better instead of just keys clicking and making noise. I realised hardstyle songs have a more euphoric tone compared to the noise that I was creating. So I decided to move away from the single oscillators that I was using and instead went for an approach of stacking multiple sawtooth waves and slightly detuning them against each other to make it sound more pleasing to the ear.
[`f44fb97`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-davidflocondezo/commit/f44fb97)

3. **Multiple keys not getting patched with changes** While updating the entire oscillator across the keys, I tested the Melody keys and sounded with the new update but testing all keys I noticed no visible change. Upon inspecting the code, I realised that the agent had only updated for the melody keys and not for the other 4 key groupings. Because of this I added a rule in the claude.md so that any change that is meant to apply to the keys is ensured to apply across all the voices there. This made sure that I didn't run into that issue again.
[`bcd6d70`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-davidflocondezo/commit/bcd6d70)

## Before you ship

`pnpm check:evidence` verifies these citations resolve to real commits, that
`reflections/crit-4.md` and `CLAUDE.md` are present, and that this file no
longer carries its template comment.
