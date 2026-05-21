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
import { getMCLPicks, getMCLTeamOrder } from '../data/draft';


// --- SHIELDING: MOCK LAYER CONFIG ---
export const IS_DEV = import.meta.env.VITE_VIBE_MODE === 'DEVELOPMENT';
const STORAGE_PREFIX = 'mythos_draft_dev_';

/** Max lobbies shown in the public list (21st and beyond are hidden). */
export const PUBLIC_LOBBIES_PAGE_SIZE = 20;

/** Public list: non-private, visible, and both captain slots filled. */
export function isLobbyEligibleForPublicList(data: {
  captain1?: string | null;
  captain2?: string | null;
  config?: { isPrivate?: boolean };
  isHidden?: boolean;
}): boolean {
  if (!data.config || data.config.isPrivate || data.isHidden === true) return false;
  return !!(data.captain1 && data.captain2);
}

export function lobbyDocToSummary(id: string, normalized: Lobby): LobbySummary {
  return {
    id,
    captain1: normalized.captain1 ?? null,
    captain2: normalized.captain2 ?? null,
    name: normalized.config?.name || `${normalized.config?.teamSize ?? 2}v${normalized.config?.teamSize ?? 2} Draft`,
    teamSize: (typeof normalized.config?.teamSize === 'number' && !isNaN(normalized.config.teamSize)) ? normalized.config.teamSize : 2,
    captain1Name: normalized.captain1Name || 'Captain 1',
    captain2Name: normalized.captain2Name || 'Captain 2',
    status: normalized.status || 'waiting',
    phase: normalized.phase || 'waiting',
    preset: normalized.config?.preset ?? null,
    lastActivityAt: normalized.lastActivityAt ?? null,
    createdAt: normalized.createdAt ?? null
  };
}

export function filterPublicSummaries(summaries: LobbySummary[]): LobbySummary[] {
  return summaries
    .filter((s) => !!(s.captain1 && s.captain2))
    .slice(0, PUBLIC_LOBBIES_PAGE_SIZE);
}

/**
 * Verifica se o lobby est├í em modo Solo Admin (captain1 === captain2).
 * Centralizado aqui para evitar que cada servi├ºo implemente a pr├│pria heur├¡stica.
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
  const lobbies: LobbySummary[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(`${STORAGE_PREFIX}lobby_`)) {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const lobby: Lobby = JSON.parse(data);
          if (isLobbyEligibleForPublicList(lobby)) {
             lobbies.push({
                id: lobby.id,
                captain1: lobby.captain1 ?? null,
                captain2: lobby.captain2 ?? null,
                name: lobby.config.name || `${lobby.config.teamSize ?? 2}v${lobby.config.teamSize ?? 2} Draft`,
                teamSize: lobby.config.teamSize ?? 2,
                captain1Name: lobby.captain1Name || 'Captain 1',
                captain2Name: lobby.captain2Name || 'Captain 2',
                status: lobby.status || 'waiting',
                phase: lobby.phase || 'waiting',
                preset: lobby.config.preset ?? null,
                lastActivityAt: lobby.lastActivityAt ?? null,
                createdAt: lobby.createdAt ?? null
             } as LobbySummary);
          }
        } catch(e) {}
      }
    }
  }
  return lobbies.sort((a, b) => {
     const tA = (a.lastActivityAt as any)?.toMillis?.() || (typeof a.lastActivityAt === 'number' ? a.lastActivityAt : 0);
     const tB = (b.lastActivityAt as any)?.toMillis?.() || (typeof b.lastActivityAt === 'number' ? b.lastActivityAt : 0);
     return tB - tA;
  });
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

export const getMillis = (val: any): number => {
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
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanData(item));
  }

  // Preserve Firebase specific objects (FieldValue, Timestamp, etc)
  if (
    typeof obj.toDate === 'function' || 
    typeof obj.isEqual === 'function' || 
    obj._methodName || 
    (Object.getPrototypeOf(obj) !== Object.prototype && Object.getPrototypeOf(obj) !== Array.prototype)
  ) {
    return obj;
  }

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

/** Mapa de timers para debounce do hover ÔÇö evita writes/re-renders por pixel movido. */
const _hoverDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

