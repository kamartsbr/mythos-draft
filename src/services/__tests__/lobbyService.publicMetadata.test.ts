import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: any[]) => ({ path: args.slice(1).join('/') })),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(),
  query: vi.fn(),
  collection: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _methodName: 'serverTimestamp' })),
  runTransaction: vi.fn(),
  Timestamp: { now: vi.fn(), fromDate: vi.fn() },
  addDoc: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn(),
  signInAnonymously: vi.fn(),
}));

vi.mock('../../firebase', () => ({
  db: {},
  auth: {},
  handleFirestoreError: vi.fn(),
  OperationType: {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    LIST: 'list',
    GET: 'get',
    WRITE: 'write',
  },
  FIRESTORE_DB_ID: 'test-db',
}));

vi.mock('../../constants', () => ({
  PLAYER_COLORS: {},
  MCL_ROUND_MAPS: [],
}));

vi.mock('../../data/draft', () => ({
  getMCLPicks: vi.fn(() => []),
  getMCLTeamOrder: vi.fn(() => []),
  shouldUseGame2MclOrder: vi.fn(() => false),
  hydrateMclPicksWithRosterNames: vi.fn(() => []),
  hydrateMclStylePicksWithRosterNames: vi.fn(() => []),
  isMclStylePreset: vi.fn(() => false),
}));

vi.mock('../../features/forja/services/forjaService', () => ({
  updateCachedLiveMatchesSummary: vi.fn(),
  invalidateForjaOfficialMatchesCache: vi.fn(),
}));

import {
  lobbyService,
  lobbyToForjaLiveMatchSummary,
  lobbyDocToSummary,
  removeForjaLiveMatchSummary,
  removeLobbySummary,
  upsertForjaLiveMatchSummary,
  upsertLobbySummary,
} from '../lobbyService';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Lobby, LobbySummary } from '../../types';
import type { ForjaLiveMatchSummary } from '../../features/forja/types';

const containsServerTimestampSentinel = (value: unknown): boolean => {
  if (!value) return false;
  if (Array.isArray(value)) return value.some(containsServerTimestampSentinel);
  if (typeof value === 'object') {
    if ((value as { _methodName?: string })._methodName === 'serverTimestamp') return true;
    return Object.values(value as Record<string, unknown>).some(containsServerTimestampSentinel);
  }
  return false;
};

let lastTransactionSetCalls: Array<{ path: string; data: unknown }> = [];

beforeEach(() => {
  vi.clearAllMocks();
  lastTransactionSetCalls = [];
  (doc as unknown as ReturnType<typeof vi.fn>).mockImplementation((...args: any[]) => ({ path: args.slice(1).join('/') }));
  (runTransaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_db: unknown, callback: any) => {
    const fakeTx = {
      get: vi.fn(async (ref: { path: string }) => {
        if (ref.path === 'metadata/lobby_index') {
          return { exists: () => true, data: () => ({ activeLobbies: [] }) };
        }
        if (ref.path === 'forja_meta/live_matches_summary') {
          return { exists: () => true, data: () => ({ matches: [] }) };
        }
        return { exists: () => false, data: () => null };
      }),
      set: vi.fn((ref: { path: string }, data: unknown) => {
        lastTransactionSetCalls.push({ path: ref.path, data });
      }),
    };
    const result = await callback(fakeTx);
    return result;
  });
});

