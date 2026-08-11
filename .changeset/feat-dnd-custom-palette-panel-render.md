---
'@jbpark/live-editor': minor
---

Added renderPalette/renderPanel props to Dnd, letting consumers fully replace the built-in left component-palette and right property-panel with custom markup while drag-and-drop and field editing keep working. Also exported DraggableItem (Dnd.DraggableItem), a children-render-prop component that owns the drag wiring for custom palette items.
