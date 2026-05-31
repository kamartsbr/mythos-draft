---
name: mythos-map-asset-intake
description: Add or review Mythos Draft map assets, IDs, public file placement, map pools, player marker positions, i18n names, and MCL/FORJA preset inclusion. Use when the user provides map images or asks to update map pools for MCL Tiebreaker, MCL Playoffs, FORJA, or ranked maps.
---

# Mythos Map Asset Intake

Use this skill when adding maps or changing map pools.

## Workflow
1. Confirm official display name, stable map ID, and target pools.
2. Place images under `public/maps/...` with kebab-case filenames.
3. Register maps in `src/data/maps.ts` with explicit `positions`.
4. Add maps only to the requested pools; do not leak MCL Tiebreaker/Playoffs maps into Group Stage unless requested.
5. Verify map cards, draft board, streamer HUD, result cards, and replay references resolve the map.
6. Run TypeScript and focused E2E for map visibility and marker placement.

## Position Rules
- Use map-specific approximate positions when spawn layout differs from defaults.
- Preserve `playerId` identity. Positions are visual coordinates only.
