---
name: mythos-draft-engine-guardian
description: Review Mythos Draft engine changes for immutable slot IDs, MCL/FORJA/Tiebreaker turn order, map/god pick-ban legality, replay log chronology, reporting flow, and cross-preset side effects. Use when changing src/domain/draft, pureDraftEngine, useDraft, draftService, map pools, or lobby config that affects draft behavior.
---

# Mythos Draft Engine Guardian

Use this skill for any change that can alter draft state or turn flow.

## Workflow
1. Identify affected presets: MCL Group, MCL Playoffs, MCL Tiebreaker, FORJA, custom.
2. Verify slot IDs remain immutable; only player names/gods may change inside a slot.
3. Check turn order for Game 1, a middle game, and final game.
4. Check map bans, map picks, god bans, god picks, ready/report transitions, and next-game reset.
5. Verify replay log and history remain chronological.
6. State exact side effects prevented before finalizing.

## Red Flags
- Swapping `playerId` values.
- Mutating visual order in persisted state.
- Resetting bans/picks/history inconsistently between games.
- Fixing one preset by changing shared logic without checking the others.
