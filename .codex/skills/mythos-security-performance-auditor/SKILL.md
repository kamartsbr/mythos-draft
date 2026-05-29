---
name: mythos-security-performance-auditor
description: Audit Mythos Draft changes for security and performance risks, including Firebase auth assumptions, public environment exposure, Firestore rules/write amplification, listener leaks, transaction contention, React render loops, image size/loading, and E2E cleanup safety.
---

# Mythos Security Performance Auditor

Use this skill when the user worries about security, performance, or broken production behavior.

## Security Checklist
- Verify auth-dependent actions match `firestore.rules`.
- Verify callable functions enforce their own server-side authorization before Admin SDK writes.
- Treat UI admin flags, localStorage, sessionStorage, URLs, and client environment variables as untrusted hints.
- Avoid exposing secrets in Vite client env, logs, traces, or reports.
- Normalize external URLs through a helper that only allows `http:` and `https:`.
- Confirm private/hidden test lobbies are cleaned up.
- Confirm delete/cleanup paths cannot target unrelated production data.

## Performance Checklist
- Look for duplicate Firestore listeners and missing unsubscribe paths.
- Prefer cold cached reads for CMS/static Forja data; reserve `onSnapshot` for live draft/admin surfaces.
- Watch for repeated transaction contention or `failed-precondition` warnings.
- Check React effects for dependency loops or high-frequency writes.
- Check images for oversized assets, missing lazy loading, or repeated network fetches.
- Check repeated `MAPS.find` / `MAJOR_GODS.find` scans in render-heavy paths and suggest local dictionaries when useful.
- Prefer focused tests before full matrix runs to reduce live database load.

## Output
Report concrete risks, evidence, severity, and recommended fix order.
