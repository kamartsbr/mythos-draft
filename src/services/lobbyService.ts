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
  startAfter,
  Unsubscribe,
  serverTimestamp,
  runTransaction,
  Timestamp,
  addDoc,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Lobby, LobbyConfig, PickEntry, ChatMessage, LobbySummary, LobbyIndex } from '../types';
import { PLAYER_COLORS, MCL_ROUND_MAPS } from '../constants';

// --- SHIELDING: MOCK LAYER CONFIG ---
export const IS_DEV = import.meta.env.VITE_VIBE_MODE === 'DEVELOPMENT';
const STORAGE_PREFIX = 'mythos_draft_dev_';

/**
 * Verifica se o lobby está em modo Solo Admin (captain1 === captain2).
 * Centralizado aqui para evitar que cada serviço implemente a própria heurística.
 */
export const isSoloAdminLobby = (lobby: { captain1?: string | null; captain2?: string | null }): boolean =>
  !!(lobby.captain1 && lobby.captain2 && lobby.captain1 === lobby.captain2);

const now = () => IS_DEV ? Date.now() : serverTimestamp();

const getLocalLobby = (id: string): Lobby | null => {
  const data = localStorage.getItem(`${STORAGE_PREFIX}lobby_${id}`);
  if (!data) return null;
  return JSON.parse(data);
};

const setLocalLobby = (id: string, lobby: Lobby) => {
  localStorage.setItem(`${STORAGE_PREFIX}lobby_${id}`, JSON.stringify(lobby));
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new CustomEvent('storage_update', { detail: lobby }));
};

const getLocalIndex = (): LobbySummary[] => {
  const data = localStorage.getItem(`${STORAGE_PREFIX}index`);
  if (!data) return [];
  return JSON.parse(data);
};

const setLocalIndex = (summaries: LobbySummary[]) => {
  localStorage.setItem(`${STORAGE_PREFIX}index`, JSON.stringify(summaries));
  window.dispatchEvent(new Event('storage_update'));
};

const MOCK_LOBBY_TEMPLATE: Partial<Lobby> = {
  status: 'drafting',
  phase: 'ready',
  turn: 0,
  readyA: false,
  readyB: false,
  captain1: 'dev-user-a',
  captain2: 'dev-user-b',
  captain1Name: 'Development Alpha',
  captain2Name: 'Development Beta',
  config: {
    teamSize: 2,
    preset: 'Standard',
    name: 'Dev Draft Match',
    seriesType: 'BO1',
    customGameCount: 1,
    mapBanCount: 1,
    banCount: 3,
    isExclusive: true,
    pickType: 'alternated',
    allowedPantheons: ['Greek', 'Norse', 'Egyptian', 'Atlantean'],
    allowedMaps: ['Alfheim', 'Elysium', 'Ghost Lake', 'Giza'],
    timerDuration: 60,
    mapTurnOrder: [],
    godTurnOrder: [],
    hasBans: true,
    isPrivate: false,
    firstMapRandom: false,
    acePick: false,
    acePickHidden: false,
    loserPicksNextMap: false
  },
  picks: [],
  bans: [],
  mapBans: [],
  seriesMaps: [],
  currentGame: 1,
  scoreA: 0,
  scoreB: 0,
  lastActivityAt: Date.now() as any,
  createdAt: Date.now() as any
};
// --- END SHIELDING ---

export const generateId = () => Math.random().toString(36).substring(2, 9);

const getMillis = (val: any): number => {
  if (!val) return 0;
  // Handle Firestore Timestamp
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val.toDate === 'function') {
    const d = val.toDate();
    if (d && !isNaN(d.getTime())) return d.getTime();
  }
  
  // Handle plain number (could be seconds or millis)
  if (typeof val === 'number') {
    // If it's a seconds-based timestamp (like 1.7e9), convert to millis
    if (val < 10000000000) return val * 1000;
    return val;
  }
  
  // Handle string or other Date-parseable
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? 0 : parsed;
};

export const cleanData = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanData(item));
  }
  if (typeof obj !== 'object' || obj.toDate) return obj;

  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      newObj[key] = cleanData(obj[key]);
    }
  });
  return newObj;
};

const sanitizeArray = (val: any): any[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(i => i !== null && i !== undefined);
  return Object.values(val).filter(i => i !== null && i !== undefined);
};

export const normalizeLobbyData = (data: any): Lobby => {
  if (!data) return data;
  
  // Firebase occasionally converts sparse arrays to objects. Ensure arrays are standard Arrays and remove holes.
  const arrayFields = [
    'seriesMaps', 
    'spectators', 
    'picks', 
    'bans', 
    'mapBans', 
    'replayLog', 
    'history', 
    'turnOrder',
    'teamAPlayers',
    'teamBPlayers',
    'mapPool',
    'hiddenActions',
    'lastSubs'
  ];

  for (const field of arrayFields) {
    data[field] = sanitizeArray(data[field]);
  }

  // Also normalize config array fields
  if (data.config) {
    const configArrayFields = ['allowedPantheons', 'allowedMaps', 'mapTurnOrder', 'godTurnOrder'];
    for (const field of configArrayFields) {
      data.config[field] = sanitizeArray(data.config[field]);
    }
    // Stabilize teamSize
    if (typeof data.config.teamSize !== 'number' || isNaN(data.config.teamSize)) {
        data.config.teamSize = 2;
    }
  }
  
  return data as Lobby;
};

