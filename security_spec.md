# Firestore Security Specification

This document outlines the data invariants and security payloads for the Mythos Draft application.

## Data Invariants

1. **Lobbies**:
   - Must have a unique ID matching the document ID.
   - Must have a valid status (`waiting`, `drafting`, `finished`).
   - Timestamps (`createdAt`, `lastActivityAt`) must be server-generated.
   - Public lobbies must be searchable by anyone.
   - Private lobbies should only be accessible if you know the ID (though Firestore rules can't hide IDs once you have them, we can restrict listing).

2. **Messages**:
   - Must belong to a valid lobby.
   - `senderId` must match the authenticated user.
   - Implied relationship: Only users who can read the lobby can read its messages.

3. **Presets**:
   - Read-only for most users.
   - Only admins can create/update presets.

4. **Users**:
   - Users can only manage their own profiles.
   - `role` cannot be set by the user (must be set by admin).

## The Dirty Dozen Payloads (Deny Test Cases)

1. **Identity Spoofing**: Create a lobby with `captain1` set to another user's UID.
2. **Resource Poisoning**: Create a lobby with a 1MB string for the `id`.
3. **State Shortcutting**: Update a lobby status from `waiting` to `finished` directly.
4. **PII Leak**: Non-admin attempting to read all user profiles.
5. **Unauthorized Preset**: Non-admin attempting to create a preset.
6. **Message Hijack**: Creating a message with someone else's `senderId`.
7. **Orphaned Write**: Creating a message for a lobby that doesn't exist.
8. **Shadow Field**: Adding `isAdmin: true` to a lobby document.
9. **Timestamp Manipulation**: Sending a client-side date for `createdAt`.
10. **Admin Elevation**: User trying to update their own `role` to 'admin'.
11. **Query Scraping**: Attempting to list all private lobbies.
12. **ID Injection**: Using a document ID containing malicious characters (e.g., `../`).

## Test Runner (Draft)

We will verify these in the rules logic.
