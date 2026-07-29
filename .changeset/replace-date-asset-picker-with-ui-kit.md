---
'@jbpark/live-editor': minor
---

Replace the inline `date` and `asset-picker` binding field implementations with `@jbpark/ui-kit`'s `DatePicker` and `Upload` components (bumped `@jbpark/ui-kit` to `^3.2.0`). `asset-picker` now keeps the existing URL text input alongside a drag-and-drop `Upload` for local files, both writing to the same binding value. `icon-picker` is unchanged and stays a local implementation (`icon-map.ts` is still in active use).
