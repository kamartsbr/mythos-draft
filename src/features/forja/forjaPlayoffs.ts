import type { ForjaPlayoffMatchId, ForjaPlayoffRound, SeriesType } from '../../types';
import type { ForjaLiveMatchSummary, ForjaTeam } from './types';

export type ForjaGroupId = 'A' | 'B' | 'C' | 'D';
export type ForjaSeedKey = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'D1' | 'D2';

type ForjaBracketSide = 'left' | 'right' | 'center';

type ForjaBracketSource = {
  matchId: ForjaPlayoffMatchId;
  result: 'winner' | 'loser';
};

type ForjaBracketDefinition = {
  id: ForjaPlayoffMatchId;
  round: ForjaPlayoffRound;
  label: string;
  title: string;
  order: number;
  side: ForjaBracketSide;
  seriesType: Extract<SeriesType, 'BO3' | 'BO5'>;
  teamASeed?: ForjaSeedKey;
  teamBSeed?: ForjaSeedKey;
  sourceA?: ForjaBracketSource;
  sourceB?: ForjaBracketSource;
};

export interface ForjaStandingRow extends ForjaTeam {
  gamesWon: number;
  gamesLost: number;
  matchesPlayed: number;
  matchWins: number;
  matchLosses: number;
  points: number;
  differential: number;
}

export interface ForjaGroupCompletion {
  groupId: ForjaGroupId;
  teamsCount: number;
  requiredMatches: number;
  completedMatches: number;
  isComplete: boolean;
  missingPairs: string[];
}

export type ForjaBracketSlot =
  | { kind: 'team'; team: ForjaTeam; seedLabel?: string }
  | { kind: 'pending'; label: string };

export interface ForjaBracketMatch {
  id: ForjaPlayoffMatchId;
  round: ForjaPlayoffRound;
  label: string;
  title: string;
  order: number;
  side: ForjaBracketSide;
  seriesType: Extract<SeriesType, 'BO3' | 'BO5'>;
  teamA: ForjaBracketSlot;
  teamB: ForjaBracketSlot;
  sourceA?: ForjaBracketSource;
  sourceB?: ForjaBracketSource;
  lobby: ForjaLiveMatchSummary | null;
  canCreate: boolean;
}

export interface ForjaPlayoffBracketState {
  standingsByGroup: Record<ForjaGroupId, ForjaStandingRow[]>;
  groupCompletion: Record<ForjaGroupId, ForjaGroupCompletion>;
  allGroupsComplete: boolean;
  qualifiedSeeds: Record<ForjaSeedKey, ForjaStandingRow> | null;
  matches: ForjaBracketMatch[];
  hasBracketLobbies: boolean;
  hasQuarterfinals: boolean;
  canGenerateQuarterfinals: boolean;
}

export const FORJA_GROUP_IDS: readonly ForjaGroupId[] = ['A', 'B', 'C', 'D'];

export const FORJA_BRACKET_ROUNDS: readonly ForjaPlayoffRound[] = [
  'QUARTERFINALS',
  'SEMIFINALS',
  'FINAL',
  'THIRD_PLACE',
];

