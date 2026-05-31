---
name: mythos-e2e-bot-qa
description: Run and interpret Mythos Draft headed Playwright bot tests against real Firestore, including MCL/FORJA preset matrix checks, UI-only actions, cleanup, report generation, and bug classification. Use when working on tests/e2e, Playwright, cross-browser draft sync, lobby creation/join, or QA reports.
---

# Mythos E2E Bot QA

Use this skill for real two-browser draft validation.

## Workflow
1. Ensure `VITE_VIBE_MODE` is not `DEVELOPMENT` and `VITE_E2E=true` is provided by the E2E server.
2. Prefer focused preset checks before the full matrix.
3. Drive UI controls only; do not write draft state directly from tests.
4. Clean up created lobbies through the E2E bridge/service path.
5. For failures, inspect `summary.md`, `summary.json`, screenshots, video, traces, console errors, page errors, and failed requests.
6. Classify every bug as UI, race, backend/Firestore, performance, harness, or security.

## Reporting Format
- Situation: what the bot was doing.
- How found: exact phase/game/turn/event evidence.
- Likely cause: product bug, backend contention, UI hitbox, or harness issue.
- Solution: concrete next fix or monitoring recommendation.