/** Mapa de timers para debounce do hover — evita writes/re-renders por pixel movido. */
const _hoverDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const lobbyService = {
  async createLobby(id: string, lobby: Lobby): Promise<void> {
    if (IS_DEV) {
      console.log(`[MOCK] Lobby created locally (LocalStorage): ${id}`);
      setLocalLobby(id, lobby);
      if (!lobby.config.isPrivate) {
        const index = getLocalIndex();
        const summary: LobbySummary = {
          id,
          name: lobby.config.name,
          teamSize: lobby.config.teamSize,
          captain1Name: lobby.captain1Name,
          captain2Name: lobby.captain2Name,
          status: lobby.status,
          phase: lobby.phase,
          preset: lobby.config.preset,
          lastActivityAt: Date.now() as any,
          createdAt: Date.now() as any
        };
        setLocalIndex([summary, ...index].slice(0, 50));
      }
      return;
    }
    try {
      await setDoc(doc(db, 'lobbies', id), cleanData(lobby));
      if (!lobby.config.isPrivate) {
        await this.refreshLobbyIndex();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `lobbies/${id}`);
    }
  },

  async getLobbiesPaginated(isFirstPage: boolean = true) {
    if (IS_DEV) return getLocalIndex();
    try {
      // 1. Define a base da query ordenada por atividade recente
      let lobbyQuery = query(
        collection(db, 'lobbies'), 
        orderBy('lastActivityAt', 'desc'), 
        limit(20) // LOBBIES_PER_PAGE
      );

      // 2. Se não for a primeira página, começa após o último documento visto
      if (!isFirstPage && (this as any)._lastVisibleDoc) {
        lobbyQuery = query(lobbyQuery, startAfter((this as any)._lastVisibleDoc));
      }

      const snapshot = await getDocs(lobbyQuery);
      
      // 3. Guarda o último documento para a próxima página
      (this as any)._lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1] || null;

      return snapshot.docs.map(doc => {
        const normalized = normalizeLobbyData(doc.data());
        return {
          id: doc.id,
          name: normalized.config?.name || `${normalized.config?.teamSize ?? 2}v${normalized.config?.teamSize ?? 2} Draft`,
          teamSize: (typeof normalized.config?.teamSize === 'number' && !isNaN(normalized.config.teamSize)) ? normalized.config.teamSize : 2,
          captain1Name: normalized.captain1Name || 'Captain 1',
          captain2Name: normalized.captain2Name || 'Captain 2',
          status: normalized.status || 'waiting',
          phase: normalized.phase || 'waiting',
          preset: normalized.config?.preset ?? null,
          lastActivityAt: normalized.lastActivityAt ?? null,
          createdAt: normalized.createdAt ?? null
        } as LobbySummary;
      });
    } catch (error) {
      console.error("Erro ao carregar lobbies paginados:", error);
      return [];
    }
  },

  async refreshLobbyIndex(): Promise<void> {
    if (IS_DEV) return;
    try {
      // Optimization: Index refresh is heavy. We use a lightweight lock to prevent concurrent refreshes 
      // from the same client session causing UI stutter.
      if ((this as any)._isRefreshingIndex) return;
      (this as any)._isRefreshingIndex = true;

      // We use 'lastActivityAt' instead of 'createdAt' for ordering. 
      // This is crucial because Firestore's query engine automatically excludes any documents 
      // from the result set if they are missing the field specified in an 'orderBy' or 'where' clause. 
      // By using a field that is consistently updated during the lifecycle of a draft, 
      // we ensure older, but still relevant drafts are not dropped from the index queries.
      const q = query(
        collection(db, 'lobbies'),
        orderBy('lastActivityAt', 'desc'),
        limit(50)
      );

      const snap = await getDocs(q);
      const summaries = snap.docs
        .map(d => {
          const data = d.data() as Lobby;
          if (!data.config || data.config.isPrivate || data.isHidden === true) return null;

          return {
            id: d.id,
            name: data.config.name || `${(typeof data.config.teamSize === 'number' && !isNaN(data.config.teamSize)) ? data.config.teamSize : 2}v${(typeof data.config.teamSize === 'number' && !isNaN(data.config.teamSize)) ? data.config.teamSize : 2} Draft`,
            teamSize: (typeof data.config.teamSize === 'number' && !isNaN(data.config.teamSize)) ? data.config.teamSize : 2,
            captain1Name: data.captain1Name || 'Captain 1',
            captain2Name: data.captain2Name || 'Captain 2',
            status: data.status || 'waiting',
            phase: data.phase || 'waiting',
            preset: data.config.preset ?? null,
            lastActivityAt: data.lastActivityAt ?? null,
            createdAt: data.createdAt ?? null
          } as LobbySummary;
        })
        .filter((l): l is LobbySummary => l !== null)
        .slice(0, 20);

      await setDoc(doc(db, 'metadata', 'lobby_index'), cleanData({
        activeLobbies: summaries,
        lastUpdated: now(),
        initialized: true
      }), { merge: true });

    } catch (err) {
      console.error("[Lobby Index] Erro ao atualizar índice:", err);
    } finally {
      (this as any)._isRefreshingIndex = false;
    }
  },

  async getLobby(id: string): Promise<Lobby | null> {
    if (IS_DEV) {
      const local = getLocalLobby(id);
      return local;
    }
    try {
      const docSnap = await getDoc(doc(db, 'lobbies', id));
      return docSnap.exists() ? normalizeLobbyData(docSnap.data()) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `lobbies/${id}`);
      return null;
    }
  },

  async updateLobby(id: string, updates: Partial<Lobby>): Promise<void> {
    if (IS_DEV) {
      const current = getLocalLobby(id) || ({ ...MOCK_LOBBY_TEMPLATE, id } as Lobby);
      const updated = { ...current, ...updates, lastActivityAt: Date.now() as any };
      setLocalLobby(id, updated);
      console.log(`[MOCK] Lobby updated locally: ${id}`);
      return;
    }
    try {
      await updateDoc(doc(db, 'lobbies', id), cleanData({
        ...updates,
        lastActivityAt: now()
      }));
      
      // Index is primarily for public/waiting lobbies. 
      // Only refresh if visibility or status changes in a way that affects the list.
      const statusChanged = updates.status === 'finished' || updates.status === 'waiting' || updates.status === 'INCOMPLETE';
      const isVisibilityUpdate = updates.isHidden !== undefined;
      
      if (statusChanged || isVisibilityUpdate) {
        // Optimization: Only refresh for major state changes that affect the public list
        await this.refreshLobbyIndex();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async setHoveredGod(id: string, team: 'A' | 'B', godId: string | null): Promise<void> {
    const key = `${id}_${team}`;
    const existing = _hoverDebounceTimers.get(key);
    if (existing) clearTimeout(existing);

    if (IS_DEV) {
      _hoverDebounceTimers.set(key, setTimeout(() => {
        const lobby = getLocalLobby(id);
        if (lobby) {
          setLocalLobby(id, { ...lobby, [`hoveredGodId${team}`]: godId } as any);
        }
        _hoverDebounceTimers.delete(key);
      }, 80));
      return;
    }

    _hoverDebounceTimers.set(key, setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'lobbies', id), cleanData({
          [`hoveredGodId${team}`]: godId,
          lastActivityAt: now()
        }));
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
      }
      _hoverDebounceTimers.delete(key);
    }, 80));
  },

  async forceUnpause(id: string): Promise<void> {
    if (IS_DEV) {
      const lobby = getLocalLobby(id);
      if (lobby) {
        setLocalLobby(id, {
          ...lobby,
          isPaused: false,
          timerStart: Date.now() as any,
          timerPausedAt: null,
          lastActivityAt: Date.now() as any
        });
      }
      return;
    }
    const lobbyRef = doc(db, 'lobbies', id);
    try {
      await runTransaction(db, async (transaction) => {
        const lobbyDoc = await transaction.get(lobbyRef);
        if (!lobbyDoc.exists()) return;

        const data = normalizeLobbyData(lobbyDoc.data());
        if (!data.isPaused) return;

        const updates: Partial<Lobby> = {
          captain1Active: true,
          captain2Active: true,
          isPaused: false,
          timerStart: now(),
          timerPausedAt: null,
          lastActivityAt: now()
        };

        transaction.update(lobbyRef, updates);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async updatePresence(id: string, captain: 'A' | 'B', active: boolean): Promise<void> {
    if (IS_DEV) return;
    try {
      const { getServerTime } = await import('../lib/serverTime');
      const docRef = doc(db, 'lobbies', id);
      
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) return;
        
        const data = normalizeLobbyData(docSnap.data());
        const updates: any = { lastActivityAt: now() };
        
        if (captain === 'A') updates.captain1Active = active;
        if (captain === 'B') updates.captain2Active = active;
        
        const c1Active = captain === 'A' ? active : (data.captain1Active ?? true);
        const c2Active = captain === 'B' ? active : (data.captain2Active ?? true);
        
        const timerPhases = ['drafting', 'map_ban', 'map_pick', 'god_ban', 'god_pick', 'god_picker'];
        const isTimerPhase = timerPhases.includes(data.phase);
        const wasPaused = data.isPaused ?? false;
        
        // Admin Solo mode:captain1 === captain2. Don't auto-pause if captains are same (Solo Mode)
        const isSoloAdmin = data.captain1 && data.captain2 && data.captain1 === data.captain2;
        const nowPaused = isTimerPhase && !isSoloAdmin && (!c1Active || !c2Active);
        
        updates.isPaused = nowPaused;

        if (!wasPaused && nowPaused && data.timerStart) {
          let startTime = getMillis(data.timerStart);
          
          const nowVal = await getServerTime();
          const elapsed = (nowVal - startTime) / 1000;
          const duration = data.config.timerDuration || 60;
          updates.pausedTimeLeft = Math.max(0, duration - Math.floor(elapsed));
          updates.timerPausedAt = now();
        } else if (wasPaused && !nowPaused && data.pausedTimeLeft !== undefined && data.pausedTimeLeft !== null) {
          const nowVal = await getServerTime();
          const duration = data.config.timerDuration || 60;
          const newStartTimeMillis = nowVal - (duration - data.pausedTimeLeft) * 1000;
          updates.timerStart = Timestamp.fromMillis(newStartTimeMillis);
          updates.pausedTimeLeft = null;
          updates.timerPausedAt = null;
        }

        transaction.update(docRef, cleanData(updates));
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async forceReset(id: string): Promise<void> {
    if (IS_DEV) {
      const lobby = getLocalLobby(id);
      if (lobby) {
        let initialSeriesMaps: string[] = [];
        if (lobby.config.preset === 'MCL' && lobby.config.mclRound) {
          const { MCL_ROUND_MAPS } = await import('../constants');
          const roundMap = MCL_ROUND_MAPS[lobby.config.mclRound];
          if (roundMap) {
            initialSeriesMaps = ["", "", roundMap];
          }
        }

        setLocalLobby(id, {
          ...lobby,
          status: 'waiting',
          phase: 'waiting',
          turn: 0,
          picks: [],
          bans: [],
          mapBans: [],
          mapPool: [],
          readyA: false,
          readyB: false,
          readyA_report: false,
          readyB_report: false,
          readyA_nextGame: false,
          readyB_nextGame: false,
          scoreA: 0,
          scoreB: 0,
          currentGame: 1,
          history: [],
          replayLog: [],
          seriesMaps: initialSeriesMaps,
          selectedMap: null,
          reportVoteA: null,
          reportVoteB: null,
          voteConflict: false,
          voteConflictCount: 0,
          reportStartAt: null,
          lastWinner: null,
          pickerVoteA: null,
          pickerVoteB: null,
          pickerPlayerA: null,
          pickerPlayerB: null,
          isPaused: false,
          timerStart: null,
          timerPausedAt: null,
          resetRequest: null,
          lastActivityAt: Date.now() as any
        } as any);
      }
      return;
    }
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
        timerPausedAt: null,
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
        lastActivityAt: now()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async requestReset(id: string, team: 'A' | 'B'): Promise<void> {
    if (IS_DEV) {
      const lobby = getLocalLobby(id);
      if (lobby) {
        setLocalLobby(id, {
          ...lobby,
          resetRequest: { requestedBy: team, status: 'pending', timestamp: Date.now() as any },
          isPaused: true,
          timerPausedAt: Date.now() as any,
          lastActivityAt: Date.now() as any
        } as any);
      }
      return;
    }
    try {
      const docRef = doc(db, 'lobbies', id);
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) return;
        const data = normalizeLobbyData(docSnap.data());
        
        if (data.resetRequest) return;

        const updates: any = {
          resetRequest: {
            requestedBy: team,
            status: 'pending',
            timestamp: now()
          },
          isPaused: true,
          timerPausedAt: now(),
          lastActivityAt: now()
        };

        transaction.update(docRef, updates);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async respondReset(id: string, accept: boolean): Promise<void> {
    if (IS_DEV) {
      const lobby = getLocalLobby(id);
      if (lobby && lobby.resetRequest) {
        if (accept) {
           setLocalLobby(id, { ...lobby, status: 'drafting', phase: 'ready', turn: 0, resetRequest: null, lastActivityAt: Date.now() as any } as any);
        } else {
           setLocalLobby(id, { ...lobby, resetRequest: null, isPaused: false, lastActivityAt: Date.now() as any } as any);
        }
      }
      return;
    }
    try {
      const docRef = doc(db, 'lobbies', id);
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) return;
        const data = normalizeLobbyData(docSnap.data());
        
        if (!data.resetRequest) return;

        if (accept) {
          const filteredReplayLog = (data.replayLog || []).filter((log: any) => log.gameNumber !== data.currentGame);
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
            picks: (Array.isArray(data.picks) ? data.picks : []).map(p => ({ ...(p as any), godId: null, isRandom: false })),
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
            lastActivityAt: now()
          });
        } else {
          const updates: any = {
            resetRequest: null,
            lastActivityAt: now()
          };

          // Resume timer logic
          if (data.isPaused && data.timerStart && data.timerPausedAt) {
             const pausedAt = getMillis(data.timerPausedAt);
             const nowVal = Date.now();
             const pausedDuration = nowVal - pausedAt;
             const oldStart = getMillis(data.timerStart);
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
    if (IS_DEV) {
      const lobby = getLocalLobby(id);
      if (lobby) {
        // Clear MCL picks if needed
        let newPicks = (lobby.picks || []).map(p => ({ ...p, godId: null }));
        if (lobby.config.preset === 'MCL') {
          // If we are resetting, we might need to preserve the skeleton
        }

        const newSeriesMaps = [...(lobby.seriesMaps || [])];
        if (lobby.config.preset === 'MCL' && lobby.currentGame < 3) {
           newSeriesMaps[lobby.currentGame - 1] = "";
        }

        setLocalLobby(id, { 
          ...lobby, 
          status: 'drafting', 
          phase: 'ready', 
          turn: 0, 
          picks: newPicks,
          bans: [],
          mapBans: lobby.currentGame === 1 ? [] : lobby.mapBans,
          seriesMaps: newSeriesMaps,
          selectedMap: (lobby.config.preset === 'MCL' && lobby.currentGame === 3) ? (lobby.seriesMaps ? lobby.seriesMaps[2] : null) : null,
          isPaused: false,
          timerStart: Date.now() as any,
          timerPausedAt: null,
          resetRequest: null,
          lastActivityAt: Date.now() as any 
        } as any);
      }
      return;
    }
    try {
      const docRef = doc(db, 'lobbies', id);
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) return;
        
        const data = normalizeLobbyData(docSnap.data());
        
        // Remove current game's actions from replayLog
        const filteredReplayLog = (data.replayLog || []).filter((log: any) => log.gameNumber !== data.currentGame);
        
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
          picks: (Array.isArray(data.picks) ? data.picks : []).map(p => ({ ...(p as any), godId: null, isRandom: false })), // Keep players but remove gods
          bans: [],
          mapBans: data.currentGame === 1 ? [] : data.mapBans,
          readyA: false,
          readyB: false,
          readyA_nextGame: false,
          readyB_nextGame: false,
          replayLog: filteredReplayLog,
          seriesMaps: newSeriesMaps,
          selectedMap: restoredMap || null,
          timerStart: now(),
          isPaused: false,
          lastActivityAt: now()
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async forceFinish(id: string): Promise<void> {
    if (IS_DEV) {
      const lobby = getLocalLobby(id);
      if (lobby) {
        setLocalLobby(id, { ...lobby, status: 'finished', phase: 'finished', lastActivityAt: Date.now() as any } as any);
      }
      return;
    }
    try {
      await updateDoc(doc(db, 'lobbies', id), cleanData({
        status: 'finished',
        phase: 'finished',
        lastActivityAt: now()
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
    if (IS_DEV) {
      const handler = () => {
        const lobby = getLocalLobby(id);
        if (lobby) {
          onUpdate(lobby);
        }
      };

      // Tenta carregar imediatamente
      handler();

      // Escuta mudanças de OUTRAS abas (evento nativo)
      window.addEventListener('storage', handler);
      // Escuta mudanças da PRÓPRIA aba (seu evento customizado)
      window.addEventListener('storage_update', handler);

      return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener('storage_update', handler);
        console.log(`[MOCK] Unsubscribed from ${id} (LocalStorage)`);
      };
    }
    return onSnapshot(doc(db, 'lobbies', id), (docSnap) => {
      if (docSnap.exists()) {
        const data = normalizeLobbyData(docSnap.data());
        onUpdate(data);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `lobbies/${id}`);
      onError(error);
    });
  },

  subscribeToPublicLobbies(onUpdate: (lobbies: LobbySummary[]) => void): Unsubscribe {
    if (IS_DEV) {
      const handler = () => onUpdate(getLocalIndex());
      handler();
      
      window.addEventListener('storage', handler);
      window.addEventListener('storage_update', handler);
      
      return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener('storage_update', handler);
        console.log("[MOCK] Unsubscribed from public lobbies (LocalStorage)");
      };
    }
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
      // We use 'lastActivityAt' instead of 'createdAt' for ordering. 
      // This is crucial because Firestore's query engine automatically excludes any documents 
      // from the result set if they are missing the field specified in an 'orderBy' or 'where' clause. 
      // By using a field that is consistently updated during the lifecycle of a draft, 
      // we ensure older, but still relevant drafts are not dropped from the index queries.
      const q = query(
        collection(db, 'lobbies'),
        orderBy('lastActivityAt', 'desc'),
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
          if (data.config.isPrivate || data.isHidden === true) return null;

          const summary = {
            id: d.id,
            name: data.config.name || `${(typeof data.config.teamSize === 'number' && !isNaN(data.config.teamSize)) ? data.config.teamSize : 2}v${(typeof data.config.teamSize === 'number' && !isNaN(data.config.teamSize)) ? data.config.teamSize : 2} Draft`,
            teamSize: (typeof data.config.teamSize === 'number' && !isNaN(data.config.teamSize)) ? data.config.teamSize : 2,
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
        .filter((l): l is LobbySummary => l !== null)
        .slice(0, 20);
      
      onUpdate(summaries);
    } catch (err) {
      console.error("[Lobby Index] Fallback query failed:", err);
      onUpdate([]);
    }
  },

  async checkAndCleanup(): Promise<void> {
    if (IS_DEV) return;
    try {
      const metaRef = doc(db, 'meta', 'cleanup');
      const metaSnap = await getDoc(metaRef);
      const nowVal = Date.now();
      const twelveHours = 12 * 60 * 60 * 1000;

      if (metaSnap.exists()) {
        const lastVal = metaSnap.data().lastCleanupAt;
        const lastCleanup = getMillis(lastVal);
        if (nowVal - lastCleanup < twelveHours) return;
      }

      // Update timestamp first to prevent concurrent cleanups from same user session
      await setDoc(metaRef, cleanData({ lastCleanupAt: now() }), { merge: true });

      // Find lobbies older than 12 hours
      const oldDate = new Date(nowVal - twelveHours);
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
    if (IS_DEV) {
      console.log(`[MOCK] Joined lobby: ${id} as ${role}`);
      return { success: true };
    }
    try {
      const docRef = doc(db, 'lobbies', id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return { success: false, error: "Lobby not found" };
      }

      const data = normalizeLobbyData(docSnap.data());
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
          updates.picks = (Array.isArray(data.picks) ? data.picks : Object.values(data.picks || {})).map((p: any) => {
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
          updates.picks = (Array.isArray(updates.picks || data.picks) ? (updates.picks || data.picks) : Object.values(updates.picks || data.picks || {})).map((p: any) => {
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
        const spectators = Array.isArray(data.spectators) ? data.spectators : Object.values(data.spectators || {});
        if (!spectators.some((s: any) => s.id === guestId)) {
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
    if (IS_DEV) return "mock-preset-id";
    try {
      const id = generateId();
      const preset = {
        id,
        name,
        config,
        createdAt: now()
      };
      await setDoc(doc(db, 'presets', id), cleanData(preset));
      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'presets');
      throw error;
    }
  },

  async setReady(id: string, team: 'A' | 'B', isReadyArg: any, guestId: string, generateTurnOrder: any): Promise<void> {
    const isReady = !!isReadyArg;

    if (IS_DEV) {
      const data = getLocalLobby(id);
      if (!data) return;

      const updates: any = {};
      const isGame1Ready = data.currentGame === 1 && (data.status === 'waiting' || data.phase === 'ready' || data.phase === 'waiting');
      const isReadyWaitPhase = isGame1Ready || data.phase === 'ready_picker';
      
      if (isReadyWaitPhase) {
        // Solo Dev Mode: auto-ready both sides
        updates.readyA = isReady;
        updates.readyB = isReady;
        
        // Ensure we have a captain 2 for solo testing
        if (!data.captain2) {
            updates.captain2 = 'dev-bot-b';
            updates.captain2Name = 'Bot B';
        }

        // Initialize players for MCL/Team presets in Solo Mode if missing
        if (!data.teamAPlayers || data.teamAPlayers.length === 0) {
          if (data.config.preset === 'MCL' || data.config.teamSize === 3) {
            updates.teamAPlayers = [
              { name: (data.captain1Name || 'Host') + ' (P1)', position: 1 },
              { name: (data.captain1Name || 'Host') + ' (P2)', position: 4 },
              { name: (data.captain1Name || 'Host') + ' (P3)', position: 5 }
            ];
          } else if (data.config.teamSize === 2) {
            updates.teamAPlayers = [
              { name: (data.captain1Name || 'Host') + ' (C)', position: 1 },
              { name: (data.captain1Name || 'Host') + ' (M)', position: 4 }
            ];
          } else {
            updates.teamAPlayers = [{ name: (data.captain1Name || 'Host'), position: 5 }];
          }
        }

        if (!data.teamBPlayers || data.teamBPlayers.length === 0) {
          if (data.config.preset === 'MCL' || data.config.teamSize === 3) {
            updates.teamBPlayers = [
              { name: 'Bot B (P1)', position: 3 },
              { name: 'Bot B (P2)', position: 2 },
              { name: 'Bot B (P3)', position: 6 }
            ];
          } else if (data.config.teamSize === 2) {
            updates.teamBPlayers = [
              { name: 'Bot B (C)', position: 3 },
              { name: 'Bot B (M)', position: 2 }
            ];
          } else {
            updates.teamBPlayers = [{ name: 'Bot B', position: 6 }];
          }
        }
        
        if (isReady) {
          if (data.status === 'waiting' || (data.status === 'drafting' && (data.phase === 'ready' || data.phase === 'waiting'))) {
            updates.status = 'drafting';
            updates.turn = 0;
            updates.timerStart = Date.now() as any;
            const currentTurn = data.turnOrder?.[0];
            if (currentTurn) {
              updates.phase = currentTurn.target === 'MAP' 
                ? (currentTurn.action === 'BAN' ? 'map_ban' : 'map_pick') 
                : (currentTurn.action === 'BAN' ? 'god_ban' : 'god_pick');
            }
          } else if (data.phase === 'ready_picker') {
            updates.phase = 'god_picker';
            updates.timerStart = Date.now() as any;
          }
        }
      } else if (data.phase === 'ready') {
        updates.readyA_nextGame = isReady;
        updates.readyB_nextGame = isReady;

        if (isReady) {
          updates.status = 'drafting';
          let startingTurn = 0;
          updates.timerStart = Date.now() as any;
          
          let preSelectedMap = data.seriesMaps?.[data.currentGame - 1];

          // Ensure map is set if it's pre-determined for this game
          if (preSelectedMap && preSelectedMap !== "") {
            updates.selectedMap = preSelectedMap;
            
            // If the first turn is a map pick, and we already have a map, skip that turn
            if (data.turnOrder?.[0]?.target === 'MAP' && data.turnOrder?.[0]?.action === 'PICK') {
              startingTurn = 1;
            }
          }

          updates.turn = startingTurn;
          const currentTurn = data.turnOrder?.[startingTurn];
          if (currentTurn) {
            updates.phase = currentTurn.target === 'MAP' 
              ? (currentTurn.action === 'BAN' ? 'map_ban' : 'map_pick') 
              : (currentTurn.action === 'BAN' ? 'god_ban' : 'god_pick');
          }
          updates.readyA_nextGame = false;
          updates.readyB_nextGame = false;
        }
      }

      setLocalLobby(id, cleanData({ ...data, ...updates, lastActivityAt: Date.now() as any }));
      return;
    }
    const docRef = doc(db, 'lobbies', id);

    try {
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) throw new Error("Lobby not found");
        
        const data = normalizeLobbyData(docSnap.data());

        if (team === 'A' && data.captain1 !== guestId) throw new Error("Not authorized for Team A");
        if (team === 'B' && data.captain2 !== guestId) throw new Error("Not authorized for Team B");

        const updates: any = {};
        const isGame1Ready = data.currentGame === 1 && (data.status === 'waiting' || data.phase === 'ready' || data.phase === 'waiting');
        const isReadyWaitPhase = isGame1Ready || data.phase === 'ready_picker';
        
        if (isReadyWaitPhase) {
          if (team === 'A') {
            updates.readyA = isReady;
            if (data.captain1 === data.captain2) updates.readyB = isReady;
          } else {
            updates.readyB = isReady;
            if (data.captain1 === data.captain2) updates.readyA = isReady;
          }
          
          const isAReady = team === 'A' ? isReady : (data.captain1 === data.captain2 ? isReady : (data.readyA || false));
          const isBReady = team === 'B' ? isReady : (data.captain1 === data.captain2 ? isReady : (data.readyB || false));
          
          if (isAReady && isBReady) {
            if (data.status === 'waiting' || (data.status === 'drafting' && (data.phase === 'ready' || data.phase === 'waiting'))) {
              updates.status = 'drafting';
              updates.turn = 0;
              updates.timerStart = now();
              const currentTurn = data.turnOrder[0];
              if (currentTurn) {
                updates.phase = currentTurn.target === 'MAP' 
                  ? (currentTurn.action === 'BAN' ? 'map_ban' : 'map_pick') 
                  : (currentTurn.action === 'BAN' ? 'god_ban' : 'god_pick');
              }
            } else if (data.phase === 'ready_picker') {
              updates.phase = 'god_picker';
              updates.timerStart = now();
            }
          }
        } else if (data.phase === 'ready') {
          // Handle readiness for Game 2+
          if (team === 'A') {
            updates.readyA_nextGame = isReady;
            if (data.captain1 === data.captain2) updates.readyB_nextGame = isReady;
          } else {
            updates.readyB_nextGame = isReady;
            if (data.captain1 === data.captain2) updates.readyA_nextGame = isReady;
          }

          const isAReady = team === 'A' ? isReady : (data.captain1 === data.captain2 ? isReady : (data.readyA_nextGame || false));
          const isBReady = team === 'B' ? isReady : (data.captain1 === data.captain2 ? isReady : (data.readyB_nextGame || false));

          if (isAReady && isBReady) {
            updates.status = 'drafting';
            updates.turn = 0;
            updates.timerStart = now();
            const currentTurn = data.turnOrder[0];
            if (currentTurn) {
              updates.phase = currentTurn.target === 'MAP' 
                ? (currentTurn.action === 'BAN' ? 'map_ban' : 'map_pick') 
                : (currentTurn.action === 'BAN' ? 'god_ban' : 'god_pick');
            }
            // Clear next game ready for the game after this one
            updates.readyA_nextGame = false;
            updates.readyB_nextGame = false;
          }
        }

        transaction.update(docRef, cleanData({ ...updates, lastActivityAt: now() }));
      });

      const finalSnap = await getDoc(docRef);
      if (finalSnap.exists() && !finalSnap.data().config.isPrivate) {
        await this.refreshLobbyIndex();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async forceStartDraft(id: string): Promise<void> {
    if (IS_DEV) {
      const lobby = getLocalLobby(id);
      if (lobby) {
        const turnOrder = lobby.turnOrder || [];
        const currentTurn = turnOrder[0];
        let initialPhase = 'god_ban';
        if (currentTurn) {
          initialPhase = currentTurn.target === 'MAP' 
            ? (currentTurn.action === 'BAN' ? 'map_ban' : 'map_pick') 
            : (currentTurn.action === 'BAN' ? 'god_ban' : 'god_pick');
        }

        const mockPlayersA = lobby.teamAPlayers || (
          (lobby.config.preset === 'MCL' || lobby.config.teamSize === 3) ? [
            { name: (lobby.captain1Name || 'Host') + ' (P1)', position: 1 },
            { name: (lobby.captain1Name || 'Host') + ' (P2)', position: 4 },
            { name: (lobby.captain1Name || 'Host') + ' (P3)', position: 5 }
          ] : (lobby.config.teamSize === 2 ? [
            { name: (lobby.captain1Name || 'Host') + ' (C)', position: 1 },
            { name: (lobby.captain1Name || 'Host') + ' (M)', position: 4 }
          ] : [{ name: (lobby.captain1Name || 'Host'), position: 5 }])
        );

        const mockPlayersB = lobby.teamBPlayers || (
          (lobby.config.preset === 'MCL' || lobby.config.teamSize === 3) ? [
            { name: 'Bot B (P1)', position: 3 },
            { name: 'Bot B (P2)', position: 2 },
            { name: 'Bot B (P3)', position: 6 }
          ] : (lobby.config.teamSize === 2 ? [
            { name: 'Bot B (C)', position: 3 },
            { name: 'Bot B (M)', position: 2 }
          ] : [{ name: 'Bot B', position: 6 }])
        );

        const updatedPicks = (lobby.picks || []).map(p => {
          const teamPlayers = p.team === 'A' ? mockPlayersA : mockPlayersB;
          const playerAtPos = teamPlayers.find(tp => tp.position === p.playerId);
          return { ...p, playerName: playerAtPos?.name || '' };
        });

        setLocalLobby(id, { 
            ...lobby, 
            status: 'drafting', 
            phase: initialPhase, 
            turn: 0,
            readyA: true,
            readyB: true,
            timerStart: Date.now() as any, 
            lastActivityAt: Date.now() as any,
            captain2: lobby.captain2 || 'dev-bot-b',
            captain2Name: lobby.captain2Name || 'Bot B',
            teamAPlayers: mockPlayersA,
            teamBPlayers: mockPlayersB,
            picks: updatedPicks
        } as any);
      }
      return;
    }
    try {
      const docRef = doc(db, 'lobbies', id);
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) return;
        const data = normalizeLobbyData(docSnap.data());
        
        const updates: any = {
          status: 'drafting',
          turn: 0,
          timerStart: now(),
          readyA: true,
          readyB: true,
          readyA_nextGame: false,
          readyB_nextGame: false,
          lastActivityAt: now()
        };

        const currentTurn = data.turnOrder[0];
        if (currentTurn) {
          updates.phase = currentTurn.target === 'MAP' 
            ? (currentTurn.action === 'BAN' ? 'map_ban' : 'map_pick') 
            : (currentTurn.action === 'BAN' ? 'god_ban' : 'god_pick');
        }

        transaction.update(docRef, cleanData(updates));
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async leaveSlot(id: string, team: 'A' | 'B'): Promise<void> {
    try {
      const updates = team === 'A' 
        ? { captain1: null, captain1Active: false } 
        : { captain2: null, captain2Active: false };
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
    if (IS_DEV) {
      const lobby = getLocalLobby(lobbyId);
      if (lobby) {
        const turnOrder = lobby.turnOrder || [];
        const currentTurn = turnOrder[0];
        let initialPhase = 'god_ban';
        if (currentTurn) {
          initialPhase = currentTurn.target === 'MAP' 
            ? (currentTurn.action === 'BAN' ? 'map_ban' : 'map_pick') 
            : (currentTurn.action === 'BAN' ? 'god_ban' : 'god_pick');
        }

        const mockPlayersA = lobby.teamAPlayers || (
          (lobby.config.preset === 'MCL' || lobby.config.teamSize === 3) ? [
            { name: `${nickname} (A1)`, position: 1 },
            { name: `${nickname} (A2)`, position: 4 },
            { name: `${nickname} (A3)`, position: 5 }
          ] : (lobby.config.teamSize === 2 ? [
            { name: `${nickname} (AC)`, position: 1 },
            { name: `${nickname} (AM)`, position: 4 }
          ] : [{ name: nickname, position: 5 }])
        );
        const mockPlayersB = lobby.teamBPlayers || (
          (lobby.config.preset === 'MCL' || lobby.config.teamSize === 3) ? [
            { name: `${nickname} (B1)`, position: 3 },
            { name: `${nickname} (B2)`, position: 2 },
            { name: `${nickname} (B3)`, position: 6 }
          ] : (lobby.config.teamSize === 2 ? [
            { name: `${nickname} (BC)`, position: 3 },
            { name: `${nickname} (BM)`, position: 2 }
          ] : [{ name: `${nickname} (B)`, position: 6 }])
        );

        const updatedPicks = (lobby.picks || []).map(p => {
          const teamPlayers = p.team === 'A' ? mockPlayersA : mockPlayersB;
          const playerAtPos = teamPlayers.find(tp => tp.position === p.playerId);
          return { ...p, playerName: playerAtPos?.name || '' };
        });

        setLocalLobby(lobbyId, { 
          ...lobby, 
          captain1: guestId, 
          captain2: guestId, 
          captain1Name: `${nickname} (A)`,
          captain2Name: `${nickname} (B)`,
          teamAPlayers: mockPlayersA,
          teamBPlayers: mockPlayersB,
          picks: updatedPicks,
          readyA: true,
          readyB: true,
          status: 'drafting', 
          phase: initialPhase,
          turn: 0,
          timerStart: Date.now() as any,
          lastActivityAt: Date.now() as any 
        } as any);
      }
      return { success: true };
    }
    try {
      const docRef = doc(db, 'lobbies', lobbyId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return { success: false, error: "Lobby not found" };
      
      const data = normalizeLobbyData(docSnap.data());
      const updates = {
        captain1: guestId, captain1Name: `${nickname} (A)`,
        captain2: guestId, captain2Name: `${nickname} (B)`,
        readyA: true, readyB: true,
        status: 'drafting', turn: 0,
        timerStart: now(),
        lastActivityAt: now(),
        phase: data.turnOrder[0]?.target === 'MAP' ? 'map_ban' : 'god_ban'
      };

      await updateDoc(docRef, cleanData(updates));
      if (!data.config.isPrivate) await this.refreshLobbyIndex();
      return { success: true };
    } catch (error) {
      return { success: false, error: "Failed to join solo" };
    }
  },

  subscribeToPresets(onUpdate: (presets: any[]) => void): Unsubscribe {
    const q = query(collection(db, 'presets'), orderBy('createdAt', 'desc'), limit(20));
    return onSnapshot(q, (snap) => onUpdate(snap.docs.map(d => d.data())), (error) => {
      handleFirestoreError(error, OperationType.LIST, 'presets');
    });
  },

  async sendChatMessage(lobbyId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<void> {
    if (IS_DEV) {
      const msgs = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}messages_${lobbyId}`) || '[]');
      const newMsg = {
        ...message,
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now()
      };
      localStorage.setItem(`${STORAGE_PREFIX}messages_${lobbyId}`, JSON.stringify([...msgs, newMsg]));
      window.dispatchEvent(new Event('storage_update'));
      return;
    }
    try {
      await addDoc(collection(db, 'lobbies', lobbyId, 'messages'), cleanData({
        ...message,
        timestamp: now()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `lobbies/${lobbyId}/messages`);
    }
  },

  subscribeToMessages(lobbyId: string, onUpdate: (messages: ChatMessage[]) => void): Unsubscribe {
    if (IS_DEV) {
      const handler = () => {
        const msgs = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}messages_${lobbyId}`) || '[]');
        onUpdate(msgs);
      };
      handler();
      
      window.addEventListener('storage', handler);
      window.addEventListener('storage_update', handler);
      
      return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener('storage_update', handler);
      };
    }
    const q = query(collection(db, 'lobbies', lobbyId, 'messages'), orderBy('timestamp', 'asc'), limit(100));
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
    });
  }
}; // FIM DO OBJETO lobbyService