---
name: mythos-firestore-guardian
description: Review Mythos Draft Firebase and Firestore changes for schema compatibility, auth/rules safety, timestamp correctness, merge semantics, cleanup risk, and production real-database E2E behavior. Use when work touches src/services, firestore.rules, Firebase auth, lobby persistence, forja collections, cleanup, or test lobbies.
---

# Mythos Firestore Guardian

Use this skill before editing or reviewing Firebase/Firestore-backed code in Mythos Draft.

## Workflow
1. Identify collections, documents, and fields touched by the change.
2. Compare writes with `firestore.rules` and existing service patterns.
3. Confirm writes use `serverTimestamp()` for production timestamps.
4. Confirm upserts preserve `setDoc(..., { merge: true })` where existing data must survive.
5. Confirm cleanup/delete paths are scoped to creator/admin-owned test or target data.
6. Confirm public/client-created documents have bounded schemas in rules.
7. Report Firestore impact, security impact, read/write economy impact, and rollback risk.

## Hard Rules
- Do not introduce schema migration unless the user explicitly requests it.
- Prefer additive optional fields with defaults for old lobbies.
- Do not use local mock mode for real cross-browser sync validation.
- Do not log secrets, tokens, Discord auth payloads, or private profile data.
- Do not rely on Firestore rules to protect Admin SDK Cloud Function writes; callable/onRequest functions need explicit authorization checks.
