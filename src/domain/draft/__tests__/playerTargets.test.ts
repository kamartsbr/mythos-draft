import { describe, expect, it } from 'vitest';
import { resolveDraftPlayerTargets } from '../playerTargets';
import type { PickEntry, TeamPlayer } from '../../../types';

describe('resolveDraftPlayerTargets', () => {
  it('keeps join order independent from chronological seat assignment', () => {
    const teamPlayers: TeamPlayer[] = [
      { name: 'Third Input', position: 0 },
      { name: 'First Input', position: 1 },
      { name: 'Second Input', position: 2 },
    ];

    const teamPicks: PickEntry[] = [
      { playerId: 1, team: 'A', position: 'corner', color: '#ef4444', godId: null },
      { playerId: 4, team: 'A', position: 'corner', color: '#f97316', godId: null },
      { playerId: 5, team: 'A', position: 'middle', color: '#eab308', godId: null },
    ];

    const targets = resolveDraftPlayerTargets(teamPlayers, teamPicks);

    expect(targets).toEqual([
      { name: 'Third Input', isAssigned: false, targetPlayerId: 1 },
      { name: 'First Input', isAssigned: false, targetPlayerId: 1 },
      { name: 'Second Input', isAssigned: false, targetPlayerId: 1 },
    ]);
  });

  it('moves the next selected player into the next chronological slot', () => {
    const teamPlayers: TeamPlayer[] = [
      { name: 'Player 3', position: 0 },
      { name: 'Player 1', position: 1 },
      { name: 'Player 2', position: 2 },
    ];

    const teamPicks: PickEntry[] = [
      { playerId: 1, team: 'A', position: 'corner', color: '#ef4444', godId: 'zeus', playerName: 'Player 3' },
      { playerId: 4, team: 'A', position: 'corner', color: '#f97316', godId: null },
      { playerId: 5, team: 'A', position: 'middle', color: '#eab308', godId: null },
    ];

    const targets = resolveDraftPlayerTargets(teamPlayers, teamPicks);

    expect(targets).toEqual([
      { name: 'Player 3', isAssigned: true, targetPlayerId: 4 },
      { name: 'Player 1', isAssigned: false, targetPlayerId: 4 },
      { name: 'Player 2', isAssigned: false, targetPlayerId: 4 },
    ]);
  });
});
