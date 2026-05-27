# Services Agent Guide

Scope: `src/services/` and Firebase/Firestore service logic.

## Firestore Rules
- Use `serverTimestamp()` for production write timestamps; do not introduce `new Date()` for persisted timestamps.
- For `forja_players` and other profile/content upserts, preserve `setDoc(..., { merge: true })` semantics.
- Preserve transaction boundaries for draft state mutation; do not replace safe transactions with plain writes.
- Keep replay/history arrays chronological and append-safe.
- Do not log secrets, tokens, private auth payloads, or full user profiles to console.

## Review Checklist
- Confirm every write path is authorized by current `firestore.rules`.
- Confirm cleanup/delete operations can only target intended lobbies/docs.
- Confirm failures return actionable errors without leaking sensitive data.