export const FORJA_PLAYOFF_DEFINITIONS: readonly ForjaBracketDefinition[] = [
  {
    id: 'QF1',
    round: 'QUARTERFINALS',
    label: 'QF1',
    title: '1o Grupo A vs 2o Grupo D',
    order: 1,
    side: 'left',
    seriesType: 'BO3',
    teamASeed: 'A1',
    teamBSeed: 'D2',
  },
  {
    id: 'QF2',
    round: 'QUARTERFINALS',
    label: 'QF2',
    title: '1o Grupo C vs 2o Grupo B',
    order: 2,
    side: 'left',
    seriesType: 'BO3',
    teamASeed: 'C1',
    teamBSeed: 'B2',
  },
  {
    id: 'QF3',
    round: 'QUARTERFINALS',
    label: 'QF3',
    title: '1o Grupo B vs 2o Grupo C',
    order: 3,
    side: 'right',
    seriesType: 'BO3',
    teamASeed: 'B1',
    teamBSeed: 'C2',
  },
  {
    id: 'QF4',
    round: 'QUARTERFINALS',
    label: 'QF4',
    title: '1o Grupo D vs 2o Grupo A',
    order: 4,
    side: 'right',
    seriesType: 'BO3',
    teamASeed: 'D1',
    teamBSeed: 'A2',
  },
  {
    id: 'SF1',
    round: 'SEMIFINALS',
    label: 'SF1',
    title: 'Vencedor QF1 vs Vencedor QF2',
    order: 5,
    side: 'left',
    seriesType: 'BO5',
    sourceA: { matchId: 'QF1', result: 'winner' },
    sourceB: { matchId: 'QF2', result: 'winner' },
  },
  {
    id: 'SF2',
    round: 'SEMIFINALS',
    label: 'SF2',
    title: 'Vencedor QF3 vs Vencedor QF4',
    order: 6,
    side: 'right',
    seriesType: 'BO5',
    sourceA: { matchId: 'QF3', result: 'winner' },
    sourceB: { matchId: 'QF4', result: 'winner' },
  },
  {
    id: 'FINAL',
    round: 'FINAL',
    label: 'Final',
    title: 'Vencedor SF1 vs Vencedor SF2',
    order: 7,
    side: 'center',
    seriesType: 'BO5',
    sourceA: { matchId: 'SF1', result: 'winner' },
    sourceB: { matchId: 'SF2', result: 'winner' },
  },
  {
    id: 'THIRD',
    round: 'THIRD_PLACE',
    label: '3o Lugar',
    title: 'Perdedor SF1 vs Perdedor SF2',
    order: 8,
    side: 'center',
    seriesType: 'BO5',
    sourceA: { matchId: 'SF1', result: 'loser' },
    sourceB: { matchId: 'SF2', result: 'loser' },
  },
];

const ROUND_LABELS: Record<ForjaPlayoffRound, string> = {
  QUARTERFINALS: 'Quartas',
  SEMIFINALS: 'Semifinais',
  FINAL: 'Final',
  THIRD_PLACE: '3o Lugar',
};

function normalizeGroupId(groupId?: string | null): ForjaGroupId | null {
  if (!groupId) return null;
  const upper = groupId.trim().toUpperCase();
  if (FORJA_GROUP_IDS.includes(upper as ForjaGroupId)) return upper as ForjaGroupId;
  const trailing = upper.match(/[A-D]$/)?.[0];
  return trailing && FORJA_GROUP_IDS.includes(trailing as ForjaGroupId) ? trailing as ForjaGroupId : null;
}

function isCompletedMatch(match: ForjaLiveMatchSummary): boolean {
  return match.status === 'completed' || match.status === 'finished';
}

function hasScore(match: ForjaLiveMatchSummary): boolean {
  return Number.isFinite(match.scoreA) && Number.isFinite(match.scoreB);
}

function getPairKey(teamAId?: string, teamBId?: string): string | null {
  if (!teamAId || !teamBId || teamAId === teamBId) return null;
  return [teamAId, teamBId].sort().join('__');
}

function isGroupMatch(match: ForjaLiveMatchSummary, groupId: ForjaGroupId): boolean {
  return match.stage === 'GROUP'
    && normalizeGroupId(match.config?.forjaGroupId) === groupId
    && !!match.config?.forjaTeamA
    && !!match.config?.forjaTeamB;
}

