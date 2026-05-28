# Components Agent Guide

Scope: `src/components/` React UI.

## UI Rules
- Components should dispatch actions and render state; do not embed heavy mutation logic in visual components.
- Use Tailwind/CSS layout for visual order. Do not reorder draft slots by mutating data.
- Add stable `data-testid` values for important E2E controls without changing visuals.
- Use i18n keys with safe fallbacks for new user-facing text.
- Check overlays, hover states, modals, disabled states, and hitboxes in headed E2E when changing draft UI.

## UX Review
- Confirm buttons are visible, enabled/disabled correctly, and not blocked by overlays.
- Confirm responsive layouts avoid unnecessary vertical scroll where horizontal grid/flex solves the layout.
- Confirm hover/preview state appears only for the active pick/slot.
