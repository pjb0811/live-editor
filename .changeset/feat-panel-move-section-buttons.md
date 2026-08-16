---
'@jbpark/live-editor': minor
---

Add Move up/Move down buttons to the section properties panel, next to Delete. Dragging to reorder doesn't work from inside the mobile Components/Properties Drawer — the canvas sits behind it, so there's nothing visible to drag onto — so this gives an explicit alternative that works regardless of layout. Added a matching `onMoveUp`/`onMoveDown`/`canMoveUp`/`canMoveDown` on `PanelRenderData` for custom `renderPanel` implementations.

Also fixes a latent bug this surfaced: section `id`s are derived fresh from each section's position on every parse, not a stable identity, so reordering the selected section left `selectedId` pointing at whatever content ended up at its old position instead of following it. The new move buttons now correctly keep the moved section selected.
