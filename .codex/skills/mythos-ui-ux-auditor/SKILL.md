---
name: mythos-ui-ux-auditor
description: Audit Mythos Draft React UI for overlap, hitbox, hover, disabled-state, responsive layout, accessibility, i18n fallback, and visual/state consistency issues. Use when changing src/components, draft board UI, lobby creation, join modal, map/god cards, player target buttons, or Tailwind layouts.
---

# Mythos UI UX Auditor

Use this skill when reviewing UI changes.

## Workflow
1. Identify user actions and visible controls touched by the change.
2. Check enabled/disabled states, loading states, hover states, and modal overlays.
3. Confirm hover/preview markers appear only for the active pick/slot.
4. Confirm roster names, map names, god names, and scores render from immutable state.
5. Check responsive layout and avoid long vertical scroll when horizontal grid/flex is better.
6. Verify new text uses i18n keys or safe fallbacks.

## E2E Signals
- Visible but unclickable buttons usually indicate overlay, animation, or hitbox problems.
- Duplicate hover markers usually indicate leaked preview state.
- Missing roster names usually indicate wrong slot-to-roster mapping.
