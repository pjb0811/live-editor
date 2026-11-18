---
'@jbpark/live-editor': minor
---

Add `Live.Dnd`'s `renderPaletteOverlay`, which draws the card that follows the pointer while a palette item is dragged. A custom palette's items no longer turn into the built-in card once picked up. Returning `undefined` keeps the built-in card.
