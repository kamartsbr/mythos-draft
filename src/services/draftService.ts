import { doc, updateDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Lobby, DraftTurn, PickEntry, TurnAction, TurnTarget, TurnModifier, TurnExecution, Substitution } from '../types';
import { MAPS, MAJOR_GODS, MCL_ROUND_MAPS, getMCLPicks, PLAYER_COLORS } from '../constants';
import { normalizeLobbyData } from './lobbyService';

// Detect Development Mode
const IS_DEV = import.meta.env.VITE_VIBE_MODE === 'DEVELOPMENT';

// Mock helpers for LocalStorage
const STORAGE_PREFIX = 'mythos_draft_dev_';

const getLocalLobby = (id: string): Lobby | null => {
  const data = localStorage.getItem(`${STORAGE_PREFIX}lobby_${id}`);
  return data ? JSON.parse(data) : null;
};

const setLocalLobby = (id: string, lobby: Lobby) => {
  localStorage.setItem(`${STORAGE_PREFIX}lobby_${id}`, JSON.stringify(lobby));
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new CustomEvent('storage_update', { detail: lobby }));
};

const now = () => IS_DEV ? Date.now() : serverTimestamp();

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

const cleanData = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanData(item));
  } else if (typeof obj === 'object') {
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
      // Skip undefined or complex Firebase types during cleaning in dev
      if (IS_DEV && (obj[key] === undefined || (obj[key] && obj[key]._methodName))) return;
      newObj[key] = cleanData(obj[key]);
    });
    return newObj;
  }
  return obj;
};

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
  if (!IS_DEV) throw new Error(JSON.stringify(errInfo));
}

