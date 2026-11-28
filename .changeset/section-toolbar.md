---
'@jbpark/live-editor': minor
---

Add `renderSectionToolbar` to `Live.Dnd`, for your own buttons in the selected canvas section's toolbar in place of the built-in move, duplicate and delete buttons. It gets the section, its position, `canMoveUp`, `canMoveDown`, `readOnly`, and `moveUp`, `moveDown`, `duplicate` and `remove`, which work as the built-in buttons do, with `remove` going through `onBeforeDelete`. A press or click inside the toolbar never starts a drag or changes the selection, and the function may call hooks. The new types are `DndRenderSectionToolbar` and `DndSectionToolbarArgs`.
