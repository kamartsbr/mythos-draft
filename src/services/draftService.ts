import { doc, updateDoc, serverTimestamp, runTransaction, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Lobby, DraftTurn, PickEntry, TurnAction, TurnTarget, TurnModifier, TurnExecution, Substitution } from '../types';
import { MAPS, MAJOR_GODS, MCL_ROUND_MAPS, getMCLPicks, PLAYER_COLORS } from '../constants';
import { normalizeLobbyData, IS_DEV, isSoloAdminLobby } from './lobbyService';
import { processTurnAction, processReportAction } from '../lib/pureDraftEngine';

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
  if (typeof obj === 'object' && obj !== null && '_methodName' in obj) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanData(item));
  } else if (typeof obj === 'object') {
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] === undefined) return;
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
      if (error.message?.includes('failed-precondition')) {
        if (retryCount < 3) {
          await new Promise(r => setTimeout(r, 500));
          return this.handleAction(lobby, actionId, isCaptain1, isCaptain2, targetPlayerId, playerName, options, retryCount + 1);
        }
        return { success: false, error: "O banco de dados está sincronizando os índices. Tente novamente em alguns segundos." };
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
    try {
      const actingTeam = isCaptain1 ? 'A' : 'B';
      const updatedLobby = processTurnAction(
        freshLobby,
        actionId,
        actingTeam,
        targetPlayerId,
        playerName,
        options,
        Date.now()
      );

      const updates: Partial<Lobby> = {
        picks: updatedLobby.picks,
        bans: updatedLobby.bans,
        mapBans: updatedLobby.mapBans,
        seriesMaps: updatedLobby.seriesMaps,
        selectedMap: updatedLobby.selectedMap,
        turn: updatedLobby.turn,
        phase: updatedLobby.phase,
        timerStart: updatedLobby.timerStart,
        turnEndsAt: updatedLobby.turnEndsAt,
        lastActivityAt: updatedLobby.lastActivityAt,
        hiddenActions: updatedLobby.hiddenActions,
        replayLog: updatedLobby.replayLog,
      };

      if (!IS_DEV) {
        if (updates.timerStart) {
          updates.timerStart = serverTimestamp();
        }
        if (updates.lastActivityAt) {
          updates.lastActivityAt = serverTimestamp();
        }
        if (updates.turnEndsAt && typeof updates.turnEndsAt === 'number') {
          updates.turnEndsAt = Timestamp.fromMillis(updates.turnEndsAt);
        }
      }

      return { success: true, updates };
    } catch (error: any) {
      return { success: false, error: error.message || "Action execution failed" };
    }
  },

  async reportScore(
    lobby: Lobby,
    winner: 'A' | 'B' | null,
    isCaptain1: boolean,
    isCaptain2: boolean,
    generateStandardTurnOrder: (cfg: any, gameNumber?: number, lastWinner?: 'A' | 'B' | null) => { mapOrder: DraftTurn[], godOrder: DraftTurn[] },
    isAdminOverride: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    if (IS_DEV) {
      const freshLobby = getLocalLobby(lobby.id);
      if (!freshLobby) return { success: false, error: "Lobby not found" };

      const result = this._processReportLogic(freshLobby, winner, isCaptain1, isCaptain2, generateStandardTurnOrder, isAdminOverride);
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
        const result = this._processReportLogic(freshLobby, winner, isCaptain1, isCaptain2, generateStandardTurnOrder, isAdminOverride);

        if (!result.success) return { success: false, error: result.error };

        transaction.update(lobbyRef, cleanData(result.updates));
        return { success: true };
      });
    } catch (error: any) {
      if (error.message?.includes('failed-precondition')) {
        return { success: false, error: "O banco de dados está sincronizando os índices. Tente novamente em alguns segundos." };
      }
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${lobby.id}`);
      return { success: false, error: "Report failed" };
    }
  },

  _processReportLogic(
    lobby: Lobby,
    winner: 'A' | 'B' | null,
    isCaptain1: boolean,
    isCaptain2: boolean,
    generateStandardTurnOrder: any,
    isAdminOverride: boolean = false
  ): { success: boolean, error?: string, updates?: Partial<Lobby> } {
    try {
      const reportingTeam = isCaptain1 ? 'A' : 'B';
      const updatedLobby = processReportAction(
        lobby,
        winner,
        reportingTeam,
        Date.now(),
        { isAdminOverride }
      );

      const updates: Partial<Lobby> = {
        scoreA: updatedLobby.scoreA,
        scoreB: updatedLobby.scoreB,
        currentGame: updatedLobby.currentGame,
        lastWinner: updatedLobby.lastWinner,
        status: updatedLobby.status,
        phase: updatedLobby.phase,
        turnOrder: updatedLobby.turnOrder,
        turn: updatedLobby.turn,
        bans: updatedLobby.bans,
        reportVoteA: updatedLobby.reportVoteA,
        reportVoteB: updatedLobby.reportVoteB,
        reportStartAt: updatedLobby.reportStartAt,
        lastSubs: updatedLobby.lastSubs,
        rosterChangedA: updatedLobby.rosterChangedA,
        rosterChangedB: updatedLobby.rosterChangedB,
        pickerVoteA: updatedLobby.pickerVoteA,
        pickerVoteB: updatedLobby.pickerVoteB,
        pickerPlayerA: updatedLobby.pickerPlayerA,
        pickerPlayerB: updatedLobby.pickerPlayerB,
        readyA_report: updatedLobby.readyA_report,
        readyB_report: updatedLobby.readyB_report,
        picks: updatedLobby.picks,
        selectedMap: updatedLobby.selectedMap,
        history: updatedLobby.history,
        voteConflict: updatedLobby.voteConflict,
        lastActivityAt: updatedLobby.lastActivityAt
      };

      if (!IS_DEV) {
        if (updates.lastActivityAt) {
          updates.lastActivityAt = serverTimestamp();
        }
        if (updates.reportStartAt && typeof updates.reportStartAt === 'number') {
          updates.reportStartAt = Timestamp.fromMillis(updates.reportStartAt);
        }
      }

      return { success: true, updates };
    } catch (e: any) {
      return { success: false, error: e.message || "Report failed" };
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
          lastActivityAt: now()
        };

        if (isCaptain1 && !updates.pickerVoteA) updates.pickerVoteA = godId;
        if (isCaptain2 && !updates.pickerVoteB) updates.pickerVoteB = godId;

        if (updates.pickerVoteA && updates.pickerVoteB) {
          updates.phase = 'revealing';
          updates.timerStart = now();
        }

        transaction.update(lobbyRef, cleanData(updates));
        return { success: true };
      });
    } catch (error: any) {
      if (error.message?.includes('failed-precondition')) {
        return { success: false, error: "O banco de dados está sincronizando os índices. Tente novamente em alguns segundos." };
      }
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
        lastActivityAt: now()
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
      const namesChanged = newPicks.some(np => {
        const old = (freshLobby.picks || []).find(hp => hp.playerId === np.playerId && hp.team === np.team);
        return !!old && (old.playerName || '').trim() !== (np.playerName || '').trim();
      });
      const notifyOpponent = subs.length > 0 || namesChanged;

      // Extract updated names into the lobby's persistent team arrays so they survive into the next game
      const nextTeamAPlayers = [...(freshLobby.teamAPlayers || [])];
      const nextTeamBPlayers = [...(freshLobby.teamBPlayers || [])];
      
      // We must figure out the roster index for each updated pick.
      // Easiest way is to sort the team's picks by playerId ascending (which matches the roster array order 0, 1, 2)
      // Since teamAPlayers always has 3 elements matching the 3 playerIds.
      const getSortedTeamIds = (t: 'A' | 'B') => {
         const ids = newHistoryPicks.filter(p => p.team === t).map(p => p.playerId).sort((a, b) => a - b);
         return ids;
      };
      
      const teamAIds = getSortedTeamIds('A');
      const teamBIds = getSortedTeamIds('B');

      newHistoryPicks.forEach(p => {
        const targetArr = p.team === 'A' ? nextTeamAPlayers : nextTeamBPlayers;
        const ids = p.team === 'A' ? teamAIds : teamBIds;
        const rosterIdx = ids.indexOf(p.playerId);
        
        if (rosterIdx !== -1 && targetArr[rosterIdx]) {
           targetArr[rosterIdx] = { ...targetArr[rosterIdx], name: p.playerName || targetArr[rosterIdx].name };
        }
      });

      setLocalLobby(lobby.id, cleanData({
        ...freshLobby,
        picks: newHistoryPicks,
        teamAPlayers: nextTeamAPlayers,
        teamBPlayers: nextTeamBPlayers,
        ...(subs.length > 0 ? { lastSubs: [...(freshLobby.lastSubs || []), ...subs] } : {}),
        ...(notifyOpponent
          ? team === 'A'
            ? { rosterChangedA: true }
            : { rosterChangedB: true }
          : {}),
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
        const updates: Partial<Lobby> = { lastActivityAt: now() };

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
        if (subs.length > 0) {
          updates.lastSubs = [...(freshLobby.lastSubs || []), ...subs];
        }

        const namesChanged = newPicks.some(np => {
          const old = (freshLobby.picks || []).find(hp => hp.playerId === np.playerId && hp.team === np.team);
          return !!old && (old.playerName || '').trim() !== (np.playerName || '').trim();
        });
        const notifyOpponent = subs.length > 0 || namesChanged;
        if (notifyOpponent) {
          if (team === 'A') updates.rosterChangedA = true;
          else updates.rosterChangedB = true;
        }

        const teamKey = team === 'A' ? 'teamAPlayers' : 'teamBPlayers';
        const currentRoster = (team === 'A' ? (freshLobby.teamAPlayers || []) : (freshLobby.teamBPlayers || []));
        const updatedRosterNames = [...currentRoster.map(p => p.name)];

        // Update names from picks if they changed
        newPicks.filter(p => p.team === team && p.playerName).forEach(p => {
          // If the player name in the pick isn't in the roster yet, we might have a problem
          // but for now let's just ensure the roster has all names from confirmed picks
          if (!updatedRosterNames.includes(p.playerName!.trim())) {
            // This is a simple pool, so we just ensure the name exists
            // In a real scenario, we might want more complex logic for subs
          }
        });

        (updates as any)[teamKey] = updatedRosterNames.map(name => ({ name }));

        transaction.update(lobbyRef, cleanData(updates));
        return { success: true };
      });
    } catch (error: any) {
      if (error.message?.includes('failed-precondition')) {
        return { success: false, error: "O banco de dados está sincronizando os índices. Tente novamente em alguns segundos." };
      }
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${lobby.id}`);
      return { success: false, error: "Roster update failed" };
    }
  }
};
