import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Lobby, DraftTurn, PickEntry, TurnAction, TurnTarget, TurnModifier, TurnExecution, Substitution } from '../types';
import { MAPS, MAJOR_GODS, MCL_ROUND_MAPS, getMCLPicks, PLAYER_COLORS } from '../constants';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const draftService = {
  async handleAction(
    lobby: Lobby, 
    actionId: string, 
    isCaptain1: boolean, 
    isCaptain2: boolean,
    targetPlayerId?: number,
    playerName?: string,
    options?: { isRandom?: boolean }
  ): Promise<{ success: boolean; error?: string }> {
    if (!lobby || lobby.status !== 'drafting') return { success: false, error: "Not drafting" };
    
    const currentTurn = lobby.turnOrder[lobby.turn];
    if (!currentTurn) return { success: false, error: "No turn found" };

    const isMyTurn = (isCaptain1 && currentTurn.player === 'A') || 
                     (isCaptain2 && currentTurn.player === 'B') ||
                     (currentTurn.player === 'BOTH');
    
    let isTimerExpired = false;
    if (lobby.timerStart) {
      let startTime: number;
      if (typeof lobby.timerStart === 'string') {
        startTime = new Date(lobby.timerStart).getTime();
      } else if (lobby.timerStart && typeof (lobby.timerStart as any).toMillis === 'function') {
        startTime = (lobby.timerStart as any).toMillis();
      } else {
        startTime = Date.now();
      }
      const elapsed = (Date.now() - startTime) / 1000;
      const duration = lobby.config.timerDuration || 30;
      if (elapsed >= duration + 1) { // 1 second grace period on server check
        isTimerExpired = true;
      }
    }

    const isOpponentTriggeringAutoPick = isTimerExpired && (isCaptain1 || isCaptain2);

    if (!isMyTurn && currentTurn.player !== 'ADMIN' && !isOpponentTriggeringAutoPick) {
      return { success: false, error: "Not your turn" };
    }

    const nextLobby = { ...lobby };
    if (!nextLobby.replayLog) nextLobby.replayLog = [];
    
    // Determine acting team based on whose turn it actually is, not who triggered it (for auto-picks)
    let actingTeam: 'A' | 'B';
    if (currentTurn.player === 'A') actingTeam = 'A';
    else if (currentTurn.player === 'B') actingTeam = 'B';
    else actingTeam = isCaptain1 ? 'A' : 'B'; // For BOTH or ADMIN
    
    if (currentTurn.execution === 'AS_OPPONENT') {
      actingTeam = (actingTeam === 'A' ? 'B' : 'A') as 'A' | 'B';
    }

    const applyAction = (id: string, turn: DraftTurn, team: 'A' | 'B', targetPlayerId?: number, playerName?: string) => {
      if (turn.action === 'BAN') {
        if (turn.target === 'MAP') {
          if (nextLobby.mapBans.includes(id)) return false;
          if (nextLobby.seriesMaps.includes(id)) return false; // Cannot ban a pre-picked map
          nextLobby.mapBans.push(id);
        } else {
          if (nextLobby.bans.includes(id)) return false;
          nextLobby.bans.push(id);
        }
      } else if (turn.action === 'PICK') {
        if (turn.target === 'MAP') {
          if (nextLobby.mapBans.includes(id)) return false;
          if (nextLobby.seriesMaps.includes(id)) return false;
          if (nextLobby.mapPool?.includes(id)) return false;
          
          if (turn.player === 'ADMIN') {
            // Admin pick always goes to Game 1
            nextLobby.seriesMaps[0] = id;
          } else {
            // Special case for Casca Grossa Playoffs: Player picks go to mapPool
            if (nextLobby.config.preset === 'CASCA' && nextLobby.config.tournamentStage === 'PLAYOFFS') {
              if (!nextLobby.mapPool) nextLobby.mapPool = [];
              nextLobby.mapPool.push(id);
            } else {
              const emptySlotIndex = nextLobby.seriesMaps.indexOf("");
              if (emptySlotIndex !== -1) {
                if (nextLobby.config.preset === 'MCL' && emptySlotIndex !== (nextLobby.currentGame - 1)) {
                  return false;
                }
                nextLobby.seriesMaps[emptySlotIndex] = id;
              } else {
                const gameCount = nextLobby.config.seriesType === 'BO1' ? 1 : 
                                  nextLobby.config.seriesType === 'BO3' ? 3 : 
                                  nextLobby.config.seriesType === 'BO5' ? 5 : 
                                  nextLobby.config.seriesType === 'BO7' ? 7 : 
                                  nextLobby.config.seriesType === 'BO9' ? 9 : 
                                  (nextLobby.config.customGameCount || 1);
                
                if (nextLobby.seriesMaps.length < gameCount) {
                  if (nextLobby.config.preset === 'MCL' && nextLobby.seriesMaps.length !== (nextLobby.currentGame - 1)) {
                    return false;
                  }
                  nextLobby.seriesMaps.push(id);
                } else {
                  return false;
                }
              }
            }
          }
          nextLobby.selectedMap = id;
          
          // MCL: Regenerate picks if map is selected to apply map-specific pick order
          if (nextLobby.config.preset === 'MCL') {
            const newPicks = getMCLPicks(nextLobby.currentGame, id, lobby.lastWinner || null);
            // Preserve player names
            nextLobby.picks = newPicks.map(p => {
              const existingPick = lobby.picks.find(ep => ep.playerId === p.playerId);
              const preservedName = existingPick?.playerName || 
                                   (p.team === 'A' ? lobby.teamAPlayers : lobby.teamBPlayers)
                                     ?.find(tp => tp.position === p.playerId)?.name || '';
              return { ...p, playerName: preservedName };
            });
          }
        } else {
          const alreadyPickedByTeam = nextLobby.picks.some(p => p.team === team && p.godId === id);
          const alreadyPickedByAnyone = nextLobby.picks.some(p => p.godId === id);
          if (turn.modifier === 'EXCLUSIVE' && alreadyPickedByAnyone) return false;
          if (turn.modifier === 'NONEXCLUSIVE' && alreadyPickedByTeam) return false;
          if (nextLobby.bans.includes(id)) return false;
          
          let pickIndex = -1;
          if (targetPlayerId !== undefined) {
            pickIndex = nextLobby.picks.findIndex(p => p.team === team && p.playerId === targetPlayerId && p.godId === null);
          } else {
            pickIndex = nextLobby.picks.findIndex(p => p.team === team && p.godId === null);
          }
          
          if (pickIndex !== -1) {
            nextLobby.picks[pickIndex].godId = id;
            nextLobby.picks[pickIndex].turnIndex = lobby.turn;
            if (options?.isRandom) {
              nextLobby.picks[pickIndex].isRandom = true;
            }
            if (playerName) {
              const lowerName = playerName.toLowerCase().trim();
              // MCL: If a player is assigned to a slot, clear their name from any other empty slots
              // of the same team to avoid duplicates and ensure they are moved to the current pick slot.
              nextLobby.picks.forEach((p, idx) => {
                if (idx !== pickIndex && p.team === team && p.godId === null && p.playerName?.toLowerCase().trim() === lowerName) {
                  p.playerName = '';
                }
              });
              nextLobby.picks[pickIndex].playerName = playerName;
            }
          } else {
            return false; // No empty slot found for this player/team
          }
        }
      } else if (turn.action === 'SNIPE') {
        const opponentTeam = team === 'A' ? 'B' : 'A';
        const pickIndex = nextLobby.picks.findIndex(p => p.team === opponentTeam && p.godId === id);
        if (pickIndex !== -1) nextLobby.picks[pickIndex].godId = null;
      } else if (turn.action === 'STEAL') {
        const opponentTeam = team === 'A' ? 'B' : 'A';
        const pickIndex = nextLobby.picks.findIndex(p => p.team === opponentTeam && p.godId === id);
        if (pickIndex !== -1) {
          nextLobby.picks[pickIndex].godId = null;
          const emptyPickIndex = nextLobby.picks.findIndex(p => p.team === team && p.godId === null);
          if (emptyPickIndex !== -1) nextLobby.picks[emptyPickIndex].godId = id;
        }
      }

      // Add to replay log
      nextLobby.replayLog.push({
        gameNumber: nextLobby.currentGame,
        turnIndex: lobby.turn,
        player: turn.player === 'BOTH' ? team : turn.player,
        action: turn.action,
        target: turn.target,
        id,
        timestamp: new Date().toISOString(),
        playerId: targetPlayerId || null,
        isRandom: options?.isRandom || false
      });

      return true;
    };

    if (currentTurn.action === 'REVEAL') {
      nextLobby.hiddenActions.forEach(ha => {
        const turn = nextLobby.turnOrder[ha.turnIndex];
        const team = turn.player === 'A' ? 'A' : (turn.player === 'B' ? 'B' : (isCaptain1 ? 'A' : 'B'));
        applyAction(ha.actionId, turn, team as 'A' | 'B');
      });
      nextLobby.hiddenActions = [];
    } else if (currentTurn.execution === 'HIDDEN') {
      nextLobby.hiddenActions.push({ turnIndex: lobby.turn, actionId });
    } else {
      if (!applyAction(actionId, currentTurn, actingTeam, targetPlayerId, playerName)) return { success: false, error: "Invalid action" };
    }

    nextLobby.turn++;
    nextLobby.timerStart = serverTimestamp();

    const nextTurn = nextLobby.turnOrder[nextLobby.turn];
    if (nextTurn) {
      if (nextTurn.target === 'MAP') {
        nextLobby.phase = nextTurn.action === 'BAN' ? 'map_ban' : 'map_pick';
      } else {
        if (currentTurn.target === 'MAP') {
          // Transitioning from MAP to GOD picks
          if (nextLobby.seriesMaps.length > 0) {
            // Use the map for the current game
            nextLobby.selectedMap = nextLobby.seriesMaps[nextLobby.currentGame - 1];
          }
        }
        nextLobby.phase = nextTurn.action === 'BAN' ? 'god_ban' : 'god_pick';
      }
    } else {
      // End of draft
      if (nextLobby.config.teamSize === 1) {
        nextLobby.phase = 'ready_picker';
        nextLobby.readyA = false;
        nextLobby.readyB = false;
      } else {
        nextLobby.phase = 'post_draft';
      }
      nextLobby.timerStart = null;
    }

    nextLobby.lastActivityAt = serverTimestamp();
    try {
      // Sanitize nextLobby to remove any undefined values that Firestore doesn't like
      const sanitizedLobby = JSON.parse(JSON.stringify(nextLobby));
      // Restore server timestamps which were lost in stringify
      sanitizedLobby.timerStart = nextLobby.timerStart;
      sanitizedLobby.lastActivityAt = nextLobby.lastActivityAt;
      if (lobby.createdAt) sanitizedLobby.createdAt = lobby.createdAt;

      await updateDoc(doc(db, 'lobbies', lobby.id), sanitizedLobby);
      return { success: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${lobby.id}`);
      return { success: false, error: "Update failed" };
    }
  },

  async reportScore(
    lobby: Lobby, 
    winner: 'A' | 'B' | null, 
    isCaptain1: boolean, 
    isCaptain2: boolean,
    generateStandardTurnOrder: (cfg: any, gameNumber?: number, lastWinner?: 'A' | 'B' | null) => { mapOrder: DraftTurn[], godOrder: DraftTurn[] }
  ): Promise<{ success: boolean; error?: string }> {
    if (!lobby) return { success: false, error: "No lobby" };
    const nextLobby = { ...lobby };
    
    // If we are coming from the post-draft screen, we need to set status to 'finished' 
    // and phase to 'reporting' to start the voting process.
    // Both players must be ready to report.
    if (nextLobby.phase === 'post_draft' && nextLobby.status === 'drafting') {
      if (isCaptain1) nextLobby.readyA_report = true;
      if (isCaptain2) nextLobby.readyB_report = true;

      if (nextLobby.readyA_report && nextLobby.readyB_report) {
        nextLobby.phase = 'reporting';
        nextLobby.readyA_report = false;
        nextLobby.readyB_report = false;
      }
      
      nextLobby.lastActivityAt = serverTimestamp();
      try {
        const sanitizedLobby = JSON.parse(JSON.stringify(nextLobby));
        sanitizedLobby.lastActivityAt = nextLobby.lastActivityAt;
        if (lobby.createdAt) sanitizedLobby.createdAt = lobby.createdAt;

        await updateDoc(doc(db, 'lobbies', lobby.id), sanitizedLobby);
        return { success: true };
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `lobbies/${lobby.id}`);
        return { success: false, error: "Transition to reporting failed" };
      }
    }

    if (!winner) return { success: false, error: "No winner selected" };

    if (isCaptain1) nextLobby.reportVoteA = winner;
    if (isCaptain2) nextLobby.reportVoteB = winner;
    
    // Set start time for auto-resolution if this is the first vote
    if (!lobby.reportVoteA && !lobby.reportVoteB) {
      nextLobby.reportStartAt = serverTimestamp();
    }

    nextLobby.voteConflict = false;

    if (nextLobby.reportVoteA && nextLobby.reportVoteB) {
      if (nextLobby.reportVoteA === nextLobby.reportVoteB) {
        const finalWinner = nextLobby.reportVoteA;
        
        nextLobby.history.push({
          gameNumber: lobby.currentGame,
          mapId: lobby.selectedMap!,
          winner: finalWinner,
          picksA: lobby.config.teamSize === 1 ? [lobby.pickerVoteA!] : lobby.picks.filter(p => p.team === 'A').map(p => p.godId!),
          picksB: lobby.config.teamSize === 1 ? [lobby.pickerVoteB!] : lobby.picks.filter(p => p.team === 'B').map(p => p.godId!),
          colorsA: lobby.config.teamSize === 1 ? [lobby.picks.find(p => p.team === 'A')?.color!] : lobby.picks.filter(p => p.team === 'A').map(p => p.color),
          colorsB: lobby.config.teamSize === 1 ? [lobby.picks.find(p => p.team === 'B')?.color!] : lobby.picks.filter(p => p.team === 'B').map(p => p.color),
          rosterA: lobby.picks.filter(p => p.team === 'A'),
          rosterB: lobby.picks.filter(p => p.team === 'B')
        });
        
        if (finalWinner === 'A') nextLobby.scoreA++;
        else nextLobby.scoreB++;
        
        let isFinished = false;
        if (lobby.config.seriesType === 'CUSTOM') {
          const totalGames = lobby.config.customGameCount || 3;
          if (nextLobby.currentGame >= totalGames) isFinished = true;
        } else {
          const maxGames = parseInt(lobby.config.seriesType.replace('BO', ''));
          const winThreshold = Math.ceil(maxGames / 2);
          if (nextLobby.scoreA >= winThreshold || nextLobby.scoreB >= winThreshold) isFinished = true;
        }
        
        if (isFinished) {
          nextLobby.status = 'finished';
          nextLobby.phase = 'finished';
        } else {
          // Instead of immediately starting next draft, go to a ready state
          nextLobby.phase = 'ready'; 
          nextLobby.readyA = false;
          nextLobby.readyB = false;
          nextLobby.readyA_nextGame = false;
          nextLobby.readyB_nextGame = false;
          nextLobby.readyA_report = false;
          nextLobby.readyB_report = false;
          
          nextLobby.currentGame++;
          nextLobby.lastWinner = finalWinner;
          
          const nextGameNumber = nextLobby.currentGame;

          if (nextLobby.seriesMaps.length > 0) {
            nextLobby.selectedMap = nextLobby.seriesMaps[nextGameNumber - 1];
          } else {
            nextLobby.selectedMap = null;
          }

          // Generate turn order for next game
          const { mapOrder, godOrder } = generateStandardTurnOrder(lobby.config, nextGameNumber, finalWinner);
          
          let newTurnOrder: DraftTurn[] = [];
          
          if (nextLobby.selectedMap && nextLobby.selectedMap !== "") {
            newTurnOrder = [...godOrder];
          } else {
            // Special Case: Casca Grossa Playoffs
            if (lobby.config.preset === 'CASCA' && lobby.config.tournamentStage === 'PLAYOFFS') {
              const loser = finalWinner === 'A' ? 'B' : 'A';
              newTurnOrder = [{ player: loser, action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' }, ...godOrder];
            } else if (lobby.config.loserPicksNextMap && finalWinner) {
              const loser = finalWinner === 'A' ? 'B' : 'A';
              newTurnOrder = [{ player: loser, action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' }, ...godOrder];
            } else {
              newTurnOrder = [...mapOrder, ...godOrder];
            }
          }

          // Swap god pick order after each game (except Game 1)
          if (nextGameNumber > 1) {
            let shouldInvert = true;
            if (lobby.config.preset === 'MCL') {
              // generateStandardTurnOrder already handles the correct starting team for MCL
              shouldInvert = false;
            } else if (nextGameNumber === 3 && lobby.config.preset !== 'MCL') {
              // ... existing logic for other presets if any
              shouldInvert = true;
            } else {
              shouldInvert = true;
            }

            if (shouldInvert) {
              for (let i = 0; i < newTurnOrder.length; i++) {
                if (newTurnOrder[i].target === 'GOD') {
                  if (newTurnOrder[i].player === 'A') newTurnOrder[i].player = 'B';
                  else if (newTurnOrder[i].player === 'B') newTurnOrder[i].player = 'A';
                }
              }
            }
          }

          nextLobby.turnOrder = newTurnOrder;
          nextLobby.turn = 0;

          // Only reset bans if we are doing a new god draft
          if (newTurnOrder.some(t => t.target === 'GOD' && t.action === 'BAN')) {
            nextLobby.bans = [];
          }
          
          // Only reset picks if we are doing a new god draft
          if (newTurnOrder.some(t => t.target === 'GOD' && t.action === 'PICK')) {
            if (lobby.config.preset === 'MCL') {
              const newPicks = getMCLPicks(nextGameNumber, nextLobby.selectedMap || null, finalWinner);
              // Preserve player names from previous game
              nextLobby.picks = newPicks.map(p => {
                const existingPick = lobby.picks.find(ep => ep.playerId === p.playerId);
                // Use the name from the previous game's picks, or fallback to teamPlayers if available
                const preservedName = existingPick?.playerName || 
                                     (p.team === 'A' ? lobby.teamAPlayers : lobby.teamBPlayers)
                                       ?.find(tp => tp.position === p.playerId)?.name || '';
                return { ...p, playerName: preservedName };
              });
            } else {
              nextLobby.picks = nextLobby.picks.map(p => ({ ...p, godId: null }));
            }
          }
          
          nextLobby.timerStart = null; // Wait for ready
          nextLobby.reportVoteA = null;
          nextLobby.reportVoteB = null;
          nextLobby.reportStartAt = null;
          nextLobby.voteConflict = false;
          nextLobby.voteConflictCount = 0;
          nextLobby.pickerVoteA = null;
          nextLobby.pickerVoteB = null;
        }
      } else {
        nextLobby.voteConflict = true;
        nextLobby.voteConflictCount = (lobby.voteConflictCount || 0) + 1;
        
        if (nextLobby.voteConflictCount >= 2) {
          nextLobby.status = 'finished';
          nextLobby.phase = 'finished';
          // We'll use a special flag or just check conflict count in UI
        }
      }
    }
    
    nextLobby.lastActivityAt = serverTimestamp();
    try {
      const sanitizedLobby = JSON.parse(JSON.stringify(nextLobby));
      sanitizedLobby.lastActivityAt = nextLobby.lastActivityAt;
      if (lobby.createdAt) sanitizedLobby.createdAt = lobby.createdAt;
      if (nextLobby.reportStartAt) sanitizedLobby.reportStartAt = nextLobby.reportStartAt;

      await updateDoc(doc(db, 'lobbies', lobby.id), sanitizedLobby);
      return { success: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${lobby.id}`);
      return { success: false, error: "Report failed" };
    }
  },

  async resetVotes(lobbyId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'lobbies', lobbyId), {
        reportVoteA: null,
        reportVoteB: null,
        reportStartAt: null,
        voteConflict: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${lobbyId}`);
    }
  },

  async handlePickerAction(
    lobby: Lobby,
    godId: string,
    playerId: number | undefined,
    isCaptain1: boolean,
    isCaptain2: boolean,
    options?: { isRandom?: boolean }
  ): Promise<{ success: boolean; error?: string }> {
    if (!lobby || lobby.phase !== 'god_picker') return { success: false, error: "Not in picker phase" };
    
    // Check if it's the player's own action
    const isMyAction = (isCaptain1 && !options?.isRandom) || (isCaptain2 && !options?.isRandom);
    
    // Check for auto-pick fallback
    let isTimerExpired = false;
    if (lobby.timerStart) {
      let startTime: number;
      if (typeof lobby.timerStart === 'string') {
        startTime = new Date(lobby.timerStart).getTime();
      } else if (lobby.timerStart && typeof (lobby.timerStart as any).toMillis === 'function') {
        startTime = (lobby.timerStart as any).toMillis();
      } else {
        startTime = Date.now();
      }
      // Use offset-corrected time if possible, or just Date.now() 
      // In the hook we use getServerTime, here we'll use Date.now() but with a safe grace period
      const elapsed = (Date.now() - startTime) / 1000;
      const duration = lobby.config.timerDuration || 30;
      if (elapsed >= duration + 1) isTimerExpired = true;
    }

    const isAutoPickFallback = isTimerExpired && (isCaptain1 || isCaptain2);

    if (!isMyAction && !isAutoPickFallback) return { success: false, error: "Not authorized" };
    
    const nextLobby = { ...lobby };
    if (!nextLobby.replayLog) nextLobby.replayLog = [];

    // Identify which team we are picking for
    // If it's a manual pick, it's the captain's team.
    // If it's an auto-pick fallback, we might be picking for either or both.
    // However, the caller should specify target team or we check both.
    
    const applyToA = (isCaptain1 && !isAutoPickFallback) || (isAutoPickFallback && !nextLobby.pickerVoteA);
    const applyToB = (isCaptain2 && !isAutoPickFallback) || (isAutoPickFallback && !nextLobby.pickerVoteB);

    if (applyToA && !nextLobby.pickerVoteA) {
        nextLobby.pickerVoteA = godId;
        if (playerId) nextLobby.pickerPlayerA = playerId;
        if (options?.isRandom) {
          const pickIndex = nextLobby.picks.findIndex(p => p.team === 'A' && (playerId !== undefined ? p.playerId === playerId : true));
          if (pickIndex !== -1) nextLobby.picks[pickIndex].isRandom = true;
        }
    }
    
    if (applyToB && !nextLobby.pickerVoteB) {
        // If we already applied to A in this same call (impossible but safeguard), 
        // we might need a different random god, but we'll stick to one for simplicity per call.
        nextLobby.pickerVoteB = godId;
        if (playerId) nextLobby.pickerPlayerB = playerId;
        if (options?.isRandom) {
          const pickIndex = nextLobby.picks.findIndex(p => p.team === 'B' && (playerId !== undefined ? p.playerId === playerId : true));
          if (pickIndex !== -1) nextLobby.picks[pickIndex].isRandom = true;
        }
    }

    if (nextLobby.pickerVoteA && nextLobby.pickerVoteB) {
      nextLobby.phase = 'revealing';
      nextLobby.timerStart = serverTimestamp(); // Reset timer for reveal duration

      // Add to replay log
      nextLobby.replayLog.push({
        gameNumber: nextLobby.currentGame,
        turnIndex: -1, // Special index for picker phase
        player: 'A',
        action: 'PICK',
        target: 'GOD',
        id: nextLobby.pickerVoteA,
        timestamp: new Date().toISOString(),
        playerId: nextLobby.pickerPlayerA || null
      });
      nextLobby.replayLog.push({
        gameNumber: nextLobby.currentGame,
        turnIndex: -1,
        player: 'B',
        action: 'PICK',
        target: 'GOD',
        id: nextLobby.pickerVoteB,
        timestamp: new Date().toISOString(),
        playerId: nextLobby.pickerPlayerB || null
      });
    }

    nextLobby.lastActivityAt = serverTimestamp();
    try {
      const sanitizedLobby = JSON.parse(JSON.stringify(nextLobby));
      sanitizedLobby.timerStart = nextLobby.timerStart;
      sanitizedLobby.lastActivityAt = nextLobby.lastActivityAt;
      if (lobby.createdAt) sanitizedLobby.createdAt = lobby.createdAt;

      await updateDoc(doc(db, 'lobbies', lobby.id), sanitizedLobby);
      return { success: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${lobby.id}`);
      return { success: false, error: "Picker action failed" };
    }
  },

  async updateRoster(
    lobby: Lobby,
    team: 'A' | 'B',
    newPicks: PickEntry[],
    subs: Substitution[],
    isCaptain1: boolean,
    isCaptain2: boolean
  ): Promise<{ success: boolean; error?: string }> {
    if (!isCaptain1 && !isCaptain2) return { success: false, error: "Not authorized" };
    
    const nextLobby = { ...lobby };
    nextLobby.picks = newPicks;
    const teamPlayers = newPicks
      .filter(p => p.team === team)
      .map(p => ({
        name: p.playerName || '?',
        position: p.playerId
      }));
    
    if (team === 'A') {
        nextLobby.teamAPlayers = teamPlayers;
        if (subs.length > 0) nextLobby.rosterChangedA = true;
    } else {
        nextLobby.teamBPlayers = teamPlayers;
        if (subs.length > 0) nextLobby.rosterChangedB = true;
    }
    
    if (!nextLobby.lastSubs) nextLobby.lastSubs = [];
    // Filter out existing subs for this team to avoid duplicates if they edit multiple times
    const otherTeamSubs = nextLobby.lastSubs.filter(s => s.team !== team);
    nextLobby.lastSubs = [...otherTeamSubs, ...subs];

    nextLobby.lastActivityAt = serverTimestamp();
    try {
      const sanitizedLobby = JSON.parse(JSON.stringify(nextLobby));
      sanitizedLobby.lastActivityAt = nextLobby.lastActivityAt;
      if (lobby.createdAt) sanitizedLobby.createdAt = lobby.createdAt;

      await updateDoc(doc(db, 'lobbies', lobby.id), sanitizedLobby);
      return { success: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${lobby.id}`);
      return { success: false, error: "Roster update failed" };
    }
  }
};
