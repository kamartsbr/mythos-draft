import { describe, it, expect } from 'vitest';
import { calculateNextTurnOrder, processTurnAction, processReportAction } from '../pureDraftEngine';
import { LobbyConfig, Lobby } from '../../types';

const createConfig = (overrides: Partial<LobbyConfig>): LobbyConfig => ({
  name: 'Test Lobby',
  preset: 'CUSTOM',
  teamSize: 3,
  hasBans: false,
  banCount: 0,
  isExclusive: false,
  isPrivate: false,
  allowedPantheons: ['greek', 'egyptian', 'norse'],
  allowedMaps: ['oasis', 'tundra', 'marsh'],
  pickType: 'alternated',
  timerDuration: 60,
  mapBanCount: 0,
  loserPicksNextMap: false,
  firstMapRandom: false,
  acePick: false,
  acePickHidden: false,
  mapTurnOrder: [],
  godTurnOrder: [],
  seriesType: 'BO5',
  ...overrides,
});

describe('pureDraftEngine > calculateNextTurnOrder', () => {
  // Scenario A: Preset MCL or FORJA, Game 1
  it('Scenario A: MCL/FORJA Preset, Game 1 should start with Team A and generate standard structure', () => {
    const config: LobbyConfig = {
      name: 'Test Lobby',
      preset: 'FORJA',
      teamSize: 3,
      hasBans: false,
      hasPerMapBans: true, // FORJA Playoffs has 1 ban per map
      banCount: 0,
      isExclusive: true,
      isPrivate: false,
      allowedPantheons: ['greek', 'egyptian'],
      allowedMaps: ['oasis', 'marsh'],
      pickType: 'alternated', // Snake draft
      timerDuration: 60,
      mapBanCount: 0,
      loserPicksNextMap: false,
      firstMapRandom: false,
      acePick: false,
      acePickHidden: false,
      mapTurnOrder: [],
      godTurnOrder: [],
      seriesType: 'BO3',
    };

    const { mapOrder, godOrder } = calculateNextTurnOrder(config, 1, null);

    // Map order for Game 1 of FORJA is map pick by A
    expect(mapOrder).toHaveLength(1);
    expect(mapOrder[0]).toEqual({
      player: 'A',
      action: 'PICK',
      target: 'MAP',
      modifier: 'GLOBAL',
      execution: 'NORMAL',
    });

    // God order has per-map bans first, starts with B since hasPerMapBans is active and startsWithB is false
    // Wait, startsWithB is false for game 1, so bans start with A, then B
    expect(godOrder[0].player).toBe('A');
    expect(godOrder[0].action).toBe('BAN');

    expect(godOrder[1].player).toBe('B');
    expect(godOrder[1].action).toBe('BAN');

    // Picks follow alternated structure (A, then B B, then A A, then B)
    // For 3v3 (teamSize 3), picks count = 3 per team (total 6 picks)
    const picks = godOrder.filter(t => t.action === 'PICK');
    expect(picks).toHaveLength(6);
    expect(picks[0].player).toBe('A');
    expect(picks[1].player).toBe('B');
    expect(picks[2].player).toBe('B');
    expect(picks[3].player).toBe('A');
    expect(picks[4].player).toBe('A');
    expect(picks[5].player).toBe('B');
  });

  // Scenario B: Preset MCL or FORJA, Game 2
  it('Scenario B: MCL/FORJA Preset, Game 2 should apply side inversion (startsWithB = true)', () => {
    const config: LobbyConfig = {
      name: 'Test Lobby',
      preset: 'MCL',
      teamSize: 3,
      hasBans: false,
      hasPerMapBans: false,
      banCount: 0,
      isExclusive: true,
      isPrivate: false,
      allowedPantheons: ['greek', 'norse'],
      allowedMaps: ['oasis', 'tundra'],
      pickType: 'alternated',
      timerDuration: 60,
      mapBanCount: 0,
      loserPicksNextMap: false,
      firstMapRandom: false,
      acePick: false,
      acePickHidden: false,
      mapTurnOrder: [],
      godTurnOrder: [],
      seriesType: 'BO3',
    };

    const { mapOrder, godOrder } = calculateNextTurnOrder(config, 2, 'A');

    // Map order for Game 2 of MCL is pick by B
    expect(mapOrder).toHaveLength(1);
    expect(mapOrder[0]).toEqual({
      player: 'B',
      action: 'PICK',
      target: 'MAP',
      modifier: 'GLOBAL',
      execution: 'NORMAL',
    });

    // Picks follow alternated structure with startsWithB = true (B, then A A, then B B, then A)
    const picks = godOrder.filter(t => t.action === 'PICK');
    expect(picks).toHaveLength(6);
    expect(picks[0].player).toBe('B');
    expect(picks[1].player).toBe('A');
    expect(picks[2].player).toBe('A');
    expect(picks[3].player).toBe('B');
    expect(picks[4].player).toBe('B');
    expect(picks[5].player).toBe('A');
  });

  // Scenario C: BO3 with loserPicksNextMap = true, Game 2
  it('Scenario C: BO3 with loserPicksNextMap = true, Game 2 should leave mapOrder empty', () => {
    const config: LobbyConfig = {
      name: 'Test Lobby',
      preset: 'CUSTOM',
      teamSize: 3,
      hasBans: true,
      banCount: 1,
      isExclusive: true,
      isPrivate: false,
      allowedPantheons: ['greek'],
      allowedMaps: ['oasis'],
      pickType: 'alternated',
      timerDuration: 60,
      mapBanCount: 1,
      loserPicksNextMap: true,
      firstMapRandom: false,
      acePick: false,
      acePickHidden: false,
      mapTurnOrder: [],
      godTurnOrder: [],
      seriesType: 'BO3',
    };

    const { mapOrder } = calculateNextTurnOrder(config, 2, 'A');

    // When loserPicksNextMap is true, Game 2+ maps are chosen out-of-band before god draft
    expect(mapOrder).toHaveLength(0);
  });

  it('Scenario D: MCL Playoffs Game 2 should let the previous loser pick map, ban first, and pick first', () => {
    const config = createConfig({
      preset: 'MCL_PLAYOFFS',
      hasPerMapBans: true,
      seriesType: 'BO5',
    });

    const afterHostWin = calculateNextTurnOrder(config, 2, 'A');
    expect(afterHostWin.mapOrder[0].player).toBe('B');
    expect(afterHostWin.godOrder[0]).toMatchObject({ player: 'B', action: 'BAN' });
    expect(afterHostWin.godOrder.find(turn => turn.action === 'PICK')?.player).toBe('B');

    const afterGuestWin = calculateNextTurnOrder(config, 2, 'B');
    expect(afterGuestWin.mapOrder[0].player).toBe('A');
    expect(afterGuestWin.godOrder[0]).toMatchObject({ player: 'A', action: 'BAN' });
    expect(afterGuestWin.godOrder.find(turn => turn.action === 'PICK')?.player).toBe('A');
  });

  it('Scenario E: MCL Tiebreaker should follow MCL group-stage parity with ban phase added', () => {
    const config = createConfig({
      preset: 'MCL_TIEBREAKER',
      hasBans: true,
      banCount: 1,
      seriesType: 'BO5',
    });

    const afterHostWin = calculateNextTurnOrder(config, 2, 'A');
    expect(afterHostWin.mapOrder[0].player).toBe('B');
    expect(afterHostWin.godOrder[0]).toMatchObject({ player: 'B', action: 'BAN' });

    const afterGuestWin = calculateNextTurnOrder(config, 2, 'B');
    expect(afterGuestWin.mapOrder[0].player).toBe('A');
    expect(afterGuestWin.godOrder[0]).toMatchObject({ player: 'B', action: 'BAN' });

    const game3 = calculateNextTurnOrder(config, 3, 'A');
    expect(game3.godOrder[0]).toMatchObject({ player: 'A', action: 'BAN' });
  });
});

