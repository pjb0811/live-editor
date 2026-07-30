---
'@jbpark/live-editor': minor
---

Add multi-select and bulk operations (duplicate, move up/down, delete) to `Panel/Items` and `Panel/Children`, resolving #34. Checkbox-select individual rows or shift-click for range-select; a bulk actions bar appears once anything is selected. Bulk delete/duplicate/move are implemented by generalizing the existing single-item mutation functions (`deleteItem`, `moveItem`, etc.) to operate on an index set rather than introducing a parallel code path.
