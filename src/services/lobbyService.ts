import { 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  query,
  collection,
  where,
  orderBy,
  limit,
  Unsubscribe,
  serverTimestamp,
  runTransaction,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Lobby, LobbyConfig, PickEntry, ChatMessage, LobbySummary, LobbyIndex } from '../types';
import { PLAYER_COLORS, MCL_ROUND_MAPS } from '../constants';

export const generateId = () => Math.random().toString(36).substring(2, 9);

// ADICIONE ISSO AQUI:
const cleanData = (obj: any) => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach(key => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    } else if (newObj[key] && typeof newObj[key] === 'object' && !newObj[key].toDate) {
      newObj[key] = cleanData(newObj[key]);
    }
  });
  return newObj;
};
export const lobbyService = {
  async createLobby(id: string, lobby: Lobby): Promise<void> {
    try {
      await setDoc(doc(db, 'lobbies', id), cleanData(lobby));
      // Trigger index refresh on creation if public
      if (!lobby.config.isPrivate) {
        this.refreshLobbyIndex();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `lobbies/${id}`);
    }
  },

  async getLobby(id: string): Promise<Lobby | null> {
    try {
      const docSnap = await getDoc(doc(db, 'lobbies', id));
      return docSnap.exists() ? (docSnap.data() as Lobby) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `lobbies/${id}`);
      return null;
    }
  },

  async updateLobby(id: string, updates: Partial<Lobby>): Promise<void> {
    try {
    await updateDoc(doc(db, 'lobbies', id), cleanData({
      ...updates,
    lastActivityAt: serverTimestamp()
}));  
      // If status or score changed, refresh index
      if (updates.status || updates.scoreA !== undefined || updates.scoreB !== undefined) {
        this.refreshLobbyIndex();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async setHoveredGod(id: string, team: 'A' | 'B', godId: string | null): Promise<void> {
    try {
      await updateDoc(doc(db, 'lobbies', id), cleanData({
        [`hoveredGodId${team}`]: godId,
        lastActivityAt: serverTimestamp()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async forceUnpause(id: string): Promise<void> {
    const lobbyRef = doc(db, 'lobbies', id);
    await runTransaction(db, async (transaction) => {
      const lobbyDoc = await transaction.get(lobbyRef);
      if (!lobbyDoc.exists()) return;

      const data = lobbyDoc.data() as Lobby;
      if (!data.isPaused) return;

      const updates: Partial<Lobby> = {
        captain1Active: true,
        captain2Active: true,
        isPaused: false
      };

      if (data.timerStart && data.timerPausedAt) {
        const pausedAt = (data.timerPausedAt as any).toDate().getTime();
        const now = new Date().getTime();
        const pausedDuration = now - pausedAt;
        const oldStart = (data.timerStart as any).toDate().getTime();
        updates.timerStart = Timestamp.fromMillis(oldStart + pausedDuration);
        updates.timerPausedAt = null;
      }

      transaction.update(lobbyRef, updates);
    });
  },

  async updatePresence(id: string, captain: 'A' | 'B', active: boolean): Promise<void> {
    try {
      const { getServerTime } = await import('../lib/serverTime');
      const docRef = doc(db, 'lobbies', id);
      
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) return;
        
        const data = docSnap.data() as Lobby;
        const updates: any = {
          lastActivityAt: serverTimestamp()
        };
        
        if (captain === 'A') updates.captain1Active = active;
        if (captain === 'B') updates.captain2Active = active;
        
        const c1Active = captain === 'A' ? active : (data.captain1Active ?? true);
        const c2Active = captain === 'B' ? active : (data.captain2Active ?? true);
        
        const timerPhases = ['drafting', 'map_ban', 'map_pick', 'god_ban', 'god_pick', 'god_picker'];
        const isTimerPhase = timerPhases.includes(data.phase);
        
        const wasPaused = data.isPaused ?? false;
        const nowPaused = isTimerPhase && (!c1Active || !c2Active);
        
        updates.isPaused = nowPaused;

        if (!wasPaused && nowPaused && data.timerStart) {
          // Pausing: calculate and store remaining time
          let startTime: number;
          if (typeof data.timerStart === 'string') {
            startTime = new Date(data.timerStart).getTime();
          } else if (data.timerStart && typeof data.timerStart.toMillis === 'function') {
            startTime = data.timerStart.toMillis();
          } else {
            startTime = Date.now();
          }
          
          const now = getServerTime();
          const elapsed = (now - startTime) / 1000;
          const duration = data.config.timerDuration || 60;
          updates.pausedTimeLeft = Math.max(0, duration - Math.floor(elapsed));
        } else if (wasPaused && !nowPaused && data.pausedTimeLeft !== undefined && data.pausedTimeLeft !== null) {
          // Resuming: adjust timerStart based on stored remaining time
          const now = getServerTime();
          const duration = data.config.timerDuration || 60;
          const newStartTimeMillis = now - (duration - data.pausedTimeLeft) * 1000;
          updates.timerStart = Timestamp.fromMillis(newStartTimeMillis);
          updates.pausedTimeLeft = null;
        }

        transaction.update(docRef, updates);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async forceReset(id: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'lobbies', id), cleanData({
        status: 'waiting',
        phase: 'waiting',
        turn: 0,
        picks: [],
        bans: [],
        readyA: false,
        readyB: false,
        readyA_report: false,
        readyB_report: false,
        readyA_nextGame: false,
        readyB_nextGame: false,
        reportVoteA: null,
        reportVoteB: null,
        voteConflict: false,
        voteConflictCount: 0,
        reportStartAt: null,
        timerStart: null,
        isPaused: false,
        scoreA: 0,
        scoreB: 0,
        currentGame: 1,
        history: [],
        replayLog: [],
        seriesMaps: [],
        mapPool: [],
        mapBans: [],
        lastWinner: null,
        pickerVoteA: null,
        pickerVoteB: null,
        selectedMap: null,
        resetRequest: null,
        lastActivityAt: serverTimestamp()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async requestReset(id: string, team: 'A' | 'B'): Promise<void> {
    try {
      const docRef = doc(db, 'lobbies', id);
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) return;
        const data = docSnap.data() as Lobby;
        
        if (data.resetRequest) return;

        const updates: any = {
          resetRequest: {
            requestedBy: team,
            status: 'pending',
            timestamp: serverTimestamp()
          },
          isPaused: true,
          timerPausedAt: serverTimestamp(),
          lastActivityAt: serverTimestamp()
        };

        transaction.update(docRef, updates);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async respondReset(id: string, accept: boolean): Promise<void> {
    try {
      const docRef = doc(db, 'lobbies', id);
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) return;
        const data = docSnap.data() as Lobby;
        
        if (!data.resetRequest) return;

        if (accept) {
          const filteredReplayLog = (data.replayLog || []).filter(log => log.gameNumber !== data.currentGame);
          const newSeriesMaps = [...(data.seriesMaps || [])];
          
          let restoredMap = "";
          if (data.config.preset === 'MCL' && data.config.mclRound) {
            const roundMap = MCL_ROUND_MAPS[data.config.mclRound];
            const gameCount = data.config.seriesType === 'BO3' ? 3 : (data.config.customGameCount || 1);
            if (gameCount >= 3 && data.currentGame === 3) restoredMap = roundMap;
          }

          if (newSeriesMaps.length >= data.currentGame) {
            newSeriesMaps[data.currentGame - 1] = restoredMap;
          }

          transaction.update(docRef, {
            status: 'drafting',
            phase: 'ready',
            turn: 0,
            picks: data.picks.map(p => ({ ...p, godId: null, isRandom: false })),
            bans: [],
            mapBans: data.currentGame === 1 ? [] : data.mapBans,
            readyA: false,
            readyB: false,
            readyA_nextGame: false,
            readyB_nextGame: false,
            replayLog: filteredReplayLog,
            seriesMaps: newSeriesMaps,
            selectedMap: restoredMap || null,
            timerStart: null,
            isPaused: false,
            timerPausedAt: null,
            resetRequest: null,
            lastActivityAt: serverTimestamp()
          });
        } else {
          const updates: any = {
            resetRequest: null,
            lastActivityAt: serverTimestamp()
          };

          // Resume timer logic
          if (data.isPaused && data.timerStart && data.timerPausedAt) {
             const pausedAt = (data.timerPausedAt as any).toDate().getTime();
             const now = new Date().getTime();
             const pausedDuration = now - pausedAt;
             const oldStart = (data.timerStart as any).toDate().getTime();
             updates.timerStart = Timestamp.fromMillis(oldStart + pausedDuration);
             updates.timerPausedAt = null;
             updates.isPaused = false;
          }

          transaction.update(docRef, updates);
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async resetCurrentGame(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'lobbies', id);
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) return;
        
        const data = docSnap.data() as Lobby;
        
        // Remove current game's actions from replayLog
        const filteredReplayLog = (data.replayLog || []).filter(log => log.gameNumber !== data.currentGame);
        
        // Restore pre-determined map for MCL if applicable
        const newSeriesMaps = [...(data.seriesMaps || [])];
        let restoredMap = "";
        if (data.config.preset === 'MCL' && data.config.mclRound) {
          const roundMap = MCL_ROUND_MAPS[data.config.mclRound];
          const gameCount = data.config.seriesType === 'BO3' ? 3 : (data.config.customGameCount || 1);
          if (gameCount >= 3 && data.currentGame === 3) restoredMap = roundMap;
        }

        if (newSeriesMaps.length >= data.currentGame) {
          newSeriesMaps[data.currentGame - 1] = restoredMap;
        }

        transaction.update(docRef, {
          status: 'drafting',
          phase: 'ready',
          turn: 0,
          picks: data.picks.map(p => ({ ...p, godId: null, isRandom: false })), // Keep players but remove gods
          bans: [],
          mapBans: data.currentGame === 1 ? [] : data.mapBans,
          readyA: false,
          readyB: false,
          readyA_nextGame: false,
          readyB_nextGame: false,
          replayLog: filteredReplayLog,
          seriesMaps: newSeriesMaps,
          selectedMap: restoredMap || null,
          timerStart: serverTimestamp(),
          isPaused: false,
          lastActivityAt: serverTimestamp()
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async forceFinish(id: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'lobbies', id), cleanData({
        status: 'finished',
        phase: 'finished',
        lastActivityAt: serverTimestamp()
      }));
      this.refreshLobbyIndex();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async deleteLobby(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'lobbies', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `lobbies/${id}`);
    }
  },

  async clearAllLobbies(): Promise<void> {
    try {
      const q = query(collection(db, 'lobbies'), where('isHidden', '==', false));
      const snap = await getDocs(q);
      if (snap.empty) return;
      
      const chunks = [];
      for (let i = 0; i < snap.docs.length; i += 500) {
        chunks.push(snap.docs.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(d => {
          batch.update(d.ref, { isHidden: true });
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'lobbies');
    }
  },

  subscribeToLobby(id: string, onUpdate: (lobby: Lobby) => void, onError: (err: Error) => void): Unsubscribe {
    return onSnapshot(doc(db, 'lobbies', id), (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as Lobby);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `lobbies/${id}`);
      onError(error);
    });
  },

  subscribeToPublicLobbies(onUpdate: (lobbies: LobbySummary[]) => void): Unsubscribe {
    const indexRef = doc(db, 'metadata', 'lobby_index');
    
    // Auto-trigger cleanup check
    this.checkAndCleanup();

    return onSnapshot(indexRef, (snap) => {
      console.log(`[Lobby Index] Snap received, exists: ${snap.exists()}`);
      if (snap.exists()) {
        const data = snap.data() as LobbyIndex;
        const lobbiesArray = Array.isArray(data.activeLobbies) ? data.activeLobbies : [];
        onUpdate(lobbiesArray);
      } else {
        // Fallback to direct query if index doesn't exist yet
        this.fallbackToDirectQuery(onUpdate);
      }
    }, (error) => {
      console.warn("[Lobby Index] Subscription failed (likely permissions), falling back to query:", error.message);
      this.fallbackToDirectQuery(onUpdate);
    });
  },

  async fallbackToDirectQuery(onUpdate: (lobbies: LobbySummary[]) => void): Promise<void> {
    try {
      console.log("[Lobby Index] Falling back to direct query on 'lobbies' collection...");
      const q = query(
        collection(db, 'lobbies'),
        limit(50)
      );
      const s = await getDocs(q);
      console.log(`[Lobby Index] Fallback found ${s.size} total lobbies`);
      
      const summaries = s.docs
        .map(d => {
          const data = d.data() as Lobby;
          if (!data.config) {
            console.warn(`Lobby ${d.id} is missing config`, data);
            return null;
          }
          if (data.config.isPrivate) return null;

          const summary = {
            id: d.id,
            name: data.config.name || `${data.config.teamSize || 2}v${data.config.teamSize || 2} Draft`,
            teamSize: data.config.teamSize || 2,
            captain1Name: data.captain1Name || 'Captain 1',
            captain2Name: data.captain2Name || 'Captain 2',
            status: data.status || 'waiting',
            phase: data.phase || 'waiting',
            preset: data.config.preset ?? null,
            mclRound: data.config.mclRound ?? null,
            tournamentStage: data.config.tournamentStage ?? null,
            lastActivityAt: data.lastActivityAt ?? null,
            createdAt: data.createdAt ?? null
          } as LobbySummary;

          // Remove strictly undefined fields
          Object.keys(summary).forEach(key => {
            if ((summary as any)[key] === undefined) {
              delete (summary as any)[key];
            }
          });

          return summary;
        })
        .filter((l): l is LobbySummary => l !== null);
      
      onUpdate(summaries);
    } catch (err) {
      console.error("[Lobby Index] Fallback query failed:", err);
      onUpdate([]);
    }
  },

  async checkAndCleanup(): Promise<void> {
    try {
      const metaRef = doc(db, 'meta', 'cleanup');
      const metaSnap = await getDoc(metaRef);
      const now = Date.now();
      const twelveHours = 12 * 60 * 60 * 1000;

      if (metaSnap.exists()) {
        const lastCleanup = metaSnap.data().lastCleanupAt?.toMillis() || 0;
        if (now - lastCleanup < twelveHours) return;
      }

      // Update timestamp first to prevent concurrent cleanups from same user session
      await setDoc(metaRef, cleanData({ lastCleanupAt: serverTimestamp() }), { merge: true });

      // Find lobbies older than 12 hours
      const oldDate = new Date(now - twelveHours);
      const q = query(
        collection(db, 'lobbies'),
        where('createdAt', '<', Timestamp.fromDate(oldDate)),
        limit(100)
      );

      const snap = await getDocs(q);
      if (snap.empty) return;

      const batch = writeBatch(db);
      let count = 0;
      snap.docs.forEach(d => {
        const data = d.data() as Lobby;
        const isFinished = data.status === 'finished' || data.phase === 'finished';
        
        // Never hide finished drafts or permanent ones, and ignore already hidden
        if (!data.isPermanent && !isFinished && data.isHidden !== true) {
          batch.update(d.ref, { isHidden: true });
          count++;
        }
      });
      if (count > 0) await batch.commit();
      console.log(`Cleaned up ${count} old lobbies.`);
    } catch (error) {
      console.error("Cleanup failed:", error);
    }
  },

  async joinLobby(
    id: string, 
    guestId: string, 
    nickname: string, 
    role: 'A' | 'B' | 'SPECTATOR',
    preferredPosition: 'corner' | 'middle',
    playerNames: Record<number, string>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const docRef = doc(db, 'lobbies', id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return { success: false, error: "Lobby not found" };
      }

      const data = docSnap.data() as Lobby;
      const updates: any = {};

      const isMCL = data.config.preset === 'MCL';

      if (role === 'A') {
        if (data.captain1 && data.captain1 !== guestId) {
          return { success: false, error: "Host slot already taken" };
        }
        updates.captain1 = guestId;
        updates.captain1Active = true;
        
        // Use nickname for 1v1 if no custom team name provided
        const is1v1 = data.config.teamSize === 1;
        const defaultNames = ['Team A (Host)', 'Time A (Host)', 'Team A', 'Time A', 'Host', 'Time A (Host)'];
        updates.captain1Name = playerNames[100] || nickname;
        if (is1v1 && (!playerNames[100] || defaultNames.includes(playerNames[100]))) {
          updates.captain1Name = nickname;
        }
        
        if (!isMCL) {
          updates.picks = data.picks.map(p => {
            if (p.team === 'A') {
              if (playerNames && playerNames[p.playerId]) {
                return { ...p, playerName: playerNames[p.playerId] };
              }
            }
            return p;
          });
        }
        
        // Store roster for easier access
        const teamSlots = isMCL ? [1, 4, 5] : [1, 5, 4];
        updates.teamAPlayers = Object.entries(playerNames)
          .filter(([id]) => teamSlots.includes(Number(id)))
          .map(([id, name]) => ({ name: name as string, position: Number(id) }));

      } else if (role === 'B') {
        if (data.captain2 && data.captain2 !== guestId) {
          return { success: false, error: "Guest slot already taken" };
        }
        updates.captain2 = guestId;
        updates.captain2Active = true;
        
        // Use nickname for 1v1 if no custom team name provided
        const is1v1 = data.config.teamSize === 1;
        const defaultNames = ['Team B (Guest)', 'Time B (Guest)', 'Team B', 'Time B', 'Guest', 'Time B (Convidado)', 'Convidado'];
        updates.captain2Name = playerNames[200] || nickname;
        if (is1v1 && (!playerNames[200] || defaultNames.includes(playerNames[200]))) {
          updates.captain2Name = nickname;
        }

        if (!isMCL) {
          updates.picks = (updates.picks || data.picks).map(p => {
            if (p.team === 'B') {
              if (playerNames && playerNames[p.playerId]) {
                return { ...p, playerName: playerNames[p.playerId] };
              }
            }
            return p;
          });
        }

        // Store roster for easier access
        const teamSlots = isMCL ? [2, 3, 6] : [2, 6, 3];
        updates.teamBPlayers = Object.entries(playerNames)
          .filter(([id]) => teamSlots.includes(Number(id)))
          .map(([id, name]) => ({ name: name as string, position: Number(id) }));
      } else {
        const spectators = data.spectators || [];
        if (!spectators.some(s => s.id === guestId)) {
          updates.spectators = [...spectators, { id: guestId, name: nickname }];
        }
      }

      if (data.phase === 'waiting' && (updates.captain1 || data.captain1) && (updates.captain2 || data.captain2)) {
        updates.phase = 'ready';
      }

      await updateDoc(docRef, cleanData(updates));
      if (!data.config.isPrivate) this.refreshLobbyIndex();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async savePreset(name: string, config: LobbyConfig): Promise<string> {
    try {
      const id = generateId();
      const preset = {
        id,
        name,
        config,
        createdAt: serverTimestamp()
      };
      await setDoc(doc(db, 'presets', id), cleanData(preset));
      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'presets');
      throw error;
    }
  },

  async setReady(id: string, team: 'A' | 'B', isReadyArg: any, guestId: string, generateTurnOrder: any): Promise<void> {
    const docRef = doc(db, 'lobbies', id);
    const isReady = !!isReadyArg;

    try {
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) throw new Error("Lobby not found");
        
        const data = docSnap.data() as Lobby;

        // Verify guestId matches the captain for the team
        if (team === 'A' && data.captain1 !== guestId) throw new Error("Not authorized for Team A");
        if (team === 'B' && data.captain2 !== guestId) throw new Error("Not authorized for Team B");

        const updates: any = {};
        const isGame1Ready = data.currentGame === 1 && (data.status === 'waiting' || data.phase === 'ready' || data.phase === 'waiting');
        const isReadyWaitPhase = isGame1Ready || data.phase === 'ready_picker';
        
        if (isReadyWaitPhase) {
          if (team === 'A') {
            updates.readyA = isReady;
            if (data.captain1 && data.captain2 && data.captain1 === data.captain2) updates.readyB = isReady;
          }
          if (team === 'B') {
            updates.readyB = isReady;
            if (data.captain1 && data.captain2 && data.captain1 === data.captain2) updates.readyA = isReady;
          }
          
          const isAReady = team === 'A' ? isReady : (data.captain1 && data.captain2 && data.captain1 === data.captain2 ? isReady : data.readyA);
          const isBReady = team === 'B' ? isReady : (data.captain1 && data.captain2 && data.captain1 === data.captain2 ? isReady : data.readyB);
          
          if (isAReady && isBReady) {
            if (data.status === 'waiting' || (data.status === 'drafting' && data.phase === 'ready')) {
              updates.status = 'drafting';
              updates.turn = 0;
              updates.timerStart = serverTimestamp();
              
              const currentTurn = data.turnOrder[0];
              if (currentTurn) {
                if (currentTurn.target === 'MAP') {
                  updates.phase = currentTurn.action === 'BAN' ? 'map_ban' : 'map_pick';
                } else {
                  updates.phase = currentTurn.action === 'BAN' ? 'god_ban' : 'god_pick';
                }
              }
            } else if (data.phase === 'ready_picker') {
              updates.phase = 'god_picker';
              updates.timerStart = serverTimestamp();
            }
          }
        } else {
          // Phase is 'ready' or 'finished' (next game ready check)
          if (team === 'A') {
            updates.readyA_nextGame = isReady;
            if (data.captain1 && data.captain2 && data.captain1 === data.captain2) updates.readyB_nextGame = isReady;
          }
          if (team === 'B') {
            updates.readyB_nextGame = isReady;
            if (data.captain1 && data.captain2 && data.captain1 === data.captain2) updates.readyA_nextGame = isReady;
          }
          
          const isAReady = team === 'A' ? isReady : (data.captain1 && data.captain2 && data.captain1 === data.captain2 ? isReady : data.readyA_nextGame);
          const isBReady = team === 'B' ? isReady : (data.captain1 && data.captain2 && data.captain1 === data.captain2 ? isReady : data.readyB_nextGame);
          
          if (isAReady && isBReady) {
            const nextGameNumber = data.currentGame;
            const { mapOrder, godOrder } = generateTurnOrder(data.config, nextGameNumber, data.lastWinner);
            
            let effectiveTurnOrder: any[] = [];
            let selectedMap = data.seriesMaps[nextGameNumber - 1];
            
            if (selectedMap && selectedMap !== "") {
              effectiveTurnOrder = [...godOrder];
            } else {
              if (data.config.loserPicksNextMap && data.lastWinner) {
                const loser = data.lastWinner === 'A' ? 'B' : 'A';
                effectiveTurnOrder = [{ player: loser, action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' }, ...godOrder];
              } else {
                effectiveTurnOrder = [...mapOrder, ...godOrder];
              }
            }

            if (nextGameNumber > 1) {
              let shouldInvert = true;
              if (data.config.preset === 'MCL') {
                // generateTurnOrder already handles the correct starting team for MCL
                shouldInvert = false;
              } else if (nextGameNumber === 3 && data.config.preset !== 'MCL') {
                shouldInvert = true;
              } else {
                shouldInvert = true;
              }
              
              if (shouldInvert) {
                effectiveTurnOrder = effectiveTurnOrder.map(t => {
                  if (t.target === 'GOD') {
                    return { ...t, player: t.player === 'A' ? 'B' : t.player === 'B' ? 'A' : t.player };
                  }
                  return t;
                });
              }
            }

            // MCL Special Rule: Force Map Pick for Guest in Game 2
            if (data.config.preset === 'MCL' && nextGameNumber === 2) {
              effectiveTurnOrder = [
                { player: 'B', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' },
                ...effectiveTurnOrder.filter(t => t.target === 'GOD')
              ];
            }

            updates.readyA_nextGame = false;
            updates.readyB_nextGame = false;
            updates.status = 'drafting';
            updates.turn = 0;
            updates.turnOrder = effectiveTurnOrder;
            updates.timerStart = serverTimestamp();
            updates.rosterChangedA = false;
            updates.rosterChangedB = false;
            
            const currentTurn = effectiveTurnOrder[0];
            if (currentTurn) {
              if (currentTurn.target === 'MAP') {
                updates.phase = currentTurn.action === 'BAN' ? 'map_ban' : 'map_pick';
              } else {
                updates.phase = currentTurn.action === 'BAN' ? 'god_ban' : 'god_pick';
              }
            }
          }
        }
        
        transaction.update(docRef, { ...updates, lastActivityAt: serverTimestamp() });
      });

      // Refresh index if status/phase changed and it's public
      const finalSnap = await getDoc(docRef);
      if (finalSnap.exists()) {
        const finalData = finalSnap.data() as Lobby;
        if (!finalData.config.isPrivate) {
          this.refreshLobbyIndex();
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async leaveSlot(id: string, team: 'A' | 'B'): Promise<void> {
    try {
      const updates: any = {};
      if (team === 'A') {
        updates.captain1 = null;
        updates.captain1Active = false;
      } else {
        updates.captain2 = null;
        updates.captain2Active = false;
      }
      await updateDoc(doc(db, 'lobbies', id), cleanData(updates));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async getPreset(id: string): Promise<any | null> {
    try {
      const docSnap = await getDoc(doc(db, 'presets', id));
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `presets/${id}`);
      return null;
    }
  },

  async soloJoin(lobbyId: string, guestId: string, nickname: string): Promise<{ success: boolean; error?: string }> {
    try {
      const docRef = doc(db, 'lobbies', lobbyId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return { success: false, error: "Lobby not found" };
      
      const data = docSnap.data() as Lobby;
      const teamSize = data.config.teamSize;
      
      const updates: any = {
        captain1: guestId,
        captain1Name: `${nickname} (A)`,
        captain1Pos: teamSize === 1 ? 5 : 5,
        captain2: guestId,
        captain2Name: `${nickname} (B)`,
        captain2Pos: teamSize === 1 ? 6 : 6,
        readyA: true,
        readyB: true,
        teamAPlayers: [],
        teamBPlayers: [],
        status: 'drafting',
        turn: 0,
        turnOrder: data.turnOrder,
        timerStart: serverTimestamp(),
        phase: data.turnOrder[0].target === 'MAP' 
          ? (data.turnOrder[0].action === 'BAN' ? 'map_ban' : 'map_pick')
          : (data.turnOrder[0].action === 'BAN' ? 'god_ban' : 'god_pick')
      };

      // Fill player names for both teams
      const playerNamesA: Record<number, string> = {};
      const playerNamesB: Record<number, string> = {};
      
      if (teamSize === 1) {
        playerNamesA[5] = `${nickname} (A)`;
        playerNamesB[6] = `${nickname} (B)`;
      } else {
        const isMCL = data.config.preset === 'MCL';
        const slotsA = isMCL ? [1, 4, 5] : [1, 5, 4];
        const slotsB = isMCL ? [2, 3, 6] : [2, 6, 3];
        
        slotsA.forEach(id => playerNamesA[id] = `${nickname} (A)`);
        slotsB.forEach(id => playerNamesB[id] = `${nickname} (B)`);
      }

      updates.teamAPlayers = Object.entries(playerNamesA).map(([id, name]) => ({ name, position: Number(id) }));
      updates.teamBPlayers = Object.entries(playerNamesB).map(([id, name]) => ({ name, position: Number(id) }));

      updates.picks = data.picks.map(p => {
        if (p.team === 'A' && playerNamesA[p.playerId]) {
          return { ...p, playerName: playerNamesA[p.playerId] };
        }
        if (p.team === 'B' && playerNamesB[p.playerId]) {
          return { ...p, playerName: playerNamesB[p.playerId] };
        }
        return p;
      });

      await updateDoc(docRef, cleanData(updates));
      if (!data.config.isPrivate) this.refreshLobbyIndex();
      return { success: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${lobbyId}`);
      return { success: false, error: "Failed to join solo" };
    }
  },

  subscribeToPresets(onUpdate: (presets: any[]) => void): Unsubscribe {
    const q = query(collection(db, 'presets'), orderBy('createdAt', 'desc'), limit(20));
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => d.data()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'presets');
    });
  },

  async sendChatMessage(lobbyId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<void> {
    try {
      const messagesRef = collection(db, 'lobbies', lobbyId, 'messages');
      await addDoc(messagesRef, cleanData({
        ...message,
        timestamp: serverTimestamp()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `lobbies/${lobbyId}/messages`);
    }
  },

  subscribeToMessages(lobbyId: string, onUpdate: (messages: ChatMessage[]) => void): Unsubscribe {
    const messagesRef = collection(db, 'lobbies', lobbyId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

    return onSnapshot(q, (snap) => {
      const messages = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
      onUpdate(messages);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `lobbies/${lobbyId}/messages`);
    });
  },

  async refreshLobbyIndex(): Promise<void> {
    try {
      const q = query(
        collection(db, 'lobbies'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      
      const snap = await getDocs(q);
      const publicLobbies = snap.docs.filter(d => {
        const data = d.data() as Lobby;
        return data.config && !data.config.isPrivate;
      }).slice(0, 20);

      console.log(`[Refresh Index] Found ${publicLobbies.length} public lobbies`);
      const summaries: LobbySummary[] = publicLobbies.map(d => {
        const data = d.data() as Lobby;
        
        const summary = {
          id: d.id,
          name: data.config.name || `${data.config.teamSize || 2}v${data.config.teamSize || 2} Draft`,
          teamSize: data.config.teamSize || 2,
          captain1Name: data.captain1Name || 'Captain 1',
          captain2Name: data.captain2Name || 'Captain 2',
          status: data.status || 'waiting',
          phase: data.phase || 'waiting',
          preset: data.config.preset ?? null,
          mclRound: data.config.mclRound ?? null,
          tournamentStage: data.config.tournamentStage ?? null,
          lastActivityAt: data.lastActivityAt ?? null,
          createdAt: data.createdAt ?? null
        };
        
        // Remove strictly undefined fields
        Object.keys(summary).forEach(key => {
          if ((summary as any)[key] === undefined) {
            delete (summary as any)[key];
          }
        });
        
        return summary as LobbySummary;
      });

      await setDoc(doc(db, 'metadata', 'lobby_index'), cleanData({
        activeLobbies: summaries,
        lastUpdate: serverTimestamp()
      }), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'metadata/lobby_index');
      console.error("Failed to refresh lobby index:", error);
    }
  }
};
