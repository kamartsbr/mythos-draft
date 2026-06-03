import { describe, expect, it } from 'vitest';
import type { ForjaPlayoffMatchId } from '../../../types';
import type { ForjaLiveMatchSummary, ForjaTeam } from '../types';
import {
  buildForjaPlayoffBracket,
  calculateForjaGroupStandings,
  getForjaGroupCompletion,
  getForjaMatchLoserTeamId,
  getForjaMatchWinnerTeamId,
  type ForjaGroupId,
} from '../forjaPlayoffs';

const GROUPS: ForjaGroupId[] = ['A', 'B', 'C', 'D'];

function team(groupId: ForjaGroupId, index: number): ForjaTeam {
  return {
    id: `${groupId}${index}`,
    team_name: `Team ${groupId}${index}`,
    captain_id: `captain-${groupId}${index}`,
    members: [`captain-${groupId}${index}`, `p-${groupId}${index}-2`, `p-${groupId}${index}-3`],
    pick_order: index,
    groupId,
  };
}

function groupTeams(): ForjaTeam[] {
  return GROUPS.flatMap((groupId) => [1, 2, 3, 4].map((index) => team(groupId, index)));
}

function groupMatch(
  id: string,
  groupId: ForjaGroupId,
  teamA: string,
  teamB: string,
  scoreA: number,
  scoreB: number,
  status: string = 'completed'
): ForjaLiveMatchSummary {
  return {
    id,
    name: id,
    status,
    scoreA,
    scoreB,
    stage: 'GROUP',
    config: {
      forjaTeamA: teamA,
      forjaTeamB: teamB,
      forjaGroupId: groupId,
      tournamentStage: 'GROUP',
    },
  };
}

function playoffMatch(
  id: ForjaPlayoffMatchId,
  teamA: string,
  teamB: string,
  scoreA: number,
  scoreB: number,
  status: string = 'completed'
): ForjaLiveMatchSummary {
  const round = id.startsWith('QF')
    ? 'QUARTERFINALS'
    : id.startsWith('SF')
      ? 'SEMIFINALS'
      : id === 'THIRD'
        ? 'THIRD_PLACE'
        : 'FINAL';
  return {
    id,
    name: id,
    status,
    scoreA,
    scoreB,
    stage: id === 'FINAL' ? 'PLAYOFFS_BO5' : 'PLAYOFFS_BO3',
    config: {
      forjaTeamA: teamA,
      forjaTeamB: teamB,
      tournamentStage: id === 'FINAL' ? 'PLAYOFFS_BO5' : 'PLAYOFFS_BO3',
      forjaPlayoffMatchId: id,
      forjaPlayoffRound: round,
    },
  };
}

function completeGroupMatches(groupId: ForjaGroupId): ForjaLiveMatchSummary[] {
  const ids = [1, 2, 3, 4].map((index) => `${groupId}${index}`);
  return [
    groupMatch(`${groupId}-1`, groupId, ids[0], ids[1], 2, 1),
    groupMatch(`${groupId}-2`, groupId, ids[0], ids[2], 2, 0),
    groupMatch(`${groupId}-3`, groupId, ids[0], ids[3], 2, 1),
    groupMatch(`${groupId}-4`, groupId, ids[1], ids[2], 2, 0),
    groupMatch(`${groupId}-5`, groupId, ids[1], ids[3], 2, 1),
    groupMatch(`${groupId}-6`, groupId, ids[2], ids[3], 2, 0),
  ];
}

