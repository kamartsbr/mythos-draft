
const SOUNDS = {
  yourTurn: null,
  timerLow: null,
  pick: '/assets/sounds/pick.mp3', // Sword
  ban: '/assets/sounds/ban.mp3', // Stone/Bash
  complete: null,
  action: '/assets/sounds/pick.mp3', // Sword/Click (fallback)
  finish: null,
};

class SoundService {
  private enabled: boolean = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  play(soundName: keyof typeof SOUNDS) {
    if (!this.enabled) return;

    try {
      const url = SOUNDS[soundName];
      if (!url) return;

      const audio = new Audio(url);
      audio.volume = 0.4;

      // Wrap play in a promise-safe check
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          // If SSL error or blocked, we just ignore it
          if (e.name !== 'NotAllowedError') {
            console.warn(`Audio play failed for ${soundName}:`, e.message);
          }
        });
      }
    } catch (error) {
      // Silently catch audio context errors
    }
  }
}

export const soundService = new SoundService();
