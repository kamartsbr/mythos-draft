# Draft Domain Agent Guide

Scope: `src/domain/draft/` and pure Draft Engine rules.

## Engine Invariants
- Slot IDs are immutable. Never exchange `playerId` between seats.
- Team/visual ordering must be derived, not persisted by mutating slot ownership.
- Turn order must remain deterministic for the same config, game number, and last winner.
- Replay log/history must stay chronological and must reflect the committed state.
- MCL, MCL Playoffs, MCL Tiebreaker, and FORJA rules must be reviewed independently for side effects.

## Required Checks
- Verify Game 1, middle game, and final game behavior for series changes.
- Verify map picks, god bans, god picks, reporting, and next-game reset.
- Verify non-exclusive picks allow legal cross-team duplicates but not illegal same-slot duplicates.
