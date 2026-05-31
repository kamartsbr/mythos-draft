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

## Architecture Review Rules
- Preserve behavior before improving structure. Map current behavior, edge cases, public APIs, and hidden assumptions before refactoring.
- Search for duplicated or near-duplicated validation, state updates, calculations, permission checks, Firestore calls, UI state, and error handling before adding new logic.
- Keep responsibilities separated: UI renders and dispatches, hooks/controllers coordinate, services handle effects, domain modules protect pure draft rules, and data layers persist.
- Make state ownership explicit. Store one source of truth and derive names, selected objects, active actors, and visual order from IDs or immutable slot state.
- Prefer simple, explicit architecture over generic frameworks, clever factories, inheritance, or broad abstractions.
- Trace important values end to end from user input or Firestore read through validation, transformation, rendering, write, and recovery.
- Isolate hidden side effects. Functions that read/write Firestore, localStorage, timers, random state, events, or UI state must be named and reviewed as effectful.
- Protect invariants with types, checks, tests, or rules. Draft slot IDs are immutable; illegal picks/bans, duplicate assignments, wrong actor turns, and client-authoritative results are bugs.
- Use narrow domain types for phases, teams, roles, statuses, IDs, permissions, and state transitions instead of raw strings where feasible.
- Treat security as architecture: define trust boundaries, validate server-side, never rely on client-only authorization, keep secrets out of Vite/client logs, and rate-limit abuse paths.
- Fix algorithmic and architectural performance waste first: duplicate listeners, repeated Firestore reads, render-loop scans, high-frequency writes, large assets, and N+1 queries.
- Make errors explicit and recoverable. Do not swallow failures or fake success for writes that matter.
- Model complex draft/timer/turn flows as state machines with allowed transitions, guards, timeouts, reconnect behavior, and side effects.
- Keep pure draft logic separate from React, Firestore, storage, sound, timers, and random behavior so it can be tested directly.
- Add characterization tests around risky behavior before refactors, especially permissions, transitions, timers, serialization, duplicate prevention, and API contracts.
- Optimize for local reasoning: reduce broad shared state, giant functions, hidden globals, and deep call chains.
- Name code by domain intent, not implementation trivia.
- Avoid premature mega-refactors. Prefer staged work: map behavior, identify risks, add tests, extract pure logic, remove duplication, strengthen types, optimize, then rename/clean.

## Project Skills
For repeated work, consult the repo-local skills in `.codex/skills/`:
- `mythos-firestore-guardian`
- `mythos-draft-engine-guardian`
- `mythos-e2e-bot-qa`
- `mythos-ui-ux-auditor`
- `mythos-security-performance-auditor`
- `mythos-map-asset-intake`

Use [docs/AI_SYSTEM_INSTRUCTIONS.md](docs/AI_SYSTEM_INSTRUCTIONS.md) as the copyable system-instructions text for future AI sessions, and [docs/BRANCH_AUDIT_2026-05-28.md](docs/BRANCH_AUDIT_2026-05-28.md) for the current `feature/engine-rework-ux-polish` context and audit notes.
