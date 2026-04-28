import { useState, useEffect, useCallback, useMemo } from 'react';
import { draftService } from '../services/draftService';
import { lobbyService } from '../services/lobbyService';
import { Lobby, LobbyConfig, DraftTurn, TeamSize, PickEntry, SeriesType, Substitution } from '../types';
import { MAPS, MAJOR_GODS, PLAYER_COLORS, MCL_ROUND_MAPS } from '../constants';
import { serverTimestamp } from 'firebase/firestore';

export function useDraft(
  lobby: Lobby | null, 
  isCaptain1: boolean, 
  isCaptain2: boolean, 
  guestId: string, 
  lang: 'en' | 'pt'
) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimisticReady, setOptimisticReady] = useState<boolean | null>(null);
  const [optimisticAction, setOptimisticAction] = useState<{ id: string, type: 'pick' | 'ban' | 'map_pick' | 'map_ban', playerId?: number, playerName?: string } | null>(null);

  // Sync optimistic state with lobby
  useEffect(() => {
    if (!lobby) return;
    
    // If we moved out of waiting/ready phases, clear optimistic state
    if (lobby.phase !== 'waiting' && lobby.phase !== 'ready' && lobby.phase !== 'finished' && lobby.phase !== 'ready_picker') {
      if (optimisticReady !== null) setOptimisticReady(null);
      return;
    }

    const isGame1Ready = lobby.currentGame === 1 && (lobby.status === 'waiting' || lobby.phase === 'ready' || lobby.phase === 'waiting');
    const isReadyWaitPhase = isGame1Ready || lobby.phase === 'ready_picker';

    const currentReady = isReadyWaitPhase
      ? (isCaptain1 ? lobby.readyA : lobby.readyB)
      : (isCaptain1 ? lobby.readyA_nextGame : lobby.readyB_nextGame);

    if (optimisticReady !== null && currentReady === optimisticReady) {
      setOptimisticReady(null);
    }
  }, [lobby, isCaptain1, isCaptain2, optimisticReady]);

  // Clear optimistic action when lobby updates to match or phase changes
  useEffect(() => {
    if (!lobby || !optimisticAction) return;
    
    let resolved = false;
    if (optimisticAction.type === 'pick') {
      resolved = lobby.picks.some(p => p.godId === optimisticAction.id);
    } else if (optimisticAction.type === 'ban') {
      resolved = lobby.bans.includes(optimisticAction.id);
    } else if (optimisticAction.type === 'map_pick') {
      resolved = lobby.selectedMap === optimisticAction.id;
    } else if (optimisticAction.type === 'map_ban') {
      resolved = lobby.mapBans.includes(optimisticAction.id);
    }

    if (resolved) setOptimisticAction(null);
  }, [lobby, optimisticAction]);

  const generateStandardTurnOrder = useCallback((cfg: LobbyConfig, gameNumber: number = 1, lastWinner: 'A' | 'B' | null = null): { mapOrder: DraftTurn[], godOrder: DraftTurn[] } => {
    // If custom turn orders are provided in the config, use them
    if (cfg.mapTurnOrder && cfg.mapTurnOrder.length > 0 && cfg.godTurnOrder && cfg.godTurnOrder.length > 0) {
      return { mapOrder: cfg.mapTurnOrder, godOrder: cfg.godTurnOrder };
    }

    const mapOrder: DraftTurn[] = [];
    const godOrder: DraftTurn[] = [];
    
    // Special Case: Casca Grossa Group Stage (Always BO1, Random Map)
    if (cfg.preset === 'CASCA' && cfg.tournamentStage === 'GROUP') {
      if (gameNumber === 1) {
        mapOrder.push({ player: 'ADMIN', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
      }
      return { mapOrder, godOrder: [] };
    }

    // Special Case: Casca Grossa Playoffs
    if (cfg.preset === 'CASCA' && cfg.tournamentStage === 'PLAYOFFS') {
      if (gameNumber === 1) {
        // 4 Map Bans (1-1-1-1)
        for (let i = 0; i < 2; i++) {
          mapOrder.push({ player: 'A', action: 'BAN', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
          mapOrder.push({ player: 'B', action: 'BAN', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
        }
        
        // Map Picks for Pool (Alternating)
        const gameCount = cfg.seriesType === 'BO3' ? 3 : 
                          cfg.seriesType === 'BO5' ? 5 : 
                          cfg.seriesType === 'BO7' ? 7 : 
                          (cfg.customGameCount || 1);
        
        const picksPerTeam = Math.floor(gameCount / 2) + 1;
        for (let i = 0; i < picksPerTeam; i++) {
          mapOrder.push({ player: 'A', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
          mapOrder.push({ player: 'B', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
        }
        
        // System Picks G1
        mapOrder.push({ player: 'ADMIN', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
      }
    } else if (cfg.preset === 'MCL') {
      if (gameNumber === 1) {
        mapOrder.push({ player: 'A', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
      } else if (gameNumber === 2) {
        mapOrder.push({ player: 'B', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
      }
      // God picks happen every game in MCL
    } else if (cfg.seriesType !== 'BO1') {
      // Standard Series Logic (BO3, BO5, etc.)
      
      // Map logic only happens if we don't have a map yet
      // For Game 1, we might have bans and a pick
      if (gameNumber === 1) {
        for (let i = 0; i < cfg.mapBanCount; i++) {
          mapOrder.push({ player: 'A', action: 'BAN', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
          mapOrder.push({ player: 'B', action: 'BAN', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
        }

        if (cfg.loserPicksNextMap) {
          if (cfg.firstMapRandom) {
            mapOrder.push({ player: 'ADMIN', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
          } else {
            mapOrder.push({ player: 'A', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
          }
        } else {
          // If not loser picks, we might pick multiple maps upfront
          const gameCount = cfg.seriesType === 'BO3' ? 3 : 
                            cfg.seriesType === 'BO5' ? 5 : 
                            cfg.seriesType === 'BO7' ? 7 : 
                            cfg.seriesType === 'BO9' ? 9 : 
                            (cfg.customGameCount || 1);
          
          const playerPicks = gameCount - 1;
          for (let i = 0; i < playerPicks; i++) {
            const player = i % 2 === 0 ? 'A' : 'B';
            mapOrder.push({ player, action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
          }
          mapOrder.push({ player: 'ADMIN', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
        }
      } else {
        // For Game 2+, if loserPicksNextMap is on, they pick now
        if (cfg.loserPicksNextMap) {
          // This is handled in reportScore by adding a single map pick turn
          // So we leave mapOrder empty here
        }
      }
    } else {
      // BO1 Logic
      if (gameNumber === 1) {
        for (let i = 0; i < cfg.mapBanCount; i++) {
          mapOrder.push({ player: 'A', action: 'BAN', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
          mapOrder.push({ player: 'B', action: 'BAN', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
        }
        if (cfg.firstMapRandom) {
          mapOrder.push({ player: 'ADMIN', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
        } else {
          mapOrder.push({ player: 'A', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
        }
      }
    }

    // God Pick Logic
    // In 1v1, we usually draft all gods in Game 1
    if (cfg.teamSize === 1 && gameNumber > 1) {
      return { mapOrder, godOrder: [] };
    }

    if (cfg.acePick) {
      if (cfg.acePickHidden) {
        godOrder.push({ player: 'A', action: 'PICK', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'HIDDEN' });
        godOrder.push({ player: 'B', action: 'PICK', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'HIDDEN' });
        godOrder.push({ player: 'ADMIN', action: 'REVEAL', target: 'GOD', modifier: 'NONEXCLUSIVE', execution: 'NORMAL' });
      } else {
        godOrder.push({ player: 'A', action: 'PICK', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'NORMAL' });
        godOrder.push({ player: 'B', action: 'PICK', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'NORMAL' });
      }
    }

    // MCL Game 2 starts with Team B. Game 3 starts with loser of Game 2.
    const startsWithB = (cfg.preset === 'MCL' && gameNumber === 2) || 
                        (cfg.preset === 'MCL' && gameNumber > 2 && lastWinner === 'A');

    if (cfg.hasBans) {
      if (cfg.preset === 'CASCA') {
        if (cfg.tournamentStage !== 'GROUP') {
          for (let i = 0; i < cfg.banCount; i++) {
            godOrder.push({ player: startsWithB ? 'B' : 'A', action: 'BAN', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'NORMAL' });
            godOrder.push({ player: startsWithB ? 'A' : 'B', action: 'BAN', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'NORMAL' });
          }
        }
      } else {
        for (let i = 0; i < cfg.banCount; i++) {
          godOrder.push({ player: startsWithB ? 'B' : 'A', action: 'BAN', target: 'GOD', modifier: cfg.isExclusive ? 'EXCLUSIVE' : 'GLOBAL', execution: 'NORMAL' });
          godOrder.push({ player: startsWithB ? 'A' : 'B', action: 'BAN', target: 'GOD', modifier: cfg.isExclusive ? 'EXCLUSIVE' : 'GLOBAL', execution: 'NORMAL' });
        }
      }
    }

    let picksPerTeam = cfg.teamSize;
    if (cfg.teamSize === 1) {
      const gameCount = cfg.seriesType === 'BO3' ? 3 : 
                        cfg.seriesType === 'BO5' ? 5 : 
                        cfg.seriesType === 'BO7' ? 7 : 
                        cfg.seriesType === 'BO9' ? 9 : 
                        (cfg.customGameCount || 1);
      if (gameCount > 1) {
        picksPerTeam = gameCount + 1;
      }
    }

    const finalPicksPerTeam = picksPerTeam - (cfg.acePick ? 1 : 0);
    if (finalPicksPerTeam > 0 && !(cfg.preset === 'CASCA' && cfg.tournamentStage === 'GROUP')) {
      if (cfg.pickType === 'alternated') {
        let remainingA = finalPicksPerTeam;
        let remainingB = finalPicksPerTeam;
        let turn = 0;
        
        while (remainingA > 0 || remainingB > 0) {
          const isTeamA = (turn % 2 === 0) !== startsWithB;
          let maxCount = 2;
          if (turn === 0) maxCount = 1;
          const count = Math.min(maxCount, isTeamA ? remainingA : remainingB);
          
          if (count > 0) {
            for (let i = 0; i < count; i++) {
              godOrder.push({ 
                player: isTeamA ? 'A' : 'B', 
                action: 'PICK', 
                target: 'GOD', 
                modifier: cfg.isExclusive ? 'EXCLUSIVE' : 'NONEXCLUSIVE', 
                execution: 'NORMAL' 
              });
              if (isTeamA) remainingA--;
              else remainingB--;
            }
          }
          turn++;
        }
      } else {
        const totalPicks = finalPicksPerTeam * 2;

        for (let i = 0; i < totalPicks; i++) {
          const isTeamA = (i % 2 === 0) !== startsWithB;
          const player = isTeamA ? 'A' : 'B';
          godOrder.push({ 
            player, 
            action: 'PICK', 
            target: 'GOD', 
            modifier: cfg.isExclusive ? 'EXCLUSIVE' : 'NONEXCLUSIVE', 
            execution: cfg.pickType === 'blind' ? 'HIDDEN' : 'NORMAL' 
          });
        }
      }
    }

    if (cfg.pickType === 'blind') {
      godOrder.push({ player: 'ADMIN', action: 'REVEAL', target: 'GOD', modifier: 'NONEXCLUSIVE', execution: 'NORMAL' });
    }

    return { mapOrder, godOrder };
  }, []);

  const handleAction = useCallback(async (actionIdArg: any, playerId?: number, playerName?: string, options?: { isRandom?: boolean }) => {
    if (!lobby || isProcessing) return;
    
    if (typeof actionIdArg !== 'string') return;
    const actionId = actionIdArg;

    // Set optimistic state
    if (lobby.phase === 'god_pick') {
      setOptimisticAction({ id: actionId, type: 'pick', playerId, playerName });
    } else if (lobby.phase === 'god_ban') {
      setOptimisticAction({ id: actionId, type: 'ban', playerId, playerName });
    } else if (lobby.phase === 'map_pick') {
      setOptimisticAction({ id: actionId, type: 'map_pick' });
    } else if (lobby.phase === 'map_ban') {
      setOptimisticAction({ id: actionId, type: 'map_ban' });
    }

    setIsProcessing(true);
    try {
      const result = await draftService.handleAction(lobby, actionId, isCaptain1, isCaptain2, playerId, playerName, options);
      if (!result.success) {
        if (result.error !== "Not your turn") {
          setError(result.error || "Action failed");
        }
        setOptimisticAction(null);
      }
    } catch (e) {
      setOptimisticAction(null);
      throw e;
    } finally {
      setIsProcessing(false);
    }
  }, [lobby, isCaptain1, isCaptain2, isProcessing]);

  const reportScore = useCallback(async (winner: 'A' | 'B' | null) => {
    if (!lobby) return;
    const result = await draftService.reportScore(lobby, winner, isCaptain1, isCaptain2, (cfg, gn, lw) => generateStandardTurnOrder(cfg, gn, lw));
    if (!result.success) {
      setError(result.error || "Report failed");
    }
  }, [lobby, isCaptain1, isCaptain2, generateStandardTurnOrder]);

  const resetVotes = useCallback(async () => {
    if (!lobby || (!isCaptain1 && !isCaptain2)) return;
    await draftService.resetVotes(lobby.id);
  }, [lobby, isCaptain1, isCaptain2]);

  const handleReady = useCallback(async (isReadyArg?: any) => {
    if (!lobby || isProcessing) return;
    if (!isCaptain1 && !isCaptain2) return; // Spectators cannot set ready
    
    // Force boolean. If it's an event or undefined, default to true.
    // If it's explicitly false, keep it false (for unready).
    const isReady = isReadyArg === false ? false : true;
    
    setOptimisticReady(isReady);
    setIsProcessing(true);
    try {
      const team = isCaptain1 ? 'A' : 'B';
      await lobbyService.setReady(lobby.id, team, isReady, guestId, generateStandardTurnOrder);
    } catch (err: any) {
      console.error("Ready action failed:", err);
      setOptimisticReady(null); // Clear optimistic state on error
      setError("Failed to set ready. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [lobby, isCaptain1, isCaptain2, guestId, generateStandardTurnOrder, isProcessing]);

  const handlePickerAction = useCallback(async (godIdArg: any, playerId?: number, playerName?: string, options?: { isRandom?: boolean }) => {
    if (!lobby || isProcessing) return;
    
    // Ensure godId is a string.
    if (typeof godIdArg !== 'string') return;
    const godId = godIdArg;

    setOptimisticAction({ id: godId, type: 'pick', playerId, playerName });
    setIsProcessing(true);
    try {
      const result = await draftService.handlePickerAction(lobby, godId, playerId, isCaptain1, isCaptain2, options);
      if (!result.success) {
        if (result.error !== "Not your turn") {
          setError(result.error || "Picker action failed");
        }
        setOptimisticAction(null);
      }
    } catch (e) {
      setOptimisticAction(null);
      throw e;
    } finally {
      setIsProcessing(false);
    }
  }, [lobby, isCaptain1, isCaptain2, isProcessing]);

  const updateRoster = useCallback(async (newPicks: PickEntry[], subs: Substitution[]) => {
    if (!lobby) return;
    if (!isCaptain1 && !isCaptain2) return; // Spectators cannot update roster
    const team = isCaptain1 ? 'A' : 'B';
    const result = await draftService.updateRoster(lobby, team, newPicks, subs, isCaptain1, isCaptain2);
    if (!result.success) {
      setError(result.error || "Roster update failed");
    }
  }, [lobby, isCaptain1]);

  const requestReset = useCallback(async () => {
    if (!lobby) return;
    const team = isCaptain1 ? 'A' : 'B';
    await lobbyService.requestReset(lobby.id, team);
  }, [lobby, isCaptain1]);

  const respondReset = useCallback(async (accept: boolean) => {
    if (!lobby) return;
    await lobbyService.respondReset(lobby.id, accept);
  }, [lobby]);

  const clearSubs = useCallback(async () => {
    if (!lobby || !isCaptain1) return;
    await lobbyService.updateLobby(lobby.id, { lastSubs: [] });
  }, [lobby, isCaptain1]);

  // Handle Auto-resolution of scores
  useEffect(() => {
    if (!lobby || lobby.phase !== 'reporting' || !lobby.reportStartAt) return;
    if (!isCaptain1) return; // Only host handles the auto-resolve check to avoid duplicate calls

    const checkAutoResolve = () => {
      const start = new Date(lobby.reportStartAt!).getTime();
      const now = new Date().getTime();
      const diff = (now - start) / 1000;

      if (diff >= 180) { // 3 minutes
        const voteA = lobby.reportVoteA;
        const voteB = lobby.reportVoteB;

        // If only one voted, resolve with that vote
        if (voteA && !voteB) {
          reportScore(voteA);
        } else if (!voteA && voteB) {
          reportScore(voteB);
        }
      }
    };

    const interval = setInterval(checkAutoResolve, 5000);
    return () => clearInterval(interval);
  }, [lobby, isCaptain1, reportScore]);

  // Handle ADMIN turns and Revealing phase
  useEffect(() => {
    if (!lobby || lobby.status !== 'drafting') return;

    if (lobby.phase === 'revealing') {
      if (!isCaptain1) return;
      const timeout = setTimeout(async () => {
        await lobbyService.updateLobby(lobby.id, { phase: 'post_draft', timerStart: null });
      }, 4000); // 4 seconds reveal delay
      return () => clearTimeout(timeout);
    }

    const picks = Array.isArray(lobby.picks) ? lobby.picks : [];
    const bans = Array.isArray(lobby.bans) ? lobby.bans : [];
    const mapBans = Array.isArray(lobby.mapBans) ? lobby.mapBans : [];
    const turnOrder = Array.isArray(lobby.turnOrder) ? lobby.turnOrder : [];
    const seriesMaps = Array.isArray(lobby.seriesMaps) ? lobby.seriesMaps : [];
    const mapPool = Array.isArray(lobby.mapPool) ? lobby.mapPool : [];

    const currentTurn = turnOrder[lobby.turn];
    if (!currentTurn || currentTurn.player !== 'ADMIN') return;
    if (!isCaptain1) return;

    const timeout = setTimeout(() => {
      if (currentTurn.target === 'MAP') {
        if (currentTurn.action === 'PICK' || currentTurn.action === 'BAN') {
          const allowedMaps = lobby.config.allowedMaps && lobby.config.allowedMaps.length > 0 
            ? lobby.config.allowedMaps 
            : MAPS.map(m => m.id);

          const availableMaps = MAPS.filter(m => 
            allowedMaps.includes(m.id) && 
            !mapBans.includes(m.id) && 
            !seriesMaps.includes(m.id) &&
            !(lobby.config.preset === 'CASCA' && lobby.config.tournamentStage === 'PLAYOFFS' && mapPool.includes(m.id))
          );
          if (availableMaps.length > 0) {
            const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];
            handleAction(randomMap.id);
          }
        }
      } else if (currentTurn.target === 'GOD') {
        if (currentTurn.action === 'PICK' || currentTurn.action === 'BAN') {
          const availableGods = MAJOR_GODS.filter(g => 
            !bans.includes(g.id) && 
            (currentTurn.modifier === 'GLOBAL' || !picks.some(p => p.godId === g.id))
          );
          if (availableGods.length > 0) {
            const randomGod = availableGods[Math.floor(Math.random() * availableGods.length)];
            handleAction(randomGod.id);
          }
        } else if (currentTurn.action === 'REVEAL') {
          handleAction('REVEAL');
        }
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [lobby, isCaptain1, handleAction]);

  return {
    error,
    setError,
    loading,
    handleAction,
    handlePickerAction,
    reportScore,
    resetVotes,
    handleReady,
    isProcessing,
    optimisticReady,
    optimisticAction,
    generateStandardTurnOrder,
    updateRoster,
    requestReset,
    respondReset,
    clearSubs
  };
}
