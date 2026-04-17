
import { useEffect, useRef } from 'react';
import { Lobby } from '../types';
import { soundService } from '../services/soundService';

export function useSoundNotifications(lobby: Lobby | null, timeLeft: number | null, isCaptain1: boolean, isCaptain2: boolean) {
  const prevTurn = useRef<number | null>(null);
  const prevPhase = useRef<string | null>(null);
  const hasPlayedTimerLow = useRef(false);

  useEffect(() => {
    if (!lobby) return;

    const currentTurn = lobby.turn;
    const currentPhase = lobby.phase;
    const turnOrder = lobby.turnOrder;
    const turnData = turnOrder[currentTurn];

    // 1. Your Turn Notification
    if (turnData && (currentTurn !== prevTurn.current || currentPhase !== prevPhase.current)) {
      const isMyTurn = (turnData.player === 'A' && isCaptain1) || 
                       (turnData.player === 'B' && isCaptain2) || 
                       (turnData.player === 'BOTH' && (isCaptain1 || isCaptain2));
      
      if (isMyTurn && lobby.status === 'drafting') {
        soundService.play('yourTurn');
      }
      
      // Reset timer low flag on turn change
      hasPlayedTimerLow.current = false;
    }

    // 2. Draft Complete Notification
    if (currentPhase === 'post_draft' && prevPhase.current !== 'post_draft') {
      soundService.play('complete');
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
  }, [lobby, timeLeft, isCaptain1, isCaptain2]);
}
