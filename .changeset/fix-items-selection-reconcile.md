---
'@jbpark/live-editor': patch
---

Fix per-item delete/move in the array editor leaving a stale multi-select set

The multi-select set holds positional indices. Bulk operations re-synced it after
mutating the array, but the per-item delete/move buttons did not — and removing or
moving an item shifts the positions of the items after it. An active selection
silently ended up pointing at different items than the user picked, so a later bulk
action targeted the wrong elements. The four single-item handlers (`deletePrimitive`,
`deleteItem`, `movePrimitive`, `moveItem`) now clear the selection after they mutate,
matching what the bulk delete already does.