export const draftService = {
  async handleAction(
    lobby: Lobby, 
    actionId: string, 
    isCaptain1: boolean, 
    isCaptain2: boolean,
    targetPlayerId?: number,
    playerName?: string,
    options?: { isRandom?: boolean },
    retryCount = 0
  ): Promise<{ success: boolean; error?: string }> {
    if (IS_DEV) {
      const freshLobby = getLocalLobby(lobby.id);
      if (!freshLobby) return { success: false, error: "Lobby not found" };
      
      const result = this._processActionLogic(freshLobby, actionId, isCaptain1, isCaptain2, targetPlayerId, playerName, options);
      if (result.success && result.updates) {
        const updatedLobby = { ...freshLobby, ...result.updates };
        setLocalLobby(lobby.id, cleanData(updatedLobby));
        return { success: true };
      }
      return { success: false, error: result.error };
    }

    try {
      return await runTransaction(db, async (transaction) => {
        const lobbyRef = doc(db, 'lobbies', lobby.id);
        const lobbyDoc = await transaction.get(lobbyRef);
        if (!lobbyDoc.exists()) return { success: false, error: "Lobby not found" };
        
        const freshLobby = normalizeLobbyData({ id: lobbyDoc.id, ...lobbyDoc.data() });
        const result = this._processActionLogic(freshLobby, actionId, isCaptain1, isCaptain2, targetPlayerId, playerName, options);
        
        if (!result.success) return { success: false, error: result.error };
        
        transaction.update(lobbyRef, cleanData(result.updates));
        return { success: true };
      });
    } catch (error: any) {
      if (error.message.includes('failed-precondition') && retryCount < 3) {
        await new Promise(r => setTimeout(r, 500));
        return this.handleAction(lobby, actionId, isCaptain1, isCaptain2, targetPlayerId, playerName, options, retryCount + 1);
      }
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${lobby.id}`);
      return { success: false, error: "Update failed" };
    }
  },

  // Internal common logic extracted for both LocalStorage and Transaction
  _processActionLogic(
    freshLobby: Lobby,
    actionId: string,
    isCaptain1: boolean,
    isCaptain2: boolean,
    targetPlayerId?: number,
    playerName?: string,
    options?: { isRandom?: boolean }
  ): { success: boolean; error?: string; updates?: Partial<Lobby> } {
    if (freshLobby.status !== 'drafting') return { success: false, error: "Not drafting" };
    
    const currentTurn = freshLobby.turnOrder[freshLobby.turn];
    if (!currentTurn) return { success: false, error: "No turn found" };

    const isMyTurn = IS_DEV || (freshLobby.captain1 === freshLobby.captain2) || 
                     (isCaptain1 && currentTurn.player === 'A') || 
                     (isCaptain2 && currentTurn.player === 'B') ||
                     (currentTurn.player === 'BOTH');
    
    // Timer check
    let isTimerExpired = false;
    if (freshLobby.timerStart) {
      let startTime: number;
      if (typeof freshLobby.timerStart === 'string') {
        startTime = new Date(freshLobby.timerStart).getTime();
      } else if (typeof freshLobby.timerStart === 'number') {
        startTime = freshLobby.timerStart;
      } else if (freshLobby.timerStart && typeof (freshLobby.timerStart as any).toMillis === 'function') {
        startTime = (freshLobby.timerStart as any).toMillis();
      } else {
        startTime = Date.now();
      }
      const elapsed = (Date.now() - startTime) / 1000;
      const duration = freshLobby.config.timerDuration || 60;
      if (elapsed >= duration + 1) {
        isTimerExpired = true;
      }
    }

    const isOpponentTriggeringAutoPick = isTimerExpired && (isCaptain1 || isCaptain2);

    if (!isMyTurn && currentTurn.player !== 'ADMIN' && !isOpponentTriggeringAutoPick) {
      return { success: false, error: "Not your turn" };
    }

    const updates: Partial<Lobby> = {
      picks: [...freshLobby.picks.map(p => ({ ...p }))],
      bans: [...(freshLobby.bans || [])],
      mapBans: [...(freshLobby.mapBans || [])],
      seriesMaps: [...(freshLobby.seriesMaps || [])],
      replayLog: [...(freshLobby.replayLog || [])],
      hiddenActions: Array.isArray(freshLobby.hiddenActions) ? [...freshLobby.hiddenActions] : [],
      mapPool: freshLobby.mapPool ? [...freshLobby.mapPool] : [],
      turn: freshLobby.turn,
      phase: freshLobby.phase,
      selectedMap: freshLobby.selectedMap,
      timerStart: freshLobby.timerStart,
      lastActivityAt: now()
    };

    let actingTeam: 'A' | 'B';
    if (currentTurn.player === 'A') actingTeam = 'A';
    else if (currentTurn.player === 'B') actingTeam = 'B';
    else actingTeam = isCaptain1 ? 'A' : 'B'; 
    
    if (currentTurn.execution === 'AS_OPPONENT') {
      actingTeam = (actingTeam === 'A' ? 'B' : 'A') as 'A' | 'B';
    }

    const applyAction = (id: string, turn: DraftTurn, team: 'A' | 'B', tPlayerId?: number, pName?: string) => {
      if (turn.action === 'BAN') {
        if (turn.target === 'MAP') {
          if (updates.mapBans!.includes(id)) return false;
          if (updates.seriesMaps!.includes(id)) return false;
          updates.mapBans!.push(id);
        } else {
          if (updates.bans!.includes(id)) return false;
          updates.bans!.push(id);
        }
      } else if (turn.action === 'PICK') {
        if (turn.target === 'MAP') {
          if (updates.mapBans!.includes(id)) return false;
          if (updates.seriesMaps!.includes(id)) return false;
          if (updates.mapPool?.includes(id)) return false;
          
          if (turn.player === 'ADMIN') {
            updates.seriesMaps![0] = id;
          } else {
            if (freshLobby.config.preset === 'CASCA' && freshLobby.config.tournamentStage === 'PLAYOFFS') {
                if (!updates.mapPool) updates.mapPool = [];
                updates.mapPool.push(id);
            } else {
              const emptySlotIndex = updates.seriesMaps!.indexOf("");
              if (emptySlotIndex !== -1) {
                if (freshLobby.config.preset === 'MCL' && emptySlotIndex !== (freshLobby.currentGame - 1)) {
                  return false;
                }
                updates.seriesMaps![emptySlotIndex] = id;
              } else {
                const gameCount = freshLobby.config.seriesType === 'BO1' ? 1 : 
                                  freshLobby.config.seriesType === 'BO3' ? 3 : 
                                  freshLobby.config.seriesType === 'BO5' ? 5 : 
                                  freshLobby.config.seriesType === 'BO7' ? 7 : 
                                  freshLobby.config.seriesType === 'BO9' ? 9 : 
                                  (freshLobby.config.customGameCount || 1);
                
                if (updates.seriesMaps!.length < gameCount) {
                  updates.seriesMaps!.push(id);
                } else {
                  return false;
                }
              }
            }
          }
          updates.selectedMap = id;
          
          if (freshLobby.config.preset === 'MCL') {
            const newMCLPicks = getMCLPicks(freshLobby.currentGame, id, freshLobby.lastWinner || null);
            updates.picks = newMCLPicks.map(p => {
              const existingPick = freshLobby.picks.find(ep => ep.playerId === p.playerId);
              const preservedName = existingPick?.playerName || 
                                   (p.team === 'A' ? freshLobby.teamAPlayers : freshLobby.teamBPlayers)
                                     ?.find(tp => tp.position === p.playerId)?.name || '';
              return { ...p, playerName: preservedName };
            });
          }
        } else {
          const alreadyPickedByTeam = updates.picks!.some(p => p.team === team && p.godId === id);
          const alreadyPickedByAnyone = updates.picks!.some(p => p.godId === id);
          if (turn.modifier === 'EXCLUSIVE' && alreadyPickedByAnyone) return false;
          if (turn.modifier === 'NONEXCLUSIVE' && alreadyPickedByTeam) return false;
          if (updates.bans!.includes(id)) return false;
          
          let pickIndex = -1;
          if (tPlayerId !== undefined) {
            pickIndex = updates.picks!.findIndex(p => p.team === team && p.playerId === tPlayerId && p.godId === null);
          } else {
            pickIndex = updates.picks!.findIndex(p => p.team === team && p.godId === null);
          }
          
          if (pickIndex !== -1) {
            updates.picks![pickIndex].godId = id;
            updates.picks![pickIndex].turnIndex = freshLobby.turn;
            if (options?.isRandom) {
              updates.picks![pickIndex].isRandom = true;
            }
            if (pName) {
              updates.picks![pickIndex].playerName = pName;
            }
          } else {
            return false; 
          }
        }
      } else if (turn.action === 'SNIPE') {
        const opponentTeam = team === 'A' ? 'B' : 'A';
        const snipeIndex = updates.picks!.findIndex(p => p.team === opponentTeam && p.godId === id);
        if (snipeIndex !== -1) updates.picks![snipeIndex].godId = null;
      }

      updates.replayLog!.push({
        gameNumber: freshLobby.currentGame,
        turnIndex: freshLobby.turn,
        player: turn.player === 'BOTH' ? team : turn.player as any,
        action: turn.action,
        target: turn.target,
        id,
        timestamp: new Date().toISOString(),
        playerId: tPlayerId || null,
        isRandom: options?.isRandom || false
      });

      return true;
    };

    if (currentTurn.action === 'REVEAL') {
      updates.hiddenActions!.forEach(ha => {
        const turn = freshLobby.turnOrder[ha.turnIndex];
        const team = turn.player === 'A' ? 'A' : (turn.player === 'B' ? 'B' : (isCaptain1 ? 'A' : 'B'));
        applyAction(ha.actionId, turn, team as 'A' | 'B');
      });
      updates.hiddenActions = [];
    } else if (currentTurn.execution === 'HIDDEN') {
      updates.hiddenActions!.push({ turnIndex: freshLobby.turn, actionId });
    } else {
      if (!applyAction(actionId, currentTurn, actingTeam, targetPlayerId, playerName)) return { success: false, error: "Invalid action" };
    }

    updates.turn!++;
    updates.timerStart = now();

    const nextTurn = freshLobby.turnOrder[updates.turn!];
    if (nextTurn) {
      if (nextTurn.target === 'MAP') {
        updates.phase = nextTurn.action === 'BAN' ? 'map_ban' : 'map_pick';
      } else {
        if (currentTurn.target === 'MAP') {
          if (updates.seriesMaps!.length > 0) {
            updates.selectedMap = updates.seriesMaps![freshLobby.currentGame - 1];
          }
        }
        updates.phase = nextTurn.action === 'BAN' ? 'god_ban' : 'god_pick';
      }
    } else {
      if (freshLobby.config.teamSize === 1) {
        updates.phase = 'ready_picker';
        updates.readyA = false;
        updates.readyB = false;
      } else {
        updates.phase = 'post_draft';
      }
      updates.timerStart = null;
    }

    return { success: true, updates };
  },

  async reportScore(
    lobby: Lobby, 
    winner: 'A' | 'B' | null, 
    isCaptain1: boolean, 
    isCaptain2: boolean,
    generateStandardTurnOrder: (cfg: any, gameNumber?: number, lastWinner?: 'A' | 'B' | null) => { mapOrder: DraftTurn[], godOrder: DraftTurn[] }
  ): Promise<{ success: boolean; error?: string }> {
    if (IS_DEV) {
      const freshLobby = getLocalLobby(lobby.id);
      if (!freshLobby) return { success: false, error: "Lobby not found" };
      
      const result = this._processReportLogic(freshLobby, winner, isCaptain1, isCaptain2, generateStandardTurnOrder);
      if (result.success && result.updates) {
        setLocalLobby(lobby.id, cleanData({ ...freshLobby, ...result.updates }));
        return { success: true };
      }
      return { success: false, error: result.error };
    }

    try {
      return await runTransaction(db, async (transaction) => {
        const lobbyRef = doc(db, 'lobbies', lobby.id);
        const lobbyDoc = await transaction.get(lobbyRef);
        if (!lobbyDoc.exists()) return { success: false, error: "Lobby not found" };
        
        const freshLobby = normalizeLobbyData({ id: lobbyDoc.id, ...lobbyDoc.data() });
        const result = this._processReportLogic(freshLobby, winner, isCaptain1, isCaptain2, generateStandardTurnOrder);
        
        if (!result.success) return { success: false, error: result.error };
        
        transaction.update(lobbyRef, cleanData(result.updates));
        return { success: true };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${lobby.id}`);
      return { success: false, error: "Report failed" };
    }
  },

  _processReportLogic(
    lobby: Lobby,
    winner: 'A' | 'B' | null,
    isCaptain1: boolean,
    isCaptain2: boolean,
    generateStandardTurnOrder: any
  ): { success: boolean, error?: string, updates?: Partial<Lobby> } {
    const nextLobby = { ...lobby };
    
    if (nextLobby.phase === 'post_draft' && nextLobby.status === 'drafting') {
      if (isCaptain1) nextLobby.readyA_report = true;
      if (isCaptain2) nextLobby.readyB_report = true;

      if (nextLobby.readyA_report && nextLobby.readyB_report) {
        nextLobby.phase = 'reporting';
        nextLobby.readyA_report = false;
        nextLobby.readyB_report = false;
      }
      
      nextLobby.lastActivityAt = now();
      return { success: true, updates: nextLobby };
    }

    if (!winner) return { success: false, error: "No winner selected" };

    if (isCaptain1) nextLobby.reportVoteA = winner;
    if (isCaptain2) nextLobby.reportVoteB = winner;
    
    if (!lobby.reportVoteA && !lobby.reportVoteB) {
      nextLobby.reportStartAt = now();
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
        const maxGamesStr = lobby.config.seriesType === 'CUSTOM' ? (lobby.config.customGameCount || 1).toString() : lobby.config.seriesType.replace('BO', '');
        const maxGames = parseInt(maxGamesStr);
        const winThreshold = Math.ceil(maxGames / 2);
        if (nextLobby.scoreA >= winThreshold || nextLobby.scoreB >= winThreshold) isFinished = true;
        
        if (isFinished) {
          nextLobby.status = 'finished';
          nextLobby.phase = 'finished';
        } else {
          nextLobby.phase = 'ready'; 
          nextLobby.currentGame++;
          nextLobby.lastWinner = finalWinner;
          
          const { mapOrder, godOrder } = generateStandardTurnOrder(lobby.config, nextLobby.currentGame, finalWinner);
          nextLobby.turnOrder = [...mapOrder, ...godOrder];
          nextLobby.turn = 0;
          nextLobby.selectedMap = null; // Clear map for next game's pick/pre-selection
          nextLobby.picks = nextLobby.picks.map(p => ({ ...p, godId: null }));
          nextLobby.bans = [];
          
          nextLobby.reportVoteA = null;
          nextLobby.reportVoteB = null;
          nextLobby.reportStartAt = null;
        }
      } else {
        nextLobby.voteConflict = true;
      }
    }

    nextLobby.lastActivityAt = now();
    return { success: true, updates: nextLobby };
  },

  async handlePickerAction(
    lobby: Lobby,
    godId: string,
    playerId: number | undefined,
    isCaptain1: boolean,
    isCaptain2: boolean,
    options?: { isRandom?: boolean }
  ): Promise<{ success: boolean; error?: string }> {
    if (IS_DEV) {
      const freshLobby = getLocalLobby(lobby.id);
      if (!freshLobby) return { success: false, error: "Lobby not found" };
      
      const updates: Partial<Lobby> = {
        pickerVoteA: freshLobby.pickerVoteA,
        pickerVoteB: freshLobby.pickerVoteB,
        picks: [...freshLobby.picks.map(p => ({ ...p }))],
        phase: freshLobby.phase,
        timerStart: freshLobby.timerStart,
        lastActivityAt: now()
      };

      if (isCaptain1 && !updates.pickerVoteA) {
        updates.pickerVoteA = godId;
      }
      if (isCaptain2 && !updates.pickerVoteB) {
        updates.pickerVoteB = godId;
      }

      if (updates.pickerVoteA && updates.pickerVoteB) {
        updates.phase = 'revealing';
        updates.timerStart = now();
      }

      setLocalLobby(lobby.id, cleanData({ ...freshLobby, ...updates }));
      return { success: true };
    }

    try {
      return await runTransaction(db, async (transaction) => {
        const lobbyRef = doc(db, 'lobbies', lobby.id);
        const lobbyDoc = await transaction.get(lobbyRef);
        if (!lobbyDoc.exists()) return { success: false, error: "Lobby not found" };
        
        const freshLobby = { id: lobbyDoc.id, ...lobbyDoc.data() } as Lobby;
        const updates: Partial<Lobby> = {
          pickerVoteA: freshLobby.pickerVoteA,
          pickerVoteB: freshLobby.pickerVoteB,
          lastActivityAt: serverTimestamp()
        };

        if (isCaptain1 && !updates.pickerVoteA) updates.pickerVoteA = godId;
        if (isCaptain2 && !updates.pickerVoteB) updates.pickerVoteB = godId;

        if (updates.pickerVoteA && updates.pickerVoteB) {
          updates.phase = 'revealing';
          updates.timerStart = serverTimestamp();
        }

        transaction.update(lobbyRef, cleanData(updates));
        return { success: true };
      });
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `lobbies/${lobby.id}`);
       return { success: false, error: "Picker action failed" };
    }
  },

  async resetVotes(id: string): Promise<void> {
    if (IS_DEV) {
      const freshLobby = getLocalLobby(id);
      if (freshLobby) {
        setLocalLobby(id, cleanData({ ...freshLobby, reportVoteA: null, reportVoteB: null, voteConflict: false, reportStartAt: null, lastActivityAt: now() }));
      }
      return;
    }
    try {
      await updateDoc(doc(db, 'lobbies', id), cleanData({
        reportVoteA: null,
        reportVoteB: null,
        voteConflict: false,
        reportStartAt: null,
        lastActivityAt: serverTimestamp()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
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
    if (IS_DEV) {
      const freshLobby = getLocalLobby(lobby.id);
      if (!freshLobby) return { success: false, error: "Lobby not found" };
      
      const newHistoryPicks = [...(freshLobby.picks || [])];
      newPicks.forEach(np => {
        const index = newHistoryPicks.findIndex(hp => hp.playerId === np.playerId && hp.team === np.team);
        if (index !== -1) {
          newHistoryPicks[index] = np;
        } else {
          newHistoryPicks.push(np);
        }
      });
      const addedSubs = [...(freshLobby.lastSubs || []), ...subs];

      setLocalLobby(lobby.id, cleanData({ 
        ...freshLobby, 
        picks: newHistoryPicks,
        lastSubs: addedSubs,
        lastActivityAt: now() 
      }));
      return { success: true };
    }
    try {
      return await runTransaction(db, async (transaction) => {
        const lobbyRef = doc(db, 'lobbies', lobby.id);
        const lobbyDoc = await transaction.get(lobbyRef);
        if (!lobbyDoc.exists()) return { success: false, error: "Lobby not found" };
        
        const freshLobby = normalizeLobbyData({ id: lobbyDoc.id, ...lobbyDoc.data() });
        const updates: Partial<Lobby> = { lastActivityAt: serverTimestamp() };
        
        const newHistoryPicks = [...(freshLobby.picks || [])];
        newPicks.forEach(np => {
          const index = newHistoryPicks.findIndex(hp => hp.playerId === np.playerId && hp.team === np.team);
          if (index !== -1) {
            newHistoryPicks[index] = np;
          } else {
            newHistoryPicks.push(np);
          }
        });
        updates.picks = newHistoryPicks;
        updates.lastSubs = [...(freshLobby.lastSubs || []), ...subs];
        
        transaction.update(lobbyRef, cleanData(updates));
        return { success: true };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${lobby.id}`);
      return { success: false, error: "Roster update failed" };
    }
  }
};
