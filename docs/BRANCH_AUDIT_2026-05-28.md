# Branch Audit - feature/engine-rework-ux-polish

Date: 2026-05-28  
Branch: `feature/engine-rework-ux-polish`  
Base compared locally: `origin/main`

## Branch Context

Commits over `origin/main`:
- `f5efb68` - active draft UX layout, map pick confirmation, timeout roster name fixes, strategy map sizing constraints, first draft-domain format/visual modules.
- `0b134d2` - final draft flow, public metadata preview, repo-local Codex skills, Playwright bot E2E, MCL map assets, server/static metadata work.
- `c54baca` - prevents timed-out manual picks from randomizing.
- `30cbe3c` - major engine, cost, and performance fixes; cold Forja reads, public lobby metadata, player target tests, action ownership tests.
- `1f8bbb0` - removes empty AI synthesizer workflow.

High-impact branch changes:
- Adds `.codex/skills/*` guides and scoped `AGENTS.md` files.
- Adds MCL map images under `public/maps/mcl`.
- Adds domain draft modules under `src/domain/draft`.
- Adds bot E2E harness under `tests/e2e`.
- Moves Forja CMS/static reads toward one-shot cached reads instead of default `onSnapshot`.
- Adds public lobby/live-match metadata summaries to reduce lobby-list reads.

## Actions Applied In This Audit

- Added the 18 architecture review rules to root `AGENTS.md`.
- Added copyable future system instructions in `docs/AI_SYSTEM_INSTRUCTIONS.md`.
- Restricted `updateEloSnapshot` callable to authenticated Forja admins/owner in `functions/index.js`.
- Fixed `fetchAomProfileForPlayer` to use the callable `fetchaomprofile` instead of the stale HTTP GET path.
- Added bounded Firestore rules for `bug_reports`.
- Changed `BugReportModal` to report write failures explicitly and clamp submitted field sizes.
- Added pure draft phase-transition rules and characterization tests before changing broader engine architecture.
- Extracted shared AoM callable normalization for registration, add-player, and admin refresh paths.
- Added safe external URL and Discord avatar fallback helpers for the first Forja call sites.
- Added map/god lookup dictionaries and moved the heaviest draft render paths off repeated array scans.

## Skill Usage

Use these repo-local skills before risky work:
- `mythos-firestore-guardian`: Firestore schemas, rules, timestamps, cleanup, real database QA.
- `mythos-draft-engine-guardian`: draft state, turn order, slot identity, replay/history, MCL/FORJA side effects.
- `mythos-security-performance-auditor`: trust boundaries, expensive reads/listeners, assets, logs, abuse paths.
- `mythos-ui-ux-auditor`: layout, hitboxes, disabled state, hover previews, i18n, responsive draft UI.
- `mythos-e2e-bot-qa`: headed real-Firestore Playwright bot matrix and failure classification.
- `mythos-map-asset-intake`: map file placement, pool IDs, marker positions, result/OBS/replay references.

## Firebase Read Economy

Current improvements:
- Forja content/settings/map pool/schedule/team reads have one-shot cache paths in `forjaService.ts`.
- Public lobby list can use `metadata/lobby_index` instead of scanning many lobby docs.
- Forja live matches can use `forja_meta/live_matches_summary`.
- `updateEloSnapshot` batches player writes and only writes progress at start/end.

Remaining cost risks:
- `useForjaPlayers(isAdmin)` in `ForjaHome` makes admins subscribe to all players on the public home view. Use live players only where admin work genuinely needs real time.
- Non-updated callable profile fetch sites should use `src/features/forja/services/aomProfileService.ts`; registration, add-player, and admin refresh are now centralized on `us-central1`.
- `serverTime.ts` writes a per-user sync doc under `system/sync_{uid}`. Keep it rare and cached; do not call it from render-driven flows.
- Lobby participant updates still call `syncPublicMetadataForLobby`; that is correct for list correctness but should stay transaction-scoped and not be called from hover/high-frequency UI paths.

## Security

Fixed now:
- `updateEloSnapshot` had no server-side admin check. Any authenticated caller could trigger expensive external API reads and privileged Admin SDK writes.
- `bug_reports` had a client write path but no matching rules, and the UI swallowed failures.
- `fetchAomProfileForPlayer` used the old unauthenticated GET shape against a callable function.