// 🚨 CACHE GLOBAL DE PRESETS (Evita leituras repetidas)
let cachedPresets: any[] | null = null;
let presetsPromise: Promise<any[]> | null = null;

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
      let lobbyQuery = query(
        collection(db, 'lobbies'), 
        orderBy('createdAt', 'desc'), 
        limit(40) // LOBBIES_PER_PAGE (increased to handle post-filter reductions)
      );

      // 2. Se n├úo for a primeira p├ígina, come├ºa ap├│s o ├║ltimo documento visto
      if (!isFirstPage && (this as any)._lastVisibleDoc) {
        lobbyQuery = query(lobbyQuery, startAfter((this as any)._lastVisibleDoc));
      }

      const snapshot = await getDocs(lobbyQuery);
      
      // 3. Guarda o ├║ltimo documento para a pr├│xima p├ígina
      (this as any)._lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1] || null;

      return snapshot.docs
        .filter(doc => {
          const data = doc.data();
          return !!(data.captain1 && data.captain2 && (!data.config || !data.config.isPrivate) && data.isHidden !== true);
        })
        .map(doc => {
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
      if ((this as any)._isRefreshingIndex) return;
      (this as any)._isRefreshingIndex = true;

      const q = query(
        collection(db, 'lobbies'),
        orderBy('createdAt', 'desc'),
        limit(30) // 🚨 OTIMIZAÇÃO: Alterado de 100 para 30 para economizar leituras!
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
      console.error("[Lobby Index] Erro ao atualizar ├¡ndice:", err);
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
      
      const statusChanged = updates.status === 'finished' || updates.status === 'waiting' || updates.status === 'INCOMPLETE';
      const isVisibilityUpdate = updates.isHidden !== undefined;
      
      if (statusChanged || isVisibilityUpdate) {
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
      }, 500));
      return;
    }

    _hoverDebounceTimers.set(key, setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'lobbies', id), cleanData({
          [`hoveredGodId${team}`]: godId
        }));
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
      }
      _hoverDebounceTimers.delete(key);
    }, 500));
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
            setLocalLobby(id, { ...lobby, status: 'waiting', phase: 'ready', turn: 0, readyA: false, readyB: false, readyA_nextGame: false, readyB_nextGame: false, resetRequest: null, lastActivityAt: Date.now() as any } as any);
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
            status: 'waiting',
            phase: 'ready',
            turn: 0,
            picks: (Array.isArray(data.picks) ? data.picks : []).map(p => ({ ...(p as any), godId: null, isRandom: false })),
            bans: [],
            mapBans: data.currentGame === 1 ? [] : data.mapBans,
            readyA: false,
            readyB: false,
            ready1: false,
            ready2: false,
            readyA_nextGame: false,
            readyB_nextGame: false,
            readyA_report: false,
            readyB_report: false,
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
        let newPicks = (lobby.picks || []).map(p => ({ ...p, godId: null }));

        const newSeriesMaps = [...(lobby.seriesMaps || [])];
        // ── Limpeza de mapa: só limpa G1/G2. G3 sempre preserva o mapa
        // (MCL: pré-determinado pelo round / FORJA: sorteado aleatoriamente).
        const isForjaG3 = lobby.config.preset === 'FORJA' && lobby.currentGame === 3;
        const isMCLG3   = lobby.config.preset === 'MCL'   && lobby.currentGame === 3;
        if (!isForjaG3 && !isMCLG3) {
          // G1 ou G2: limpa o slot para novo pick de mapa
          if (newSeriesMaps.length >= lobby.currentGame) {
            newSeriesMaps[lobby.currentGame - 1] = '';
          }
        }

        // selectedMap: mantém o mapa no G3 (MCL/FORJA), null nos demais
        const preservedMap3 = (isForjaG3 || isMCLG3) ? (lobby.seriesMaps?.[2] ?? null) : null;

        setLocalLobby(id, {
          ...lobby,
          status: 'waiting',
          phase: 'ready',
          turn: 0,
          picks: newPicks,
          bans: [],
          mapBans: lobby.currentGame === 1 ? [] : lobby.mapBans,
          readyA: false,
          readyB: false,
          readyA_nextGame: false,
          readyB_nextGame: false,
          seriesMaps: newSeriesMaps,
          selectedMap: preservedMap3,
          isPaused: false,
          timerStart: null,
          timerPausedAt: null,
          resetRequest: null,
          lastActivityAt: Date.now() as any,
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

        const filteredReplayLog = (data.replayLog || []).filter((log: any) => log.gameNumber !== data.currentGame);

        const newSeriesMaps = [...(data.seriesMaps || [])];
        let restoredMap = '';

        if (data.config.preset === 'MCL' && data.config.mclRound) {
          // MCL: mapa 3 é pré-determinado pelo round — restaurar sempre
          const roundMap = MCL_ROUND_MAPS[data.config.mclRound];
          const gameCount = data.config.seriesType === 'BO3' ? 3 : (data.config.customGameCount || 1);
          if (gameCount >= 3 && data.currentGame === 3) restoredMap = roundMap;
        } else if (data.config.preset === 'FORJA' && data.currentGame === 3) {
          // ── FORJA: mapa 3 foi SORTEADO aleatoriamente — preservar o valor já persistido.
          // NÃO limpar seriesMaps[2]; usar o mapa que já estava lá.
          restoredMap = (data.seriesMaps || [])[2] ?? '';
        }

        // Para G1/G2 (ou qualquer preset sem mapa fixo no G3): limpa o slot.
        // Para G3 MCL/FORJA: restaura o mapa correto (pré-determinado ou sorteado).
        if (newSeriesMaps.length >= data.currentGame) {
          newSeriesMaps[data.currentGame - 1] = restoredMap;
        }

        transaction.update(docRef, {
          status: 'waiting',
          phase: 'ready',
          turn: 0,
          picks: (Array.isArray(data.picks) ? data.picks : []).map(p => ({ ...(p as any), godId: null, isRandom: false })),
          bans: [],
          mapBans: data.currentGame === 1 ? [] : data.mapBans,
          readyA: false,
          readyB: false,
          ready1: false,
          ready2: false,
          readyA_nextGame: false,
          readyB_nextGame: false,
          readyA_report: false,
          readyB_report: false,
          replayLog: filteredReplayLog,
          seriesMaps: newSeriesMaps,
          selectedMap: restoredMap || null,
          timerStart: null,
          isPaused: false,
          timerPausedAt: null,
          resetRequest: null,
          lastActivityAt: now(),
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

      handler();

      window.addEventListener('storage', handler);
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

  // 🚨 NOVA FUNÇÃO: Busca Fria de Lobbies Públicos
  async getPublicLobbiesOnce(): Promise<LobbySummary[]> {
    if (IS_DEV) return getLocalIndex();
    
    try {
      const indexSnap = await getDoc(doc(db, 'metadata', 'lobby_index'));

      if (indexSnap.exists()) {
        const data = indexSnap.data() as any;
        if (data.initialized === true && Array.isArray(data.activeLobbies)) {
          return data.activeLobbies;
        }
      }

      const q = query(
        collection(db, 'lobbies'),
        orderBy('createdAt', 'desc'),
        limit(30)
      );

      const snap = await getDocs(q);
      const summaries = snap.docs
        .map(d => {
          const data = normalizeLobbyData({ ...d.data(), id: d.id } as Lobby);
          if (!isLobbyEligibleForPublicList(data)) return null;
          return lobbyDocToSummary(d.id, data);
        })
        .filter((l): l is LobbySummary => l !== null)
        .slice(0, PUBLIC_LOBBIES_PAGE_SIZE);

      return summaries;
    } catch (err) {
      console.error("[Lobby Index] Falha na busca fria de lobbies:", err);
      return [];
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

      const isMCL = data.config.preset === 'MCL' || data.config.preset === 'FORJA';

      if (role === 'A') {
        if (data.captain1 && data.captain1 !== guestId) {
          return { success: false, error: "Host slot already taken" };
        }
        updates.captain1 = guestId;
        updates.captain1Active = true;
        
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
        
        updates.teamAPlayers = Array.from({ length: data.config.teamSize }, (_, idx) => ({
          name: playerNames[idx] || ''
        }));

      } else if (role === 'B') {
        if (data.captain2 && data.captain2 !== guestId) {
          return { success: false, error: "Guest slot already taken" };
        }
        updates.captain2 = guestId;
        updates.captain2Active = true;
        
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

        updates.teamBPlayers = Array.from({ length: data.config.teamSize }, (_, idx) => ({
          name: playerNames[idx] || ''
        }));
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

  async updateLobbyConfig(id: string, updates: Partial<LobbyConfig>): Promise<void> {
    if (IS_DEV) {
      const lobby = getLocalLobby(id);
      if (lobby) {
        setLocalLobby(id, { ...lobby, config: { ...lobby.config, ...updates } } as Lobby);
      }
      return;
    }
    try {
      const firestoreUpdates: any = {};
      Object.entries(updates).forEach(([key, val]) => {
        firestoreUpdates[`config.${key}`] = val;
      });
      await updateDoc(doc(db, 'lobbies', id), cleanData(firestoreUpdates));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  async updateLobbyBasicInfo(id: string, updates: { name?: string, captain1Name?: string, captain2Name?: string }): Promise<void> {
    if (IS_DEV) {
      const lobby = getLocalLobby(id);
      if (lobby) {
        const newLobby = { ...lobby };
        if (updates.name) newLobby.config.name = updates.name;
        if (updates.captain1Name) newLobby.captain1Name = updates.captain1Name;
        if (updates.captain2Name) newLobby.captain2Name = updates.captain2Name;
        setLocalLobby(id, newLobby as Lobby);
      }
      return;
    }
    try {
      const firestoreUpdates: any = {};
      if (updates.name) firestoreUpdates['config.name'] = updates.name;
      if (updates.captain1Name) firestoreUpdates.captain1Name = updates.captain1Name;
      if (updates.captain2Name) firestoreUpdates.captain2Name = updates.captain2Name;
      
      await updateDoc(doc(db, 'lobbies', id), cleanData(firestoreUpdates));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
    }
  },

  // 🚨 ATUALIZADO: Salva o preset e limpa o cache local
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
      
      // MUTAÇÃO DE CACHE: Força a próxima leitura a buscar do banco
      cachedPresets = null;
      presetsPromise = null;
      
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
        updates.readyA = isReady;
        updates.readyB = isReady;
        
        if (!data.captain2) {
            updates.captain2 = 'dev-bot-b';
            updates.captain2Name = 'Bot B';
        }

        if (!data.teamAPlayers || data.teamAPlayers.length === 0) {
          if (data.config.preset === 'MCL' || data.config.teamSize === 3) {
            updates.teamAPlayers = [
              { name: (data.captain1Name || 'Host') + ' (P1)' },
              { name: (data.captain1Name || 'Host') + ' (P2)' },
              { name: (data.captain1Name || 'Host') + ' (P3)' }
            ];
          } else if (data.config.teamSize === 2) {
            updates.teamAPlayers = [
              { name: (data.captain1Name || 'Host') + ' (C)' },
              { name: (data.captain1Name || 'Host') + ' (M)' }
            ];
          } else {
            updates.teamAPlayers = [{ name: (data.captain1Name || 'Host') }];
          }
        }

        if (!data.teamBPlayers || data.teamBPlayers.length === 0) {
          if (data.config.preset === 'MCL' || data.config.teamSize === 3) {
            updates.teamBPlayers = [
              { name: 'Bot B (P1)' },
              { name: 'Bot B (P2)' },
              { name: 'Bot B (P3)' }
            ];
          } else if (data.config.teamSize === 2) {
            updates.teamBPlayers = [
              { name: 'Bot B (C)' },
              { name: 'Bot B (M)' }
            ];
          } else {
            updates.teamBPlayers = [{ name: 'Bot B' }];
          }
        }
        
        if (isReady) {
          if (data.status === 'waiting' || (data.status === 'drafting' && (data.phase === 'ready' || data.phase === 'waiting'))) {
            updates.status = 'drafting';
            updates.turn = 0;
            updates.timerStart = Date.now() as any;
            
            let finalTurnOrder = data.turnOrder;
            if ((!finalTurnOrder || finalTurnOrder.length === 0) && generateTurnOrder && typeof generateTurnOrder === 'function') {
              const generated = generateTurnOrder(data.config, 1, null);
              finalTurnOrder = [...generated.mapOrder, ...generated.godOrder];
              updates.turnOrder = finalTurnOrder;
            }

            const currentTurn = finalTurnOrder?.[0];
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

          if (preSelectedMap && preSelectedMap !== "") {
            updates.selectedMap = preSelectedMap;
            
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
        // Game 1 ready logic only. Se for game > 1 e phase='ready', deve cair no else if (data.phase === 'ready')
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
              
              // 🔥 Timer Absoluto
              const duration = data.config.timerDuration || 60;
              if (IS_DEV) {
                updates.turnEndsAt = (Date.now() + (duration * 1000)) as any;
              } else {
                updates.turnEndsAt = Timestamp.fromMillis(Date.now() + (duration * 1000));
              }
              
              let finalTurnOrder = data.turnOrder;
              if ((!finalTurnOrder || finalTurnOrder.length === 0) && generateTurnOrder) {
                const generated = generateTurnOrder(data.config, 1, null);
                finalTurnOrder = [...generated.mapOrder, ...generated.godOrder];
                updates.turnOrder = finalTurnOrder;
              }

              const currentTurn = finalTurnOrder?.[0];
              if (currentTurn) {
                updates.phase = currentTurn.target === 'MAP' 
                  ? (currentTurn.action === 'BAN' ? 'map_ban' : 'map_pick') 
                  : (currentTurn.action === 'BAN' ? 'god_ban' : 'god_pick');
              }

              // INITIALIZE PICKS
              if (data.config.preset === 'MCL' || data.config.preset === 'FORJA') {
                updates.picks = getMCLPicks(data.currentGame || 1, data.selectedMap || null, data.lastWinner || null);
              }
            } else if (data.phase === 'ready_picker') {
              updates.phase = 'god_picker';
              updates.timerStart = now();
            }
          }
        } else if (data.phase === 'ready') {
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
            { name: (lobby.captain1Name || 'Host') + ' (P1)' },
            { name: (lobby.captain1Name || 'Host') + ' (P2)' },
            { name: (lobby.captain1Name || 'Host') + ' (P3)' }
          ] : (lobby.config.teamSize === 2 ? [
            { name: (lobby.captain1Name || 'Host') + ' (C)' },
            { name: (lobby.captain1Name || 'Host') + ' (M)' }
          ] : [{ name: (lobby.captain1Name || 'Host') }])
        );

        const mockPlayersB = lobby.teamBPlayers || (
          (lobby.config.preset === 'MCL' || lobby.config.teamSize === 3) ? [
            { name: 'Bot B (P1)' },
            { name: 'Bot B (P2)' },
            { name: 'Bot B (P3)' }
          ] : (lobby.config.teamSize === 2 ? [
            { name: 'Bot B (C)' },
            { name: 'Bot B (M)' }
          ] : [{ name: 'Bot B' }])
        );

        const updatedPicks = getMCLPicks(lobby.currentGame || 1, lobby.selectedMap || null, lobby.lastWinner || null);

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
          // 🔥 Timer Absoluto
          turnEndsAt: Timestamp.fromMillis(Date.now() + ((data.config.timerDuration || 60) * 1000)),
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

        // 🔥 INITIALIZE PICKS WITH PLAYER NAMES (Anti-Generic Name Bug)
        if (data.config.preset === 'MCL' || data.config.preset === 'FORJA') {
          const initialPicks = getMCLPicks(data.currentGame || 1, data.selectedMap || null, data.lastWinner || null);
          const teamAOrder = getMCLTeamOrder('A');
          const teamBOrder = getMCLTeamOrder('B');

          updates.picks = initialPicks.map(p => {
            const teamPlayers = p.team === 'A' ? (updates.teamAPlayers || data.teamAPlayers) : (updates.teamBPlayers || data.teamBPlayers);
            const teamOrder = p.team === 'A' ? teamAOrder : teamBOrder;
            const rosterIdx = teamOrder.indexOf(p.playerId);
            const player = teamPlayers?.[rosterIdx];
            return { ...p, playerName: player?.name || '' };
          });
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
            { name: `${nickname} (A1)` },
            { name: `${nickname} (A2)` },
            { name: `${nickname} (A3)` }
          ] : (lobby.config.teamSize === 2 ? [
            { name: `${nickname} (AC)` },
            { name: `${nickname} (AM)` }
          ] : [{ name: nickname }])
        );
        const mockPlayersB = lobby.teamBPlayers || (
          (lobby.config.preset === 'MCL' || lobby.config.teamSize === 3) ? [
            { name: `${nickname} (B1)` },
            { name: `${nickname} (B2)` },
            { name: `${nickname} (B3)` }
          ] : (lobby.config.teamSize === 2 ? [
            { name: `${nickname} (BC)` },
            { name: `${nickname} (BM)` }
          ] : [{ name: `${nickname} (B)` }])
        );

        const updatedPicks = getMCLPicks(lobby.currentGame || 1, lobby.selectedMap || null, lobby.lastWinner || null);

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

  // 🚨 NOVA FUNÇÃO FRIA DE PRESETS (Substituindo o antigo subscribe)
  async getPresetsOnce(): Promise<any[]> {
    if (cachedPresets) return cachedPresets;

    if (!presetsPromise) {
      const q = query(collection(db, 'presets'), orderBy('createdAt', 'desc'), limit(20));
      presetsPromise = getDocs(q)
        .then(snap => {
          const data = snap.docs.map(d => d.data());
          cachedPresets = data;
          return data;
        })
        .catch(err => {
          handleFirestoreError(err, OperationType.LIST, 'presets');
          presetsPromise = null; // Clear failed promise to allow retry
          return [];
        });
    }

    return presetsPromise;
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
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `lobbies/${lobbyId}/messages`);
    });
  }
}; // FIM DO OBJETO lobbyService