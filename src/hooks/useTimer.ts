import { useState, useEffect, useRef, useCallback } from 'react';
import { Lobby } from '../types';
import { MAPS, MAJOR_GODS } from '../constants';
import { getServerTime } from '../lib/serverTime';

export function useTimer(
  lobby: Lobby | null, 
  isCaptain1: boolean, 
  isCaptain2: boolean, 
  handleAction: (id: string, playerId?: number, playerName?: string, options?: { isRandom?: boolean }) => void,
  handlePickerAction?: (id: string, playerId?: number, playerName?: string, options?: { isRandom?: boolean }) => void
) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const isProcessing = useRef(false);
  const lastTriggeredTurn = useRef<number | null>(null);
  const lastTriggerAt = useRef<number>(0);
  const workerRef = useRef<Worker | null>(null);
  const lobbyRef = useRef(lobby);

  // Keep lobbyRef in sync for the interval without re-subscribing useEffect unnecessarily
  useEffect(() => {
    lobbyRef.current = lobby;
  }, [lobby]);

  // Helper to shuffle array for better randomness
  const shuffle = <T>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const tick = useCallback(async () => {
    const currentLobby = lobbyRef.current;
    if (!currentLobby || !currentLobby.timerStart || currentLobby.status !== 'drafting' || currentLobby.phase === 'finished' || currentLobby.phase === 'post_draft') {
      setTimeLeft(null);
      isProcessing.current = false;
      lastTriggeredTurn.current = null;
      return;
    }

    if (currentLobby.isPaused) {
      setTimeLeft(currentLobby.pausedTimeLeft ?? null);
      return;
    }

    if (isProcessing.current) return;

    // Retry logic: If we triggered for this turn but it failed (turn hasn't changed), 
    // allow retry after 5 seconds to prevent permanent stall.
    const nowMs = Date.now();
    if (lastTriggeredTurn.current === currentLobby.turn && (nowMs - lastTriggerAt.current) < 5000) {
      return;
    }

    let startTime: number;
    if (typeof currentLobby.timerStart === 'string') {
      startTime = new Date(currentLobby.timerStart).getTime();
    } else if (currentLobby.timerStart && typeof (currentLobby.timerStart as any).toMillis === 'function') {
      startTime = (currentLobby.timerStart as any).toMillis();
    } else {
      startTime = Date.now();
    }

    const nowServer = getServerTime();
    const elapsed = (nowServer - startTime) / 1000;
    const duration = currentLobby.config.timerDuration || 60;
    const remaining = Math.max(0, duration - Math.floor(elapsed));
    setTimeLeft(remaining);
    
    if (elapsed >= duration) {
      isProcessing.current = true;
      lastTriggerAt.current = nowMs;
      
      if (currentLobby.phase === 'god_picker') {
        if (!handlePickerAction) {
          isProcessing.current = false;
          return;
        }
        
        // In god_picker, BOTH can pick. 
        // We try to pick for OURSELVES first. 
        // If it's been duration+2 and opponent hasn't picked, handlePickerAction will also try for them in the service.
        const myTeam = isCaptain1 ? 'A' : isCaptain2 ? 'B' : null;
        const myVote = isCaptain1 ? currentLobby.pickerVoteA : currentLobby.pickerVoteB;
        const opponentVote = isCaptain1 ? currentLobby.pickerVoteB : currentLobby.pickerVoteA;
        
        // If I already picked AND the opponent already picked, or it's not even my turn to help...
        if (myVote && (opponentVote || elapsed < duration + 2)) {
          isProcessing.current = false;
          return;
        }

        const teamAGods = currentLobby.picks.filter(p => p.team === 'A' && p.godId).map(p => p.godId!);
        const teamBGods = currentLobby.picks.filter(p => p.team === 'B' && p.godId).map(p => p.godId!);
        const usedGodsA = currentLobby.history.map(h => h.picksA[0]).filter(Boolean);
        const usedGodsB = currentLobby.history.map(h => h.picksB[0]).filter(Boolean);

        const isCascaGroup = currentLobby.config.preset === 'CASCA' && currentLobby.config.tournamentStage === 'GROUP';
        
        // Decide which team god pool to use (if picking for self or helping opponent)
        const teamToPickFor = !myVote ? myTeam : (isCaptain1 ? 'B' : 'A');
        
        const myGodPool = isCascaGroup 
          ? MAJOR_GODS.filter(g => !currentLobby.config.allowedPantheons || currentLobby.config.allowedPantheons.length === 0 || currentLobby.config.allowedPantheons.includes(g.id)).map(g => g.id)
          : (teamToPickFor === 'A' ? teamAGods : teamBGods);
        
        const myUsedGods = isCascaGroup ? [] : (teamToPickFor === 'A' ? usedGodsA : usedGodsB);
        const availableGods: string[] = myGodPool.filter(id => !myUsedGods.includes(id));

        if (availableGods.length > 0) {
          lastTriggeredTurn.current = currentLobby.turn; 
          const shuffled = shuffle(availableGods);
          const randomGod = shuffled[0];
          try {
            await handlePickerAction(randomGod, undefined, undefined, { isRandom: true });
          } finally {
            isProcessing.current = false;
          }
        } else {
          isProcessing.current = false;
        }
        return;
      }

      const currentTurn = currentLobby.turnOrder[currentLobby.turn];
      if (!currentTurn) {
        isProcessing.current = false;
        return;
      }

      const isC1Turn = currentTurn.player === 'A' || currentTurn.player === 'BOTH';
      const isC2Turn = currentTurn.player === 'B' || currentTurn.player === 'BOTH';
      
      const isMyTurn = (isC1Turn && isCaptain1) || (isC2Turn && isCaptain2);
      const isOpponentTurn = (isC1Turn && isCaptain2) || (isC2Turn && isCaptain1);
      
      const shouldTrigger = isMyTurn || (isOpponentTurn && elapsed >= duration + 2);
      if (!shouldTrigger) {
        isProcessing.current = false;
        return;
      }

      lastTriggeredTurn.current = currentLobby.turn;

      if (currentTurn.action === 'REVEAL') {
        try {
          await handleAction('REVEAL');
        } finally {
          isProcessing.current = false;
        }
        return;
      }

      let actionId = '';
      if (currentTurn.target === 'MAP') {
        const availableMaps = MAPS.filter(m => 
          currentLobby.config.allowedMaps.includes(m.id) && 
          !currentLobby.mapBans.includes(m.id) && 
          !currentLobby.seriesMaps.includes(m.id)
        );
        if (availableMaps.length > 0) {
          const shuffled = shuffle(availableMaps);
          actionId = shuffled[0].id;
        }
      } else if (currentTurn.target === 'GOD') {
        const availableGods = MAJOR_GODS.filter(g => {
          const isAllowed = !currentLobby.config.allowedPantheons || 
                            currentLobby.config.allowedPantheons.length === 0 || 
                            currentLobby.config.allowedPantheons.includes(g.id) ||
                            currentLobby.config.allowedPantheons.includes(g.culture);
          const isBanned = currentLobby.bans.includes(g.id);
          const isPicked = currentLobby.picks.some(p => p.godId === g.id);
          const actingTeam = currentTurn.player === 'A' ? 'A' : (currentTurn.player === 'B' ? 'B' : (isCaptain1 ? 'A' : 'B'));
          const isPickedByMyTeam = currentLobby.picks.some(p => p.team === actingTeam && p.godId === g.id);
          
          if (!isAllowed || isBanned || isPickedByMyTeam) return false;
          if (currentLobby.config.isExclusive && isPicked) return false;
          return true;
        });
        if (availableGods.length > 0) {
          const shuffled = shuffle(availableGods);
          actionId = shuffled[0].id;
        }
      }

      if (actionId) {
        try {
          if (currentLobby.config.preset === 'MCL' && currentTurn.target === 'GOD' && currentTurn.action === 'PICK') {
            const team = currentTurn.player === 'A' ? 'A' : (currentTurn.player === 'B' ? 'B' : (isCaptain1 ? 'A' : 'B'));
            const teamPlayers = team === 'A' ? currentLobby.teamAPlayers : currentLobby.teamBPlayers;
            const emptyPick = currentLobby.picks.find(p => p.team === team && p.godId === null);
            
            if (emptyPick) {
              const assignedPlayerNames = currentLobby.picks.filter(p => p.team === team && p.godId !== null).map(p => p.playerName);
              const availablePlayers = teamPlayers?.filter(tp => !assignedPlayerNames.includes(tp.name)) || [];
              const randomPlayer = availablePlayers.length > 0 
                ? availablePlayers[Math.floor(Math.random() * availablePlayers.length)] 
                : { name: `Player ${emptyPick.playerId}` };
                
              await handleAction(actionId, emptyPick.playerId, randomPlayer.name, { isRandom: true });
            } else {
              await handleAction(actionId, undefined, undefined, { isRandom: true });
            }
          } else {
            await handleAction(actionId, undefined, undefined, { isRandom: true });
          }
        } finally {
          isProcessing.current = false;
        }
      } else {
        isProcessing.current = false;
      }
    }
  }, [handleAction, handlePickerAction, isCaptain1, isCaptain2]);

  // Initial setup for Worker-based timer to handle background tabs
  useEffect(() => {
    const workerCode = `
      let timer = null;
      self.onmessage = (e) => {
        if (e.data === 'start') {
          if (timer) clearInterval(timer);
          timer = setInterval(() => postMessage('tick'), 1000);
        } else if (e.data === 'stop') {
          clearInterval(timer);
          timer = null;
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = () => tick();
    worker.postMessage('start');
    workerRef.current = worker;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick(); // Force immediate check when returning to tab
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      worker.postMessage('stop');
      worker.terminate();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tick]);

  return { timeLeft };
}
