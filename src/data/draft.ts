import { PickEntry } from '../types';

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

// ⚠️ FIXED: Position is now a DRAFT property, not a visual layout property.
// The "Middle" visual requirement should be handled by CSS/Layout logic in PlayerSlot/MapVisualizer.
export const PLAYER_POSITION_MAP = {
  1: 'corner', 4: 'corner', 5: 'middle',
  2: 'corner', 3: 'corner', 6: 'middle'
};

/**
 * FIXED: Returns stritctly chronological pick order for the team.
 * The order in which players choose gods is fixed in the engine.
 */
export const getMCLTeamOrder = (team: 'A' | 'B'): number[] => {
  // Team A picks in slots: 1st, 4th, 5th
  // Team B picks in slots: 2nd, 3rd, 6th
  return team === 'A' ? [1, 4, 5] : [2, 3, 6];
};

export const getDraftTimeline = (gameNumber: number): number[] => {
  // G1 (Host First): [1, 2, 3, 4, 5, 6]
  // G2 (Guest First): [3, 4, 1, 2, 6, 5]
  return gameNumber % 2 !== 0 ? [1, 2, 3, 4, 5, 6] : [3, 4, 1, 2, 6, 5];
};

export const getMCLPicks = (gameNumber: number, mapId: string | null, lastWinner: 'A' | 'B' | null): PickEntry[] => {
  const timeline = getDraftTimeline(gameNumber);
  
  return timeline.map(id => {
    const team = PLAYER_TEAM_MAP[id as keyof typeof PLAYER_TEAM_MAP] as 'A' | 'B';
    return {
      playerId: id,
      godId: null,
      team,
      color: PLAYER_COLORS[id as keyof typeof PLAYER_COLORS],
      position: PLAYER_POSITION_MAP[id as keyof typeof PLAYER_POSITION_MAP] as any,
      playerName: ''
    };
  });
};

