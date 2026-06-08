import { DraftTurn, PickEntry, TeamPlayer } from '../types';
import {
  getDraftTimeline as domainGetDraftTimeline,
  getMCLTeamOrder as domainGetMCLTeamOrder,
  shouldUseGame2MclOrder as domainShouldUseGame2MclOrder,
} from '../domain/draft/rules/turnOrder';

export const PLAYER_COLORS = {
  1: '#ef4444', // Team A - P1 (Red)
  2: '#ec4899', // Team B - P1 (Pink)
  3: '#3b82f6', // Team B - P2 (Blue)
  4: '#f97316', // Team A - P2 (Orange)
  5: '#eab308', // Team A - P3 (Yellow)
  6: '#06b6d4', // Team B - P3 (Cyan)
};

export const PLAYER_TEAM_MAP = {
  1: 'A', 4: 'A', 5: 'A',
  2: 'B', 3: 'B', 6: 'B'
};

export const PLAYER_POSITION_MAP = {
  1: 'corner', 4: 'corner', 5: 'middle',
  2: 'corner', 3: 'corner', 6: 'middle'
};

export const getDraftTimeline = domainGetDraftTimeline;
export const getMCLTeamOrder = domainGetMCLTeamOrder;
export const shouldUseGame2MclOrder = domainShouldUseGame2MclOrder;

const GENERIC_ROSTER_NAME_PATTERNS = [
  /^host$/i,
  /^guest$/i,
  /^team\s*a$/i,
  /^team\s*b$/i,
  /^time\s*a$/i,
  /^time\s*b$/i,
  /^bot\s*a$/i,
  /^bot\s*b$/i,
  /^player\s*\d+$/i,
  /^p\d+$/i,
  /^captain\s*\d+$/i,
  /^selecting\.{3}$/i,
];

const normalizeRosterName = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const isRealRosterName = (value: unknown): boolean => {
  const normalized = normalizeRosterName(value);
  if (!normalized) return false;
  return !GENERIC_ROSTER_NAME_PATTERNS.some((pattern) => pattern.test(normalized));
};

/**
 * Detects whether a preset string corresponds to an MCL-style preset.
 *
 * @param preset - Preset identifier (may be null or undefined)
 * @returns `true` if `preset` equals `MCL`, `FORJA`, `MCL_PLAYOFFS`, or `MCL_TIEBREAKER` (case-insensitive); `false` otherwise.
 */
export function isMclStylePreset(preset?: string | null): boolean {
  const normalized = String(preset ?? '').toUpperCase();
  return normalized === 'MCL' || normalized === 'FORJA' || normalized === 'MCL_PLAYOFFS' || normalized === 'MCL_TIEBREAKER';
}

const resolveHydratedPlayerName = (
  candidateName: unknown,
  existingName: unknown,
  rosterAvailable: boolean
): string => {
  const existing = normalizeRosterName(existingName);

  if (!rosterAvailable) {
    return existing;
  }

  if (isRealRosterName(candidateName)) {
    return normalizeRosterName(candidateName);
  }

  return isRealRosterName(existing) ? existing : '';
};

/**
 * Hydrates MCL draft picks for a given game with roster-derived player names, preserving valid existing names when appropriate.
 *
 * @param gameNumber - Game number used to determine pick and team ordering
 * @param teamAPlayers - Optional roster for Team A used to source player names (ordered by team slot)
 * @param teamBPlayers - Optional roster for Team B used to source player names (ordered by team slot)
 * @param options.turnOrder - Optional draft turn order that influences whether the "Game 2" MCL order is used
 * @param options.existingPicks - Optional array of prior picks whose `playerName` values may be preserved if they are considered real
 * @returns An array of `PickEntry` objects where each entry's `playerName` is set from the corresponding roster name when available and considered real; otherwise an existing real name is preserved, or the name is set to an empty string
 */
export function hydrateMclPicksWithRosterNames(
  gameNumber: number,
  teamAPlayers?: TeamPlayer[] | null,
  teamBPlayers?: TeamPlayer[] | null,
  options?: {
    turnOrder?: DraftTurn[] | null;
    existingPicks?: PickEntry[] | null;
  }
): PickEntry[] {
  const freshPicks = getMCLPicks(gameNumber);
  const useGame2Order = options?.turnOrder ? shouldUseGame2MclOrder(options.turnOrder) : gameNumber % 2 === 0;
  const teamAOrder = getMCLTeamOrder('A', null, useGame2Order);
  const teamBOrder = getMCLTeamOrder('B', null, useGame2Order);
  const existingPicks = options?.existingPicks ?? [];

  return freshPicks.map((pick) => {
    const teamPlayers = pick.team === 'A' ? teamAPlayers : teamBPlayers;
    const teamOrder = pick.team === 'A' ? teamAOrder : teamBOrder;
    const rosterIndex = teamOrder.indexOf(pick.playerId);
    const existingPick = existingPicks.find((existing) => existing.playerId === pick.playerId && existing.team === pick.team);
    const candidateName = rosterIndex !== -1 ? teamPlayers?.[rosterIndex]?.name : undefined;

    return {
      ...pick,
      playerName: resolveHydratedPlayerName(candidateName, existingPick?.playerName, Array.isArray(teamPlayers) && teamPlayers.length > 0),
    };
  });
}

export const getMCLPicks = (gameNumber: number): PickEntry[] => {
  const timeline = getDraftTimeline(gameNumber);

  return timeline.map(id => {
    const team = PLAYER_TEAM_MAP[id as keyof typeof PLAYER_TEAM_MAP] as 'A' | 'B';
    return {
      playerId: id,
      godId: null,
      team,
      color: PLAYER_COLORS[id as keyof typeof PLAYER_COLORS],
      position: PLAYER_POSITION_MAP[id as keyof typeof PLAYER_POSITION_MAP] as 'corner' | 'middle',
      playerName: ''
    };
  });
};

