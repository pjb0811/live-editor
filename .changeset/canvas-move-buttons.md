---
'@jbpark/live-editor': minor
---

Add move up and move down buttons to the selected section on the `Live.Dnd` canvas, next to duplicate and delete. They make the same move as the panel's buttons, so a section can be reordered without a drag right where it's selected, including with a custom panel that has no move controls. Move up is disabled on the first section and move down on the last. When a move takes the section to either end, focus moves to the section instead of the now-disabled button. The canvas's duplicate and delete buttons, which had no accessible name, are now labeled "Duplicate section" and "Delete section".
