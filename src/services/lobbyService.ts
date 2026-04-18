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
import { db, auth } from '../firebase';
import { Lobby, LobbyConfig, PickEntry, ChatMessage } from '../types';
import { PLAYER_COLORS } from '../constants';

export const generateId = () => Math.random().toString(36).substring(2, 9);

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
    databaseId: (db as any)._databaseId?.database || 'unknown',
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const lobbyService = {
  async createLobby(id: string, lobby: Lobby): Promise<void> {
    try {
      await setDoc(doc(db, 'lobbies', id), lobby);
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
      await updateDoc(doc(db, 'lobbies', id), {
        ...updates,
        lastActivityAt: serverTimestamp()
      });
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
          const duration = data.config.timerDuration || 30;
          updates.pausedTimeLeft = Math.max(0, duration - Math.floor(elapsed));
        } else if (wasPaused && !nowPaused && data.pausedTimeLeft !== undefined && data.pausedTimeLeft !== null) {
          // Resuming: adjust timerStart based on stored remaining time
          const now = getServerTime();
          const duration = data.config.timerDuration || 30;
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
      await updateDoc(doc(db, 'lobbies', id), {
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
        lastActivityAt: serverTimestamp()
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
        
        // Remove current game's map if not pre-selected
        const newSeriesMaps = [...(data.seriesMaps || [])];
        if (newSeriesMaps.length >= data.currentGame) {
          newSeriesMaps[data.currentGame - 1] = "";
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
          selectedMap: null,
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
      await updateDoc(doc(db, 'lobbies', id), {
        status: 'finished',
        phase: 'finished',
        lastActivityAt: serverTimestamp()
      });
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
      const snap = await getDocs(collection(db, 'lobbies'));
      if (snap.empty) return;
      
      const chunks = [];
      for (let i = 0; i < snap.docs.length; i += 500) {
        chunks.push(snap.docs.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(d => {
          const data = d.data() as any;
          if (data.isHidden !== true) {
            batch.update(d.ref, { isHidden: true });
          }
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

  subscribeToPublicLobbies(onUpdate: (lobbies: Lobby[]) => void): Unsubscribe {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const q = query(
      collection(db, 'lobbies'), 
      where('config.isPrivate', '==', false),
      where('isHidden', '==', false),
      where('createdAt', '>', Timestamp.fromDate(yesterday)), 
      orderBy('status', 'asc'), // Prioriza drafts finalizados
      orderBy('createdAt', 'desc'),
      limit(20) // Reduzido de 500 para 20 para economizar leituras
    );

    return onSnapshot(q, (snap) => {
      const lobbies = snap.docs.map(d => d.data() as Lobby);
      onUpdate(lobbies);
    }, (error) => {
      // Use sua função de erro original que já está no código
      handleFirestoreError(error, OperationType.LIST, 'lobbies');
    });
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

      await updateDoc(docRef, updates);
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
      await setDoc(doc(db, 'presets', id), preset);
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
        const isReadyWaitPhase = data.status === 'waiting' || data.phase === 'ready_picker' || data.phase === 'waiting';
        
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
            if (data.status === 'waiting') {
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
      await updateDoc(doc(db, 'lobbies', id), updates);
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

      await updateDoc(docRef, updates);
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
      await addDoc(messagesRef, {
        ...message,
        timestamp: serverTimestamp()
      });
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
  }
};
