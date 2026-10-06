---
'@jbpark/live-editor': patch
---

Draw the element outline inside the canvas instead of on top of the whole page. The outline shows which element a panel field edits, or which one the element picker points at. It used to be portaled to `document.body` with the highest possible `z-index`, so on a phone it appeared above the panel Drawer that covers the canvas, and above any host modal. It now sits in the canvas's scroll container, under anything that covers the canvas, and it scrolls and clips with it.
