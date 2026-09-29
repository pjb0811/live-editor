---
'@jbpark/live-editor': patch
---

Fix `Live.Dnd` dropping an edit when two commits happen in the same tick. Every commit used to start from the document of the last render, so a second commit made before the host handed the new value back wrote the first one's change back out. That covered two `PanelBinding.onChange` calls in a row, two `onNodeChange` calls, or a binding edit next to a section move, add, copy or delete. Each commit now builds on the one before it. Once the next render arrives, the `value` it hands in is the source of truth again, so a commit the host didn't accept isn't carried forward.
