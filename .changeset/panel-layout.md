---
'@jbpark/live-editor': minor
---

The built-in panel no longer reads `meta` by itself. `Live.Dnd`'s new `panelLayout` takes the functions that decide which fields show (`isVisible`), which share a box (`groupOf`) and what describes each (`describe`), and `metaPanelLayout` from `@jbpark/live-editor/dnd` implements them with the `visible`, `group` and `description` keys. This is a change from 6.3.0, which read those keys by default: pass `panelLayout={metaPanelLayout}` to keep its descriptions, boxes and hidden fields. Without `panelLayout`, the panel draws what 6.2.0 drew. New exports: `metaPanelLayout` and the `DndPanelLayout` type.
