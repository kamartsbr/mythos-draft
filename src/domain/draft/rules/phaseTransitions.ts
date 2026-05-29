import type { DraftPhase, DraftTurn, TeamSize } from '../../../types';

type DraftTurnTarget = DraftTurn['target'];
type DraftTurnAction = DraftTurn['action'];

export type DraftTransitionKey =
  | 'map-ban'
  | 'map-pick'
  | 'god-ban'
  | 'god-pick'
  | 'solo-draft-complete'
  | 'team-draft-complete';

export const DRAFT_PHASE_TRANSITIONS: Record<DraftTransitionKey, DraftPhase> = {
  'map-ban': 'map_ban',
  'map-pick': 'map_pick',
  'god-ban': 'god_ban',
  'god-pick': 'god_pick',
  'solo-draft-complete': 'ready_picker',
  'team-draft-complete': 'post_draft',
};

const TURN_PHASE_BY_TARGET: Record<DraftTurnTarget, Partial<Record<DraftTurnAction, DraftPhase>>> = {
  MAP: {
    BAN: DRAFT_PHASE_TRANSITIONS['map-ban'],
    PICK: DRAFT_PHASE_TRANSITIONS['map-pick'],
  },
  GOD: {
    BAN: DRAFT_PHASE_TRANSITIONS['god-ban'],
    PICK: DRAFT_PHASE_TRANSITIONS['god-pick'],
    SNIPE: DRAFT_PHASE_TRANSITIONS['god-pick'],
    STEAL: DRAFT_PHASE_TRANSITIONS['god-pick'],
    REVEAL: DRAFT_PHASE_TRANSITIONS['god-pick'],
  },
};

export function phaseForDraftTurn(turn: DraftTurn | null | undefined): DraftPhase | null {
  if (!turn) return null;
  return TURN_PHASE_BY_TARGET[turn.target]?.[turn.action] ?? null;
}

export function phaseAfterDraftQueue(turnOrder: DraftTurn[], nextTurnIndex: number, teamSize: TeamSize): DraftPhase {
  const nextTurn = turnOrder[nextTurnIndex];
  const turnPhase = phaseForDraftTurn(nextTurn);

  if (turnPhase) return turnPhase;

  return teamSize === 1
    ? DRAFT_PHASE_TRANSITIONS['solo-draft-complete']
    : DRAFT_PHASE_TRANSITIONS['team-draft-complete'];
}
