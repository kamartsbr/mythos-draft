export type TeamSide = 'A' | 'B';

export type VisualSlot = {
  id: string;
  team: TeamSide;
  colorName: string;
  colorHex: string;
};

export type DraftVisualLayout = {
  /** Maps pickIndex → visualSlot id. Length = total picks per game. */
  pickToSlot: string[];
  /** Maps visualSlot id → map coordinates (percentage). */
  positions: Record<string, { x: number; y: number }>;
};

export type DraftGameLayout = {
  turnOrder: TeamSide[];
  defaultLayout: DraftVisualLayout;
  mapLayouts?: Record<string, DraftVisualLayout>;
};

export type DraftFormat = {
  id: string;
  name: string;
  visualSlots: Record<string, VisualSlot>;
  /** Specific layouts per game number. Use 'default' as fallback. */
  games: Record<number | 'default', DraftGameLayout>;
};

export type ResolvedDraftPick = {
  pickIndex: number;
  chronologicalPickNumber: number;
  team: TeamSide;
  slotId: string;
  colorName: string;
  colorHex: string;
  lane: 'left' | 'center' | 'right';
  visualOrder: number;
  mapX: number;
  mapY: number;
  playerName: string;
  godId: string | null;
  playerId: number; // legacy backward compat
};