function getExpectedPairLabels(teams: ForjaTeam[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (let left = 0; left < teams.length; left += 1) {
    for (let right = left + 1; right < teams.length; right += 1) {
      const pairKey = getPairKey(teams[left].id, teams[right].id);
      if (pairKey) labels.set(pairKey, `${teams[left].team_name} x ${teams[right].team_name}`);
    }
  }
  return labels;
}

export function getForjaPlayoffRoundLabel(round: ForjaPlayoffRound): string {
  return ROUND_LABELS[round];
}

export function findForjaPlayoffMatch(
  matches: ForjaLiveMatchSummary[],
  matchId: ForjaPlayoffMatchId
): ForjaLiveMatchSummary | null {
  return matches.find((match) => match.config?.forjaPlayoffMatchId === matchId) ?? null;
}

export function getForjaMatchWinnerTeamId(match: ForjaLiveMatchSummary | null | undefined): string | null {
  if (!match || !isCompletedMatch(match) || !hasScore(match)) return null;
  if (match.scoreA === match.scoreB) return null;
  return match.scoreA > match.scoreB
    ? match.config?.forjaTeamA ?? null
    : match.config?.forjaTeamB ?? null;
}

export function getForjaMatchLoserTeamId(match: ForjaLiveMatchSummary | null | undefined): string | null {
  if (!match || !isCompletedMatch(match) || !hasScore(match)) return null;
  if (match.scoreA === match.scoreB) return null;
  return match.scoreA > match.scoreB
    ? match.config?.forjaTeamB ?? null
    : match.config?.forjaTeamA ?? null;
}

export function calculateForjaGroupStandings(
  teams: ForjaTeam[],
  matches: ForjaLiveMatchSummary[],
  groupId: ForjaGroupId
): ForjaStandingRow[] {
  const groupTeams = teams.filter((team) => normalizeGroupId(team.groupId) === groupId);
  const groupMatches = matches.filter((match) => isGroupMatch(match, groupId) && isCompletedMatch(match) && hasScore(match));

  return groupTeams.map((team) => {
    let gamesWon = 0;
    let gamesLost = 0;
    let matchesPlayed = 0;
    let matchWins = 0;
    let matchLosses = 0;

    groupMatches.forEach((match) => {
      const teamAId = match.config?.forjaTeamA;
      const teamBId = match.config?.forjaTeamB;
      if (teamAId !== team.id && teamBId !== team.id) return;

      const ownScore = teamAId === team.id ? match.scoreA : match.scoreB;
      const otherScore = teamAId === team.id ? match.scoreB : match.scoreA;
      gamesWon += ownScore;
      gamesLost += otherScore;
      matchesPlayed += 1;
      if (ownScore > otherScore) matchWins += 1;
      if (ownScore < otherScore) matchLosses += 1;
    });

    return {
      ...team,
      gamesWon,
      gamesLost,
      matchesPlayed,
      matchWins,
      matchLosses,
      points: gamesWon,
      differential: gamesWon - gamesLost,
    };
  }).sort((left, right) => (
    right.points - left.points
    || right.differential - left.differential
    || right.matchWins - left.matchWins
    || right.gamesWon - left.gamesWon
    || left.team_name.localeCompare(right.team_name)
  ));
}

export function getForjaGroupCompletion(
  teams: ForjaTeam[],
  matches: ForjaLiveMatchSummary[],
  groupId: ForjaGroupId
): ForjaGroupCompletion {
  const groupTeams = teams.filter((team) => normalizeGroupId(team.groupId) === groupId);
  const expectedPairs = getExpectedPairLabels(groupTeams);
  const completedPairs = new Set<string>();

  matches
    .filter((match) => isGroupMatch(match, groupId) && isCompletedMatch(match) && hasScore(match))
    .forEach((match) => {
      const pairKey = getPairKey(match.config?.forjaTeamA, match.config?.forjaTeamB);
      if (pairKey && expectedPairs.has(pairKey)) completedPairs.add(pairKey);
    });

  const missingPairs = Array.from(expectedPairs.entries())
    .filter(([pairKey]) => !completedPairs.has(pairKey))
    .map(([, label]) => label);

  return {
    groupId,
    teamsCount: groupTeams.length,
    requiredMatches: expectedPairs.size,
    completedMatches: completedPairs.size,
    isComplete: groupTeams.length === 4 && expectedPairs.size === 6 && missingPairs.length === 0,
    missingPairs,
  };
}

export function getForjaQualifiedSeeds(
  standingsByGroup: Record<ForjaGroupId, ForjaStandingRow[]>,
  groupCompletion: Record<ForjaGroupId, ForjaGroupCompletion>
): Record<ForjaSeedKey, ForjaStandingRow> | null {
  if (!FORJA_GROUP_IDS.every((groupId) => groupCompletion[groupId].isComplete && standingsByGroup[groupId].length >= 2)) {
    return null;
  }

  return {
    A1: standingsByGroup.A[0],
    A2: standingsByGroup.A[1],
    B1: standingsByGroup.B[0],
    B2: standingsByGroup.B[1],
    C1: standingsByGroup.C[0],
    C2: standingsByGroup.C[1],
    D1: standingsByGroup.D[0],
    D2: standingsByGroup.D[1],
  };
}

function getTeamById(teams: ForjaTeam[], teamId: string | null): ForjaTeam | null {
  if (!teamId) return null;
  return teams.find((team) => team.id === teamId) ?? null;
}

function resolveSeedSlot(
  seeds: Record<ForjaSeedKey, ForjaStandingRow> | null,
  seedKey: ForjaSeedKey | undefined
): ForjaBracketSlot {
  if (!seedKey || !seeds) return { kind: 'pending', label: seedKey ? `Classificado ${seedKey}` : 'A definir' };
  return { kind: 'team', team: seeds[seedKey], seedLabel: seedKey };
}

function resolveSourceSlot(
  source: ForjaBracketSource | undefined,
  teams: ForjaTeam[],
  matches: ForjaLiveMatchSummary[]
): ForjaBracketSlot {
  if (!source) return { kind: 'pending', label: 'A definir' };
  const sourceMatch = findForjaPlayoffMatch(matches, source.matchId);
  const teamId = source.result === 'winner'
    ? getForjaMatchWinnerTeamId(sourceMatch)
    : getForjaMatchLoserTeamId(sourceMatch);
  const team = getTeamById(teams, teamId);
  if (team) return { kind: 'team', team };

  const sourceLabel = source.result === 'winner' ? 'Vencedor' : 'Perdedor';
  return { kind: 'pending', label: `${sourceLabel} ${source.matchId}` };
}

function resolveBracketSlot(
  definition: ForjaBracketDefinition,
  slot: 'A' | 'B',
  seeds: Record<ForjaSeedKey, ForjaStandingRow> | null,
  teams: ForjaTeam[],
  matches: ForjaLiveMatchSummary[]
): ForjaBracketSlot {
  if (slot === 'A') {
    return definition.teamASeed
      ? resolveSeedSlot(seeds, definition.teamASeed)
      : resolveSourceSlot(definition.sourceA, teams, matches);
  }
  return definition.teamBSeed
    ? resolveSeedSlot(seeds, definition.teamBSeed)
    : resolveSourceSlot(definition.sourceB, teams, matches);
}

export function isForjaBracketSlotReady(slot: ForjaBracketSlot): slot is Extract<ForjaBracketSlot, { kind: 'team' }> {
  return slot.kind === 'team';
}

export function buildForjaPlayoffBracket(
  teams: ForjaTeam[],
  matches: ForjaLiveMatchSummary[]
): ForjaPlayoffBracketState {
  const standingsByGroup = FORJA_GROUP_IDS.reduce((acc, groupId) => {
    acc[groupId] = calculateForjaGroupStandings(teams, matches, groupId);
    return acc;
  }, {} as Record<ForjaGroupId, ForjaStandingRow[]>);

  const groupCompletion = FORJA_GROUP_IDS.reduce((acc, groupId) => {
    acc[groupId] = getForjaGroupCompletion(teams, matches, groupId);
    return acc;
  }, {} as Record<ForjaGroupId, ForjaGroupCompletion>);

  const allGroupsComplete = FORJA_GROUP_IDS.every((groupId) => groupCompletion[groupId].isComplete);
  const qualifiedSeeds = getForjaQualifiedSeeds(standingsByGroup, groupCompletion);

  const bracketMatches = FORJA_PLAYOFF_DEFINITIONS.map((definition) => {
    const teamA = resolveBracketSlot(definition, 'A', qualifiedSeeds, teams, matches);
    const teamB = resolveBracketSlot(definition, 'B', qualifiedSeeds, teams, matches);
    const lobby = findForjaPlayoffMatch(matches, definition.id);
    return {
      id: definition.id,
      round: definition.round,
      label: definition.label,
      title: definition.title,
      order: definition.order,
      side: definition.side,
      seriesType: definition.seriesType,
      teamA,
      teamB,
      sourceA: definition.sourceA,
      sourceB: definition.sourceB,
      lobby,
      canCreate: isForjaBracketSlotReady(teamA) && isForjaBracketSlotReady(teamB) && !lobby,
    };
  });

  const hasBracketLobbies = bracketMatches.some((match) => !!match.lobby);
  const hasQuarterfinals = bracketMatches
    .filter((match) => match.round === 'QUARTERFINALS')
    .every((match) => !!match.lobby);

  return {
    standingsByGroup,
    groupCompletion,
    allGroupsComplete,
    qualifiedSeeds,
    matches: bracketMatches,
    hasBracketLobbies,
    hasQuarterfinals,
    canGenerateQuarterfinals: allGroupsComplete && !hasQuarterfinals,
  };
}
