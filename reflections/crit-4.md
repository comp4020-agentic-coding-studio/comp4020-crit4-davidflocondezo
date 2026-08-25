# Crit 4 reflection

**What was the breakthrough that moved the work forward?**

The concept didn't click until I figured out how to make the instrument "idiot" proof so that anyone can make music. I did a lot of tests and trials of button mashing to try and create "music" but most of the time it didn't really sound rhythmically like a hardstyle song you would hear at a festival. So there was a lot of research on the structure of hardstyle songs that I did to try and replicate the sounds using the audio buffer. I separated the instrument into two things that are not allowed to interact rhythmically: an always-on kick/bass foundation that only evolves harmonically, and 36 player-triggered layers that are free to fire whenever a key is pressed. Then so that there was no way to play it wrong, every voice needed to snap to the next valid grid position instead of firing exactly on keydown. I also implemented an "Auto-Backbone" State Machine that holds everything together. The user esssentially doesn't have to worry about the structure of a hardstyle song as they can simply manually trigger INTRO, BUILDUP, and CLIMAX sections of the song. So when the user triggers their melodies, stabs, and FX, it instantly sounds like a complete, mastered song because the rhythmic foundation is mathematically there.

**What did this change about who I want to be as a software developer?**

I think for me this brief was especially interesting because I chose to explore a genre that i'm really interested in and therefore spent a lot of time working on this while enjoying it. Moving forward, I want to always find ways to relate my work to areas of interest to myself to keep myself motivated and informed.
