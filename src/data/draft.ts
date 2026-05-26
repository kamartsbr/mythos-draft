import { PickEntry } from '../types';
import { getDraftTimeline as domainGetDraftTimeline, getMCLTeamOrder as domainGetMCLTeamOrder } from '../domain/draft/rules/turnOrder';

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

