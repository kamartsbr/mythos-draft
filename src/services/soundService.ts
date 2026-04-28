
const SOUNDS = {
  yourTurn: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', // Horn
  timerLow: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3', // Ticking
  pick: 'https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3', // Sword
  ban: 'https://assets.mixkit.co/active_storage/sfx/1185/1185-preview.mp3', // Stone/Bash
  complete: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', // Fanfare
  action: 'https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3', // Sword/Click
  finish: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', // Fanfare
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
