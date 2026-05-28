import { PickEntry, GameResult } from '../../../types';
import { DraftFormat, ResolvedDraftPick } from '../types/draftFormat.types';
import { playerIdToPickIndex } from '../rules/turnOrder';

export function resolveLaneFromX(x: number): 'left' | 'center' | 'right' {
  if (x <= 33) return 'left';
  if (x >= 66) return 'right';
  return 'center';
}

export function laneToOrder(lane: 'left' | 'center' | 'right'): number {
  switch (lane) {
    case 'left': return 1;
    case 'right': return 2;
    case 'center': return 3;
    default: return 1;
  }
}

/**
 * Resolve a single pick to its visual properties.
 */
export function resolveDraftPick({
  pick,
  pickIndex: providedPickIndex,
  format,
  mapId,
  gameNumber,
  useGame2Order
}: {
  pick: PickEntry;
  pickIndex?: number;
  format: DraftFormat;
  mapId: string | null;
  gameNumber: number;
  useGame2Order?: boolean;
}): ResolvedDraftPick {
  const pickIndex = providedPickIndex ?? playerIdToPickIndex(pick.playerId, gameNumber);
  
  const resolvedGameNumber = useGame2Order === undefined
    ? gameNumber
    : (useGame2Order ? 2 : 1);
  const gameLayout = format.games[resolvedGameNumber] || format.games[gameNumber] || format.games['default'];
  const layout = (mapId && gameLayout.mapLayouts && gameLayout.mapLayouts[mapId]) 
    ? gameLayout.mapLayouts[mapId] 
    : gameLayout.defaultLayout;

  const slotId = layout.pickToSlot[pickIndex];
  
  if (!slotId) {
    // Fallback if index out of bounds
    return {
      pickIndex,
      chronologicalPickNumber: pickIndex + 1,
      team: pick.team,
      slotId: 'unknown',
      lane: 'left',
      colorName: 'gray',
      colorHex: '#9ca3af',
      visualOrder: 1,
      mapX: 0,
      mapY: 0,
      godId: pick.godId,
      playerName: pick.playerName || '',
      playerId: pick.playerId,
    };
  }

  const slot = format.visualSlots[slotId];
  const expectedTeam = gameLayout.turnOrder[pickIndex];

  // Validation Guard for Custom Formats
  if (slot.team !== expectedTeam) {
    console.warn(`[DraftResolver] Format validation failed: pickIndex ${pickIndex} expected team ${expectedTeam} but got slot ${slotId} with team ${slot.team}`);
  }

  const position = layout.positions[slotId];
  const mapX = position?.x ?? 0;
  const mapY = position?.y ?? 0;
  const lane = resolveLaneFromX(mapX);

  return {
    pickIndex,
    chronologicalPickNumber: pickIndex + 1,
    team: pick.team,
    slotId,
    lane,
    colorName: slot.colorName,
    colorHex: slot.colorHex,
    visualOrder: pickIndex + 1,
    mapX,
    mapY,
    godId: pick.godId,
    playerName: pick.playerName || '',
    playerId: pick.playerId,
  };
}

/**
 * Resolve all picks for a lobby.
 */
export function resolveAllPicks(
  picks: PickEntry[],
  format: DraftFormat,
  mapId: string | null,
  gameNumber: number,
  useGame2Order?: boolean
): ResolvedDraftPick[] {
  return picks.map(pick => resolveDraftPick({ pick, format, mapId, gameNumber, useGame2Order }));
}

/**
 * Resolve picks from a GameResult (history mode).
 */
export function resolveGameResultPicks(
  game: GameResult,
  format: DraftFormat,
  gameNumber: number
): { teamA: ResolvedDraftPick[]; teamB: ResolvedDraftPick[] } {
  const teamA: ResolvedDraftPick[] = [];
  const teamB: ResolvedDraftPick[] = [];

  // Create fake PickEntries from history if needed
  const picksA = game.rosterA && game.rosterA.length > 0 
    ? game.rosterA 
    : game.picksA?.map((godId, i) => ({ 
        playerId: i === 0 ? 1 : (i === 1 ? 4 : 5), 
        godId, team: 'A' as const, color: '', position: 'corner' as const, playerName: `P${i+1}` 
      })) || [];

  const picksB = game.rosterB && game.rosterB.length > 0 
    ? game.rosterB 
    : game.picksB?.map((godId, i) => ({ 
        playerId: i === 0 ? 2 : (i === 1 ? 3 : 6), 
        godId, team: 'B' as const, color: '', position: 'corner' as const, playerName: `P${i+1}` 
      })) || [];

  for (const pick of picksA) {
    teamA.push(resolveDraftPick({ pick: pick as PickEntry, format, mapId: game.mapId || null, gameNumber }));
  }

  for (const pick of picksB) {
    teamB.push(resolveDraftPick({ pick: pick as PickEntry, format, mapId: game.mapId || null, gameNumber }));
  }

  return { teamA, teamB };
}
