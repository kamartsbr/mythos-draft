/**
 * Backward-compat: get strictly chronological pick order for the team.
 * Legacy timeline was [1, 2, 3, 4, 5, 6] for G1, and [3, 4, 1, 2, 6, 5] for G2.
 */
export function getDraftTimeline(gameNumber: number): number[] {
  return gameNumber % 2 !== 0 ? [1, 2, 3, 4, 5, 6] : [3, 4, 1, 2, 6, 5];
}

/**
 * Backward-compat: map legacy playerId → pickIndex for a given game.
 */
export function playerIdToPickIndex(playerId: number, gameNumber: number): number {
  const timeline = getDraftTimeline(gameNumber);
  const index = timeline.indexOf(playerId);
  return index !== -1 ? index : 0;
}

/**
 * Backward-compat: Returns chronological pick order for the team.
 */
export function getMCLTeamOrder(team: 'A' | 'B', _mapId?: string | null, useGame2Order?: boolean): number[] {
  const gameNumber = useGame2Order ? 2 : 1;
  const timeline = getDraftTimeline(gameNumber);
  // Team mapping: A = 1,4,5. B = 2,3,6.
  const isTeamA = (id: number) => id === 1 || id === 4 || id === 5;
  return timeline.filter(id => (team === 'A' ? isTeamA(id) : !isTeamA(id)));
}
