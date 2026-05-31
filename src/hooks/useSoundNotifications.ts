import { useEffect, useRef } from 'react';
import { Lobby } from '../types';
import { soundService } from '../services/soundService';

export function useSoundNotifications(lobby: Lobby | null, timeLeft: number | null, isCaptain1: boolean, isCaptain2: boolean) {
  const prevTurn = useRef<number | null>(null);
  const prevPhase = useRef<string | null>(null);
  const prevStatus = useRef<string | null>(null);
  const hasPlayedTimerLow = useRef(false);

  // Request Notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const sendBrowserNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      new Notification(title, { body, icon: '/favicon.ico' });
      
      // Blink title
      let isBlinking = true;
      const originalTitle = document.title;
      const blinkInterval = setInterval(() => {
        document.title = document.title === originalTitle ? `(1) ${title}` : originalTitle;
      }, 1000);

      const stopBlinking = () => {
        isBlinking = false;
        clearInterval(blinkInterval);
        document.title = originalTitle;
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };

      const handleVisibilityChange = () => {
        if (!document.hidden && isBlinking) {
          stopBlinking();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  };

  useEffect(() => {
    if (!lobby) return;

    const currentTurn = lobby.turn;
    const currentPhase = lobby.phase;
    const currentStatus = lobby.status;
    const turnOrder = lobby.turnOrder;
    const turnData = turnOrder[currentTurn];
    
    const isPlayer = isCaptain1 || isCaptain2;

    // 0. Draft Started Notification
    if (currentStatus === 'drafting' && prevStatus.current !== 'drafting') {
      if (isPlayer) {
        soundService.play('yourTurn'); // We can reuse yourTurn or add a specific matchFound sound later
        sendBrowserNotification("Draft Started!", "The draft has begun. Return to the lobby.");
      }
    }

    // 1. Your Turn Notification
    if (turnData && (currentTurn !== prevTurn.current || currentPhase !== prevPhase.current)) {
      const isMyTurn = (turnData.player === 'A' && isCaptain1) || 
                       (turnData.player === 'B' && isCaptain2) || 
                       (turnData.player === 'BOTH' && (isCaptain1 || isCaptain2));
      
      if (isMyTurn && lobby.status === 'drafting') {
        soundService.play('yourTurn');
        sendBrowserNotification("Your Turn!", `It is your turn to ${turnData.action} a ${turnData.target}.`);
      }
      
      // Reset timer low flag on turn change
      hasPlayedTimerLow.current = false;
    }

    // 2. Draft Complete Notification
    if (currentPhase === 'post_draft' && prevPhase.current !== 'post_draft') {
      soundService.play('complete');
      if (isPlayer) {
        sendBrowserNotification("Draft Complete!", "The draft has concluded.");
      }
    }

    // 3. Timer Low Notification (5 seconds)
    if (timeLeft !== null && timeLeft <= 5 && timeLeft > 0 && !hasPlayedTimerLow.current) {
      const isMyTurn = turnData && ((turnData.player === 'A' && isCaptain1) || 
                       (turnData.player === 'B' && isCaptain2) || 
                       (turnData.player === 'BOTH' && (isCaptain1 || isCaptain2)));
      
      if (isMyTurn && lobby.status === 'drafting') {
        soundService.play('timerLow');
        hasPlayedTimerLow.current = true;
      }
    }

    prevTurn.current = currentTurn;
    prevPhase.current = currentPhase;
    prevStatus.current = currentStatus;
  }, [lobby, timeLeft, isCaptain1, isCaptain2]);
}
