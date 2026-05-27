# Mythos Draft Agent Guide

Mythos Draft is a React 19, TypeScript, Firebase/Firestore draft app. Treat this repo as production-connected unless the user explicitly says otherwise.

## Non-Negotiables
- Do not use mock/local draft mode for real QA unless the user asks for mocks. Real E2E uses Firestore and must not run with `VITE_VIBE_MODE=DEVELOPMENT`.
- Do not break Firestore contracts or migrate schemas casually. Additive optional fields are acceptable only with safe fallbacks for existing lobbies.
- Draft slot IDs are immutable. Never swap a slot `playerId`; update player/god data only. Visual order belongs to CSS.
- Do not add new `any` or blind forced casts. Define exact types for Firestore shapes and app state.
- Keep heavy mutation logic out of React visual components. UI dispatches to hooks/services/domain logic and reacts to immutable state.

## Standard Validation
- Type check: `npx tsc --noEmit`
- Unit tests: `npm test`
- Focused MCL E2E: `npm run e2e:draft:mcl`
- Full bot matrix: `npm run e2e:draft:matrix`
- Install browsers once: `npm run e2e:install`

## Required Review Gate
Before finalizing code work, report:
- Firestore impact: collections/documents/fields touched and whether writes are additive.
- Draft Engine impact: turn order, slot identity, replay log, MCL/FORJA side effects.
- Security impact: auth assumptions, exposed data, rules or permission implications.
- Performance impact: listeners, transactions, render loops, image/loading size.
- QA evidence: commands run, exit codes, reports, and unresolved risks.

## Project Skills
For repeated work, consult the repo-local skills in `.codex/skills/`:
- `mythos-firestore-guardian`
- `mythos-draft-engine-guardian`
- `mythos-e2e-bot-qa`
- `mythos-ui-ux-auditor`
- `mythos-security-performance-auditor`
- `mythos-map-asset-intake`
