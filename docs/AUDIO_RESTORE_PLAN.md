# Audio Restoration Plan (Tech Debt)

The audio layer was temporarily removed due to auto-play violations and structural issues in the `timer 10s pick block` PR. It must be restored with a robust, user-first approach.

## Requirements for Restoration

1. **Explicit User Gesture Unlock**
   - Modern browsers block `AudioContext` and media auto-play until the user interacts with the page.
   - Implement a "Click to Start" overlay or a prominent "Enable Audio" interaction before rendering the main draft board.
   
2. **Persistent Mute Toggle**
   - Add a global mute/unmute button to the UI.
   - Save the user's audio preference in `localStorage` so they don't have to toggle it every game.
   
3. **No Unprompted Auto-play**
   - Never attempt to `.play()` audio on component mount or timer ticks if the user has not explicitly unlocked the audio context.
   - If audio fails to play due to browser policy, catch the exception cleanly and silently update the UI to indicate sound is blocked, rather than crashing or spamming the console.

4. **Service-Based Architecture**
   - Ensure `soundService.ts` is purely a coordinator for HTMLAudioElements or Web Audio API.
   - Do not mix audio side-effects directly into React render loops. Dispatch audio triggers from `useEffect` hooks that watch state transitions (e.g., `lobby.turn`, `lobby.phase`).
