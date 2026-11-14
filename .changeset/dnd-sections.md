---
'@jbpark/live-editor': minor
---

Add `useDndSections()` and `Live.Dnd`'s `onSelectionChange`. The hook lists the document's sections and can select, move, duplicate or delete any of them, selected or not, so a host can build its own outline, layers list or menu. `onSelectionChange` reports the selected section, or `null`, whenever the selection changes.
