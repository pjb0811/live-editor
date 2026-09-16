---
'@jbpark/live-editor': patch
---

Preserve original array positions and source during Items edits, including sparse slots, comments, formatting and untouched JSX. Move, remove and copy dense array elements through source spans; reject unsupported sparse/spread structural changes without committing or clearing selection.

Preserve serialized arrays through extraction and JSX write-back, retain nested expressions in copies, and reconcile bulk-move selection for mixed arrays.
