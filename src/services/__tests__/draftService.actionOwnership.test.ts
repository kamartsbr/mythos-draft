import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lobby, LobbyConfig } from '../../types';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
  runTransaction: vi.fn(),
  Timestamp: {
    fromMillis: vi.fn((value: number) => ({ toMillis: () => value })),
  },
}));

vi.mock('../../firebase', () => ({
  db: {},
  auth: {},
}));

vi.mock('../lobbyService', () => ({
  normalizeLobbyData: vi.fn((lobby: Lobby) => lobby),
  IS_DEV: true,
  isSoloAdminLobby: vi.fn(() => false),
}));

import { draftService } from '../draftService';

const config: LobbyConfig = {
  name: 'Service Test Lobby',
  preset: 'MCL_TIEBREAKER',
  teamSize: 3,
  hasBans: false,
  banCount: 0,
  isExclusive: true,
  isPrivate: true,
  allowedPantheons: ['greek'],
  allowedMaps: ['oasis'],
  pickType: 'alternated',
  timerDuration: 60,
  mapBanCount: 0,
  loserPicksNextMap: false,
  firstMapRandom: false,
  acePick: false,
  acePickHidden: false,
  mapTurnOrder: [],
  godTurnOrder: [],
  seriesType: 'BO1',
};

const createLobby = (): Lobby => ({
  id: 'service-lobby',
  status: 'drafting',
  captain1: 'host',
  captain2: 'guest',
  readyA: true,
  readyB: true,
  config,
  selectedMap: 'oasis',
  seriesMaps: ['oasis'],
  mapBans: [],
  turn: 0,
  phase: 'god_pick',
  bans: [],
  picks: [
    { playerId: 1, team: 'A', position: 'corner', color: '#ef4444', godId: null, playerName: 'Host Alpha' },
    { playerId: 2, team: 'B', position: 'corner', color: '#ec4899', godId: null, playerName: 'Guest Alpha' },
  ],
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
  timerStart: 0,
  createdAt: 0,
  spectators: [],
  turnOrder: [
    { player: 'A', action: 'PICK', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'NORMAL' },
    { player: 'B', action: 'PICK', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'NORMAL' },
  ],
  hiddenActions: [],
});

describe('draftService._processActionLogic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks guest manual action during host turn', () => {
    vi.setSystemTime(30_000);
    const lobby = createLobby();

    const result = draftService._processActionLogic(lobby, 'zeus', false, true, 1, 'Guest Hijack');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not your turn');
  });

  it('blocks host manual action during guest turn', () => {
    vi.setSystemTime(30_000);
    const lobby = createLobby();
    lobby.turn = 1;
    lobby.picks[0].godId = 'zeus';

    const result = draftService._processActionLogic(lobby, 'hera', true, false, 2, 'Host Hijack');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not your turn');
  });

  it('blocks timeout flag before the timer actually expires', () => {
    vi.setSystemTime(30_000);
    const lobby = createLobby();

    const result = draftService._processActionLogic(
      lobby,
      'zeus',
      false,
      true,
      1,
      'Guest Hijack',
      { isRandom: true, isTimeoutAutoResolve: true }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not your turn');
  });

  it('allows timeout auto-resolve for the active side after expiry', () => {
    vi.setSystemTime(61_000);
    const lobby = createLobby();

    const result = draftService._processActionLogic(
      lobby,
      'zeus',
      false,
      true,
      1,
      'Guest Timeout',
      { isRandom: true, isTimeoutAutoResolve: true }
    );

    expect(result.success).toBe(true);
    expect(result.updates?.picks?.[0].team).toBe('A');
    expect(result.updates?.picks?.[0].godId).toBeTruthy();
    expect(result.updates?.replayLog?.[0]).toMatchObject({
      player: 'A',
      action: 'PICK',
      target: 'GOD',
      isRandom: true,
    });
  });
});