describe('FORJA playoffs', () => {
  it('blocks bracket generation while any group pair is missing', () => {
    const teams = groupTeams();
    const matches = completeGroupMatches('A').slice(0, 5);
    const completion = getForjaGroupCompletion(teams, matches, 'A');
    const bracket = buildForjaPlayoffBracket(teams, matches);

    expect(completion.isComplete).toBe(false);
    expect(completion.completedMatches).toBe(5);
    expect(completion.missingPairs).toEqual(['Team A3 x Team A4']);
    expect(bracket.canGenerateQuarterfinals).toBe(false);
  });

  it('uses real standings to seed the required quarterfinal bracket order', () => {
    const teams = groupTeams();
    const matches = GROUPS.flatMap(completeGroupMatches);
    const bracket = buildForjaPlayoffBracket(teams, matches);

    expect(bracket.allGroupsComplete).toBe(true);
    expect(bracket.canGenerateQuarterfinals).toBe(true);
    expect(bracket.matches.filter((match) => match.round === 'QUARTERFINALS').map((match) => ({
      id: match.id,
      teamA: match.teamA.kind === 'team' ? match.teamA.team.id : null,
      teamB: match.teamB.kind === 'team' ? match.teamB.team.id : null,
    }))).toEqual([
      { id: 'QF1', teamA: 'A1', teamB: 'D2' },
      { id: 'QF2', teamA: 'C1', teamB: 'B2' },
      { id: 'QF3', teamA: 'B1', teamB: 'C2' },
      { id: 'QF4', teamA: 'D1', teamB: 'A2' },
    ]);
  });

  it('does not offer duplicate quarterfinal generation when bracket lobbies exist', () => {
    const teams = groupTeams();
    const matches = [
      ...GROUPS.flatMap(completeGroupMatches),
      playoffMatch('QF1', 'A1', 'D2', 0, 0, 'waiting'),
      playoffMatch('QF2', 'C1', 'B2', 0, 0, 'waiting'),
      playoffMatch('QF3', 'B1', 'C2', 0, 0, 'waiting'),
      playoffMatch('QF4', 'D1', 'A2', 0, 0, 'waiting'),
    ];
    const bracket = buildForjaPlayoffBracket(teams, matches);

    expect(bracket.hasQuarterfinals).toBe(true);
    expect(bracket.canGenerateQuarterfinals).toBe(false);
  });

  it('derives semifinal and third-place entrants from completed playoff results', () => {
    const teams = groupTeams();
    const matches = [
      ...GROUPS.flatMap(completeGroupMatches),
      playoffMatch('QF1', 'A1', 'D2', 2, 0),
      playoffMatch('QF2', 'C1', 'B2', 1, 2),
      playoffMatch('QF3', 'B1', 'C2', 2, 1),
      playoffMatch('QF4', 'D1', 'A2', 2, 0),
      playoffMatch('SF1', 'A1', 'B2', 2, 1),
      playoffMatch('SF2', 'B1', 'D1', 1, 2),
    ];
    const bracket = buildForjaPlayoffBracket(teams, matches);
    const sf1 = bracket.matches.find((match) => match.id === 'SF1');
    const final = bracket.matches.find((match) => match.id === 'FINAL');
    const third = bracket.matches.find((match) => match.id === 'THIRD');

    expect(sf1?.teamA.kind === 'team' ? sf1.teamA.team.id : null).toBe('A1');
    expect(sf1?.teamB.kind === 'team' ? sf1.teamB.team.id : null).toBe('B2');
    expect(final?.teamA.kind === 'team' ? final.teamA.team.id : null).toBe('A1');
    expect(final?.teamB.kind === 'team' ? final.teamB.team.id : null).toBe('D1');
    expect(third?.teamA.kind === 'team' ? third.teamA.team.id : null).toBe('B2');
    expect(third?.teamB.kind === 'team' ? third.teamB.team.id : null).toBe('B1');
  });

  it('keeps winner and loser resolution unavailable for tied playoff scores', () => {
    const tied = playoffMatch('QF1', 'A1', 'D2', 1, 1);

    expect(getForjaMatchWinnerTeamId(tied)).toBeNull();
    expect(getForjaMatchLoserTeamId(tied)).toBeNull();
  });

  it('sorts group standings by points, differential, match wins, then name', () => {
    const teams = [team('A', 1), team('A', 2), team('A', 3), team('A', 4)];
    const standings = calculateForjaGroupStandings(teams, [
      groupMatch('A-1', 'A', 'A1', 'A2', 2, 0),
      groupMatch('A-2', 'A', 'A1', 'A3', 1, 2),
      groupMatch('A-3', 'A', 'A1', 'A4', 2, 0),
      groupMatch('A-4', 'A', 'A2', 'A3', 2, 1),
      groupMatch('A-5', 'A', 'A2', 'A4', 2, 0),
      groupMatch('A-6', 'A', 'A3', 'A4', 2, 0),
    ], 'A');

    expect(standings.map((standing) => standing.id)).toEqual(['A1', 'A3', 'A2', 'A4']);
  });
});
