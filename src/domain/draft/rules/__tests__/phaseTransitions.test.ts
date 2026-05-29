import { describe, expect, it } from 'vitest';
import { phaseAfterDraftQueue, phaseForDraftTurn } from '../phaseTransitions';
import type { DraftTurn } from '../../../../types';

const turn = (action: DraftTurn['action'], target: DraftTurn['target']): DraftTurn => ({
  player: 'A',
  action,
  target,
  modifier: target === 'MAP' ? 'GLOBAL' : 'EXCLUSIVE',
  execution: 'NORMAL',
});

describe('draft phase transition table', () => {
  it('maps the next draft turn to the public phase', () => {
    expect(phaseForDraftTurn(turn('BAN', 'MAP'))).toBe('map_ban');
    expect(phaseForDraftTurn(turn('PICK', 'MAP'))).toBe('map_pick');
    expect(phaseForDraftTurn(turn('BAN', 'GOD'))).toBe('god_ban');
    expect(phaseForDraftTurn(turn('PICK', 'GOD'))).toBe('god_pick');
  });

  it('moves exhausted 1v1 queues to ready_picker', () => {
    expect(phaseAfterDraftQueue([turn('PICK', 'GOD')], 1, 1)).toBe('ready_picker');
  });

  it('moves exhausted team queues to post_draft', () => {
    expect(phaseAfterDraftQueue([turn('PICK', 'GOD')], 1, 3)).toBe('post_draft');
  });
});
