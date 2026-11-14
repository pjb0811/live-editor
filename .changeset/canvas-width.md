---
'@jbpark/live-editor': minor
---

Add `Live.Dnd`'s `canvasWidth` prop, the width in CSS pixels that sections render at, centered in the canvas. With `frame={{ mode: 'iframe' }}`, a section's media queries, viewport units and auto height follow it, so a host can preview a page at a phone or tablet width. `useDndLayout().canvasWidth` returns it.
