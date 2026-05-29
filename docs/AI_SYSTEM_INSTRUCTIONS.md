# Mythos Draft AI System Instructions

Use this text at the top of future AI sessions for this repository.

```text
You are working on Mythos Draft, a production-connected React 19, TypeScript, Firebase/Firestore draft app inspired by AoE2 Captains Mode but targeting Age of Mythology: Retold.

Current target branch: feature/engine-rework-ux-polish.
Primary objective: evolve Mythos Draft into a better, safer, faster draft and tournament experience than aoe2cm.net while preserving existing production behavior.

Before changing code:
- Read AGENTS.md and the nearest scoped AGENTS.md.
- Read docs/AI_PROJECT_CONTEXT.md and docs/BRANCH_AUDIT_2026-05-28.md.
- Use repo-local skills in .codex/skills/ when touching Firestore, draft engine, E2E, UI/UX, security/performance, or map assets.

Engineering rules:
1. Preserve behavior before improving structure. Map current behavior, edge cases, assumptions, and public APIs before refactoring.
2. Look for duplicated logic in validation, state updates, calculations, permission checks, API calls, UI state, and error handling.
3. Separate UI, hooks/controllers, services, pure domain logic, persistence, validation, authorization, configuration, and side effects.
4. Make state ownership obvious. Store one source of truth and derive the rest from IDs or immutable state.
5. Prefer simple, explicit, boring architecture over clever abstractions.
6. Trace data flow end to end from input through validation, transformation, storage, rendering, and persistence.
7. Identify hidden side effects and isolate or rename effectful functions.
8. Protect invariants with types, guards, rules, assertions, or tests.
9. Use stricter types for IDs, phases, roles, permissions, statuses, teams, and state transitions.
10. Treat security as architecture. Validate server-side, never trust client authorization, protect secrets, avoid sensitive logs, and consider abuse/rate limits.
11. Fix architectural performance waste first: duplicate listeners, repeated reads, repeated renders, large payloads, expensive loops, and high-frequency writes.
12. Make errors explicit and recoverable. Do not swallow failures or pretend writes succeeded.
13. Use state-machine thinking for draft phases, timers, turns, permissions, reconnects, and multi-step flows.
14. Keep pure draft logic separate from React, Firestore, localStorage, timers, sound, random behavior, and network calls.
15. Add focused characterization tests before risky refactors.
16. Optimize for local reasoning. Prefer code that can be understood by reading one or two nearby files.
17. Make names reveal domain intent.
18. Avoid mega-refactors. Stage work as: map behavior, identify risks, add tests, extract pure logic, remove duplication, strengthen types, optimize, then clean naming.

Non-negotiable Mythos invariants:
- Draft slot IDs are immutable. Never swap a slot playerId to change visual order.
- Client UI may guide permissions but cannot be the authority for admin-only or game-result actions.
- Firestore production timestamps should use serverTimestamp(), except explicitly local/dev-only state.
- Forja upserts that must preserve existing profile/content fields should use merge writes.
- Real E2E uses real Firestore. Do not use VITE_VIBE_MODE=DEVELOPMENT for production QA.
- Report Firestore, draft engine, security, performance, and QA impact before finalizing code work.
```
