import { describe, it, expect, vi } from 'vitest';
import { resolveDraftPick } from '../resolveDraftPick';
import { MCL_FORMAT } from '../../formats/mcl.format';
import { PickEntry } from '../../../../types';

describe('resolveDraftPick - MCL Format Rules', () => {
  const mockPick = (playerId: number, team: 'A' | 'B'): PickEntry => ({
    playerId,
    team,
    godId: null,
    color: '',
    position: 'corner',
    playerName: `P${playerId}`,
  });

  describe('DEFAULT Game 1', () => {
    it('resolves red right top for pickIndex 0', () => {
      const pick = mockPick(1, 'A');
      const resolved = resolveDraftPick({ pick, pickIndex: 0, format: MCL_FORMAT, mapId: null, gameNumber: 1 });
      
      expect(resolved.slotId).toBe('red');
      expect(resolved.colorName).toBe('red');
      expect(resolved.lane).toBe('right');
      expect(resolved.mapX).toBe(80);
      expect(resolved.mapY).toBe(20);
      expect(resolved.team).toBe('A');
    });

    it('resolves pink right bottom for pickIndex 1', () => {
      const pick = mockPick(2, 'B');
      const resolved = resolveDraftPick({ pick, pickIndex: 1, format: MCL_FORMAT, mapId: null, gameNumber: 1 });
      
      expect(resolved.slotId).toBe('pink');
      expect(resolved.lane).toBe('right');
      expect(resolved.mapX).toBe(80);
      expect(resolved.mapY).toBe(80);
    });

    it('resolves blue left bottom for pickIndex 2', () => {
      const pick = mockPick(3, 'B');
      const resolved = resolveDraftPick({ pick, pickIndex: 2, format: MCL_FORMAT, mapId: null, gameNumber: 1 });
      
      expect(resolved.slotId).toBe('blue');
      expect(resolved.lane).toBe('left');
      expect(resolved.mapX).toBe(20);
      expect(resolved.mapY).toBe(80);
    });

    it('resolves yellow center top for pickIndex 4', () => {
      const pick = mockPick(5, 'A');
      const resolved = resolveDraftPick({ pick, pickIndex: 4, format: MCL_FORMAT, mapId: null, gameNumber: 1 });
      
      expect(resolved.slotId).toBe('yellow');
      expect(resolved.lane).toBe('center');
      expect(resolved.mapX).toBe(50);
      expect(resolved.mapY).toBe(20);
    });
  });

  describe('DEFAULT Game 2', () => {
    it('resolves blue left bottom for pickIndex 0 (Game 2 starting guest)', () => {
      const pick = mockPick(3, 'B'); // In game 2, B picks first
      const resolved = resolveDraftPick({ pick, pickIndex: 0, format: MCL_FORMAT, mapId: null, gameNumber: 2 });
      
      expect(resolved.slotId).toBe('blue');
      expect(resolved.lane).toBe('left');
      expect(resolved.team).toBe('B');
    });

    it('resolves yellow center top for pickIndex 5 (Game 2 last pick host)', () => {
      const pick = mockPick(5, 'A');
      const resolved = resolveDraftPick({ pick, pickIndex: 5, format: MCL_FORMAT, mapId: null, gameNumber: 2 });
      
      expect(resolved.slotId).toBe('yellow');
      expect(resolved.lane).toBe('center');
      expect(resolved.team).toBe('A');
    });
  });

  describe('KERLAUGAR Game 1', () => {
    it('resolves yellow left top for pickIndex 0', () => {
      const pick = mockPick(1, 'A');
      const resolved = resolveDraftPick({ pick, pickIndex: 0, format: MCL_FORMAT, mapId: 'kerlaugar', gameNumber: 1 });
      
      expect(resolved.slotId).toBe('yellow');
      expect(resolved.lane).toBe('left');
      expect(resolved.mapX).toBe(20);
    });

    it('resolves red center top for pickIndex 4', () => {
      const pick = mockPick(5, 'A');
      const resolved = resolveDraftPick({ pick, pickIndex: 4, format: MCL_FORMAT, mapId: 'kerlaugar', gameNumber: 1 });
      
      expect(resolved.slotId).toBe('red');
      expect(resolved.lane).toBe('center');
      expect(resolved.mapX).toBe(50);
    });
  });

  describe('SNAKE_DANCE Game 1', () => {
    it('resolves blue left bottom for pickIndex 1', () => {
      const pick = mockPick(2, 'B');
      const resolved = resolveDraftPick({ pick, pickIndex: 1, format: MCL_FORMAT, mapId: 'snake_dance', gameNumber: 1 });
      
      expect(resolved.slotId).toBe('blue');
      expect(resolved.lane).toBe('left'); // Blue is left in Snake Dance!
      expect(resolved.mapX).toBe(20);
    });

    it('resolves pink right bottom for pickIndex 2', () => {
      const pick = mockPick(3, 'B');
      const resolved = resolveDraftPick({ pick, pickIndex: 2, format: MCL_FORMAT, mapId: 'snake_dance', gameNumber: 1 });
      
      expect(resolved.slotId).toBe('pink');
      expect(resolved.lane).toBe('right'); // Pink is right in Snake Dance!
      expect(resolved.mapX).toBe(80);
    });
  });

  describe('Invalid Format Protection', () => {
    it('warns when a slot team does not match the expected turn team', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const invalidFormat = {
        ...MCL_FORMAT,
        games: {
          1: {
            turnOrder: ['A', 'A', 'A'], // A always picks
            defaultLayout: {
              pickToSlot: ['pink', 'blue', 'cyan'], // B slots
              positions: {
                pink: { x: 0, y: 0 },
                blue: { x: 0, y: 0 },
                cyan: { x: 0, y: 0 },
              }
            }
          }
        }
      };

      const pick = mockPick(1, 'A');
      resolveDraftPick({ pick, pickIndex: 0, format: invalidFormat as any, mapId: null, gameNumber: 1 });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Format validation failed: pickIndex 0 expected team A but got slot pink with team B')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Legacy fallback', () => {
    it('derives pickIndex from playerId using playerIdToPickIndex', () => {
      const pick = mockPick(5, 'A'); // playerId 5 is pickIndex 4 in game 1
      const resolved = resolveDraftPick({ pick, format: MCL_FORMAT, mapId: null, gameNumber: 1 });
      
      expect(resolved.pickIndex).toBe(4);
      expect(resolved.slotId).toBe('yellow');
    });
  });
});
