
const SOUNDS = {
  yourTurn: '/assets/sounds/yourTurn.mp3', // Horn
  timerLow: '/assets/sounds/yourTurn.mp3', // Ticking (fallback)
  pick: '/assets/sounds/pick.mp3', // Sword
  ban: '/assets/sounds/ban.mp3', // Stone/Bash
  complete: '/assets/sounds/yourTurn.mp3', // Fanfare (fallback)
  action: '/assets/sounds/pick.mp3', // Sword/Click (fallback)
  finish: '/assets/sounds/yourTurn.mp3', // Fanfare (fallback)
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
