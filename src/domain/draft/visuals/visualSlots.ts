import { VisualSlot } from '../types/draftFormat.types';

export const MCL_VISUAL_SLOTS: Record<string, VisualSlot> = {
  red:    { id: 'red',    team: 'A', colorName: 'red',    colorHex: '#ef4444' },
  orange: { id: 'orange', team: 'A', colorName: 'orange', colorHex: '#f97316' },
  yellow: { id: 'yellow', team: 'A', colorName: 'yellow', colorHex: '#eab308' },
  pink:   { id: 'pink',   team: 'B', colorName: 'pink',   colorHex: '#ec4899' },
  blue:   { id: 'blue',   team: 'B', colorName: 'blue',   colorHex: '#3b82f6' },
  cyan:   { id: 'cyan',   team: 'B', colorName: 'cyan',   colorHex: '#06b6d4' },
};
