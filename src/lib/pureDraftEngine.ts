import { LobbyConfig, DraftTurn, Lobby, PickEntry } from '../types';
import { getMCLPicks, getMCLTeamOrder } from '../data/draft';

/**
 * Compute deterministic, immutable map and god draft turn sequences for the specified game and configuration.
 *
 * The returned orders respect custom overrides in the configuration, preset-specific rules (e.g., MCL/FORJA),
 * series type (BO1/BO3/BO5/…), ace-pick and hidden/blank pick modes, ban/pick counts, exclusive vs non-exclusive
 * modifiers, and blind reveal behavior.
 *
 * @param cfg - Lobby configuration that controls drafting rules, presets, counts, and special modes
 * @param gameNumber - Current game number in the series (1-indexed)
 * @param lastWinner - Winner of the previous game (`'A'` or `'B'`) or `null` when no previous winner exists
 * @returns An object with `mapOrder` — the ordered list of map draft turns, and `godOrder` — the ordered list of god draft turns
 */
export function calculateNextTurnOrder(
  cfg: LobbyConfig,
  gameNumber: number = 1,
  lastWinner: 'A' | 'B' | null = null
): { mapOrder: DraftTurn[]; godOrder: DraftTurn[] } {
  // If custom turn orders are provided in the config, use them directly
  if (cfg.mapTurnOrder && cfg.mapTurnOrder.length > 0 && cfg.godTurnOrder && cfg.godTurnOrder.length > 0) {
    return {
      mapOrder: [...cfg.mapTurnOrder],
      godOrder: [...cfg.godTurnOrder],
    };
  }

  const mapOrder: DraftTurn[] = [];
  const godOrder: DraftTurn[] = [];

  // 1. Map Draft Turn Order
  if (cfg.preset === 'MCL' || cfg.preset === 'FORJA') {
    if (gameNumber === 1) {
      mapOrder.push({ player: 'A', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
    } else if (gameNumber === 2) {
      mapOrder.push({ player: 'B', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
    } else if (gameNumber === 3 && (cfg.preset === 'FORJA' || cfg.hasMap3RandomRoll)) {
      // FORJA or preset with hasMap3RandomRoll: Map 3 is system-rolled (ADMIN turn)
      mapOrder.push({ player: 'ADMIN', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
    }
  } else if (cfg.seriesType !== 'BO1') {
    // Standard Series Logic (BO3, BO5, etc.) for non-MCL/non-FORJA presets
    if (gameNumber === 1) {
      for (let i = 0; i < (cfg.mapBanCount || 0); i++) {
        mapOrder.push({ player: 'A', action: 'BAN', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
        mapOrder.push({ player: 'B', action: 'BAN', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
      }

      if (cfg.loserPicksNextMap) {
        if (cfg.firstMapRandom) {
          mapOrder.push({ player: 'ADMIN', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
        } else {
          mapOrder.push({ player: 'A', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
        }
      } else {
        const gameCount = cfg.seriesType === 'BO3' ? 3 :
                          cfg.seriesType === 'BO5' ? 5 :
                          cfg.seriesType === 'BO7' ? 7 :
                          cfg.seriesType === 'BO9' ? 9 :
                          (cfg.customGameCount || 1);

        const playerPicks = gameCount - 1;
        for (let i = 0; i < playerPicks; i++) {
          const player = i % 2 === 0 ? 'A' : 'B';
          mapOrder.push({ player, action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
        }
        mapOrder.push({ player: 'ADMIN', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
      }
    } else {
      // For Game 2+, if loserPicksNextMap is on, it is handled outside mapOrder
      if (cfg.loserPicksNextMap) {
        // Leave mapOrder empty here as it's resolved before the picks/bans of gods
      }
    }
  } else {
    // BO1 Logic
    if (gameNumber === 1) {
      for (let i = 0; i < (cfg.mapBanCount || 0); i++) {
        mapOrder.push({ player: 'A', action: 'BAN', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
        mapOrder.push({ player: 'B', action: 'BAN', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
      }
      if (cfg.firstMapRandom) {
        mapOrder.push({ player: 'ADMIN', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
      } else {
        mapOrder.push({ player: 'A', action: 'PICK', target: 'MAP', modifier: 'GLOBAL', execution: 'NORMAL' });
      }
    }
  }

  // 2. God Draft Turn Order
  // In 1v1, all gods are drafted in Game 1. Game 2+ has no god drafting turns.
  if (cfg.teamSize === 1 && gameNumber > 1) {
    return { mapOrder, godOrder: [] };
  }

  // Ace Pick Phase (runs before bans)
  if (cfg.acePick) {
    if (cfg.acePickHidden) {
      godOrder.push({ player: 'A', action: 'PICK', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'HIDDEN' });
      godOrder.push({ player: 'B', action: 'PICK', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'HIDDEN' });
      godOrder.push({ player: 'ADMIN', action: 'REVEAL', target: 'GOD', modifier: 'NONEXCLUSIVE', execution: 'NORMAL' });
    } else {
      godOrder.push({ player: 'A', action: 'PICK', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'NORMAL' });
      godOrder.push({ player: 'B', action: 'PICK', target: 'GOD', modifier: 'EXCLUSIVE', execution: 'NORMAL' });
    }
  }

  // Priority alternation (determines who acts first in bans/picks)
  // MCL / FORJA: Game 2 starts with B.
  // Game 3+: starts with B if lastWinner was A (the loser of previous game picks first).
  const startsWithB =
    ((cfg.preset === 'MCL' || cfg.preset === 'FORJA') && gameNumber === 2) ||
    ((cfg.preset === 'MCL' || cfg.preset === 'FORJA') && gameNumber > 2 && lastWinner === 'A');

  // God Ban Phase
  if (cfg.hasBans) {
    for (let i = 0; i < (cfg.banCount || 0); i++) {
      godOrder.push({
        player: startsWithB ? 'B' : 'A',
        action: 'BAN',
        target: 'GOD',
        modifier: cfg.isExclusive ? 'EXCLUSIVE' : 'GLOBAL',
        execution: 'NORMAL',
      });
      godOrder.push({
        player: startsWithB ? 'A' : 'B',
        action: 'BAN',
        target: 'GOD',
        modifier: cfg.isExclusive ? 'EXCLUSIVE' : 'GLOBAL',
        execution: 'NORMAL',
      });
    }
  } else if (cfg.hasPerMapBans) {
    // FORJA Playoffs: 1 Ban of God per team before picking on each map
    godOrder.push({
      player: startsWithB ? 'B' : 'A',
      action: 'BAN',
      target: 'GOD',
      modifier: 'GLOBAL',
      execution: 'NORMAL',
    });
    godOrder.push({
      player: startsWithB ? 'A' : 'B',
      action: 'BAN',
      target: 'GOD',
      modifier: 'GLOBAL',
      execution: 'NORMAL',
    });
  }

  // God Pick Phase
  let picksPerTeam = cfg.teamSize || 1;
  if (cfg.teamSize === 1) {
    const gameCount = cfg.seriesType === 'BO3' ? 3 :
                      cfg.seriesType === 'BO5' ? 5 :
                      cfg.seriesType === 'BO7' ? 7 :
                      cfg.seriesType === 'BO9' ? 9 :
                      (cfg.customGameCount || 1);
    if (gameCount > 1) {
      picksPerTeam = gameCount + 1;
    }
  }

  const finalPicksPerTeam = picksPerTeam - (cfg.acePick ? 1 : 0);

  if (finalPicksPerTeam > 0) {
    if (cfg.pickType === 'alternated') {
      // Snake / double-pick style: 1-2-2-2...
      let remainingA = finalPicksPerTeam;
      let remainingB = finalPicksPerTeam;
      let turn = 0;

      while (remainingA > 0 || remainingB > 0) {
        const isTeamA = (turn % 2 === 0) !== startsWithB;
        let maxCount = 2;
        if (turn === 0) maxCount = 1;
        const count = Math.min(maxCount, isTeamA ? remainingA : remainingB);

        if (count > 0) {
          for (let i = 0; i < count; i++) {
            godOrder.push({
              player: isTeamA ? 'A' : 'B',
              action: 'PICK',
              target: 'GOD',
              modifier: cfg.isExclusive ? 'EXCLUSIVE' : 'NONEXCLUSIVE',
              execution: 'NORMAL',
            });
            if (isTeamA) remainingA--;
            else remainingB--;
          }
        }
        turn++;
      }
    } else {
      // Normal/parallel alternating style: 1-1-1-1...
      const totalPicks = finalPicksPerTeam * 2;
      for (let i = 0; i < totalPicks; i++) {
        const isTeamA = (i % 2 === 0) !== startsWithB;
        const player = isTeamA ? 'A' : 'B';
        godOrder.push({
          player,
          action: 'PICK',
          target: 'GOD',
          modifier: cfg.isExclusive ? 'EXCLUSIVE' : 'NONEXCLUSIVE',
          execution: cfg.pickType === 'blind' ? 'HIDDEN' : 'NORMAL',
        });
      }
    }
  }

  if (cfg.pickType === 'blind') {
    godOrder.push({
      player: 'ADMIN',
      action: 'REVEAL',
      target: 'GOD',
      modifier: 'NONEXCLUSIVE',
      execution: 'NORMAL',
    });
  }

  return { mapOrder, godOrder };
}

/**
 * Apply a single draft turn (pick, ban, snipe, hidden action, or reveal) and return an updated Lobby state.
 *
 * @param lobby - Current immutable Lobby state
 * @param actionId - Selected item ID (god or map). For timer-expired turns a null-like value may be used to trigger timeout handling
 * @param actingTeam - Team performing the action (`'A'` or `'B'`)
 * @param targetPlayerId - Optional player slot id used to target a specific roster slot for a pick
 * @param playerName - Optional player name to record for the targeted pick slot
 * @param options - Additional flags (e.g., `{ isRandom?: true }` to mark a random pick)
 * @param currentTimeMs - Current timestamp in milliseconds used for deterministic timing and replay entries
 * @returns A new Lobby object reflecting the applied action and any state transitions (turn, phase, timers, logs, hidden actions)
 * @throws If the lobby is not in drafting, if no current turn exists, if the caller is not authorized for the turn, or if the action is invalid
 */
export function processTurnAction(
  lobby: Lobby,
  actionId: string,
  actingTeam: 'A' | 'B',
  targetPlayerId?: number,
  playerName?: string,
  options?: { isRandom?: boolean },
  currentTimeMs: number = Date.now()
): Lobby {
  if (lobby.status !== 'drafting') {
    throw new Error("Not drafting");
  }

  const currentTurn = lobby.turnOrder[lobby.turn];
  if (!currentTurn) {
    throw new Error("No turn found");
  }

  // Timer Check
  let isTimerExpired = false;
  if (lobby.timerStart) {
    let startTime: number;
    if (typeof lobby.timerStart === 'number') {
      startTime = lobby.timerStart;
    } else if (typeof lobby.timerStart === 'string') {
      startTime = new Date(lobby.timerStart).getTime();
    } else if (lobby.timerStart && typeof (lobby.timerStart as any).toMillis === 'function') {
      startTime = (lobby.timerStart as any).toMillis();
    } else if (lobby.timerStart instanceof Date) {
      startTime = lobby.timerStart.getTime();
    } else {
      startTime = currentTimeMs;
    }
    const elapsed = (currentTimeMs - startTime) / 1000;
    const duration = lobby.config.timerDuration || 60;
    if (elapsed >= duration + 1) {
      isTimerExpired = true;
    }
  }

  const isMyTurn =
    (actingTeam === 'A' && currentTurn.player === 'A') ||
    (actingTeam === 'B' && currentTurn.player === 'B') ||
    currentTurn.player === 'BOTH';

  if (!isMyTurn && currentTurn.player !== 'ADMIN') {
    throw new Error("Not your turn");
  }

  // When timer expires, ignore supplied actionId and invoke deterministic timeout logic
  if (isTimerExpired && currentTurn.player !== 'ADMIN') {
    actionId = null as any; // Force timeout pick path
  }

  // Create immutable copy of state arrays
  const nextLobby: Lobby = {
    ...lobby,
    picks: lobby.picks.map(p => ({ ...p })),
    bans: [...(lobby.bans || [])],
    mapBans: [...(lobby.mapBans || [])],
    seriesMaps: [...(lobby.seriesMaps || [])],
    replayLog: [...(lobby.replayLog || [])],
    hiddenActions: Array.isArray(lobby.hiddenActions) ? lobby.hiddenActions.map(ha => ({ ...ha })) : [],
    mapPool: lobby.mapPool ? [...lobby.mapPool] : [],
  };

  let executionTeam: 'A' | 'B' = actingTeam;
  if (currentTurn.player === 'A') executionTeam = 'A';
  else if (currentTurn.player === 'B') executionTeam = 'B';

  if (currentTurn.execution === 'AS_OPPONENT') {
    executionTeam = executionTeam === 'A' ? 'B' : 'A';
  }

  const applyAction = (id: string, turn: DraftTurn, team: 'A' | 'B', tPlayerId?: number, pName?: string): boolean => {
    if (turn.action === 'BAN') {
      if (turn.target === 'MAP') {
        if (nextLobby.mapBans.includes(id)) return false;
        if (nextLobby.seriesMaps.includes(id)) return false;
        nextLobby.mapBans.push(id);
      } else {
        if (nextLobby.bans.includes(id)) return false;
        nextLobby.bans.push(id);
      }
    } else if (turn.action === 'PICK') {
      if (turn.target === 'MAP') {
        if (nextLobby.mapBans.includes(id)) return false;
        if (nextLobby.seriesMaps.includes(id)) return false;
        if (nextLobby.mapPool && nextLobby.mapPool.includes(id)) return false;

        if (turn.player === 'ADMIN') {
          const targetIndex = nextLobby.currentGame ? nextLobby.currentGame - 1 : 0;
          if (targetIndex < 0) return false;
          while (nextLobby.seriesMaps.length <= targetIndex) {
            nextLobby.seriesMaps.push("");
          }
          nextLobby.seriesMaps[targetIndex] = id;
        } else {
          const emptySlotIndex = nextLobby.seriesMaps.indexOf("");
          if (emptySlotIndex !== -1) {
            if ((nextLobby.config.preset === 'MCL' || nextLobby.config.preset === 'FORJA') && emptySlotIndex !== (nextLobby.currentGame - 1)) {
              return false;
            }
            nextLobby.seriesMaps[emptySlotIndex] = id;
          } else {
            const gameCount = nextLobby.config.seriesType === 'BO1' ? 1 :
                              nextLobby.config.seriesType === 'BO3' ? 3 :
                              nextLobby.config.seriesType === 'BO5' ? 5 :
                              nextLobby.config.seriesType === 'BO7' ? 7 :
                              nextLobby.config.seriesType === 'BO9' ? 9 :
                              nextLobby.config.seriesType === '3G' ? 3 :
                              (nextLobby.config.customGameCount || 1);

            if (nextLobby.seriesMaps.length < gameCount) {
              nextLobby.seriesMaps.push(id);
            } else {
              return false;
            }
          }
        }

        nextLobby.selectedMap = id;

        if (nextLobby.config.preset === 'MCL' || nextLobby.config.preset === 'FORJA') {
          nextLobby.picks = getMCLPicks(nextLobby.currentGame);
        }
      } else {
        // God PICK
        const alreadyPickedByTeam = nextLobby.picks.some(p => p.team === team && p.godId === id);
        const alreadyPickedByAnyone = nextLobby.picks.some(p => p.godId === id);
        if (turn.modifier === 'EXCLUSIVE' && alreadyPickedByAnyone) return false;
        if (turn.modifier === 'NONEXCLUSIVE' && alreadyPickedByTeam) return false;
        if (nextLobby.bans.includes(id)) return false;

        let pickIndex = -1;
        if (tPlayerId !== undefined) {
          pickIndex = nextLobby.picks.findIndex(p => p.team === team && p.playerId === tPlayerId && p.godId === null);
        } else {
          pickIndex = nextLobby.picks.findIndex(p => p.team === team && p.godId === null);
        }

        if (pickIndex !== -1) {
          nextLobby.picks[pickIndex].godId = id;
          nextLobby.picks[pickIndex].turnIndex = nextLobby.turn;
          if (options?.isRandom) {
            nextLobby.picks[pickIndex].isRandom = true;
          }
          if (pName) {
            nextLobby.picks[pickIndex].playerName = pName;
          }
        } else {
          return false;
        }
      }
    } else if (turn.action === 'SNIPE') {
      const opponentTeam = team === 'A' ? 'B' : 'A';
      const snipeIndex = nextLobby.picks.findIndex(p => p.team === opponentTeam && p.godId === id);
      if (snipeIndex !== -1) {
        nextLobby.picks[snipeIndex].godId = null;
      }
    }

    nextLobby.replayLog.push({
      gameNumber: nextLobby.currentGame,
      turnIndex: nextLobby.turn,
      player: turn.player === 'BOTH' ? team : turn.player as any,
      action: turn.action,
      target: turn.target,
      id,
      timestamp: new Date(currentTimeMs).toISOString(),
      playerId: tPlayerId ?? null,
      isRandom: options?.isRandom || false,
    });

    return true;
  };

  if (currentTurn.action === 'REVEAL') {
    nextLobby.hiddenActions.forEach(ha => {
      const turn = nextLobby.turnOrder[ha.turnIndex];
      const team = turn.player === 'A' ? 'A' : (turn.player === 'B' ? 'B' : executionTeam);
      applyAction(ha.actionId, turn, team, ha.targetPlayerId, ha.playerName);
    });
    nextLobby.hiddenActions = [];
  } else if (currentTurn.execution === 'HIDDEN') {
    nextLobby.hiddenActions.push({ turnIndex: nextLobby.turn, actionId, targetPlayerId, playerName });
  } else {
    const success = applyAction(actionId, currentTurn, executionTeam, targetPlayerId, playerName);
    if (!success) {
      throw new Error("Invalid action");
    }
  }

  nextLobby.turn++;
  nextLobby.timerStart = currentTimeMs;

  const duration = nextLobby.config.timerDuration || 60;
  nextLobby.turnEndsAt = currentTimeMs + (duration * 1000);

  const nextTurn = nextLobby.turnOrder[nextLobby.turn];
  if (nextTurn) {
    if (nextTurn.target === 'MAP') {
      nextLobby.phase = nextTurn.action === 'BAN' ? 'map_ban' : 'map_pick';
    } else {
      if (currentTurn.target === 'MAP') {
        if (nextLobby.seriesMaps.length > 0) {
          nextLobby.selectedMap = nextLobby.seriesMaps[nextLobby.currentGame - 1];
        }
      }
      nextLobby.phase = nextTurn.action === 'BAN' ? 'god_ban' : 'god_pick';
    }
  } else {
    if (nextLobby.config.teamSize === 1) {
      nextLobby.phase = 'ready_picker';
      nextLobby.readyA = false;
      nextLobby.readyB = false;
    } else {
      nextLobby.phase = 'post_draft';
    }
    nextLobby.timerStart = null;
    nextLobby.turnEndsAt = null;
  }

  nextLobby.lastActivityAt = currentTimeMs;

  return nextLobby;
}

/**
 * Update lobby reporting state and either advance the series to the next game or mark the match finished based on a reported winner.
 *
 * This records the reporting team's vote (or mirrors votes when `isAdminOverride`), starts the report timer when voting begins, and when both sides agree appends a game entry to history, increments the winning team's score, and decides whether the series is complete. If the series continues, the function advances to the next game, resets draft/report fields, recomputes the next turn order, and applies preset-specific reinitialization (e.g., MCL/FORJA pick assignment); if the series finishes, it sets the lobby to the finished state.
 *
 * @param lobby - Current immutable Lobby state
 * @param winner - Reported game winner (`'A'` or `'B'`); must be non-null when submitting a vote
 * @param reportingTeam - Team submitting this report vote (`'A'` or `'B'`)
 * @param currentTimeMs - Current timestamp in milliseconds used for time fields and history entries
 * @param options.isAdminOverride - When true, apply the reported winner to both teams' votes immediately
 * @returns The updated Lobby reflecting the report action
 */
export function processReportAction(
  lobby: Lobby,
  winner: 'A' | 'B' | null,
  reportingTeam: 'A' | 'B',
  currentTimeMs: number = Date.now(),
  options?: { isAdminOverride?: boolean }
): Lobby {
  const nextLobby: Lobby = {
    ...lobby,
    picks: lobby.picks.map(p => ({ ...p })),
    bans: [...(lobby.bans || [])],
    mapBans: [...(lobby.mapBans || [])],
    seriesMaps: [...(lobby.seriesMaps || [])],
    replayLog: [...(lobby.replayLog || [])],
    history: lobby.history.map(h => ({
      ...h,
      picksA: [...h.picksA],
      picksB: [...h.picksB],
      colorsA: h.colorsA ? [...h.colorsA] : undefined,
      colorsB: h.colorsB ? [...h.colorsB] : undefined,
      rosterA: h.rosterA ? h.rosterA.map(p => ({ ...p })) : undefined,
      rosterB: h.rosterB ? h.rosterB.map(p => ({ ...p })) : undefined,
    })),
  };

  if (nextLobby.phase === 'post_draft' && nextLobby.status === 'drafting') {
    if (options?.isAdminOverride) {
      nextLobby.readyA_report = true;
      nextLobby.readyB_report = true;
    } else {
      if (reportingTeam === 'A') nextLobby.readyA_report = true;
      if (reportingTeam === 'B') nextLobby.readyB_report = true;
    }

    if (nextLobby.readyA_report && nextLobby.readyB_report) {
      nextLobby.phase = 'reporting';
      nextLobby.readyA_report = false;
      nextLobby.readyB_report = false;
    }

    nextLobby.lastActivityAt = currentTimeMs;
    return nextLobby;
  }

  if (!winner) {
    throw new Error("No winner selected");
  }

  if (options?.isAdminOverride) {
    nextLobby.reportVoteA = winner;
    nextLobby.reportVoteB = winner;
  } else {
    if (reportingTeam === 'A') nextLobby.reportVoteA = winner;
    if (reportingTeam === 'B') nextLobby.reportVoteB = winner;
  }

  if (!lobby.reportVoteA && !lobby.reportVoteB) {
    nextLobby.reportStartAt = currentTimeMs;
  }

  nextLobby.voteConflict = false;

  if (nextLobby.reportVoteA && nextLobby.reportVoteB) {
    if (nextLobby.reportVoteA === nextLobby.reportVoteB) {
      const finalWinner = nextLobby.reportVoteA;

      nextLobby.history.push({
        gameNumber: lobby.currentGame,
        mapId: lobby.selectedMap || "",
        winner: finalWinner,
        picksA: lobby.config.teamSize === 1 ? [lobby.pickerVoteA || ""] : lobby.picks.filter(p => p.team === 'A').map(p => p.godId || ""),
        picksB: lobby.config.teamSize === 1 ? [lobby.pickerVoteB || ""] : lobby.picks.filter(p => p.team === 'B').map(p => p.godId || ""),
        colorsA: lobby.config.teamSize === 1 ? [lobby.picks.find(p => p.team === 'A')?.color || ""] : lobby.picks.filter(p => p.team === 'A').map(p => p.color),
        colorsB: lobby.config.teamSize === 1 ? [lobby.picks.find(p => p.team === 'B')?.color || ""] : lobby.picks.filter(p => p.team === 'B').map(p => p.color),
        rosterA: lobby.picks.filter(p => p.team === 'A'),
        rosterB: lobby.picks.filter(p => p.team === 'B'),
      });

      if (finalWinner === 'A') nextLobby.scoreA++;
      else nextLobby.scoreB++;

      let isFinished = false;
      const sType = lobby.config.seriesType;

      if (sType === '3G' || lobby.config.preset === 'MCL' || (lobby.config.preset === 'FORJA' && lobby.config.tournamentStage === 'GROUP')) {
        isFinished = lobby.currentGame === 3 && Boolean(nextLobby.reportVoteA && nextLobby.reportVoteB);
      } else {
        const maxGamesStr = sType === 'CUSTOM' ? (lobby.config.customGameCount || 1).toString() : sType.replace('BO', '');
        const maxGames = parseInt(maxGamesStr);
        const winThreshold = Math.ceil(maxGames / 2);
        if (nextLobby.scoreA >= winThreshold || nextLobby.scoreB >= winThreshold) isFinished = true;
      }

      if (isFinished) {
        nextLobby.status = 'finished';
        nextLobby.phase = 'finished';
      } else {
        nextLobby.phase = 'ready';
        nextLobby.currentGame++;
        nextLobby.lastWinner = finalWinner;

        const { mapOrder, godOrder } = calculateNextTurnOrder(lobby.config, nextLobby.currentGame, finalWinner);
        nextLobby.turnOrder = [...mapOrder, ...godOrder];
        nextLobby.turn = 0;
        nextLobby.bans = [];
        nextLobby.reportVoteA = null;
        nextLobby.reportVoteB = null;
        nextLobby.reportStartAt = null;
        nextLobby.lastSubs = [];
        nextLobby.rosterChangedA = false;
        nextLobby.rosterChangedB = false;
        nextLobby.pickerVoteA = null;
        nextLobby.pickerVoteB = null;
        nextLobby.pickerPlayerA = null;
        nextLobby.pickerPlayerB = null;
        nextLobby.readyA_report = false;
        nextLobby.readyB_report = false;

        if (nextLobby.config.preset === 'MCL' || nextLobby.config.preset === 'FORJA') {
          const nextGameMap = (nextLobby.seriesMaps || [])[nextLobby.currentGame - 1];
          if (nextGameMap && nextGameMap !== '') {
            const newMCLPicks = getMCLPicks(nextLobby.currentGame);
            const teamAPlayers = nextLobby.teamAPlayers || [];
            const teamBPlayers = nextLobby.teamBPlayers || [];
            const teamAOrder = getMCLTeamOrder('A', nextGameMap, nextLobby.currentGame % 2 === 0);
            const teamBOrder = getMCLTeamOrder('B', nextGameMap, nextLobby.currentGame % 2 === 0);

            nextLobby.picks = newMCLPicks.map(p => {
              const existingPick = (lobby.picks || []).find(ep => ep.playerId === p.playerId);
              const teamPlayers = p.team === 'A' ? teamAPlayers : teamBPlayers;
              const teamOrder = p.team === 'A' ? teamAOrder : teamBOrder;
              const rosterIdx = teamOrder.indexOf(p.playerId);
              const player = teamPlayers?.[rosterIdx];
              return { ...p, playerName: player?.name || existingPick?.playerName || '' };
            });
            nextLobby.selectedMap = nextGameMap;
          } else {
            nextLobby.picks = nextLobby.picks.map(p => ({ ...p, godId: null }));
            nextLobby.selectedMap = null;
          }
        } else {
          nextLobby.picks = nextLobby.picks.map(p => ({ ...p, godId: null }));
          nextLobby.selectedMap = null;
        }
      }
    } else {
      nextLobby.voteConflict = true;
      nextLobby.voteConflictCount = (nextLobby.voteConflictCount || 0) + 1;
    }
  }

  nextLobby.lastActivityAt = currentTimeMs;

  return nextLobby;
}


