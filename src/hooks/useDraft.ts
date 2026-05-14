import { useState, useEffect, useCallback, useMemo } from 'react';
import { draftService } from '../services/draftService';
import { lobbyService, IS_DEV, isSoloAdminLobby } from '../services/lobbyService';
import { Lobby, LobbyConfig, DraftTurn, TeamSize, PickEntry, SeriesType, Substitution } from '../types';
import { MAPS, MAJOR_GODS, PLAYER_COLORS, MCL_ROUND_MAPS } from '../constants';
import { serverTimestamp } from 'firebase/firestore';

/**
 * Manage client-side draft state, permissions, optimistic updates, and actions for a lobby-based draft flow.
 *
 * Provides derived role flags, turn helpers, optimistic ready/action synchronization with lobby updates,
 * a generator for standard map/god turn orders, and action helpers that call underlying services.
 *
 * @returns An object with:
 *  - `error` / `setError`: current error message and setter.
 *  - `loading`: unused loading flag.
 *  - `handleAction`: perform a draft action (pick/ban/map pick/map ban) with optimistic state and in-flight protection.
 *  - `handlePickerAction`: perform a picker-originated pick with optimistic state.
 *  - `reportScore`: report match score and regenerate turn order when needed.
 *  - `resetVotes`: reset vote state for the lobby.
 *  - `handleReady`: set ready/unready for the caller's team with optimistic state.
 *  - `isProcessing`: whether an action is currently being processed.
 *  - `optimisticReady`: locally optimistic ready state (cleared when lobby confirms).
 *  - `optimisticAction`: locally optimistic action pending confirmation.
 *  - `generateStandardTurnOrder`: produce map and god draft turn orders from a lobby config, game number, and last winner.
 *  - `updateRoster`: update team roster (picks and substitutions).
 *  - `requestReset` / `respondReset`: request or respond to a lobby reset.
 *  - `clearSubs`: clear last substitution records (admin/host action).
 *  - `isMyTurn`: whether the current user (based on captain flags) has the current turn.
 *  - `myTeam`: the caller's inferred team (`'A' | 'B' | null`).
 */