describe('lobbyService public metadata helpers', () => {
  it('keeps newest lobby summaries first and replaces by id', () => {
    const base: LobbySummary[] = [
      {
        id: 'older',
        name: 'Older',
        teamSize: 3,
        captain1: 'a',
        captain2: 'b',
        status: 'waiting',
        phase: 'ready',
        lastActivityAt: 1000,
        createdAt: 1000,
      },
    ];

    const updated = upsertLobbySummary(base, {
      id: 'newer',
      name: 'Newer',
      teamSize: 3,
      captain1: 'a',
      captain2: 'b',
      status: 'drafting',
      phase: 'god_pick',
      lastActivityAt: 2000,
      createdAt: 2000,
    });

    expect(updated.map((item) => item.id)).toEqual(['newer', 'older']);

    const replaced = upsertLobbySummary(updated, {
      ...updated[1],
      id: 'older',
      name: 'Older Updated',
      lastActivityAt: 3000,
    });

    expect(replaced.map((item) => item.id)).toEqual(['older', 'newer']);
    expect(replaced[0].name).toBe('Older Updated');
    expect(removeLobbySummary(replaced, 'newer').map((item) => item.id)).toEqual(['older']);
  });

  it('maps official FORJA lobby into lightweight live summary', () => {
    const lobby: Lobby = {
      id: 'forja1',
      status: 'drafting',
      phase: 'god_pick',
      captain1: 'cap-a',
      captain2: 'cap-b',
      readyA: true,
      readyB: true,
      config: {
        name: 'Quarterfinal A',
        preset: 'FORJA',
        isOfficialForjaMatch: true,
        tournamentStage: 'PLAYOFFS_BO5',
        forjaTeamA: 'team-a',
        forjaTeamB: 'team-b',
        forjaGroupId: 'A',
        teamSize: 3,
        hasBans: false,
        banCount: 0,
        isExclusive: true,
        isPrivate: false,
        allowedPantheons: [],
        allowedMaps: [],
        pickType: 'alternated',
        seriesType: 'BO5',
        mapBanCount: 0,
        firstMapRandom: false,
        acePick: false,
        acePickHidden: false,
        mapTurnOrder: [],
        godTurnOrder: [],
        loserPicksNextMap: false,
      },
      selectedMap: null,
      seriesMaps: [],
      mapBans: [],
      turn: 0,
      bans: [],
      picks: [],
      scoreA: 2,
      scoreB: 1,
      reportVoteA: null,
      reportVoteB: null,
      voteConflict: false,
      voteConflictCount: 0,
      currentGame: 3,
      history: [],
      replayLog: [],
      lastWinner: null,
      timerStart: null,
      createdAt: 0,
      turnOrder: [],
      hiddenActions: [],
      spectators: [],
    };

    const summary = lobbyToForjaLiveMatchSummary(lobby);
    expect(summary.id).toBe('forja1');
    expect(summary.stage).toBe('PLAYOFFS_BO5');
    expect(summary.scoreA).toBe(2);
    expect(summary.config?.forjaTeamA).toBe('team-a');
  });

  it('upserts and removes live FORJA matches by id', () => {
    const older: ForjaLiveMatchSummary = {
      id: 'older',
      name: 'Older',
      status: 'waiting',
      scoreA: 0,
      scoreB: 0,
      stage: 'GROUP',
      scheduledDate: 5000,
    };
    const newer: ForjaLiveMatchSummary = {
      id: 'newer',
      name: 'Newer',
      status: 'waiting',
      scoreA: 0,
      scoreB: 0,
      stage: 'GROUP',
      scheduledDate: 1000,
    };

    const ordered = upsertForjaLiveMatchSummary([older], newer);
    expect(ordered.map((item) => item.id)).toEqual(['newer', 'older']);

    const removed = removeForjaLiveMatchSummary(ordered, 'newer');
    expect(removed.map((item) => item.id)).toEqual(['older']);
  });

  it('strips serverTimestamp sentinels from lobby summaries before public metadata writes', async () => {
    const lobby: Lobby = {
      id: 'lobby-a',
      status: 'drafting',
      captain1: 'cap-a',
      captain2: 'cap-b',
      captain1Name: 'Captain A',
      captain2Name: 'Captain B',
      readyA: true,
      readyB: true,
      config: {
        name: 'Sentinel Test',
        preset: 'MCL',
        teamSize: 3,
        hasBans: true,
        banCount: 2,
        isExclusive: true,
        isPrivate: false,
        allowedPantheons: [],
        allowedMaps: [],
        pickType: 'alternated',
        seriesType: 'BO3',
        mapBanCount: 0,
        firstMapRandom: false,
        acePick: false,
        acePickHidden: false,
        mapTurnOrder: [],
        godTurnOrder: [],
        loserPicksNextMap: false,
      },
      selectedMap: null,
      seriesMaps: [],
      mapBans: [],
      turn: 0,
      phase: 'god_pick',
      bans: [],
      picks: [],
      scoreA: 0,
      scoreB: 0,
      reportVoteA: null,
      reportVoteB: null,
      voteConflict: false,
      voteConflictCount: 0,
      currentGame: 1,
      history: [],
      replayLog: [],
      lastWinner: null,
      turnOrder: [],
      timerStart: serverTimestamp() as any,
      createdAt: serverTimestamp() as any,
      lastActivityAt: serverTimestamp() as any,
      hiddenActions: [],
      spectators: [],
    };

    const summary = lobbyDocToSummary(lobby.id, lobby);
    expect(summary.lastActivityAt).toBeNull();
    expect(summary.createdAt).toBeNull();

    const result = await lobbyService.syncPublicMetadataForLobby(lobby.id, lobby);
    expect(result).toBeUndefined();

    const lobbyIndexWrite = lastTransactionSetCalls.find((call) => call.path === 'metadata/lobby_index');
    expect(lobbyIndexWrite).toBeDefined();
    const lobbyIndexData = lobbyIndexWrite?.data as any;
    expect(lobbyIndexData.lastUpdated?._methodName).toBe('serverTimestamp');
    expect(containsServerTimestampSentinel(lobbyIndexData.activeLobbies)).toBe(false);
    expect(lobbyIndexData.activeLobbies?.[0]?.lastActivityAt ?? null).toBeNull();
    expect(lobbyIndexData.activeLobbies?.[0]?.createdAt ?? null).toBeNull();
  });
});
