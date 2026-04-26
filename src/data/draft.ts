import { PickEntry } from '../types';

export const PLAYER_COLORS = {
  1: '#ef4444', // Red
  2: '#ec4899', // Pink
  3: '#3b82f6', // Blue
  4: '#f97316', // Orange
  5: '#eab308', // Yellow
  6: '#06b6d4', // Cyan
};

export const PLAYER_TEAM_MAP = {
  1: 'A', 5: 'A', 4: 'A',
  2: 'B', 6: 'B', 3: 'B'
};

export const PLAYER_POSITION_MAP = {
  1: 'corner', 5: 'middle', 4: 'corner',
  2: 'corner', 6: 'middle', 3: 'corner'
};

export const getMCLTeamOrder = (team: 'A' | 'B', mapId: string | null, useGame2Order: boolean): number[] => {
  if (mapId === 'snake_dance') {
    if (team === 'A') return useGame2Order ? [4, 1, 5] : [1, 4, 5];
    return useGame2Order ? [2, 3, 6] : [3, 2, 6];
  } else if (mapId === 'kerlaugar') {
    if (team === 'A') return useGame2Order ? [5, 4, 1] : [4, 5, 1];
    return useGame2Order ? [2, 6, 3] : [6, 2, 3];
  } else {
    if (team === 'A') return useGame2Order ? [4, 1, 5] : [1, 4, 5];
    return useGame2Order ? [3, 2, 6] : [2, 3, 6];
  }
};

export const getMCLPicks = (gameNumber: number, mapId: string | null, lastWinner: 'A' | 'B' | null): PickEntry[] => {
  const useGame2Order = gameNumber === 2 || (gameNumber === 3 && lastWinner === 'A');

  const teamAOrder = getMCLTeamOrder('A', mapId, useGame2Order);
  const teamBOrder = getMCLTeamOrder('B', mapId, useGame2Order);

  let picks: PickEntry[] = [];

  teamAOrder.forEach(id => {
    let position = 'corner';
    if (mapId === 'kerlaugar') {
      if (id === 1) position = 'middle';
    } else {
      if (id === 5) position = 'middle';
    }

    picks.push({ 
      playerId: id, 
      godId: null, 
      team: 'A', 
      color: PLAYER_COLORS[id as keyof typeof PLAYER_COLORS], 
      position: position as any, 
      playerName: '' 
    });
  });

  teamBOrder.forEach(id => {
    let position = 'corner';
    if (mapId === 'kerlaugar') {
      if (id === 3) position = 'middle';
    } else {
      if (id === 6) position = 'middle';
    }

    picks.push({ 
      playerId: id, 
      godId: null, 
      team: 'B', 
      color: PLAYER_COLORS[id as keyof typeof PLAYER_COLORS], 
      position: position as any, 
      playerName: '' 
    });
  });

  return picks;
};

