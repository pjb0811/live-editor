---
'@jbpark/live-editor': patch
---

Fix `useDndItems` dropping an edit when two edits to the same array happen in the same tick. Every edit computed the next array from the one the last render passed in, so a second `add()`, a second item property edit, or any structural action right after another one overwrote the first. Each edit now builds on the one before it. That includes the item ids and the selection, so two `add()` calls in a row give two new items, each with its own id. An item edited after a same-tick move is still the item that was edited, not whatever took its old position. Editing an item removed earlier in the same tick does nothing. Once the next render arrives, the value it passes in is the source of truth again, so an edit the host didn't accept isn't carried forward.