describe('pureDraftEngine > processTurnAction', () => {
  const baseConfig: LobbyConfig = {
    name: 'Test Lobby',
    teamSize: 1,
    hasBans: false,
    banCount: 0,
    isExclusive: true,
    isPrivate: false,
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

  const createBaseLobby = (status: Lobby['status']): Lobby => ({
    id: 'test-lobby',
    status,
    captain1: 'capA',
    captain2: 'capB',
    readyA: false,
    readyB: false,
    config: baseConfig,
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
    timerStart: null,
    createdAt: 0,
    spectators: [],
    turnOrder: [
      { player: 'A', action: 'PICK', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'NORMAL' },
      { player: 'B', action: 'PICK', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'NORMAL' }
    ],
    hiddenActions: []
  });

  // Cenário A: Validação de Status
  it('Scenario A: Should throw if status is not drafting', () => {
    const lobby = createBaseLobby('waiting');
    expect(() => processTurnAction(lobby, 'zeus', 'A')).toThrow("Not drafting");
  });

  // Cenário B: Pick Normal
  it('Scenario B: Should apply normal pick, record replayLog, and advance turn', () => {
    const lobby = createBaseLobby('drafting');
    lobby.picks = [
      { playerId: 1, godId: null, team: 'A', color: 'red', position: 'corner' },
      { playerId: 2, godId: null, team: 'B', color: 'blue', position: 'corner' }
    ];

    const updated = processTurnAction(lobby, 'zeus', 'A', undefined, undefined, undefined, 1000);

    expect(updated.turn).toBe(1);
    expect(updated.picks[0].godId).toBe('zeus');
    expect(updated.picks[0].turnIndex).toBe(0);
    expect(updated.replayLog).toHaveLength(1);
    expect(updated.replayLog[0]).toMatchObject({
      gameNumber: 1,
      turnIndex: 0,
      player: 'A',
      action: 'PICK',
      target: 'GOD',
      id: 'zeus',
    });
    expect(new Date(updated.replayLog[0].timestamp).getTime()).toBe(1000);
    expect(updated.timerStart).toBe(1000);
    expect(updated.turnEndsAt).toBe(1000 + 60 * 1000);
    expect(updated.phase).toBe('god_pick');
  });

  // Cenário C: Hidden/Reveal
  it('Scenario C: Should queue action on execution HIDDEN and process on REVEAL', () => {
    const lobby = createBaseLobby('drafting');
    lobby.turnOrder = [
      { player: 'A', action: 'PICK', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'HIDDEN' },
      { player: 'B', action: 'PICK', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'HIDDEN' },
      { player: 'ADMIN', action: 'REVEAL', target: 'GOD', modifier: 'NONEXCLUSIVE', execution: 'NORMAL' }
    ];
    lobby.picks = [
      { playerId: 1, godId: null, team: 'A', color: 'red', position: 'corner' },
      { playerId: 2, godId: null, team: 'B', color: 'blue', position: 'corner' }
    ];

    // 1. Team A picks Zeus hidden
    const lobbyAfterA = processTurnAction(lobby, 'zeus', 'A', undefined, undefined, undefined, 1000);
    expect(lobbyAfterA.picks[0].godId).toBeNull();
    expect(lobbyAfterA.hiddenActions).toHaveLength(1);
    expect(lobbyAfterA.hiddenActions[0]).toEqual({ turnIndex: 0, actionId: 'zeus' });
    expect(lobbyAfterA.turn).toBe(1);

    // 2. Team B picks Isis hidden
    const lobbyAfterB = processTurnAction(lobbyAfterA, 'isis', 'B', undefined, undefined, undefined, 2000);
    expect(lobbyAfterB.picks[1].godId).toBeNull();
    expect(lobbyAfterB.hiddenActions).toHaveLength(2);
    expect(lobbyAfterB.turn).toBe(2);

    // 3. Admin triggers REVEAL
    const lobbyAfterReveal = processTurnAction(lobbyAfterB, 'reveal-placeholder', 'A', undefined, undefined, undefined, 3000);
    expect(lobbyAfterReveal.picks[0].godId).toBe('zeus');
    expect(lobbyAfterReveal.picks[1].godId).toBe('isis');
    expect(lobbyAfterReveal.hiddenActions).toHaveLength(0);
    expect(lobbyAfterReveal.replayLog).toHaveLength(2);
  });

  // Cenário D: Erro de Propriedade
  it('Scenario D: Should throw error if wrong team acts', () => {
    const lobby = createBaseLobby('drafting');
    expect(() => processTurnAction(lobby, 'zeus', 'B')).toThrow("Not your turn");
  });

  it('Scenario D2: Should reject expired manual picks instead of replacing them with random actions', () => {
    const mapLobby = createBaseLobby('drafting');
    mapLobby.phase = 'map_pick';
    mapLobby.timerStart = 1000;
    mapLobby.turnOrder = [
      { player: 'A', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' }
    ];

    expect(() => processTurnAction(mapLobby, 'ghost_lake', 'A', undefined, undefined, undefined, 63_000)).toThrow("Turn timed out");

    const godLobby = createBaseLobby('drafting');
    godLobby.timerStart = 1000;
    godLobby.picks = [
      { playerId: 1, godId: null, team: 'A', color: 'red', position: 'corner', playerName: 'PlayerOne' }
    ];

    expect(() => processTurnAction(godLobby, 'huitzilopochtli', 'A', 1, 'PlayerOne', undefined, 63_000)).toThrow("Turn timed out");
  });

  // Scenario E: Auto-pick MAP on timeout or null actionId
  it('Scenario E: Should auto-pick a random map when target is MAP and actionId is null', () => {
    const lobby = createBaseLobby('drafting');
    lobby.turnOrder = [
      { player: 'A', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' }
    ];
    lobby.config.allowedMaps = ['oasis', 'marsh'];
    
    const updated = processTurnAction(lobby, null as any, 'A', undefined, undefined, undefined, 1000);
    
    expect(updated.selectedMap).toBeDefined();
    expect(['oasis', 'marsh']).toContain(updated.selectedMap);
    expect(updated.replayLog).toHaveLength(1);
    expect(updated.replayLog[0].isRandom).toBe(true);
    expect(updated.replayLog[0].target).toBe('MAP');
  });

  // Scenario F: Auto-pick GOD on timeout or null actionId
  it('Scenario F: Should auto-pick a random god when target is GOD and actionId is null, resolving targetPlayerId and playerName', () => {
    const lobby = createBaseLobby('drafting');
    lobby.config.allowedPantheons = ['greek'];
    lobby.picks = [
      { playerId: 10, godId: null, team: 'A', color: 'red', position: 'corner', playerName: 'PlayerOne' }
    ];
    
    const updated = processTurnAction(lobby, null as any, 'A', undefined, undefined, undefined, 1000);
    
    expect(updated.picks[0].godId).toBeDefined();
    expect(updated.picks[0].godId).not.toBeNull();
    expect(updated.picks[0].isRandom).toBe(true);
    expect(updated.picks[0].playerName).toBe('PlayerOne');
    
    expect(updated.replayLog).toHaveLength(1);
    expect(updated.replayLog[0].isRandom).toBe(true);
    expect(updated.replayLog[0].playerId).toBe(10);
    expect(updated.replayLog[0].target).toBe('GOD');
  });

  // Scenario G: Auto-pick BAN on timeout or null actionId
  it('Scenario G: Should auto-ban a random god when action is BAN and actionId is null', () => {
    const lobby = createBaseLobby('drafting');
    lobby.turnOrder = [
      { player: 'A', action: 'BAN', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'NORMAL' }
    ];
    lobby.config.allowedPantheons = ['greek'];
    
    const updated = processTurnAction(lobby, null as any, 'A', undefined, undefined, undefined, 1000);
    
    expect(updated.bans).toHaveLength(1);
    expect(updated.bans[0]).toBeDefined();
    expect(updated.bans[0]).not.toBeNull();
    
    expect(updated.replayLog).toHaveLength(1);
    expect(updated.replayLog[0].isRandom).toBe(true);
    expect(updated.replayLog[0].action).toBe('BAN');
  });
});

describe('pureDraftEngine > processReportAction', () => {
  const bo3Config: LobbyConfig = {
    name: 'BO3 Lobby',
    teamSize: 3,
    hasBans: false,
    banCount: 0,
    isExclusive: true,
    isPrivate: false,
    allowedPantheons: ['greek'],
    allowedMaps: ['oasis', 'tundra'],
    pickType: 'alternated',
    timerDuration: 60,
    mapBanCount: 0,
    loserPicksNextMap: false,
    firstMapRandom: false,
    acePick: false,
    acePickHidden: false,
    mapTurnOrder: [],
    godTurnOrder: [],
    seriesType: 'BO3',
  };

  const createDraftedLobby = (phase: Lobby['phase']): Lobby => ({
    id: 'test-lobby',
    status: 'drafting',
    captain1: 'capA',
    captain2: 'capB',
    readyA: false,
    readyB: false,
    readyA_report: false,
    readyB_report: false,
    config: bo3Config,
    selectedMap: 'oasis',
    seriesMaps: ['oasis'],
    mapBans: [],
    turn: 2,
    phase,
    bans: [],
    picks: [
      { playerId: 1, godId: 'zeus', team: 'A', color: 'red', position: 'corner' },
      { playerId: 2, godId: 'isis', team: 'B', color: 'blue', position: 'corner' }
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
    timerStart: null,
    createdAt: 0,
    spectators: [],
    turnOrder: [
      { player: 'A', action: 'PICK', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'NORMAL' },
      { player: 'B', action: 'PICK', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'NORMAL' }
    ],
    hiddenActions: []
  });

  // Cenário A: Transição para fase de reporte
  it('Scenario A: Should mark ready and transition phase to reporting when both are ready', () => {
    const lobby = createDraftedLobby('post_draft');
    
    // Team A ready
    const step1 = processReportAction(lobby, null, 'A', 1000);
    expect(step1.readyA_report).toBe(true);
    expect(step1.phase).toBe('post_draft');

    // Team B ready -> transitions to reporting
    const step2 = processReportAction(step1, null, 'B', 2000);
    expect(step2.readyA_report).toBe(false);
    expect(step2.readyB_report).toBe(false);
    expect(step2.phase).toBe('reporting');
  });

  // Cenário B: Conflito de votos
  it('Scenario B: Should set voteConflict to true if votes do not match', () => {
    const lobby = createDraftedLobby('reporting');

    // Team A votes A
    const step1 = processReportAction(lobby, 'A', 'A', 1000);
    // Team B votes B
    const step2 = processReportAction(step1, 'B', 'B', 2000);

    expect(step2.reportVoteA).toBe('A');
    expect(step2.reportVoteB).toBe('B');
    expect(step2.voteConflict).toBe(true);
  });

  // Cenário C: Resultado bate e avança para Game 2
  it('Scenario C: Should advance to Game 2 and reset picks/selectedMap when votes match and series continues', () => {
    const lobby = createDraftedLobby('reporting');

    // Both vote A
    const step1 = processReportAction(lobby, 'A', 'A', 1000);
    const step2 = processReportAction(step1, 'A', 'B', 2000);

    expect(step2.scoreA).toBe(1);
    expect(step2.scoreB).toBe(0);
    expect(step2.currentGame).toBe(2);
    expect(step2.lastWinner).toBe('A');
    expect(step2.phase).toBe('ready');
    expect(step2.selectedMap).toBeNull();
    expect(step2.picks[0].godId).toBeNull(); // Reset god selections for next game
    expect(step2.picks[1].godId).toBeNull();
    expect(step2.history).toHaveLength(1);
    expect(step2.history[0]).toMatchObject({
      gameNumber: 1,
      mapId: 'oasis',
      winner: 'A',
      picksA: ['zeus'],
      picksB: ['isis'],
    });
  });

  // Cenário D: Resultado finaliza a série
  it('Scenario D: Should finish the series when score threshold is reached', () => {
    const lobby = createDraftedLobby('reporting');
    lobby.scoreA = 1;
    lobby.currentGame = 2;

    // Both vote A again (Team A wins Game 2, score A becomes 2 in a BO3, which completes the series)
    const step1 = processReportAction(lobby, 'A', 'A', 1000);
    const step2 = processReportAction(step1, 'A', 'B', 2000);

    expect(step2.scoreA).toBe(2);
    expect(step2.status).toBe('finished');
    expect(step2.phase).toBe('finished');
  });

  it('Scenario E: MCL Group Stage Game 3 start prevents isRandom or godId leakage and clears timer', () => {
    const config: LobbyConfig = {
      name: 'MCL Lobby',
      preset: 'MCL',
      teamSize: 3,
      hasBans: false,
      seriesType: '3G'
    } as LobbyConfig;

    const lobby: Lobby = {
      id: 'test',
      config,
      status: 'drafting',
      phase: 'reporting',
      currentGame: 2,
      history: [],
      bans: [],
      mapBans: [],
      seriesMaps: ['map1', 'map2'],
      scoreA: 1,
      scoreB: 1,
      picks: [
        { playerId: 1, team: 'A', position: 'corner', color: '#ef4444', godId: 'oranos', isRandom: true, turnIndex: 1, playerName: 'P1' }
      ]
    } as unknown as Lobby;

    const step1 = processReportAction(lobby, 'A', 'A', 1000);
    const step2 = processReportAction(step1, 'A', 'B', 2000);

    expect(step2.currentGame).toBe(3);
    expect(step2.phase).toBe('ready');
    expect(step2.status).toBe('waiting');
    expect(step2.timerStart).toBeNull();
    expect(step2.turnEndsAt).toBeNull();

    // Verify all picks are wiped cleanly
    const p1 = step2.picks.find(p => p.playerId === 1);
    expect(p1?.godId).toBeNull();
    expect(p1?.isRandom).toBe(false);
    expect(p1?.turnIndex).toBeUndefined();
    expect(p1?.playerName).toBe('P1');
  });

  it('Scenario F: MCL Playoffs per-game god bans reset when advancing to the next game', () => {
    const lobby = createDraftedLobby('reporting');
    lobby.config = createConfig({
      preset: 'MCL_PLAYOFFS',
      hasPerMapBans: true,
      seriesType: 'BO5',
    });
    lobby.bans = ['zeus'];

    const step1 = processReportAction(lobby, 'A', 'A', 1000);
    const step2 = processReportAction(step1, 'A', 'B', 2000);

    expect(step2.currentGame).toBe(2);
    expect(step2.bans).toHaveLength(0);
    expect(step2.turnOrder[0]).toMatchObject({ player: 'B', action: 'PICK', target: 'MAP' });
    expect(step2.turnOrder[1]).toMatchObject({ player: 'B', action: 'BAN', target: 'GOD' });
  });
});
