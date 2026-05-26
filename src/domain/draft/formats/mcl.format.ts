import { DraftFormat } from '../types/draftFormat.types';
import { MCL_VISUAL_SLOTS } from '../visuals/visualSlots';

export const MCL_FORMAT: DraftFormat = {
  id: 'MCL',
  name: 'MCL 3v3',
  visualSlots: MCL_VISUAL_SLOTS,
  games: {
    1: {
      turnOrder: ['A', 'B', 'B', 'A', 'A', 'B'],
      defaultLayout: {
        pickToSlot: ['red', 'pink', 'blue', 'orange', 'yellow', 'cyan'],
        positions: {
          orange: { x: 20, y: 20 },
          yellow: { x: 50, y: 20 },
          red:    { x: 80, y: 20 },
          blue:   { x: 20, y: 80 },
          cyan:   { x: 50, y: 80 },
          pink:   { x: 80, y: 80 },
        },
      },
      mapLayouts: {
        kerlaugar: {
          pickToSlot: ['yellow', 'pink', 'cyan', 'orange', 'red', 'blue'],
          positions: {
            yellow: { x: 20, y: 20 },
            red:    { x: 50, y: 20 },
            orange: { x: 80, y: 20 },
            pink:   { x: 20, y: 80 },
            blue:   { x: 50, y: 80 },
            cyan:   { x: 80, y: 80 },
          },
        },
        snake_dance: {
          pickToSlot: ['red', 'blue', 'pink', 'orange', 'yellow', 'cyan'],
          positions: {
            red:    { x: 20, y: 20 },
            yellow: { x: 50, y: 20 },
            orange: { x: 80, y: 20 },
            blue:   { x: 20, y: 80 },
            cyan:   { x: 50, y: 80 },
            pink:   { x: 80, y: 80 },
          },
        },
      },
    },
    2: {
      turnOrder: ['B', 'A', 'A', 'B', 'B', 'A'],
      defaultLayout: {
        pickToSlot: ['blue', 'orange', 'red', 'pink', 'cyan', 'yellow'],
        positions: {
          orange: { x: 20, y: 20 },
          yellow: { x: 50, y: 20 },
          red:    { x: 80, y: 20 },
          blue:   { x: 20, y: 80 },
          cyan:   { x: 50, y: 80 },
          pink:   { x: 80, y: 80 },
        },
      },
      mapLayouts: {
        kerlaugar: {
          pickToSlot: ['cyan', 'orange', 'yellow', 'pink', 'blue', 'red'],
          positions: {
            yellow: { x: 20, y: 20 },
            red:    { x: 50, y: 20 },
            orange: { x: 80, y: 20 },
            pink:   { x: 20, y: 80 },
            blue:   { x: 50, y: 80 },
            cyan:   { x: 80, y: 80 },
          },
        },
        snake_dance: {
          pickToSlot: ['pink', 'orange', 'red', 'blue', 'cyan', 'yellow'],
          positions: {
            red:    { x: 20, y: 20 },
            yellow: { x: 50, y: 20 },
            orange: { x: 80, y: 20 },
            blue:   { x: 20, y: 80 },
            cyan:   { x: 50, y: 80 },
            pink:   { x: 80, y: 80 },
          },
        },
      },
    },
    'default': {
      turnOrder: ['A', 'B', 'B', 'A', 'A', 'B'],
      defaultLayout: {
        pickToSlot: ['red', 'pink', 'blue', 'orange', 'yellow', 'cyan'],
        positions: {
          orange: { x: 20, y: 20 },
          yellow: { x: 50, y: 20 },
          red:    { x: 80, y: 20 },
          blue:   { x: 20, y: 80 },
          cyan:   { x: 50, y: 80 },
          pink:   { x: 80, y: 80 },
        },
      },
      mapLayouts: {
        kerlaugar: {
          pickToSlot: ['yellow', 'pink', 'cyan', 'orange', 'red', 'blue'],
          positions: {
            yellow: { x: 20, y: 20 },
            red:    { x: 50, y: 20 },
            orange: { x: 80, y: 20 },
            pink:   { x: 20, y: 80 },
            blue:   { x: 50, y: 80 },
            cyan:   { x: 80, y: 80 },
          },
        },
        snake_dance: {
          pickToSlot: ['red', 'blue', 'pink', 'orange', 'yellow', 'cyan'],
          positions: {
            red:    { x: 20, y: 20 },
            yellow: { x: 50, y: 20 },
            orange: { x: 80, y: 20 },
            blue:   { x: 20, y: 80 },
            cyan:   { x: 50, y: 80 },
            pink:   { x: 80, y: 80 },
          },
        },
      },
    },
  },
};
