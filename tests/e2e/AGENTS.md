# E2E Agent Guide

Scope: `tests/e2e/` Playwright bot tests and reports.

## Real Firestore E2E
- Do not run E2E bots with `VITE_VIBE_MODE=DEVELOPMENT`.
- Use real browser contexts and real Firestore-backed lobbies.
- Create private/hidden test lobbies and clean them up through creator-authenticated UI/service paths.
- Drive the UI only; do not mutate draft state directly from tests.

## Bug Reporting
- For every failure, report situation, evidence, likely cause, and proposed solution.
- Classify issues as UI, race condition, backend/Firestore, performance, harness, or security.
- Capture console errors, page errors, request failures, phase/game/turn, picks/bans/maps, replay length, screenshots/video/trace on failure.

## Test Scope
- Do not test every MCL round when only the fixed last map changes.
- Prefer focused coverage for buttons, player positioning, roster edits, hover behavior, draft order, and preset-specific edge cases.