export function useDraft(
  lobby: Lobby | null, 
  isCaptain1: boolean, 
  isCaptain2: boolean, 
  guestId: string, 
  lang: string
) {
  const isSoloAdmin = lobby ? isSoloAdminLobby(lobby) : false;
  const effectiveIsCaptain1 = IS_DEV || isSoloAdmin || isCaptain1;
  const effectiveIsCaptain2 = IS_DEV || isSoloAdmin || isCaptain2;
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimisticReady, setOptimisticReady] = useState<boolean | null>(null);
  const [optimisticAction, setOptimisticAction] = useState<{ id: string, type: 'pick' | 'ban' | 'map_pick' | 'map_ban', playerId?: number, playerName?: string } | null>(null);

  const currentTurn = lobby?.turnOrder?.[lobby?.turn || 0];

  const myTeam = useMemo(() => {
    if (!lobby || !currentTurn) return null;
    // In DEV Solo mode, assume the team is whichever is active, or default to 'A'
    if (IS_DEV && currentTurn.player !== 'BOTH') {
      return currentTurn.player === 'B' ? 'B' : 'A';
    }
    if (effectiveIsCaptain1) return 'A';
    if (effectiveIsCaptain2) return 'B';
    return null;
  }, [lobby, currentTurn, effectiveIsCaptain1, effectiveIsCaptain2]);

  const isMyTurn = useMemo(() => {
    if (!lobby || !currentTurn) return false;
    if (IS_DEV || isSoloAdmin) return true;
    if (currentTurn.player === 'BOTH') return true;
    if (effectiveIsCaptain1 && currentTurn.player === 'A') return true;
    if (effectiveIsCaptain2 && currentTurn.player === 'B') return true;
    return false;
  }, [lobby, currentTurn, effectiveIsCaptain1, effectiveIsCaptain2, isSoloAdmin]);

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
      ? (effectiveIsCaptain1 ? lobby.readyA : lobby.readyB)
      : (effectiveIsCaptain1 ? lobby.readyA_nextGame : lobby.readyB_nextGame);

    if (optimisticReady !== null && currentReady === optimisticReady) {
      setOptimisticReady(null);
    }
  }, [lobby, effectiveIsCaptain1, effectiveIsCaptain2, optimisticReady]);

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
    
    if (cfg.preset === 'MCL' || cfg.preset === 'FORJA') {
      if (gameNumber === 1) {
        mapOrder.push({ player: 'A', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
      } else if (gameNumber === 2) {
        mapOrder.push({ player: 'B', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
      } else if (gameNumber === 3 && (cfg.preset === 'FORJA' || cfg.hasMap3RandomRoll)) {
        // FORJA: Mapa 3 sempre sorteado pelo sistema (ADMIN turn)
        mapOrder.push({ player: 'ADMIN', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
      }
      // MCL puro: Mapa 3 é pré-determinado pelo round (seriesMaps[2] já está preenchido)
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

    // MCL / FORJA: Game 2 começa com B (Guest escolhe mapa e abre bans/picks).
    // Game 3: o PERDEDOR do G2 escolhe primeiro — se A ganhou G2, B (o perdedor) abre.
    const startsWithB =
      ((cfg.preset === 'MCL' || cfg.preset === 'FORJA') && gameNumber === 2) ||
      ((cfg.preset === 'MCL' || cfg.preset === 'FORJA') && gameNumber > 2 && lastWinner === 'A');

    if (cfg.hasBans) {
      for (let i = 0; i < cfg.banCount; i++) {
        godOrder.push({ player: startsWithB ? 'B' : 'A', action: 'BAN', target: 'GOD', modifier: cfg.isExclusive ? 'EXCLUSIVE' : 'GLOBAL', execution: 'NORMAL' });
        godOrder.push({ player: startsWithB ? 'A' : 'B', action: 'BAN', target: 'GOD', modifier: cfg.isExclusive ? 'EXCLUSIVE' : 'GLOBAL', execution: 'NORMAL' });
      }
    } else if (cfg.hasPerMapBans) {
      // FORJA Playoffs: 1 Ban de Deus por time antes dos picks em cada mapa
      godOrder.push({ player: startsWithB ? 'B' : 'A', action: 'BAN', target: 'GOD', modifier: 'GLOBAL', execution: 'NORMAL' });
      godOrder.push({ player: startsWithB ? 'A' : 'B', action: 'BAN', target: 'GOD', modifier: 'GLOBAL', execution: 'NORMAL' });
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
    if (finalPicksPerTeam > 0) {
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

  const handleAction = useCallback(async (actionIdArg: any, playerId?: number, playerName?: string, options?: { isRandom?: boolean; force?: boolean }) => {
    if (!lobby) return;
    if (isProcessing && !options?.force) return;
    
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
      const result = await draftService.handleAction(lobby, actionId, effectiveIsCaptain1, effectiveIsCaptain2, playerId, playerName, options);
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
  }, [lobby, effectiveIsCaptain1, effectiveIsCaptain2, isProcessing]);

  const reportScore = useCallback(async (winner: 'A' | 'B' | null) => {
    if (!lobby) return;
    const result = await draftService.reportScore(lobby, winner, effectiveIsCaptain1, effectiveIsCaptain2, (cfg, gn, lw) => generateStandardTurnOrder(cfg, gn, lw));
    if (!result.success) {
      setError(result.error || "Report failed");
    }
  }, [lobby, effectiveIsCaptain1, effectiveIsCaptain2, generateStandardTurnOrder]);

  const resetVotes = useCallback(async () => {
    if (!lobby || (!effectiveIsCaptain1 && !effectiveIsCaptain2)) return;
    await draftService.resetVotes(lobby.id);
  }, [lobby, effectiveIsCaptain1, effectiveIsCaptain2]);

  const handleReady = useCallback(async (isReadyArg?: any) => {
    if (!lobby || isProcessing) return;
    if (!effectiveIsCaptain1 && !effectiveIsCaptain2) return; // Spectators cannot set ready
    
    // Force boolean. If it's an event or undefined, default to true.
    // If it's explicitly false, keep it false (for unready).
    const isReady = isReadyArg === false ? false : true;
    
    setOptimisticReady(isReady);
    setIsProcessing(true);
    try {
      const team = effectiveIsCaptain1 ? 'A' : 'B';
      await lobbyService.setReady(lobby.id, team, isReady, guestId, generateStandardTurnOrder);
    } catch (err: any) {
      console.error("Ready action failed:", err);
      setOptimisticReady(null); // Clear optimistic state on error
      setError("Failed to set ready. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [lobby, effectiveIsCaptain1, effectiveIsCaptain2, guestId, generateStandardTurnOrder, isProcessing]);

  const handlePickerAction = useCallback(async (godIdArg: any, playerId?: number, playerName?: string, options?: { isRandom?: boolean }) => {
    if (!lobby || isProcessing) return;
    
    // Ensure godId is a string.
    if (typeof godIdArg !== 'string') return;
    const godId = godIdArg;

    setOptimisticAction({ id: godId, type: 'pick', playerId, playerName });
    setIsProcessing(true);
    try {
      const result = await draftService.handlePickerAction(lobby, godId, playerId, effectiveIsCaptain1, effectiveIsCaptain2, options);
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
  }, [lobby, effectiveIsCaptain1, effectiveIsCaptain2, isProcessing]);

  const updateRoster = useCallback(async (newPicks: PickEntry[], subs: Substitution[]) => {
    if (!lobby) return;
    if (!effectiveIsCaptain1 && !effectiveIsCaptain2) return; // Spectators cannot update roster
    const team = effectiveIsCaptain1 ? 'A' : 'B';
    const result = await draftService.updateRoster(lobby, team, newPicks, subs, effectiveIsCaptain1, effectiveIsCaptain2);
    if (!result.success) {
      setError(result.error || "Roster update failed");
    }
  }, [lobby, effectiveIsCaptain1, effectiveIsCaptain2]);

  const requestReset = useCallback(async () => {
    if (!lobby) return;
    const team = effectiveIsCaptain1 ? 'A' : 'B';
    await lobbyService.requestReset(lobby.id, team);
  }, [lobby, effectiveIsCaptain1]);

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
          // ── FORJA: Sorteio do Mapa 3 via pool cacheada (Cold Fetch) ───────────
          if (
            lobby.config.hasMap3RandomRoll &&
            lobby.currentGame === 3 &&
            lobby.config.preset === 'FORJA'
          ) {
            import('../features/forja/services/forjaService').then(({ getForjaMapPoolOnce }) => {
              getForjaMapPoolOnce().then(poolDoc => {
                const allowed = poolDoc?.active_map_ids ?? lobby.config.allowedMaps ?? [];
                const available = allowed.filter(id =>
                  !mapBans.includes(id) &&
                  !seriesMaps.includes(id)
                );
                if (available.length > 0) {
                  const randomId = available[Math.floor(Math.random() * available.length)];
                  handleAction(randomId, undefined, undefined, { force: true });
                }
              }).catch(() => {
                // Fallback: usa lista local de mapas
                const fallbackMaps = MAPS.filter(m =>
                  !mapBans.includes(m.id) &&
                  !seriesMaps.includes(m.id)
                );
                if (fallbackMaps.length > 0) {
                  handleAction(fallbackMaps[Math.floor(Math.random() * fallbackMaps.length)].id, undefined, undefined, { force: true });
                }
              });
            });
            return; // Não executa o fluxo padrão abaixo
          }
          // ── Fluxo padrão ─────────────────────────────────────────────────────

          const allowedMaps = lobby.config.allowedMaps && lobby.config.allowedMaps.length > 0 
            ? lobby.config.allowedMaps 
            : MAPS.map(m => m.id);

          const availableMaps = MAPS.filter(m => 
            allowedMaps.includes(m.id) && 
            !mapBans.includes(m.id) && 
            !seriesMaps.includes(m.id)
          );
          if (availableMaps.length > 0) {
            const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];
            handleAction(randomMap.id, undefined, undefined, { force: true });
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
            handleAction(randomGod.id, undefined, undefined, { force: true });
          }
        } else if (currentTurn.action === 'REVEAL') {
          handleAction('REVEAL', undefined, undefined, { force: true });
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
    clearSubs,
    isMyTurn,
    myTeam
  };
}