Still important:
- `lobbies/{id}` rules allow participants/admins to update broad lobby fields. Draft results, phase, score, turn, picks, and timers are still largely client-authoritative. Stage a rules/schema hardening pass before exposing higher-stakes tournament results.
- Client UI still has admin fallbacks (`HARDCODED_ADMIN_IDS`, `VITE_FORJA_ADMIN_IDS`, `sessionStorage.mythos_admin`). Treat those as UI hints only; server code and Firestore rules must remain authoritative.
- `verifydiscordtoken` validates redirect URI and uses server-side code exchange, but it does not implement OAuth `state` or PKCE yet.
- External URLs from Firestore should be normalized through `toSafeExternalUrl`; the Forja home lobby/external-stream links are now covered.
- `handleFirestoreError` logs auth/provider metadata. Keep logs useful but avoid email/token/private profile leakage.

## Performance

Observed concerns:
- `public/mainmenubackground.mp4` is about 3.0 MB and `public/mythosdraftstreamerhudbackgroundv1.mp4` is about 2.2 MB. They are acceptable for intentional video surfaces but should stay lazy/conditional.
- `public/assets/sounds/ban.mp3` is about 1.15 MB, much larger than the other sound effects. Consider compression or a shorter asset.
- Shared `MAPS_BY_ID`/`MAJOR_GODS_BY_ID` dictionaries now exist; several render-heavy draft paths use them, but lower-priority screens still have remaining array scans.
- Large files still carry mixed UI/effect/domain logic, especially `src/services/lobbyService.ts`, `src/features/forja/services/forjaService.ts`, `src/App.tsx`, and `src/components/Lobby/LobbyCreation.tsx`.

## Assets And Links

Local public path check:
- MCL maps referenced by `src/data/maps.ts` exist under `public/maps/mcl`.
- Root map assets referenced by `src/data/maps.ts` exist in `public`.
- `/mainmenubackground.mp4`, `/mythosdraftstreamerhudbackgroundv1.mp4`, `/logo-forja.png`, `/mcl-logo.png`, `/mythosdraftmainpage.png`, and `/assets/sounds/*` exist.

Pathing risks:
- The app relies heavily on external Wikia/Wikimedia/Discord CDN images. Use `referrerPolicy="no-referrer"` consistently and keep local fallbacks for critical UI.
- `MapVisualizer` falls back to `https://picsum.photos/...`; that is visually unrelated and can hide broken map assets. Prefer a local Mythos placeholder.
- README still points clone instructions at `kamartsbr/MythosDraftv1.git`, not this repo.

## Infrastructure

Current shape:
- Vite + Express server (`server.ts`) with Firebase Hosting rewrites to `index.html`.
- Firestore named database: `mythosdraft-prod`.
- Cloud Functions v2 in `functions/index.js`, region `us-central1`.
- Firebase project: `boxwood-plating-368522`.

Infra risks:
- `functions/package.json` uses Node `24`; verify this against the deployed Firebase runtime before deploy.
- Callable functions and client code should consistently use `us-central1`.
- Hosting cache headers cover JS/CSS and index, but not media. Large videos/images may need explicit cache policy.
- Keep `.env` out of git; Firebase web API keys are public identifiers, but they should still be restricted in Google Cloud/Firebase settings.

## Duplicated Logic To Reduce Next

Good extraction candidates:
- Continue migrating lower-priority Discord/default avatar fallback call sites to `src/features/forja/utils/avatar.ts`.
- Effective ELO math appears outside `getEffectiveElo()`.
- Continue replacing loose external URL handling with `src/lib/safeExternalUrl.ts`.
- Timestamp/date parsing is repeated across Forja views and services.
- Player lookup by ID and map/god lookup by ID are repeated with array scans.
- MCL/FORJA roster fallback and slot-name assignment logic appears in multiple draft service paths.

Recommended staged order:
1. Add focused tests for bug report rules shape and admin snapshot authorization.
2. Continue migrating remaining avatar/link/god/map lookup call sites to shared helpers.
3. Harden lobby write rules in stages after characterizing current draft transitions.
4. Split the largest service/UI files by responsibility only after tests protect current behavior.
