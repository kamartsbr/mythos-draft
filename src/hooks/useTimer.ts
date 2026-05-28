import { useState, useEffect, useRef, useCallback } from 'react';
import { Lobby, DraftActionOptions } from '../types';
import { MAPS, MAJOR_GODS } from '../constants';
import { getServerTime } from '../lib/serverTime';

/**
 * Manage and expose the lobby draft countdown and trigger automatic draft actions when the timer elapses.
 *
 * When a drafting timer is active, keeps `timeLeft` synchronized (including across background tabs) and automatically
 * submits picks, bans, reveals, or god-picker selections according to lobby state and turn rules.
 *
 * @param lobby - Current lobby or `null`; no timer runs when the lobby is absent or not in an active drafting state.
 * @param isCaptain1 - True when the caller represents captain A.
 * @param isCaptain2 - True when the caller represents captain B.
 * @param handleAction - Callback to submit non-god-picker draft actions. When invoked for automatic choices, `options.isRandom` is set.
 * @param handlePickerAction - Optional callback used only during the `god_picker` phase; called similarly to `handleAction` when an automatic god pick is made.
 * @returns `timeLeft` — seconds remaining on the active draft timer, or `null` when no valid timer is available.
 */
export function useTimer(
  lobby: Lobby | null, 
  isCaptain1: boolean, 
  isCaptain2: boolean, 
  handleAction: (id: string, playerId?: number, playerName?: string, options?: DraftActionOptions) => void,
  handlePickerAction?: (id: string, playerId?: number, playerName?: string, options?: DraftActionOptions) => void
) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const isProcessing = useRef(false);
  const lastTriggeredTurn = useRef<number | null>(null);
  const lastTriggerAt = useRef<number>(0);
  const lastGameChangeAt = useRef<number>(0);
  const workerRef = useRef<Worker | null>(null);
  const lobbyRef = useRef(lobby);

  // Keep lobbyRef in sync for the interval without re-subscribing useEffect unnecessarily
  useEffect(() => {
    if (lobby?.currentGame !== lobbyRef.current?.currentGame) {
      lastGameChangeAt.current = Date.now();
    }
    lobbyRef.current = lobby;
  }, [lobby]);

  useEffect(() => {
    // Reset internal timer state whenever the currentGame changes
    // This prevents "leaking" timer artifacts or trigger states from previous games
    lastTriggeredTurn.current = null;
    isProcessing.current = false;
    setTimeLeft(null);
  }, [lobby?.currentGame]);

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
    if (!currentLobby || (!currentLobby.timerStart && !currentLobby.turnEndsAt) || currentLobby.status !== 'drafting' || currentLobby.phase === 'finished' || currentLobby.phase === 'post_draft' || currentLobby.phase === 'ready') {
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

    if (isProcessing.current) return;

    // Retry logic: If we triggered for this turn but it failed (turn hasn't changed), 
    // allow retry after 5 seconds to prevent permanent stall.
    if (lastTriggeredTurn.current === currentLobby.turn && (nowMs - lastTriggerAt.current) < 5000) {
      return;
    }

    // 🔥 SOLUÇÃO: Timer Absoluto (Sincronização Perfeita)
    // Usamos o 'turnEndsAt' persistido no Firestore como fonte única da verdade.
    let endTime: number;
    const tea = currentLobby.turnEndsAt;
    
    if (tea && typeof (tea as any).toMillis === 'function') {
      endTime = (tea as any).toMillis();
    } else if (tea && typeof (tea as any).toDate === 'function') {
      endTime = (tea as any).toDate().getTime();
    } else if (typeof tea === 'number') {
      endTime = tea < 10000000000 ? tea * 1000 : tea;
    } else {
      // Fallback para lógica antiga caso turnEndsAt não exista (migração)
      let startTime: number;
      const ts = currentLobby.timerStart;
      if (ts && typeof (ts as any).toMillis === 'function') {
        startTime = (ts as any).toMillis();
      } else if (typeof ts === 'number') {
        startTime = ts < 10000000000 ? ts * 1000 : ts;
      } else {
        startTime = Date.now();
      }
      const duration = currentLobby.config?.timerDuration || 60;
      endTime = startTime + (duration * 1000);
    }

    const duration = currentLobby.config?.timerDuration || 60;
    const nowServer = await getServerTime();
    const remaining = Math.max(0, Math.floor((endTime - nowServer) / 1000));
    const elapsed = Math.max(0, (nowServer - (endTime - (duration * 1000))) / 1000);

    // Protection: if the calculated time is suspiciously large (e.g. > 1 hour),
    // it likely indicates a clock sync issue or a corrupted timestamp.
    if (remaining > 3600 || isNaN(remaining)) {
      setTimeLeft(null);
    } else {
      setTimeLeft(remaining);
    }

    if (isProcessing.current) return;

    // Retry logic: If we triggered for this turn but it failed (turn hasn't changed), 
    // allow retry after 5 seconds to prevent permanent stall.
    if (lastTriggeredTurn.current === currentLobby.turn && (nowMs - lastTriggerAt.current) < 5000) {
      return;
    }

    // Debounce: prevent actions immediately after game change
    if ((nowMs - lastGameChangeAt.current) < 2000) {
      return;
    }
    
    const shouldTimeoutNow = remaining === 0 || elapsed >= duration;

    if (shouldTimeoutNow) {
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
        if (myVote && opponentVote) {
          isProcessing.current = false;
          return;
        }

        const picks = Array.isArray(currentLobby.picks) ? currentLobby.picks : [];
        const history = Array.isArray(currentLobby.history) ? currentLobby.history : [];

        const teamAGods = picks.filter(p => p.team === 'A' && p.godId).map(p => p.godId!);
        const teamBGods = picks.filter(p => p.team === 'B' && p.godId).map(p => p.godId!);
        const usedGodsA = history.map(h => (h.picksA && h.picksA[0]) ? h.picksA[0] : null).filter(Boolean);
        const usedGodsB = history.map(h => (h.picksB && h.picksB[0]) ? h.picksB[0] : null).filter(Boolean);

        const teamToPickFor = !myVote ? myTeam : (isCaptain1 ? 'B' : 'A');
        
        const myGodPool = (teamToPickFor === 'A' ? teamAGods : teamBGods);
        const myUsedGods = (teamToPickFor === 'A' ? usedGodsA : usedGodsB);
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

      if (currentTurn.player === 'ADMIN') {
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
          await handleAction('REVEAL', undefined, undefined, { isTimeoutAutoResolve: true });
        } finally {
          isProcessing.current = false;
        }
        return;
      }

      let actionId = '';
      if (currentTurn.target === 'MAP') {
        const allowedMaps = Array.isArray(currentLobby.config.allowedMaps) && currentLobby.config.allowedMaps.length > 0 
          ? currentLobby.config.allowedMaps 
          : MAPS.map(m => m.id);
          
        const mapBans = Array.isArray(currentLobby.mapBans) ? currentLobby.mapBans : [];
        const seriesMaps = Array.isArray(currentLobby.seriesMaps) ? currentLobby.seriesMaps : [];
        const mapPool = Array.isArray(currentLobby.mapPool) ? currentLobby.mapPool : [];

        const availableMaps = MAPS.filter(m => 
          allowedMaps.includes(m.id) && 
          !mapBans.includes(m.id) && 
          !seriesMaps.includes(m.id)
        );
        if (availableMaps.length > 0) {
          const shuffled = shuffle(availableMaps);
          actionId = shuffled[0].id;
        }
      } else if (currentTurn.target === 'GOD') {
        const allowedPantheons = Array.isArray(currentLobby.config.allowedPantheons) ? currentLobby.config.allowedPantheons : [];
        const bans = Array.isArray(currentLobby.bans) ? currentLobby.bans : [];
        const picks = Array.isArray(currentLobby.picks) ? currentLobby.picks : [];

        const availableGods = MAJOR_GODS.filter(g => {
          const isAllowed = allowedPantheons.length === 0 || 
                            allowedPantheons.some(p => p.toLowerCase() === g.id.toLowerCase()) ||
                            allowedPantheons.some(p => p.toLowerCase() === g.culture.toLowerCase());
          const isBanned = bans.includes(g.id);
          const isPicked = picks.some(p => p.godId === g.id);
          const actingTeam = currentTurn.player === 'A' ? 'A' : (currentTurn.player === 'B' ? 'B' : (isCaptain1 ? 'A' : 'B'));
          const isPickedByMyTeam = picks.some(p => p.team === actingTeam && p.godId === g.id);
          
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
          const isPresetWithRoster = currentLobby.config.preset === 'MCL' || currentLobby.config.preset === 'FORJA' || currentLobby.config.preset === 'MCL_PLAYOFFS' || currentLobby.config.preset === 'MCL_TIEBREAKER';
          if (isPresetWithRoster && currentTurn.target === 'GOD' && currentTurn.action === 'PICK') {
            const team = currentTurn.player === 'A' ? 'A' : (currentTurn.player === 'B' ? 'B' : (isCaptain1 ? 'A' : 'B'));
            const teamPlayers = team === 'A' ? currentLobby.teamAPlayers : currentLobby.teamBPlayers;
            const emptyPick = currentLobby.picks.find(p => p.team === team && p.godId === null);
            
            if (emptyPick) {
              const assignedPlayerNames = currentLobby.picks.filter(p => p.team === team && p.godId !== null).map(p => p.playerName).filter(Boolean);
              const availablePlayers = teamPlayers?.filter(tp => tp.name && !assignedPlayerNames.includes(tp.name)) || [];
              const randomPlayer = availablePlayers.length > 0 
                ? availablePlayers[Math.floor(Math.random() * availablePlayers.length)] 
                : { name: `Player ${emptyPick.playerId}` };
                
              await handleAction(actionId, emptyPick.playerId, randomPlayer.name, { isRandom: true, isTimeoutAutoResolve: true });
            } else {
              await handleAction(actionId, undefined, undefined, { isRandom: true, isTimeoutAutoResolve: true });
            }
          } else {
            await handleAction(actionId, undefined, undefined, { isRandom: true, isTimeoutAutoResolve: true });
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
